import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { abortSourceUpload } from "@/src/lib/actions/uploads";
import { formatBytes } from "@/src/lib/format";
import type { AssetRow } from "@/src/lib/supabase/database.types";

import { useSourceUpload } from "./use-source-upload";

function StaleUploadPanel({
  asset,
  onRefresh,
}: {
  asset: AssetRow;
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex aspect-video flex-col items-center justify-center border border-edge bg-black/20 px-6 text-center">
      <p className="text-sm font-medium text-ink">An upload was interrupted</p>
      <p className="mt-2 max-w-sm text-xs leading-5 text-ink-secondary">
        {asset.original_filename ?? "A previous upload"} did not finish. Cancel
        it to start over.
      </p>
      <Button
        size="sm"
        className="mt-5"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await abortSourceUpload(asset.id);
          } finally {
            setPending(false);
            onRefresh();
          }
        }}
      >
        Cancel interrupted upload
      </Button>
    </div>
  );
}

/**
 * Upload surface for the original gameplay recording: direct
 * browser→R2 multipart upload with real transfer progress.
 *
 * `staleAsset` is a server-known "uploading" asset row. It only means a
 * genuinely interrupted upload when THIS component is idle — while an upload
 * runs in this tab, the same row appears after any refresh, and showing the
 * interrupted panel then would hide (and its cancel button would kill) the
 * live upload.
 */
export function SourceUpload({
  projectId,
  staleAsset,
  onUploaded,
}: {
  projectId: string;
  staleAsset?: AssetRow | null;
  onUploaded: () => void;
}) {
  const { state, start, cancel, reset } = useSourceUpload({
    projectId,
    onUploaded,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void start(file);
    }
  };

  if (state.phase === "idle" && staleAsset) {
    return <StaleUploadPanel asset={staleAsset} onRefresh={onUploaded} />;
  }

  if (state.phase === "idle") {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={`flex aspect-video flex-col items-center justify-center border border-dashed px-6 text-center transition-colors ${
          isDragOver
            ? "border-accent bg-accent/5"
            : "border-edge-strong bg-black/20"
        }`}
      >
        <p className="text-sm font-medium text-ink">
          Drop your gameplay recording
        </p>
        <p className="mt-1.5 text-xs text-ink-muted">
          MP4 or MOV · one full match · up to 32 GB
        </p>
        <Button
          size="sm"
          className="mt-5"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void start(file);
            }
            event.target.value = "";
          }}
        />
        <p className="mt-4 max-w-sm text-[11px] leading-4 text-ink-muted">
          The file uploads directly to private storage. Processing starts in a
          later phase — the source stays attached to this project.
        </p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center border border-danger/40 bg-danger/5 px-6 text-center">
        <p className="text-sm font-medium text-ink">
          The upload did not finish
        </p>
        <p className="mt-2 max-w-md text-xs leading-5 text-ink-secondary">
          {state.error}
        </p>
        <Button size="sm" className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    );
  }

  const percent =
    state.totalBytes > 0
      ? Math.min(
          100,
          Math.floor((state.uploadedBytes / state.totalBytes) * 100),
        )
      : 0;

  return (
    <div className="flex aspect-video flex-col justify-center border border-edge bg-black/20 px-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate text-sm font-medium text-ink">
          {state.filename}
        </p>
        <p className="tabular shrink-0 font-mono text-xs text-ink-secondary">
          {state.phase === "finalizing"
            ? "Verifying…"
            : state.phase === "done"
              ? "Complete"
              : `${percent}%`}
        </p>
      </div>

      <div className="mt-4 h-1 w-full bg-raised">
        <div
          className="h-1 bg-accent transition-[width] duration-300"
          style={{
            width: `${state.phase === "finalizing" || state.phase === "done" ? 100 : percent}%`,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="tabular font-mono text-xs text-ink-muted">
          {formatBytes(state.uploadedBytes)} / {formatBytes(state.totalBytes)}
        </p>
        {state.phase === "uploading" || state.phase === "starting" ? (
          <Button size="sm" variant="ghost" onClick={() => void cancel()}>
            Cancel upload
          </Button>
        ) : null}
      </div>

      <p className="mt-6 text-[11px] leading-4 text-ink-muted">
        Keep this tab open until the upload finishes.
      </p>
    </div>
  );
}
