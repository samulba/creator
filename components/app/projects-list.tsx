import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cx } from "@/components/ui/cx";

export type ProjectListItem = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: StatusTone;
  /** Right-aligned metadata on the first row, e.g. a duration. */
  trailing?: string;
  /** Right-aligned metadata on the second row, e.g. last update. */
  updated: string;
};

export function ProjectsList({
  items,
  selectedId,
  onSelect,
}: {
  items: ProjectListItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul>
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <li key={item.id} className="border-b border-edge">
            <button
              onClick={() => onSelect(item.id)}
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
                  {item.title}
                </h3>
                {item.trailing ? (
                  <span className="tabular shrink-0 font-mono text-xs text-ink-muted">
                    {item.trailing}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <StatusBadge tone={item.statusTone} label={item.statusLabel} />
                <span className="text-xs text-ink-muted">{item.updated}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
