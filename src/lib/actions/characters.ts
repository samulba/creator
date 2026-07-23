"use server";

import { revalidatePath } from "next/cache";

import {
  energyOptions,
  humorLevelOptions,
  isOptionValue,
  sentenceLengthOptions,
} from "@/src/lib/creative/options";
import type { Json } from "@/src/lib/supabase/database.types";

import {
  failure,
  isUuid,
  readNumber,
  readString,
  readStringList,
  requireActionContext,
  type ActionResult,
} from "./shared";

function revalidate() {
  revalidatePath("/app");
  revalidatePath("/app/settings");
}

/**
 * Validates and assembles the bounded speech_style / voice_settings objects.
 * Only provided keys are stored; shapes are documented in
 * docs/CHANNEL_CHARACTER_MODEL.md and the migration column comments.
 */
function parseCharacterInput(formData: FormData):
  | {
      ok: true;
      name: string;
      description: string | null;
      language: string;
      voiceKey: string | null;
      voiceSettings: Json;
      speechStyle: Json;
    }
  | { ok: false; error: string } {
  const name = readString(formData, "name", { maxLength: 120, required: true });
  if (name.error || !name.value) {
    return failure(name.error ?? "Character name is required.");
  }

  const description = readString(formData, "description", { maxLength: 2000 });
  if (description.error) return failure(description.error);

  const language = readString(formData, "language", { maxLength: 35 });
  if (language.error) return failure(language.error);
  const languageValue = language.value ?? "en";
  if (languageValue.length < 2) {
    return failure("Language must be at least 2 characters (e.g. en, de).");
  }

  const voiceKey = readString(formData, "voice_key", { maxLength: 200 });
  if (voiceKey.error) return failure(voiceKey.error);

  const modelId = readString(formData, "voice_model_id", { maxLength: 100 });
  if (modelId.error) return failure(modelId.error);
  const stability = readNumber(formData, "voice_stability", { min: 0, max: 1 });
  if (stability.error) return failure(stability.error);
  const similarity = readNumber(formData, "voice_similarity_boost", {
    min: 0,
    max: 1,
  });
  if (similarity.error) return failure(similarity.error);
  const styleAmount = readNumber(formData, "voice_style", { min: 0, max: 1 });
  if (styleAmount.error) return failure(styleAmount.error);
  const speed = readNumber(formData, "voice_speed", { min: 0.5, max: 1.5 });
  if (speed.error) return failure(speed.error);

  const voiceSettings: Record<string, Json> = {};
  if (modelId.value) voiceSettings.model_id = modelId.value;
  if (stability.value !== null) voiceSettings.stability = stability.value;
  if (similarity.value !== null)
    voiceSettings.similarity_boost = similarity.value;
  if (styleAmount.value !== null) voiceSettings.style = styleAmount.value;
  if (speed.value !== null) voiceSettings.speed = speed.value;

  const tone = readString(formData, "tone", { maxLength: 200 });
  if (tone.error) return failure(tone.error);
  const vocabularyNotes = readString(formData, "vocabulary_notes", {
    maxLength: 1000,
  });
  if (vocabularyNotes.error) return failure(vocabularyNotes.error);

  const humor = readString(formData, "humor_level", { maxLength: 20 });
  if (humor.value && !isOptionValue(humor.value, humorLevelOptions)) {
    return failure("Invalid humor level.");
  }
  const energy = readString(formData, "energy", { maxLength: 20 });
  if (energy.value && !isOptionValue(energy.value, energyOptions)) {
    return failure("Invalid energy value.");
  }
  const sentenceLength = readString(formData, "sentence_length", {
    maxLength: 20,
  });
  if (
    sentenceLength.value &&
    !isOptionValue(sentenceLength.value, sentenceLengthOptions)
  ) {
    return failure("Invalid sentence length.");
  }

  const catchphrases = readStringList(formData, "catchphrases", {
    maxItems: 20,
    maxItemLength: 200,
  });
  if (catchphrases.error) return failure(catchphrases.error);
  const forbiddenWords = readStringList(formData, "forbidden_words", {
    maxItems: 50,
    maxItemLength: 100,
  });
  if (forbiddenWords.error) return failure(forbiddenWords.error);
  const exampleLines = readStringList(formData, "example_lines", {
    maxItems: 8,
    maxItemLength: 300,
  });
  if (exampleLines.error) return failure(exampleLines.error);

  const speechStyle: Record<string, Json> = {};
  if (tone.value) speechStyle.tone = tone.value;
  if (humor.value) speechStyle.humor_level = humor.value;
  if (energy.value) speechStyle.energy = energy.value;
  if (sentenceLength.value) speechStyle.sentence_length = sentenceLength.value;
  if (vocabularyNotes.value)
    speechStyle.vocabulary_notes = vocabularyNotes.value;
  if (catchphrases.value.length) speechStyle.catchphrases = catchphrases.value;
  if (forbiddenWords.value.length)
    speechStyle.forbidden_words = forbiddenWords.value;
  if (exampleLines.value.length) speechStyle.example_lines = exampleLines.value;

  return {
    ok: true,
    name: name.value,
    description: description.value,
    language: languageValue,
    voiceKey: voiceKey.value,
    voiceSettings,
    speechStyle,
  };
}

export async function createCharacter(
  formData: FormData,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;

  const input = parseCharacterInput(formData);
  if (!input.ok) return input;

  const { error } = await context.supabase.from("characters").insert({
    user_id: context.user.id,
    name: input.name,
    description: input.description,
    language: input.language,
    voice_key: input.voiceKey,
    voice_settings: input.voiceSettings,
    speech_style: input.speechStyle,
  });

  if (error) {
    if (error.code === "23505") {
      return failure("You already have a character with this name.");
    }
    return failure("The character could not be created.");
  }

  revalidate();
  return { ok: true };
}

export async function updateCharacter(
  characterId: string,
  formData: FormData,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(characterId)) return failure("Invalid character id.");

  const input = parseCharacterInput(formData);
  if (!input.ok) return input;

  const { error, data } = await context.supabase
    .from("characters")
    .update({
      name: input.name,
      description: input.description,
      language: input.language,
      voice_key: input.voiceKey,
      voice_settings: input.voiceSettings,
      speech_style: input.speechStyle,
    })
    .eq("id", characterId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return failure("You already have a character with this name.");
    }
    return failure("The character could not be updated.");
  }

  if (!data?.length) {
    return failure("Character not found.");
  }

  revalidate();
  return { ok: true };
}

export async function setCharacterArchived(
  characterId: string,
  archived: boolean,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(characterId)) return failure("Invalid character id.");

  const { error, data } = await context.supabase
    .from("characters")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", characterId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return failure(
        "An active character with this name already exists. Rename it before restoring.",
      );
    }
    return failure("The character could not be updated.");
  }
  if (!data?.length) return failure("Character not found.");

  revalidate();
  return { ok: true };
}

export async function deleteCharacter(
  characterId: string,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(characterId)) return failure("Invalid character id.");

  // Archive-first lifecycle: refuse hard deletion while the character is
  // referenced by an active project's active settings row.
  const { data: activeReferences, error: referenceError } =
    await context.supabase
      .from("project_creative_settings")
      .select("id, projects!inner(deleted_at, archived_at)")
      .eq("character_id", characterId)
      .eq("is_active", true)
      .is("projects.deleted_at", null)
      .limit(1);

  if (referenceError) {
    return failure("Could not verify character usage. Try again.");
  }

  if (activeReferences?.length) {
    return failure(
      "This character is used by an active project. Archive it instead, or remove it from the project first.",
    );
  }

  const { error, data } = await context.supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .select("id");

  if (error) return failure("The character could not be deleted.");
  if (!data?.length) return failure("Character not found.");

  revalidate();
  return { ok: true };
}
