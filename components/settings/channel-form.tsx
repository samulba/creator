import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createChannel, updateChannel } from "@/src/lib/actions/channels";
import {
  creativeDirectionOptions,
  editStyleKeys,
  editStyleOptions,
  gameplayPreservationOptions,
  narrationDensityOptions,
  pacingOptions,
  targetLengthOptions,
} from "@/src/lib/creative/options";
import type {
  ChannelRow,
  CharacterRow,
} from "@/src/lib/supabase/database.types";

function editStyleValue(channel: ChannelRow | null, key: string): string {
  const style = channel?.edit_style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    const value = (style as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

const editStyleLabels: Record<string, string> = {
  caption_style: "Captions",
  zoom_usage: "Zooms",
  transition_style: "Transitions",
  intro_style: "Intro",
  outro_style: "Outro",
};

/**
 * Create/edit form for a channel: identity, default character, the five
 * creative dials, and edit-style branding tokens.
 */
export function ChannelForm({
  channel,
  characters,
  onDone,
}: {
  channel: ChannelRow | null;
  characters: CharacterRow[];
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const idPrefix = channel ? `channel-${channel.id}` : "channel-new";

  const activeCharacters = characters.filter(
    (character) =>
      !character.archived_at || character.id === channel?.default_character_id,
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = channel
        ? await updateChannel(channel.id, formData)
        : await createChannel(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone();
    } finally {
      setPending(false);
    }
  };

  const dials = [
    {
      name: "creative_direction",
      label: "Creative direction",
      options: creativeDirectionOptions,
      value: channel?.creative_direction ?? "balanced",
    },
    {
      name: "pacing",
      label: "Pacing",
      options: pacingOptions,
      value: channel?.pacing ?? "balanced",
    },
    {
      name: "narration_density",
      label: "Narration density",
      options: narrationDensityOptions,
      value: channel?.narration_density ?? "balanced",
    },
    {
      name: "gameplay_preservation",
      label: "Gameplay preservation",
      options: gameplayPreservationOptions,
      value: channel?.gameplay_preservation ?? "balanced",
    },
    {
      name: "target_length",
      label: "Target length",
      options: targetLengthOptions,
      value: channel?.target_length ?? "auto",
    },
  ] as const;

  return (
    <form
      onSubmit={submit}
      className="space-y-6 border-l-2 border-edge py-2 pl-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel name" htmlFor={`${idPrefix}-name`}>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={channel?.name ?? ""}
            maxLength={120}
            required
          />
        </Field>
        <Field label="YouTube handle" htmlFor={`${idPrefix}-handle`}>
          <Input
            id={`${idPrefix}-handle`}
            name="youtube_handle"
            defaultValue={channel?.youtube_handle ?? ""}
            maxLength={100}
            placeholder="@channel"
          />
        </Field>
        <Field
          label="Default narrator character"
          htmlFor={`${idPrefix}-character`}
        >
          <Select
            id={`${idPrefix}-character`}
            name="default_character_id"
            defaultValue={channel?.default_character_id ?? ""}
          >
            <option value="">Not set</option>
            {activeCharacters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Language"
          htmlFor={`${idPrefix}-language`}
          hint="e.g. en, de"
        >
          <Input
            id={`${idPrefix}-language`}
            name="default_language"
            defaultValue={channel?.default_language ?? "en"}
            maxLength={35}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={channel?.description ?? ""}
          placeholder="What kind of videos does this channel publish?"
        />
      </Field>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Creative defaults
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {dials.map((dial) => (
            <Field
              key={dial.name}
              label={dial.label}
              htmlFor={`${idPrefix}-${dial.name}`}
            >
              <Select
                id={`${idPrefix}-${dial.name}`}
                name={dial.name}
                defaultValue={dial.value}
              >
                {dial.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Edit style
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {editStyleKeys.map((key) => (
            <Field
              key={key}
              label={editStyleLabels[key] ?? key}
              htmlFor={`${idPrefix}-edit-${key}`}
            >
              <Select
                id={`${idPrefix}-edit-${key}`}
                name={`edit_${key}`}
                defaultValue={editStyleValue(channel, key)}
              >
                <option value="">Not set</option>
                {editStyleOptions[key].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </fieldset>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : channel ? "Save channel" : "Create channel"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
