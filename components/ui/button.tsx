import type { ButtonHTMLAttributes } from "react";

import { cx } from "./cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-accent bg-accent text-accent-ink hover:border-accent-hover hover:bg-accent-hover",
  secondary:
    "border border-edge-strong bg-transparent text-ink hover:border-ink-muted hover:bg-raised",
  ghost:
    "border border-transparent bg-transparent text-ink-secondary hover:bg-raised hover:text-ink",
  danger:
    "border border-danger/40 bg-danger/10 text-danger hover:border-danger/60 hover:bg-danger/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-[13px]",
  md: "px-4 py-2 text-sm",
};

/** Button styling for non-button elements such as links. */
export function buttonClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cx(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
