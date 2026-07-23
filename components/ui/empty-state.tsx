import type { ReactNode } from "react";

/**
 * Quiet empty state: one sentence, one primary action, optional note.
 * No illustrations, no mascots.
 */
export function EmptyState({
  title,
  description,
  action,
  note,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-edge-strong px-6 py-10">
      <div>
        <h3 className="text-base font-medium text-ink">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-secondary">
          {description}
        </p>
      </div>
      {action}
      {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
    </div>
  );
}
