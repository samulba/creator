import type { SelectHTMLAttributes } from "react";

import { cx } from "./cx";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full appearance-none rounded-sm border border-edge-strong bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-colors hover:border-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
