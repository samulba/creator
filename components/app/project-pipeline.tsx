import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { StageList, type Stage } from "@/components/ui/stage-list";
import { retryProjectJob } from "@/src/lib/actions/jobs";
import type {
  JobType,
  ProjectPipelineState,
  ProjectRow,
  UserJobRow,
} from "@/src/lib/supabase/database.types";

/** Semantic stages in pipeline order (docs/PROCESSING_EXPERIENCE.md). */
const semanticStages: Array<{
  label: string;
  states: ProjectPipelineState[];
}> = [
  { label: "Gameplay uploaded", states: ["draft", "uploading"] },
  { label: "Preparing footage", states: ["preparing"] },
  { label: "Understanding gameplay", states: ["understanding_gameplay"] },
  { label: "Building the story", states: ["building_story"] },
  { label: "Generating voice", states: ["generating_voice"] },
  { label: "Building the edit", states: ["building_edit"] },
  { label: "Rendering", states: ["rendering"] },
  { label: "Quality check", states: ["checking_quality"] },
  { label: "Ready for review", states: ["ready_for_review", "approved"] },
];

function currentStageIndex(state: ProjectPipelineState): number {
  return semanticStages.findIndex((stage) => stage.states.includes(state));
}

/**
 * Which job types roll up into each semantic stage (by stage index). A stage's
 * real duration is the wall-clock span of its jobs: earliest start → latest
 * completion. Stage 0 (upload) and the terminal stage have no processing job.
 */
const stageJobTypes: Partial<Record<number, JobType[]>> = {
  1: ["source_validation", "media_probe", "proxy_generation"],
  2: ["coarse_analysis", "candidate_detection", "deep_analysis"],
  3: ["story_generation", "script_generation"],
  4: ["voice_generation"],
  5: ["edit_planning"],
  6: ["render"],
  7: ["quality_control"],
};

/**
 * Real wall-clock duration of a completed stage, in ms, or null if it can't be
 * derived yet. Never invented — only from persisted job start/finish times.
 */
function stageDurationMs(jobs: UserJobRow[], stageIndex: number): number | null {
  const types = stageJobTypes[stageIndex];
  if (!types) return null;
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const job of jobs) {
    if (!types.includes(job.job_type)) continue;
    if (job.status !== "succeeded" || !job.completed_at) continue;
    const startRaw = job.started_at ?? job.created_at;
    const start = startRaw ? Date.parse(startRaw) : NaN;
    const end = Date.parse(job.completed_at);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
    return null;
  }
  return maxEnd - minStart;
}

function stagesFor(
  state: ProjectPipelineState,
  jobs: UserJobRow[],
  currentDetail: string | null,
): Stage[] {
  const currentIndex = currentStageIndex(state);
  return semanticStages.map((stage, index) => {
    const stageState: Stage["state"] =
      currentIndex === -1
        ? "upcoming"
        : index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "upcoming";
    let detail: string | undefined;
    if (stageState === "done") {
      const ms = stageDurationMs(jobs, index);
      detail = ms !== null ? formatElapsed(ms) : undefined;
    } else if (stageState === "current" && currentDetail) {
      detail = currentDetail;
    }
    return { label: stage.label, state: stageState, detail };
  });
}

const jobStatusCopy: Record<UserJobRow["status"], string> = {
  queued: "Queued — waiting for a free worker",
  leased: "Picked up by a worker",
  running: "Working",
  retry_scheduled: "A step failed — Creator will retry automatically",
  succeeded: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** What each stage does + a rough sense of how long it takes. */
const stageHint: Partial<Record<ProjectPipelineState, string>> = {
  preparing:
    "Reading the recording and making a lightweight analysis copy. Scales with video length — often a few minutes.",
  understanding_gameplay:
    "The AI watches the match for chases, hooks, and turning points. Usually 1–4 minutes.",
  building_story:
    "Choosing the strongest angle and writing timestamp-aware narration. Usually under a minute.",
  generating_voice:
    "Recording the narration in the channel's voice. Roughly 10–30 seconds per line.",
  building_edit: "Planning the cut from the chosen moments. A few seconds.",
  rendering:
    "Cutting, mixing narration, and encoding the final video. Scales with length — often several minutes.",
  checking_quality: "Final technical and consistency checks.",
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `0:${String(seconds).padStart(2, "0")}`;
}

/**
 * Production console for a real project inside the pipeline: a live hero, a
 * prominent current-step card with elapsed time, and a connected stage
 * timeline. Terminal failures offer an owner retry.
 */
export function ProjectPipeline({
  project,
  jobs,
  onRefresh,
}: {
  project: ProjectRow;
  jobs: UserJobRow[];
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeJob =
    jobs.find((job) =>
      ["running", "leased", "queued", "retry_scheduled"].includes(job.status),
    ) ??
    jobs.find((job) => job.status === "failed") ??
    null;

  const isProcessing =
    activeJob !== null && ["running", "leased"].includes(activeJob.status);

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isProcessing, activeJob?.id]);

  const startedAtMs = activeJob?.started_at
    ? Date.parse(activeJob.started_at)
    : null;
  const elapsedMs =
    isProcessing && now > 0 && startedAtMs !== null ? now - startedAtMs : null;
  const elapsed = elapsedMs !== null ? formatElapsed(elapsedMs) : null;

  const hint = stageHint[project.pipeline_state] ?? null;
  const stageIndex = currentStageIndex(project.pipeline_state);
  const stageLabel = semanticStages[stageIndex]?.label ?? "Processing";
  const isFailed = project.pipeline_state === "failed";

  // Approximate overall progress: how many named stages are behind us. Honest
  // (derived from real stage position), and clearly labelled as approximate.
  const totalStages = semanticStages.length;
  const overallPercent =
    stageIndex >= 0
      ? Math.round((stageIndex / (totalStages - 1)) * 100)
      : null;
  const stepNumber = stageIndex >= 0 ? Math.min(stageIndex + 1, totalStages) : null;

  const retry = async (jobId: string) => {
    setPending(true);
    setError(null);
    try {
      const result = await retryProjectJob(jobId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onRefresh();
    } finally {
      setPending(false);
    }
  };

  if (isFailed) {
    const failedJob = jobs.find((job) => job.status === "failed") ?? null;

    return (
      <div className="mx-auto w-full max-w-2xl py-4">
        <StatusBadge tone="danger" label="Needs attention" />
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          Creator couldn&rsquo;t finish this video
        </h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">
          {project.failure_message ??
            "A processing step did not complete. Completed work is preserved, so a retry picks up where it stopped."}
        </p>

        <div className="panel mt-8 p-5 sm:p-6">
          <p className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">
            What you can do
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-secondary">
            <li>Retry the failed step — completed work is kept.</li>
            <li>
              If it keeps failing, check the source recording and try again.
            </li>
          </ul>
          {error ? (
            <p className="mt-4 text-[13px] leading-5 text-danger">{error}</p>
          ) : null}
          {failedJob ? (
            <div className="mt-5">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => void retry(failedJob.id)}
              >
                {pending ? "Retrying…" : "Retry failed step"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ambient animate-fade-up relative mx-auto w-full max-w-2xl py-4">
      {/* Hero */}
      <div className="relative z-10">
        <StatusBadge tone="info" label={stageLabel} pulse={isProcessing} />
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          Creator is producing your video
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          {activeJob?.current_activity ??
            (activeJob
              ? jobStatusCopy[activeJob.status]
              : "Waiting for the next step.")}
        </p>

        {/* Approximate overall progress across the named stages */}
        {overallPercent !== null ? (
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-ink-muted uppercase">
              <span>Overall progress</span>
              <span className="tabular font-mono text-ink-secondary normal-case">
                ~{overallPercent}%
                {stepNumber ? ` · step ${stepNumber} of ${totalStages}` : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(overallPercent, 3)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Live current-step card */}
      {activeJob ? (
        <div className="panel relative z-10 mt-7 overflow-hidden">
          <div className="relative h-1 overflow-hidden bg-edge">
            {isProcessing && activeJob.progress_percent !== null ? (
              // A real numeric percent for this step (e.g. render clip i/N).
              <div
                className="h-full bg-info transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(activeJob.progress_percent, 2)}%` }}
              />
            ) : isProcessing ? (
              <div className="sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-info to-transparent" />
            ) : (
              <div className="h-full w-full bg-info/30" />
            )}
          </div>
          <div className="flex items-start justify-between gap-6 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">
                Current step
              </p>
              <p className="mt-2 text-base font-medium text-ink">
                {activeJob.current_activity ?? jobStatusCopy[activeJob.status]}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {activeJob.progress_stage ?? jobStatusCopy[activeJob.status]}
                {activeJob.progress_percent !== null
                  ? ` · ${activeJob.progress_percent}% of this step`
                  : ""}
                {activeJob.attempt_count > 1
                  ? ` · attempt ${activeJob.attempt_count}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {elapsed ? (
                <p className="tabular font-mono text-2xl font-semibold text-ink">
                  {elapsed}
                </p>
              ) : activeJob.progress_percent !== null ? (
                <p className="tabular font-mono text-2xl font-semibold text-ink">
                  {activeJob.progress_percent}%
                </p>
              ) : (
                <p className="font-mono text-2xl font-semibold text-ink-muted">
                  —
                </p>
              )}
              <p className="mt-0.5 text-[11px] font-medium tracking-wider text-ink-muted uppercase">
                {elapsed ? "Elapsed" : "Status"}
              </p>
            </div>
          </div>
          {hint ? (
            <p className="border-t border-edge px-5 py-4 text-xs leading-5 text-ink-secondary sm:px-6">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Timeline */}
      <div className="panel relative z-10 mt-6 p-5 sm:p-6">
        <p className="mb-5 text-[11px] font-medium tracking-wider text-ink-muted uppercase">
          Production timeline
        </p>
        <StageList stages={stagesFor(project.pipeline_state, jobs, elapsed)} />
      </div>

      <p className="relative z-10 mt-6 flex items-center gap-2 text-xs text-ink-muted">
        {isProcessing ? (
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
        ) : null}
        You can leave this page — Creator keeps working in the background and
        the project updates when you come back.
      </p>
    </div>
  );
}
