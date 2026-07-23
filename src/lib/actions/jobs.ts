"use server";

import { revalidatePath } from "next/cache";

import {
  failure,
  isUuid,
  requireActionContext,
  type ActionResult,
} from "./shared";

/**
 * Owner-initiated retry of a terminally failed job. Ownership and state
 * validation happen inside the retry_job RPC (migration 004).
 */
export async function retryProjectJob(jobId: string): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(jobId)) return failure("Invalid job id.");

  const { error } = await context.supabase.rpc("retry_job", {
    p_job_id: jobId,
  });

  if (error) {
    return failure(
      error.message.includes("only failed jobs")
        ? "Only failed steps can be retried."
        : "The step could not be retried.",
    );
  }

  revalidatePath("/app");
  return { ok: true };
}
