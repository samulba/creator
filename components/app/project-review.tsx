"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  approveFinalOutput,
  getFinalOutput,
  getFinalVideoDownloadUrl,
  type FinalOutput,
} from "@/src/lib/actions/outputs";
import { formatBytes } from "@/src/lib/format";
import type { ProjectRow } from "@/src/lib/supabase/database.types";

import { SectionHeader } from "./section-header";

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Review workspace for a finished production (ready_for_review / approved):
 * final video facts, download, and approval.
 */
export function ProjectReview({
  project,
  onRefresh,
}: {
  project: ProjectRow;
  onRefresh: () => void;
}) {
  const [output, setOutput] = useState<FinalOutput | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<"download" | "approve" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFinalOutput(project.id)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.data) {
          setOutput(result.data);
          setLoadError(null);
        } else {
          setLoadError(
            result.ok ? "The output could not be loaded." : result.error,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("The output could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.pipeline_state]);

  const download = async () => {
    setPending("download");
    setActionError(null);
    try {
      const result = await getFinalVideoDownloadUrl(project.id);
      if (!result.ok || !result.data) {
        setActionError(result.ok ? "Download unavailable." : result.error);
        return;
      }
      window.location.assign(result.data.url);
    } catch {
      setActionError("Download unavailable. Try again in a moment.");
    } finally {
      setPending(null);
    }
  };

  const approve = async () => {
    setPending("approve");
    setActionError(null);
    try {
      const result = await approveFinalOutput(project.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setOutput((current) =>
        current ? { ...current, isApproved: true } : current,
      );
      onRefresh();
    } catch {
      setActionError("The approval failed. Try again in a moment.");
    } finally {
      setPending(null);
    }
  };

  const isApproved =
    project.pipeline_state === "approved" || output?.isApproved === true;

  return (
    <div className="animate-fade-up mx-auto max-w-2xl py-6">
      <h3 className="text-2xl font-semibold tracking-tight text-ink">
        {isApproved ? "Approved and ready to publish" : "Your video is ready"}
      </h3>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        {isApproved
          ? "This production is approved. Download the file and upload it to YouTube."
          : "Creator finished the full production. Review the final video, then approve it or download the file."}
      </p>

      {loadError ? (
        <p className="mt-6 border-l-2 border-warn/60 pl-4 text-[13px] leading-5 text-warn">
          {loadError}
        </p>
      ) : null}

      {output ? (
        <section className="mt-8">
          <SectionHeader>Final video</SectionHeader>
          <dl className="mt-1">
            {(
              [
                ["Duration", formatDuration(output.durationMs)],
                [
                  "Resolution",
                  output.width && output.height
                    ? `${output.width}×${output.height}`
                    : "—",
                ],
                [
                  "File size",
                  output.byteSize !== null ? formatBytes(output.byteSize) : "—",
                ],
                [
                  "Version",
                  `v${String(output.versionNumber).padStart(2, "0")}`,
                ],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-edge py-2.5"
              >
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="tabular font-mono text-sm text-ink">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-b border-edge py-2.5">
              <dt className="text-xs text-ink-muted">Quality control</dt>
              <dd>
                <StatusBadge
                  tone={output.qcStatus === "passed" ? "ok" : "neutral"}
                  label={
                    output.qcStatus === "passed" ? "Passed" : output.qcStatus
                  }
                />
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {actionError ? (
        <p className="mt-5 text-[13px] leading-5 text-danger">{actionError}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          variant="primary"
          disabled={pending !== null || output === null}
          onClick={() => void download()}
        >
          {pending === "download" ? "Preparing link…" : "Download video"}
        </Button>
        {!isApproved ? (
          <Button
            disabled={pending !== null || output === null}
            onClick={() => void approve()}
          >
            {pending === "approve" ? "Approving…" : "Approve"}
          </Button>
        ) : null}
      </div>

      <p className="mt-6 text-xs leading-5 text-ink-muted">
        The download link is private and expires after a few minutes — the file
        itself stays stored with the project.
      </p>
    </div>
  );
}
