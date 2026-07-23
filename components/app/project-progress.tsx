import { StageList, type Stage } from "@/components/ui/stage-list";

/**
 * Shared progress view for projects that are processing or rendering.
 * Semantic stages only — no fake percentages.
 */
export function ProjectProgress({
  heading,
  description,
  stages,
}: {
  heading: string;
  description: string;
  stages: Stage[];
}) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h3 className="text-2xl font-semibold tracking-tight text-ink">
        {heading}
      </h3>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">{description}</p>
      <div className="mt-8 border-t border-edge">
        <StageList stages={stages} />
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        You can leave this page. Creator keeps working in the background and the
        project updates when you come back.
      </p>
    </div>
  );
}

export const processingStages: Stage[] = [
  { label: "Footage prepared", state: "done" },
  { label: "Match structure understood", state: "done" },
  { label: "Finding important moments", state: "current" },
  { label: "Shape the story", state: "upcoming" },
  { label: "Write narration", state: "upcoming" },
  { label: "Assemble the edit", state: "upcoming" },
  { label: "Render final video", state: "upcoming" },
];

export const renderingStages: Stage[] = [
  { label: "Story approved", state: "done" },
  { label: "Narration prepared", state: "done" },
  { label: "Edit assembled", state: "done" },
  { label: "Creating the final review video", state: "current" },
  { label: "Check the render", state: "upcoming" },
  { label: "Prepare download", state: "upcoming" },
];
