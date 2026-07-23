import { elevenLabsConfigured, geminiConfigured } from "../env.js";
import type { ProcessingJob } from "../types.js";

import { coarseAnalysis } from "./coarse-analysis.js";
import { scriptGeneration } from "./script-generation.js";
import { sourceValidation } from "./source-validation.js";
import { storyGeneration } from "./story-generation.js";
import { mediaProbe } from "./media-probe.js";
import { proxyGeneration } from "./proxy-generation.js";
import { voiceGeneration } from "./voice-generation.js";

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
 * Job types this worker can execute. Media handlers are always available.
 * `coarse_analysis` is only registered when an AI provider is configured
 * (GEMINI_API_KEY present) — otherwise the job stays queued and the pipeline
 * pauses at "understanding_gameplay" rather than failing. Story/voice/edit/
 * render handlers arrive in later phases.
 */
export const handlers: Partial<Record<ProcessingJob["job_type"], JobHandler>> = {
  source_validation: sourceValidation,
  media_probe: mediaProbe,
  proxy_generation: proxyGeneration,
  ...(geminiConfigured
    ? {
        coarse_analysis: coarseAnalysis,
        story_generation: storyGeneration,
        script_generation: scriptGeneration,
      }
    : {}),
  ...(elevenLabsConfigured ? { voice_generation: voiceGeneration } : {}),
};

export const supportedJobTypes = Object.keys(handlers);
