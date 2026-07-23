import type { ReactNode } from "react";

/**
 * Quiet empty state: one sentence, one primary action, optional note.
 * Sits in a soft raised panel. No illustrations, no mascots.
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
    <div className="panel ambient relative flex w-full max-w-xl flex-col items-start gap-5 overflow-hidden px-7 py-9">
      <div className="relative z-10">
        <h3 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-secondary">
          {description}
        </p>
      </div>
      {action ? <div className="relative z-10">{action}</div> : null}
      {note ? (
        <p className="relative z-10 text-xs leading-5 text-ink-muted">{note}</p>
      ) : null}
    </div>
  );
}
