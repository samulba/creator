import type { ButtonHTMLAttributes } from "react";

import { cx } from "./cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-accent/70 bg-accent text-accent-ink shadow-[0_2px_10px_-3px_rgb(216_184_102_/_0.45)] hover:bg-accent-hover hover:-translate-y-px active:translate-y-0",
  secondary:
    "border border-edge-strong bg-surface text-ink hover:border-ink-muted/70 hover:bg-raised",
  ghost:
    "border border-transparent bg-transparent text-ink-secondary hover:bg-raised hover:text-ink",
  danger:
    "border border-danger/40 bg-danger/10 text-danger hover:border-danger/60 hover:bg-danger/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[13px]",
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
