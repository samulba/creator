import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/**
 * Custom checkbox: appearance-none box that fills with the accent and draws
 * an animated check when checked. Label and optional description are part of
 * the clickable surface.
 */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cx(
        "group flex cursor-pointer items-start gap-3 select-none",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0">
        <input
          type="checkbox"
          className="peer h-full w-full cursor-pointer appearance-none rounded-[5px] border border-edge-strong bg-canvas transition-[border-color,background-color,box-shadow] duration-150 group-hover:border-ink-muted/70 checked:border-accent checked:bg-accent checked:shadow-[0_2px_8px_-2px_rgb(216_184_102_/_0.5)] focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 scale-50 text-accent-ink opacity-0 transition-[opacity,transform] duration-150 ease-out peer-checked:scale-100 peer-checked:opacity-100"
        >
          <path d="M2.5 6.5 5 8.8l4.5-5.3" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-5 text-ink-secondary transition-colors duration-150 group-hover:text-ink">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-4 text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
