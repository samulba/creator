import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  abortSourceUpload,
  getSourceDownloadUrl,
} from "@/src/lib/actions/uploads";
import {
  creativeDirectionOptions,
  editStyleKeys,
  editStyleOptions,
  gameplayPreservationOptions,
  labelFor,
  narrationDensityOptions,
  pacingOptions,
  targetLengthOptions,
} from "@/src/lib/creative/options";
import { formatBytes } from "@/src/lib/format";
import type {
  AssetRow,
  ProjectCreativeSettingsRow,
  ProjectRow,
} from "@/src/lib/supabase/database.types";

import { SectionHeader } from "./section-header";
import { SourceUpload } from "./source-upload";

function UploadedSourcePanel({ asset }: { asset: AssetRow }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await getSourceDownloadUrl(asset.id);
      if (!result.ok || !result.data) {
        setError(result.ok ? "Download unavailable." : result.error);
        return;
      }
      window.location.assign(result.data.url);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex aspect-video flex-col justify-center border border-edge bg-black/20 px-8">
      <p className="text-xs font-medium tracking-[0.14em] text-ok uppercase">
        Source uploaded
      </p>
      <p className="mt-3 truncate text-sm font-medium text-ink">
        {asset.original_filename ?? "Gameplay recording"}
      </p>
      <p className="tabular mt-1.5 font-mono text-xs text-ink-muted">
        {asset.byte_size !== null ? formatBytes(asset.byte_size) : "—"}
        {asset.available_at ? ` · ${asset.available_at.slice(0, 10)}` : ""}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={() => void download()}>
          {pending ? "Preparing link…" : "Download source"}
        </Button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
      <p className="mt-6 max-w-md text-[11px] leading-4 text-ink-muted">
        The recording is stored privately. Analysis and processing start with
        the job system in Phase 3.
      </p>
    </div>
  );
}

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
 * Workspace view for a real draft project. Uploads are live (Phase 2);
 * analysis/processing arrive with the job system and workers (Phase 3+).
 */
export function ProjectDraft({
  project,
  settings,
  sourceAsset,
  channelName,
  characterName,
  storageConfigured,
  assetsReady,
  onArchive,
  onDelete,
  onRefresh,
  pending,
}: {
  project: ProjectRow;
  settings: ProjectCreativeSettingsRow | null;
  sourceAsset: AssetRow | null;
  channelName: string | null;
  characterName: string | null;
  storageConfigured: boolean;
  assetsReady: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editStyle =
    settings && typeof settings.edit_style === "object" && settings.edit_style
      ? (settings.edit_style as Record<string, string>)
      : {};

  const hasSource = sourceAsset?.status === "available";

  const facts: Array<[string, string | null]> = [
    ["Channel", channelName ?? "No channel"],
    ["Narrator character", characterName ?? "Not set"],
    ["Language", project.target_language],
    [
      "Creative direction",
      labelFor(creativeDirectionOptions, settings?.creative_direction),
    ],
    ["Pacing", labelFor(pacingOptions, settings?.pacing)],
    [
      "Narration density",
      labelFor(narrationDensityOptions, settings?.narration_density),
    ],
    [
      "Gameplay preservation",
      labelFor(gameplayPreservationOptions, settings?.gameplay_preservation),
    ],
    ["Target length", labelFor(targetLengthOptions, settings?.target_length)],
  ];

  const editStyleFacts = editStyleKeys
    .map((key) => {
      const value = editStyle[key];
      return value
        ? ([
            key.replace(/_/g, " "),
            labelFor(editStyleOptions[key], value),
          ] as const)
        : null;
    })
    .filter(Boolean) as Array<readonly [string, string | null]>;

  const nextSteps = [
    {
      label: "Upload one raw gameplay recording",
      done: hasSource,
    },
    { label: "Creator understands the match and finds the story", done: false },
    {
      label: "Narration is written and voiced in this channel's character",
      done: false,
    },
    { label: "The edit follows this channel's style and pacing", done: false },
    {
      label: "You review, approve, and download the final video",
      done: false,
    },
  ];

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-10">
        {!assetsReady ? (
          <div className="flex aspect-video flex-col items-center justify-center border border-dashed border-warn/50 px-6 text-center">
            <p className="text-sm font-medium text-ink">
              Database migration pending
            </p>
            <p className="mt-2 max-w-md text-xs leading-5 text-ink-secondary">
              Uploads need{" "}
              <code className="font-mono">
                supabase/migrations/003_assets.sql
              </code>
              . Run it in the Supabase SQL Editor, then reload.
            </p>
          </div>
        ) : hasSource && sourceAsset ? (
          <UploadedSourcePanel asset={sourceAsset} />
        ) : sourceAsset && sourceAsset.status === "uploading" ? (
          <StaleUploadPanel asset={sourceAsset} onRefresh={onRefresh} />
        ) : storageConfigured ? (
          <SourceUpload projectId={project.id} onUploaded={onRefresh} />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center border border-dashed border-warn/50 px-6 text-center">
            <p className="text-sm font-medium text-ink">
              Storage is not configured
            </p>
            <p className="mt-2 max-w-md text-xs leading-5 text-ink-secondary">
              Uploads need the Cloudflare R2 environment variables
              (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
              R2_BUCKET). Add them to the server environment, then reload.
            </p>
          </div>
        )}

        <section>
          <SectionHeader>What happens next</SectionHeader>
          <ol className="mt-1 space-y-0 text-sm">
            {nextSteps.map((step, index) => (
              <li
                key={step.label}
                className="flex items-center gap-4 border-b border-edge py-2.5"
              >
                <span className="tabular w-6 shrink-0 font-mono text-xs text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    step.done ? "text-ink-muted" : "text-ink-secondary"
                  }
                >
                  {step.label}
                </span>
                {step.done ? (
                  <span className="ml-auto text-xs text-ok">Done</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-10">
        <section>
          <SectionHeader>Production setup</SectionHeader>
          <dl>
            {facts.map(([label, value]) => (
              <div key={label} className="border-b border-edge py-3">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="mt-1 text-sm leading-6 text-ink">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
          {editStyleFacts.length ? (
            <dl className="mt-6">
              {editStyleFacts.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-edge py-2.5"
                >
                  <dt className="text-xs text-ink-muted capitalize">{label}</dt>
                  <dd className="text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        <section>
          <SectionHeader>Project actions</SectionHeader>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={onArchive}>
              Archive
            </Button>
            {confirmingDelete ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={onDelete}
                >
                  Really delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">
            Deleting removes the project permanently. Archiving hides it from
            the active list.
          </p>
        </section>
      </aside>
    </div>
  );
}
