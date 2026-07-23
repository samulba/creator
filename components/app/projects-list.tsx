import { StatusBadge } from "@/components/ui/status-badge";
import { cx } from "@/components/ui/cx";

import { statusTone, type DemoProject } from "./demo-data";

export function ProjectsList({
  projects,
  selectedId,
  onSelect,
}: {
  projects: DemoProject[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul>
      {projects.map((project) => {
        const isSelected = project.id === selectedId;

        return (
          <li key={project.id} className="border-b border-edge">
            <button
              onClick={() => onSelect(project.id)}
              aria-current={isSelected ? "true" : undefined}
              className={cx(
                "relative w-full px-5 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                isSelected ? "bg-raised" : "hover:bg-surface",
              )}
            >
              {isSelected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <h3
                  className={cx(
                    "text-sm leading-5",
                    isSelected ? "font-medium text-ink" : "text-ink-secondary",
                  )}
                >
                  {project.title}
                </h3>
                {project.duration ? (
                  <span className="tabular shrink-0 font-mono text-xs text-ink-muted">
                    {project.duration}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <StatusBadge
                  tone={statusTone[project.status]}
                  label={project.status}
                />
                <span className="text-xs text-ink-muted">
                  {project.updated}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
