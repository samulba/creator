import { useState } from "react";

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
  queued:
    "Queued — waiting for a processing worker (workers arrive in Phase 4)",
  leased: "Picked up by a worker",
  running: "Working",
  retry_scheduled: "A step failed — Creator will retry automatically",
  succeeded: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

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

      {activeJob ? (
        <section className="mt-8">
          <SectionHeader>Current step</SectionHeader>
          <div className="flex items-center justify-between gap-4 border-b border-edge py-3">
            <div>
              <p className="text-sm text-ink">
                {jobStatusCopy[activeJob.status]}
              </p>
              {activeJob.progress_stage ? (
                <p className="mt-1 text-xs text-ink-muted">
                  {activeJob.progress_stage}
                </p>
              ) : null}
            </div>
            {activeJob.progress_percent !== null ? (
              <span className="tabular font-mono text-xs text-ink-secondary">
                {activeJob.progress_percent}%
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-muted">
        You can leave this page. Creator keeps working in the background and the
        project updates when you come back.
      </p>
    </div>
  );
}
