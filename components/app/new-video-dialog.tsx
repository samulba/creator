import { useEffect } from "react";

import { Button } from "@/components/ui/button";

const settings = [
  ["Language", "English"],
  ["Narrator", "Calm documentary"],
  ["Target length", "Auto · 8–15 minutes"],
  ["Creative direction", "Balanced"],
] as const;

export function NewVideoDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-video-title"
        className="w-full max-w-xl rounded-md border border-edge-strong bg-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge px-6 py-5">
          <div>
            <h2
              id="new-video-title"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              New video
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Upload one gameplay recording. Creator builds the video.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="px-6 py-6">
          <div className="flex flex-col items-center justify-center border border-dashed border-edge-strong px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink">
              Drop a gameplay recording
            </p>
            <p className="mt-1.5 text-xs text-ink-muted">
              MP4 or MOV · one full match
            </p>
          </div>

          <dl className="mt-6">
            {settings.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-edge py-3"
              >
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="flex items-center gap-3">
                  <span className="text-sm text-ink">{value}</span>
                  <Button size="sm" variant="ghost">
                    Change
                  </Button>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-edge px-6 py-4">
          <p className="text-xs text-ink-muted">
            Prototype — uploads are not connected yet.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onClose}>
              Create video
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
