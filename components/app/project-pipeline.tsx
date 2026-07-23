import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { StageList, type Stage } from "@/components/ui/stage-list";
import { retryProjectJob } from "@/src/lib/actions/jobs";
import type {
  ProjectPipelineState,
  ProjectRow,
  UserJobRow,
} from "@/src/lib/supabase/database.types";

import { SectionHeader } from "./section-header";

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

function stagesFor(state: ProjectPipelineState): Stage[] {
  const currentIndex = semanticStages.findIndex((stage) =>
    stage.states.includes(state),
  );

  return semanticStages.map((stage, index) => ({
    label: stage.label,
    state:
      currentIndex === -1
        ? "upcoming"
        : index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "upcoming",
  }));
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

/** What each stage does + a rough sense of how long it takes, so the live
 * view sets the right expectation instead of feeling stuck. */
const stageHint: Partial<Record<ProjectPipelineState, string>> = {
  preparing:
    "Reading the recording and making a lightweight analysis copy. Scales with video length — often a few minutes.",
  understanding_gameplay:
    "The AI watches the match for chases, hooks, and turning points. Usually 1–4 minutes.",
  building_story:
    "Choosing the strongest angle and writing timestamp-aware narration. Usually under a minute.",
  generating_voice:
    "Recording the narration with the channel's voice. Roughly 10–30 seconds per line.",
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
    return `${hours}h ${minutes % 60}m`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Workspace view for a real project inside the processing pipeline
 * (Phase 3): semantic stages plus sanitized job state, with owner retry
 * for terminal failures.
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

  // Live elapsed timer for the current step (ticks once a second while a job
  // is actively running, so the view shows progress instead of feeling stuck).
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
  const hint = stageHint[project.pipeline_state] ?? null;

  const isFailed = project.pipeline_state === "failed";

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
      <div className="mx-auto max-w-2xl py-6">
        <h3 className="text-2xl font-semibold tracking-tight text-ink">
          Creator could not continue with this project
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink-secondary">
          {project.failure_message ??
            "A processing step did not complete. Completed work is preserved."}
        </p>

        <div className="mt-8 border-l-2 border-danger/60 pl-5">
          <h4 className="text-sm font-medium text-ink">What you can do</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-secondary">
            <li>Retry the failed step — completed work is kept.</li>
            <li>If it keeps failing, check the source recording.</li>
          </ul>
        </div>

        {error ? (
          <p className="mt-4 text-[13px] leading-5 text-danger">{error}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {failedJob ? (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => void retry(failedJob.id)}
            >
              {pending ? "Retrying…" : "Retry failed step"}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h3 className="text-2xl font-semibold tracking-tight text-ink">
        Creator is working on this video
      </h3>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        {activeJob?.current_activity ??
          (activeJob
            ? jobStatusCopy[activeJob.status]
            : "Waiting for the next step.")}
      </p>

      <div className="mt-8 border-t border-edge">
        <StageList stages={stagesFor(project.pipeline_state)} />
      </div>

      {hint ? (
        <p className="mt-3 text-xs leading-5 text-ink-muted">{hint}</p>
      ) : null}

      {activeJob ? (
        <section className="mt-8">
          <SectionHeader>Current step</SectionHeader>
          <div className="flex items-center justify-between gap-4 border-b border-edge py-3">
            <div>
              <p className="text-sm text-ink">
                {activeJob.current_activity ?? jobStatusCopy[activeJob.status]}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {activeJob.progress_stage ?? jobStatusCopy[activeJob.status]}
                {activeJob.attempt_count > 1
                  ? ` · attempt ${activeJob.attempt_count}`
                  : ""}
              </p>
            </div>
            <div className="text-right">
              {elapsedMs !== null ? (
                <span className="font-mono text-xs text-ink-secondary tabular-nums">
                  {formatElapsed(elapsedMs)}
                </span>
              ) : null}
              {activeJob.progress_percent !== null ? (
                <span className="mt-0.5 block font-mono text-xs text-ink-muted tabular-nums">
                  {activeJob.progress_percent}%
                </span>
              ) : null}
            </div>
          </div>
          {isProcessing ? (
            <p className="mt-2 text-xs text-ink-muted">
              Live — this page updates every few seconds while Creator works.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-muted">
        You can leave this page. Creator keeps working in the background and the
        project updates when you come back.
      </p>
    </div>
  );
}
