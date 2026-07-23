import { randomUUID } from "node:crypto";

import { env } from "./env.js";
import { handlers, supportedJobTypes, type JobContext } from "./jobs/index.js";
import { logger } from "./logger.js";
import {
  claimNextJob,
  completeJob,
  failJob,
  heartbeatJob,
  isProjectActive,
  startJob,
} from "./supabase.js";
import { JobError, type ProcessingJob } from "./types.js";

const workerId = `${env.workerName}-${randomUUID().slice(0, 8)}`;

let shuttingDown = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJob(job: ProcessingJob): Promise<void> {
  const handler = handlers[job.job_type];
  if (!handler) {
    // Should not happen — we only claim supported types.
    await failJob(job.id, workerId, {
      code: "UNSUPPORTED_JOB",
      message: "This worker cannot run this job type.",
      retryable: false,
      failProject: false,
    });
    return;
  }

  // The job must be running before any terminal transition: complete_job
  // and fail_job both require status = 'running', so starting first also
  // makes the project-inactive skip below actually terminate the job.
  await startJob(job.id, workerId);
  logger.info("job started", {
    job_id: job.id,
    job_type: job.job_type,
    project_id: job.project_id,
    attempt: job.attempt_count + 1,
  });

  // Skip work for projects that were cancelled/deleted mid-flight.
  if (!(await isProjectActive(job.project_id))) {
    await completeWithRetry(job, { skipped: "project_inactive" });
    logger.info("job skipped (project inactive)", {
      job_id: job.id,
      job_type: job.job_type,
    });
    return;
  }

  const ctx: JobContext = {
    heartbeat: (progress) => heartbeatJob(job.id, workerId, progress),
  };

  // Long steps (ffmpeg encodes, Gemini uploads/calls) can run far past the
  // lease without emitting progress. Renew the lease on a timer so the job
  // is not reclaimed — and run twice — while it is legitimately working.
  const leaseRenewal = setInterval(
    () => {
      void heartbeatJob(job.id, workerId).catch(() => {});
    },
    Math.max(30_000, (env.leaseSeconds * 1000) / 3),
  );

  try {
    const result = await handler(job, ctx);
    await completeWithRetry(job, result);
    logger.info("job succeeded", { job_id: job.id, job_type: job.job_type });
  } catch (error) {
    if (error instanceof JobError) {
      await failJob(job.id, workerId, {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        failProject: error.failProject,
      });
      logger.warn("job failed", {
        job_id: job.id,
        job_type: job.job_type,
        code: error.code,
        retryable: error.retryable,
      });
    } else {
      // Surface enough of the underlying error to diagnose (e.g. an AWS SDK
      // "UnknownError" from R2 usually carries an HTTP status like 403).
      const err = error as {
        name?: string;
        message?: string;
        $metadata?: { httpStatusCode?: number };
        Code?: string;
      };
      const message = err?.message ?? "unknown error";
      const errorName = err?.name ?? null;
      const httpStatus = err?.$metadata?.httpStatusCode ?? null;
      const providerCode = err?.Code ?? null;
      await failJob(job.id, workerId, {
        code: "WORKER_ERROR",
        message: "A processing step did not complete.",
        details: {
          reason: message,
          name: errorName,
          http_status: httpStatus,
          provider_code: providerCode,
        },
        retryable: true,
        failProject: true,
      });
      logger.error("job crashed", {
        job_id: job.id,
        job_type: job.job_type,
        reason: message,
        error_name: errorName,
        http_status: httpStatus,
        provider_code: providerCode,
      });
    }
  } finally {
    clearInterval(leaseRenewal);
  }
}

/**
 * Records success with retries. A transient DB blip while recording success
 * must not be treated as a job failure — the handler's work is done, and
 * calling failJob here would re-run it (duplicating AI spend and downstream
 * jobs). If recording keeps failing, leave the job leased: the lease expires
 * and the job is reclaimed, which is the least-wrong outcome.
 */
async function completeWithRetry(
  job: ProcessingJob,
  result: Record<string, unknown> | undefined,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await completeJob(job.id, workerId, result);
      return;
    } catch (error) {
      lastError = error;
      await sleep(2000 * (attempt + 1));
    }
  }
  logger.error("job result could not be recorded", {
    job_id: job.id,
    job_type: job.job_type,
    reason: lastError instanceof Error ? lastError.message : "unknown",
  });
}

async function loop(): Promise<void> {
  logger.info("worker started", {
    worker_id: workerId,
    supported: supportedJobTypes,
  });

  while (!shuttingDown) {
    let job: ProcessingJob | null = null;
    try {
      job = await claimNextJob(workerId, supportedJobTypes);
    } catch (error) {
      logger.error("claim failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      await sleep(env.pollIntervalMs);
      continue;
    }

    if (!job) {
      await sleep(env.pollIntervalMs);
      continue;
    }

    // A failure here (e.g. DB blip while completing) must not kill the loop.
    try {
      await runJob(job);
    } catch (error) {
      logger.error("job handling error", {
        job_id: job.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  logger.info("worker stopped", { worker_id: workerId });
}

function onShutdown(signal: string) {
  logger.info("shutdown requested", { signal });
  shuttingDown = true;
}

process.on("SIGTERM", () => onShutdown("SIGTERM"));
process.on("SIGINT", () => onShutdown("SIGINT"));

loop().catch((error) => {
  logger.error("worker fatal", {
    reason: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
