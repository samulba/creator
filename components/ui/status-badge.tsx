import { cx } from "./cx";

export type StatusTone = "neutral" | "ok" | "info" | "warn" | "danger";

const tones: Record<StatusTone, { text: string; dot: string; chip: string }> = {
  neutral: {
    text: "text-ink-secondary",
    dot: "bg-ink-muted",
    chip: "border-edge-strong bg-raised/60",
  },
  ok: {
    text: "text-ok",
    dot: "bg-ok",
    chip: "border-ok/25 bg-ok/10",
  },
  info: {
    text: "text-info",
    dot: "bg-info",
    chip: "border-info/25 bg-info/10",
  },
  warn: {
    text: "text-warn",
    dot: "bg-warn",
    chip: "border-warn/25 bg-warn/10",
  },
  danger: {
    text: "text-danger",
    dot: "bg-danger",
    chip: "border-danger/25 bg-danger/10",
  },
};

/**
 * Status indicator. Default is a subtle tinted chip (dot + label); `bare`
 * drops the chip for inline metadata. Status reads clearly but never shouts.
 */
export function StatusBadge({
  tone,
  label,
  bare = false,
  pulse = false,
  className,
}: {
  tone: StatusTone;
  label: string;
  bare?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tones[tone].text,
        !bare &&
          cx(
            "rounded-full border px-2 py-0.5 tracking-tight",
            tones[tone].chip,
          ),
        className,
      )}
    >
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        {pulse ? (
          <span
            className={cx(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              tones[tone].dot,
            )}
          />
        ) : null}
        <span
          className={cx(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            tones[tone].dot,
          )}
        />
      </span>
      {label}
    </span>
  );
}
