import { cx } from "./cx";

/**
 * Typographic Creator mark: a small brass tick plus the wordmark.
 * Shared across landing, auth, and the application shell.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 font-semibold tracking-tight text-ink",
        size === "sm" ? "text-sm" : "text-base",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block bg-accent",
          size === "sm" ? "h-2.5 w-1" : "h-3 w-1",
        )}
      />
      Creator
    </span>
  );
}
