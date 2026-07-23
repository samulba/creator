import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCharacter, updateCharacter } from "@/src/lib/actions/characters";
import {
  energyOptions,
  humorLevelOptions,
  sentenceLengthOptions,
  type Option,
} from "@/src/lib/creative/options";
import type { CharacterRow } from "@/src/lib/supabase/database.types";

function styleValue(character: CharacterRow | null, key: string): string {
  const style = character?.speech_style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    const value = (style as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join("\n");
    if (typeof value === "number") return String(value);
  }
  return "";
}

function voiceValue(character: CharacterRow | null, key: string): string {
  const settings = character?.voice_settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const value = (settings as Record<string, unknown>)[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

function EnumSelect({
  id,
  name,
  options,
  defaultValue,
}: {
  id: string;
  name: string;
  options: Option[];
  defaultValue: string;
}) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue}>
      <option value="">Not set</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Create/edit form for a narrator character. The example lines are the
 * strongest consistency lever — the form says so explicitly.
 */
export function CharacterForm({
  character,
  onDone,
}: {
  character: CharacterRow | null;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const idPrefix = character ? `character-${character.id}` : "character-new";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = character
        ? await updateCharacter(character.id, formData)
        : await createCharacter(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone();
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 border-l-2 border-edge py-2 pl-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}-name`}>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={character?.name ?? ""}
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Language"
          htmlFor={`${idPrefix}-language`}
          hint="e.g. en, de"
        >
          <Input
            id={`${idPrefix}-language`}
            name="language"
            defaultValue={character?.language ?? "en"}
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
          defaultValue={character?.description ?? ""}
          placeholder="Who is this narrator? One or two sentences."
        />
      </Field>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Voice
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="ElevenLabs voice ID"
            htmlFor={`${idPrefix}-voice-key`}
            hint="Voice ID, not an API key"
          >
            <Input
              id={`${idPrefix}-voice-key`}
              name="voice_key"
              defaultValue={character?.voice_key ?? ""}
              maxLength={200}
              placeholder="Assigned in Phase 7 — can stay empty"
            />
          </Field>
          <Field label="Voice model" htmlFor={`${idPrefix}-voice-model`}>
            <Input
              id={`${idPrefix}-voice-model`}
              name="voice_model_id"
              defaultValue={voiceValue(character, "model_id")}
              maxLength={100}
              placeholder="e.g. eleven_multilingual_v2"
            />
          </Field>
          <Field
            label="Stability (0–1)"
            htmlFor={`${idPrefix}-voice-stability`}
          >
            <Input
              id={`${idPrefix}-voice-stability`}
              name="voice_stability"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={voiceValue(character, "stability")}
            />
          </Field>
          <Field label="Style amount (0–1)" htmlFor={`${idPrefix}-voice-style`}>
            <Input
              id={`${idPrefix}-voice-style`}
              name="voice_style"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={voiceValue(character, "style")}
            />
          </Field>
          <Field
            label="Similarity boost (0–1)"
            htmlFor={`${idPrefix}-voice-similarity`}
          >
            <Input
              id={`${idPrefix}-voice-similarity`}
              name="voice_similarity_boost"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={voiceValue(character, "similarity_boost")}
            />
          </Field>
          <Field label="Speed (0.5–1.5)" htmlFor={`${idPrefix}-voice-speed`}>
            <Input
              id={`${idPrefix}-voice-speed`}
              name="voice_speed"
              type="number"
              step="0.05"
              min="0.5"
              max="1.5"
              defaultValue={voiceValue(character, "speed")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Speech style
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Tone"
            htmlFor={`${idPrefix}-tone`}
            hint="e.g. dry, warm, sarcastic"
          >
            <Input
              id={`${idPrefix}-tone`}
              name="tone"
              defaultValue={styleValue(character, "tone")}
              maxLength={200}
            />
          </Field>
          <Field label="Humor" htmlFor={`${idPrefix}-humor`}>
            <EnumSelect
              id={`${idPrefix}-humor`}
              name="humor_level"
              options={humorLevelOptions}
              defaultValue={styleValue(character, "humor_level")}
            />
          </Field>
          <Field label="Energy" htmlFor={`${idPrefix}-energy`}>
            <EnumSelect
              id={`${idPrefix}-energy`}
              name="energy"
              options={energyOptions}
              defaultValue={styleValue(character, "energy")}
            />
          </Field>
          <Field label="Sentence length" htmlFor={`${idPrefix}-sentences`}>
            <EnumSelect
              id={`${idPrefix}-sentences`}
              name="sentence_length"
              options={sentenceLengthOptions}
              defaultValue={styleValue(character, "sentence_length")}
            />
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field
            label="Example lines"
            htmlFor={`${idPrefix}-examples`}
            hint="3–8 lines, one per line — the strongest consistency lever"
          >
            <Textarea
              id={`${idPrefix}-examples`}
              name="example_lines"
              rows={4}
              defaultValue={styleValue(character, "example_lines")}
              placeholder={
                "He was supposed to pressure generators. He chose violence instead.\nThat decision is going to cost him the match."
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Catchphrases"
              htmlFor={`${idPrefix}-catchphrases`}
              hint="One per line, used sparingly"
            >
              <Textarea
                id={`${idPrefix}-catchphrases`}
                name="catchphrases"
                rows={3}
                defaultValue={styleValue(character, "catchphrases")}
              />
            </Field>
            <Field
              label="Forbidden words"
              htmlFor={`${idPrefix}-forbidden`}
              hint="One per line, never used"
            >
              <Textarea
                id={`${idPrefix}-forbidden`}
                name="forbidden_words"
                rows={3}
                defaultValue={styleValue(character, "forbidden_words")}
              />
            </Field>
          </div>
          <Field label="Vocabulary notes" htmlFor={`${idPrefix}-vocabulary`}>
            <Textarea
              id={`${idPrefix}-vocabulary`}
              name="vocabulary_notes"
              rows={2}
              maxLength={1000}
              defaultValue={styleValue(character, "vocabulary_notes")}
              placeholder="Preferred wording, game terms, things the narrator would never say."
            />
          </Field>
        </div>
      </fieldset>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending
            ? "Saving…"
            : character
              ? "Save character"
              : "Create character"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
