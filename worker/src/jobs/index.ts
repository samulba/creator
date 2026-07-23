import { elevenLabsConfigured, geminiConfigured } from "../env.js";
import type { ProcessingJob } from "../types.js";

import { coarseAnalysis } from "./coarse-analysis.js";
import { editPlanning } from "./edit-planning.js";
import { render } from "./render.js";
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
 * Job types this worker can execute. Media, edit-planning, and render handlers
 * are always available (FFmpeg only, no external key). The Gemini jobs are
 * registered only when GEMINI_API_KEY is set; voice only when ELEVENLABS_API_KEY
 * is set — otherwise those jobs stay queued and the pipeline pauses at the
 * matching stage rather than failing. Quality control arrives in Phase 10.
 */
export const handlers: Partial<Record<ProcessingJob["job_type"], JobHandler>> = {
  source_validation: sourceValidation,
  media_probe: mediaProbe,
  proxy_generation: proxyGeneration,
  edit_planning: editPlanning,
  render: render,
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
