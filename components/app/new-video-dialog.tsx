import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { createProject } from "@/src/lib/actions/projects";
import {
  creativeDirectionOptions,
  labelFor,
  targetLengthOptions,
} from "@/src/lib/creative/options";
import type {
  ChannelRow,
  CharacterRow,
} from "@/src/lib/supabase/database.types";

/**
 * Channel-first project creation (Phase 1.4): choosing a channel implies
 * language, narrator character, dials, and edit style. Uploads land in
 * Phase 2 — the drop zone is honest about that.
 */
export function NewVideoDialog({
  channels,
  characters,
  onClose,
  onCreated,
}: {
  channels: ChannelRow[];
  characters: CharacterRow[];
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [showOverrides, setShowOverrides] = useState(false);
  const [direction, setDirection] = useState("");
  const [length, setLength] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const channel = channels.find((entry) => entry.id === channelId) ?? null;
  const defaultCharacter = channel
    ? (characters.find((entry) => entry.id === channel.default_character_id) ??
      null)
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Give the video a working title.");
      return;
    }
    if (!channel) {
      setError("Choose a channel for this video.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("channel_id", channel.id);
      if (direction) formData.set("creative_direction", direction);
      if (length) formData.set("target_length", length);
      if (characterId) formData.set("character_id", characterId);

      const result = await createProject(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onCreated(result.data?.projectId ?? "");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-video-title"
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-md border border-edge-strong bg-overlay"
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
              The channel defines voice, style, and pacing — every video stays
              consistent.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        {channels.length === 0 ? (
          <div className="px-6 py-10">
            <p className="text-sm font-medium text-ink">
              Create a channel first
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-secondary">
              Videos are produced for a channel so voice, speech style, and
              editing stay identical across every upload. Set up your first
              channel and narrator character in Settings.
            </p>
            <Link
              href="/app/settings"
              className="mt-5 inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:border-accent-hover hover:bg-accent-hover"
            >
              Open settings
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="space-y-5 px-6 py-6">
              <div className="flex flex-col items-center justify-center border border-dashed border-edge-strong px-6 py-8 text-center">
                <p className="text-sm font-medium text-ink">
                  Upload the gameplay on the next screen
                </p>
                <p className="mt-1.5 text-xs text-ink-muted">
                  Create the project first, then drop the recording into the
                  project to start processing.
                </p>
              </div>

              <Field label="Working title" htmlFor="new-video-name">
                <Input
                  id="new-video-name"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Ghost Face Match 043"
                  maxLength={200}
                  required
                />
              </Field>

              <Field label="Channel" htmlFor="new-video-channel">
                <Select
                  id="new-video-channel"
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                >
                  {channels.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {channel ? (
                <dl className="border-y border-edge">
                  {(
                    [
                      [
                        "Narrator character",
                        defaultCharacter?.name ?? "Not set",
                      ],
                      ["Language", channel.default_language],
                      [
                        "Creative direction",
                        labelFor(
                          creativeDirectionOptions,
                          channel.creative_direction,
                        ),
                      ],
                      [
                        "Target length",
                        labelFor(targetLengthOptions, channel.target_length),
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-edge py-2.5 last:border-b-0"
                    >
                      <dt className="text-xs text-ink-muted">{label}</dt>
                      <dd className="text-sm text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {showOverrides ? (
                <div className="space-y-4 border-l-2 border-edge pl-4">
                  <Field
                    label="Creative direction override"
                    htmlFor="new-video-direction"
                  >
                    <Select
                      id="new-video-direction"
                      value={direction}
                      onChange={(event) => setDirection(event.target.value)}
                    >
                      <option value="">Use channel default</option>
                      {creativeDirectionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Target length override"
                    htmlFor="new-video-length"
                  >
                    <Select
                      id="new-video-length"
                      value={length}
                      onChange={(event) => setLength(event.target.value)}
                    >
                      <option value="">Use channel default</option>
                      {targetLengthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Narrator character override"
                    htmlFor="new-video-character"
                  >
                    <Select
                      id="new-video-character"
                      value={characterId}
                      onChange={(event) => setCharacterId(event.target.value)}
                    >
                      <option value="">Use channel default</option>
                      {characters.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-ink-muted underline decoration-edge-strong underline-offset-4 transition-colors hover:text-ink"
                  onClick={() => setShowOverrides(true)}
                >
                  Override channel defaults for this video
                </button>
              )}

              {error ? <FormMessage tone="error">{error}</FormMessage> : null}
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-edge px-6 py-4">
              <p className="text-xs text-ink-muted">
                Settings are snapshotted per project.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create project"}
                </Button>
              </div>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
