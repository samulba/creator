"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { SectionHeader } from "@/components/app/section-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  deleteCharacter,
  setCharacterArchived,
} from "@/src/lib/actions/characters";
import { setChannelArchived } from "@/src/lib/actions/channels";
import type {
  ChannelRow,
  CharacterRow,
} from "@/src/lib/supabase/database.types";

import { ChannelForm } from "./channel-form";
import { CharacterForm } from "./character-form";

type Editing =
  | { kind: "channel"; id: string | "new" }
  | { kind: "character"; id: string | "new" }
  | null;

export function SettingsView({
  channels,
  characters,
  schemaReady,
}: {
  channels: ChannelRow[];
  characters: CharacterRow[];
  schemaReady: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeChannels = channels.filter((channel) => !channel.archived_at);
  const archivedChannels = channels.filter((channel) => channel.archived_at);
  const activeCharacters = characters.filter(
    (character) => !character.archived_at,
  );
  const archivedCharacters = characters.filter(
    (character) => character.archived_at,
  );

  const characterNameById = new Map(
    characters.map((character) => [character.id, character.name]),
  );

  const run = async (
    action: () => Promise<{ ok: boolean } & { error?: string }>,
  ) => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("The action failed. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  };

  const closeForm = () => {
    setEditing(null);
    router.refresh();
  };

  if (!schemaReady) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-6 border-l-2 border-warn/60 pl-4 text-sm leading-6 text-ink-secondary">
          Channels and characters need database migration{" "}
          <code className="font-mono text-xs">
            supabase/migrations/002_channels_and_characters.sql
          </code>
          . Run it in the Supabase SQL Editor, move it to{" "}
          <code className="font-mono text-xs">supabase/applied/</code>, then
          reload this page.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block text-sm text-ink underline decoration-edge-strong underline-offset-4"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Settings
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-secondary">
        Channels and characters define how every video on a channel sounds and
        feels. Configure them once — Creator keeps each channel consistent.
      </p>

      {error ? (
        <p className="mt-6 border-l-2 border-danger/60 pl-4 text-[13px] leading-5 text-danger">
          {error}
        </p>
      ) : null}

      {/* Channels */}
      <section className="mt-10">
        <SectionHeader
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => setEditing({ kind: "channel", id: "new" })}
            >
              New channel
            </Button>
          }
        >
          Channels
        </SectionHeader>

        {editing?.kind === "channel" && editing.id === "new" ? (
          <div className="animate-fade-up mt-5">
            <ChannelForm
              channel={null}
              characters={characters}
              onDone={closeForm}
            />
          </div>
        ) : null}

        {activeChannels.length === 0 &&
        !(editing?.kind === "channel" && editing.id === "new") ? (
          <p className="mt-5 text-sm leading-6 text-ink-secondary">
            No channels yet. A channel bundles the narrator character, creative
            defaults, and edit style for one YouTube channel.
          </p>
        ) : null}

        <ul>
          {activeChannels.map((channel) => (
            <li key={channel.id} className="border-b border-edge">
              {editing?.kind === "channel" && editing.id === channel.id ? (
                <div className="animate-fade-up py-5">
                  <ChannelForm
                    channel={channel}
                    characters={characters}
                    onDone={closeForm}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {channel.name}
                      {channel.youtube_handle ? (
                        <span className="ml-2 text-xs font-normal text-ink-muted">
                          {channel.youtube_handle}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {channel.default_character_id
                        ? `Narrator: ${characterNameById.get(channel.default_character_id) ?? "Unknown"}`
                        : "No narrator character set"}
                      {" · "}
                      {channel.default_language}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({ kind: "channel", id: channel.id })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() => setChannelArchived(channel.id, true))
                      }
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {archivedChannels.length ? (
          <div className="mt-4">
            <p className="text-xs text-ink-muted">Archived</p>
            <ul>
              {archivedChannels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center justify-between gap-4 border-b border-edge py-2.5"
                >
                  <span className="text-sm text-ink-muted">{channel.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() => setChannelArchived(channel.id, false))
                    }
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Characters */}
      <section className="mt-12">
        <SectionHeader
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => setEditing({ kind: "character", id: "new" })}
            >
              New character
            </Button>
          }
        >
          Characters
        </SectionHeader>
        <p className="mt-3 text-xs leading-5 text-ink-muted">
          Reusable narrator identities — voice plus speech style. Shared across
          channels; the voice itself is connected in Phase 7.
        </p>

        {editing?.kind === "character" && editing.id === "new" ? (
          <div className="animate-fade-up mt-5">
            <CharacterForm character={null} onDone={closeForm} />
          </div>
        ) : null}

        {activeCharacters.length === 0 &&
        !(editing?.kind === "character" && editing.id === "new") ? (
          <p className="mt-5 text-sm leading-6 text-ink-secondary">
            No characters yet. Create one narrator identity per channel voice.
          </p>
        ) : null}

        <ul>
          {activeCharacters.map((character) => (
            <li key={character.id} className="border-b border-edge">
              {editing?.kind === "character" && editing.id === character.id ? (
                <div className="animate-fade-up py-5">
                  <CharacterForm character={character} onDone={closeForm} />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {character.name}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
                      <span>{character.language}</span>
                      <StatusBadge
                        tone={character.voice_key ? "ok" : "neutral"}
                        label={
                          character.voice_key ? "Voice set" : "No voice yet"
                        }
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({ kind: "character", id: character.id })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() => setCharacterArchived(character.id, true))
                      }
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {archivedCharacters.length ? (
          <div className="mt-4">
            <p className="text-xs text-ink-muted">Archived</p>
            <ul>
              {archivedCharacters.map((character) => (
                <li
                  key={character.id}
                  className="flex items-center justify-between gap-4 border-b border-edge py-2.5"
                >
                  <span className="text-sm text-ink-muted">
                    {character.name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() => setCharacterArchived(character.id, false))
                      }
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => run(() => deleteCharacter(character.id))}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
