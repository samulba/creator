import { cx } from "./cx";

export type StatusTone = "neutral" | "ok" | "info" | "warn" | "danger";

const tones: Record<StatusTone, { text: string; dot: string }> = {
  neutral: { text: "text-ink-secondary", dot: "bg-ink-muted" },
  ok: { text: "text-ok", dot: "bg-ok" },
  info: { text: "text-info", dot: "bg-info" },
  warn: { text: "text-warn", dot: "bg-warn" },
  danger: { text: "text-danger", dot: "bg-danger" },
};

/**
 * Quiet status indicator: a small dot plus label. Status should read as
 * metadata, not as a colored pill competing with content.
 */
export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tones[tone].text,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx("h-1.5 w-1.5 rounded-full", tones[tone].dot)}
      />
      {label}
    </span>
  );
}
