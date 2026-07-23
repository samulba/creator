import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import type {
  ProjectCreativeSettingsRow,
  ProjectRow,
} from "@/src/lib/supabase/database.types";

import { SectionHeader } from "./section-header";

/**
 * Workspace view for a real draft project (Phase 1.4). Uploads and the
 * processing pipeline arrive in Phase 2+; this view is honest about that.
 */
export function ProjectDraft({
  project,
  settings,
  channelName,
  characterName,
  onArchive,
  onDelete,
  pending,
}: {
  project: ProjectRow;
  settings: ProjectCreativeSettingsRow | null;
  channelName: string | null;
  characterName: string | null;
  onArchive: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editStyle =
    settings && typeof settings.edit_style === "object" && settings.edit_style
      ? (settings.edit_style as Record<string, string>)
      : {};

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

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-10">
        <div className="flex aspect-video flex-col items-center justify-center border border-dashed border-edge-strong bg-black/20 px-6 text-center">
          <p className="text-sm font-medium text-ink">
            Waiting for gameplay upload
          </p>
          <p className="mt-2 max-w-sm text-xs leading-5 text-ink-muted">
            Uploads are not connected yet — they arrive with Phase 2 (storage
            and uploads). This project keeps its channel and character setup
            until then.
          </p>
        </div>

        <section>
          <SectionHeader>What happens next</SectionHeader>
          <ol className="mt-1 space-y-0 text-sm text-ink-secondary">
            {[
              "Upload one raw gameplay recording",
              "Creator understands the match and finds the story",
              "Narration is written and voiced in this channel's character",
              "The edit follows this channel's style and pacing",
              "You review, approve, and download the final video",
            ].map((step, index) => (
              <li key={step} className="flex gap-4 border-b border-edge py-2.5">
                <span className="tabular w-6 shrink-0 font-mono text-xs text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
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
