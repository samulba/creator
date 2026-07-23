import type { ReactNode } from "react";

/**
 * Workspace section label: quiet, uppercase, structural. Sections are
 * separated by spacing and hairlines instead of nested cards.
 */
export function SectionHeader({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge pb-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
        {children}
      </h3>
      {action}
    </div>
  );
}
