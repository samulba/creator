import type { ProcessingJob } from "../types.js";

import { sourceValidation } from "./source-validation.js";
import { mediaProbe } from "./media-probe.js";
import { proxyGeneration } from "./proxy-generation.js";

export type JobContext = {
  heartbeat: (progress: {
    percent?: number | null;
    stage?: string | null;
    activity?: string | null;
  }) => Promise<void>;
};

export type JobHandler = (
  job: ProcessingJob,
  ctx: JobContext,
) => Promise<Record<string, unknown>>;

/**
 * Job types this worker can execute. Analysis/story/voice/edit/render
 * handlers arrive in later phases — until then those jobs stay queued.
 */
export const handlers: Partial<Record<ProcessingJob["job_type"], JobHandler>> = {
  source_validation: sourceValidation,
  media_probe: mediaProbe,
  proxy_generation: proxyGeneration,
};

export const supportedJobTypes = Object.keys(handlers);
