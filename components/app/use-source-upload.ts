import { useCallback, useRef, useState } from "react";

import {
  abortSourceUpload,
  completeSourceUpload,
  getSourceUploadStatus,
  getUploadPartUrls,
  startSourceUpload,
} from "@/src/lib/actions/uploads";
import {
  ALLOWED_SOURCE_CONTENT_TYPES,
  MAX_PART_URL_BATCH,
  MAX_UPLOAD_BYTES,
  UPLOAD_PART_SIZE,
} from "@/src/lib/storage/upload-constants";

export type UploadPhase =
  "idle" | "starting" | "uploading" | "finalizing" | "done" | "error";

export type UploadState = {
  phase: UploadPhase;
  uploadedBytes: number;
  totalBytes: number;
  filename: string | null;
  error: string | null;
};

const initialState: UploadState = {
  phase: "idle",
  uploadedBytes: 0,
  totalBytes: 0,
  filename: null,
  error: null,
};

const PART_RETRIES = 3;
const CONCURRENCY = 3;

type ActiveUpload = {
  cancelled: boolean;
  activeRequests: Set<XMLHttpRequest>;
  assetId: string | null;
};

function putPart(
  url: string,
  body: Blob,
  active: ActiveUpload,
  onProgress: (loadedBytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    active.activeRequests.add(xhr);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      active.activeRequests.delete(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(
            new Error(
              'The storage response is missing the ETag header. Add "ETag" to the R2 bucket CORS ExposeHeaders.',
            ),
          );
          return;
        }
        onProgress(body.size);
        resolve(etag);
      } else {
        reject(new Error(`Part upload failed with status ${xhr.status}.`));
      }
    };

    xhr.onerror = () => {
      active.activeRequests.delete(xhr);
      reject(new Error("Network error during part upload."));
    };
    xhr.onabort = () => {
      active.activeRequests.delete(xhr);
      reject(new Error("cancelled"));
    };

    xhr.open("PUT", url);
    xhr.send(body);
  });
}

/**
 * After a failed finalize request, polls the asset status until the server
 * settles it. Returns true when the upload turned out to be complete
 * ("available"), false when it is settled as not completed, and
 * "cancelled" when the user cancelled while waiting.
 */
async function waitForServerFinalize(
  assetId: string,
  active: ActiveUpload,
): Promise<boolean | "cancelled"> {
  const POLL_INTERVAL_MS = 5000;
  const POLL_ATTEMPTS = 24; // ~2 minutes

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (active.cancelled) return "cancelled";

    const status = await getSourceUploadStatus(assetId).catch(() => null);
    if (!status?.ok || !status.data) continue;

    if (status.data.status === "available") return true;
    if (status.data.status !== "uploading") return false;
  }

  return false;
}

/**
 * Direct browser→R2 multipart upload with real transfer progress:
 * the server issues presigned part URLs; the file bytes never pass
 * through the web application.
 */
export function useSourceUpload({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [state, setState] = useState<UploadState>(initialState);
  const activeRef = useRef<ActiveUpload | null>(null);

  const start = useCallback(
    async (file: File) => {
      if (!ALLOWED_SOURCE_CONTENT_TYPES[file.type]) {
        setState({
          ...initialState,
          phase: "error",
          error: "Use an MP4 or MOV gameplay recording.",
        });
        return;
      }
      if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
        setState({
          ...initialState,
          phase: "error",
          error: "The file size is outside the supported range (max 32 GB).",
        });
        return;
      }

      const active: ActiveUpload = {
        cancelled: false,
        activeRequests: new Set(),
        assetId: null,
      };
      activeRef.current = active;

      setState({
        phase: "starting",
        uploadedBytes: 0,
        totalBytes: file.size,
        filename: file.name,
        error: null,
      });

      const fail = async (message: string) => {
        // Free the one-original-per-project slot for a clean retry.
        if (active.assetId) {
          await abortSourceUpload(active.assetId).catch(() => {});
        }
        setState((current) => ({
          ...current,
          phase: "error",
          error: message,
        }));
      };

      try {
        const started = await startSourceUpload({
          projectId,
          filename: file.name,
          byteSize: file.size,
          contentType: file.type,
        });

        if (!started.ok || !started.data) {
          setState((current) => ({
            ...current,
            phase: "error",
            error: started.ok ? "The upload could not start." : started.error,
          }));
          return;
        }

        active.assetId = started.data.assetId;
        const { partCount } = started.data;

        const partProgress = new Map<number, number>();
        const reportProgress = () => {
          let uploaded = 0;
          for (const bytes of partProgress.values()) {
            uploaded += bytes;
          }
          setState((current) =>
            current.phase === "uploading" || current.phase === "starting"
              ? { ...current, phase: "uploading", uploadedBytes: uploaded }
              : current,
          );
        };

        const etags = new Array<string>(partCount);

        for (
          let batchStart = 1;
          batchStart <= partCount;
          batchStart += MAX_PART_URL_BATCH
        ) {
          if (active.cancelled) return;

          const batchNumbers = [];
          for (
            let part = batchStart;
            part < batchStart + MAX_PART_URL_BATCH && part <= partCount;
            part += 1
          ) {
            batchNumbers.push(part);
          }

          const urlsResult = await getUploadPartUrls({
            assetId: started.data.assetId,
            partNumbers: batchNumbers,
          });

          if (!urlsResult.ok || !urlsResult.data) {
            await fail(
              urlsResult.ok
                ? "Upload URLs could not be created."
                : urlsResult.error,
            );
            return;
          }

          const urlByPart = new Map(
            urlsResult.data.urls.map((entry) => [entry.partNumber, entry.url]),
          );

          // Upload the batch with limited concurrency and per-part retries.
          const queue = [...batchNumbers];
          const workers = Array.from(
            { length: Math.min(CONCURRENCY, queue.length) },
            async () => {
              while (queue.length > 0) {
                if (active.cancelled) return;
                const partNumber = queue.shift();
                if (!partNumber) return;

                const url = urlByPart.get(partNumber);
                if (!url) throw new Error("Missing part URL.");

                const begin = (partNumber - 1) * UPLOAD_PART_SIZE;
                const body = file.slice(
                  begin,
                  Math.min(begin + UPLOAD_PART_SIZE, file.size),
                );

                let lastError: unknown = null;
                for (let attempt = 0; attempt < PART_RETRIES; attempt += 1) {
                  if (active.cancelled) return;
                  try {
                    const etag = await putPart(url, body, active, (loaded) => {
                      partProgress.set(partNumber, Math.min(loaded, body.size));
                      reportProgress();
                    });
                    etags[partNumber - 1] = etag;
                    partProgress.set(partNumber, body.size);
                    reportProgress();
                    lastError = null;
                    break;
                  } catch (error) {
                    if (
                      error instanceof Error &&
                      error.message === "cancelled"
                    ) {
                      return;
                    }
                    lastError = error;
                    await new Promise((resolveDelay) =>
                      setTimeout(resolveDelay, 1000 * (attempt + 1)),
                    );
                  }
                }

                if (lastError) {
                  throw lastError;
                }
              }
            },
          );

          try {
            await Promise.all(workers);
          } catch (error) {
            if (active.cancelled) return;
            await fail(
              error instanceof Error
                ? error.message
                : "The upload failed. Check your connection and retry.",
            );
            return;
          }
        }

        if (active.cancelled) return;

        setState((current) => ({ ...current, phase: "finalizing" }));

        // Finalizing (R2 multipart complete + verification + pipeline start)
        // can outlive a proxy timeout even though the server finishes the
        // work. Never trust a failed finalize response alone: poll the
        // asset status and only fail once the server confirms the upload
        // did not complete.
        const completed = await completeSourceUpload({
          assetId: started.data.assetId,
          parts: etags.map((etag, index) => ({
            partNumber: index + 1,
            etag,
          })),
        }).catch(() => null);

        if (!completed?.ok) {
          const recovered = await waitForServerFinalize(
            started.data.assetId,
            active,
          );
          if (recovered === "cancelled") return;
          if (!recovered) {
            await fail(
              completed && !completed.ok
                ? completed.error
                : "The upload could not be confirmed. Check the project after a refresh before retrying.",
            );
            return;
          }
        }

        setState((current) => ({ ...current, phase: "done" }));
        onUploaded();
      } catch (error) {
        if (!active.cancelled) {
          await fail(
            error instanceof Error
              ? error.message
              : "The upload failed unexpectedly.",
          );
        }
      }
    },
    [projectId, onUploaded],
  );

  const cancel = useCallback(async () => {
    const active = activeRef.current;
    if (!active) return;

    active.cancelled = true;
    for (const request of active.activeRequests) {
      request.abort();
    }
    if (active.assetId) {
      await abortSourceUpload(active.assetId).catch(() => {});
    }
    setState(initialState);
    onUploaded();
  }, [onUploaded]);

  const reset = useCallback(() => setState(initialState), []);

  return { state, start, cancel, reset };
}
