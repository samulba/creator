import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

const inputClassName =
  "w-full rounded-lg border border-edge-strong bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-muted hover:border-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger/60";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClassName, className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-medium text-ink" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "animate-fade-up rounded-lg border px-3 py-2 text-[13px] leading-5",
        tone === "error"
          ? "border-danger/35 bg-danger/10 text-danger"
          : "border-info/35 bg-info/10 text-info",
      )}
    >
      {children}
    </p>
  );
}
