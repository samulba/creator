import type { TextareaHTMLAttributes } from "react";

import { cx } from "./cx";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-edge-strong bg-canvas px-3 py-2.5 text-sm leading-6 text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-muted hover:border-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
