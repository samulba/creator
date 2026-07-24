import type { SelectHTMLAttributes } from "react";

import { cx } from "./cx";

/**
 * Native select with the design system's field styling and a custom chevron
 * (appearance-none removes the platform arrow, so one must be drawn). The
 * chevron picks up the accent while the field is focused.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select
        className={cx(
          "peer w-full cursor-pointer appearance-none rounded-lg border border-edge-strong bg-canvas py-2.5 pr-9 pl-3 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-muted transition-colors duration-150 peer-hover:text-ink-secondary peer-focus:text-accent"
      >
        <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
      </svg>
    </span>
  );
}
