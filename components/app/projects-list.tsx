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

const LIVE_TONES: StatusTone[] = ["info"];

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
    <ul className="space-y-1.5 p-2.5">
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        const isLive = LIVE_TONES.includes(item.statusTone);

        return (
          <li key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              aria-current={isSelected ? "true" : undefined}
              className={cx(
                "group relative block w-full rounded-lg border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                isSelected
                  ? "border-accent/35 bg-raised shadow-panel"
                  : "border-transparent hover:border-edge hover:bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  className={cx(
                    "truncate text-sm leading-5 font-medium",
                    isSelected
                      ? "text-ink"
                      : "text-ink-secondary group-hover:text-ink",
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
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <StatusBadge
                  tone={item.statusTone}
                  label={item.statusLabel}
                  pulse={isLive}
                />
                <span className="text-xs text-ink-muted">{item.updated}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
