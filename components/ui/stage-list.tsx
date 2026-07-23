import { cx } from "./cx";

export type StageState = "done" | "current" | "upcoming";

export type Stage = {
  label: string;
  state: StageState;
};

/**
 * Semantic production progress — named stages instead of fake percentages,
 * per docs/PROCESSING_EXPERIENCE.md.
 */
export function StageList({ stages }: { stages: Stage[] }) {
  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className={cx(
            "flex items-center gap-3 py-2.5",
            index > 0 && "border-t border-edge",
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              "flex h-4 w-4 items-center justify-center",
              stage.state === "current" && "text-info",
              stage.state === "done" && "text-ink-muted",
              stage.state === "upcoming" && "text-ink-muted/50",
            )}
          >
            {stage.state === "done" ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M3.5 8.5l3 3 6-6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  stage.state === "current" ? "bg-info" : "bg-ink-muted/40",
                )}
              />
            )}
          </span>
          <span
            className={cx(
              "text-sm",
              stage.state === "current" && "font-medium text-ink",
              stage.state === "done" && "text-ink-secondary",
              stage.state === "upcoming" && "text-ink-muted",
            )}
          >
            {stage.label}
          </span>
          {stage.state === "current" ? (
            <span className="ml-auto text-xs text-info">In progress</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
