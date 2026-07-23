"use server";

import { revalidatePath } from "next/cache";

import {
  creativeDirectionOptions,
  editStyleKeys,
  editStyleOptions,
  gameplayPreservationOptions,
  isOptionValue,
  narrationDensityOptions,
  pacingOptions,
  targetLengthOptions,
} from "@/src/lib/creative/options";
import type { Json } from "@/src/lib/supabase/database.types";

import {
  failure,
  isUuid,
  readString,
  requireActionContext,
  type ActionResult,
} from "./shared";

function revalidate() {
  revalidatePath("/app");
  revalidatePath("/app/settings");
}

function parseChannelInput(formData: FormData):
  | {
      ok: true;
      name: string;
      youtubeHandle: string | null;
      description: string | null;
      defaultCharacterId: string | null;
      defaultLanguage: string;
      creativeDirection: string;
      pacing: string;
      narrationDensity: string;
      gameplayPreservation: string;
      targetLength: string;
      editStyle: Json;
    }
  | { ok: false; error: string } {
  const name = readString(formData, "name", { maxLength: 120, required: true });
  if (name.error || !name.value) {
    return failure(name.error ?? "Channel name is required.");
  }

  const youtubeHandle = readString(formData, "youtube_handle", {
    maxLength: 100,
  });
  if (youtubeHandle.error) return failure(youtubeHandle.error);

  const description = readString(formData, "description", { maxLength: 2000 });
  if (description.error) return failure(description.error);

  const defaultCharacterRaw = readString(formData, "default_character_id", {
    maxLength: 36,
  });
  if (defaultCharacterRaw.error) return failure(defaultCharacterRaw.error);
  if (defaultCharacterRaw.value && !isUuid(defaultCharacterRaw.value)) {
    return failure("Invalid default character.");
  }

  const language = readString(formData, "default_language", { maxLength: 35 });
  if (language.error) return failure(language.error);
  const languageValue = language.value ?? "en";
  if (languageValue.length < 2) {
    return failure("Language must be at least 2 characters (e.g. en, de).");
  }

  const dials = {
    creative_direction: {
      options: creativeDirectionOptions,
      fallback: "balanced",
    },
    pacing: { options: pacingOptions, fallback: "balanced" },
    narration_density: {
      options: narrationDensityOptions,
      fallback: "balanced",
    },
    gameplay_preservation: {
      options: gameplayPreservationOptions,
      fallback: "balanced",
    },
    target_length: { options: targetLengthOptions, fallback: "auto" },
  } as const;

  const dialValues: Record<string, string> = {};
  for (const [field, config] of Object.entries(dials)) {
    const raw = readString(formData, field, { maxLength: 40 });
    if (raw.error) return failure(raw.error);
    const value = raw.value ?? config.fallback;
    if (!isOptionValue(value, config.options)) {
      return failure(`Invalid value for ${field}.`);
    }
    dialValues[field] = value;
  }

  const editStyle: Record<string, Json> = {};
  for (const key of editStyleKeys) {
    const raw = readString(formData, `edit_${key}`, { maxLength: 40 });
    if (raw.error) return failure(raw.error);
    if (raw.value) {
      if (!isOptionValue(raw.value, editStyleOptions[key])) {
        return failure(`Invalid value for ${key}.`);
      }
      editStyle[key] = raw.value;
    }
  }

  return {
    ok: true,
    name: name.value,
    youtubeHandle: youtubeHandle.value,
    description: description.value,
    defaultCharacterId: defaultCharacterRaw.value,
    defaultLanguage: languageValue,
    creativeDirection: dialValues.creative_direction,
    pacing: dialValues.pacing,
    narrationDensity: dialValues.narration_density,
    gameplayPreservation: dialValues.gameplay_preservation,
    targetLength: dialValues.target_length,
    editStyle,
  };
}

type ChannelWrite = ReturnType<typeof parseChannelInput> & { ok: true };

function toChannelRow(input: ChannelWrite, userId: string) {
  return {
    user_id: userId,
    name: input.name,
    youtube_handle: input.youtubeHandle,
    description: input.description,
    default_character_id: input.defaultCharacterId,
    default_language: input.defaultLanguage,
    creative_direction:
      input.creativeDirection as ChannelDials["creative_direction"],
    pacing: input.pacing as ChannelDials["pacing"],
    narration_density:
      input.narrationDensity as ChannelDials["narration_density"],
    gameplay_preservation:
      input.gameplayPreservation as ChannelDials["gameplay_preservation"],
    target_length: input.targetLength as ChannelDials["target_length"],
    edit_style: input.editStyle,
  };
}

type ChannelDials = {
  creative_direction: (typeof creativeDirectionOptions)[number]["value"];
  pacing: (typeof pacingOptions)[number]["value"];
  narration_density: (typeof narrationDensityOptions)[number]["value"];
  gameplay_preservation: (typeof gameplayPreservationOptions)[number]["value"];
  target_length: (typeof targetLengthOptions)[number]["value"];
};

export async function createChannel(formData: FormData): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;

  const input = parseChannelInput(formData);
  if (!input.ok) return input;

  const { error } = await context.supabase
    .from("channels")
    .insert(toChannelRow(input, context.user.id));

  if (error) {
    if (error.code === "23505") {
      return failure("You already have a channel with this name.");
    }
    if (error.code === "23503") {
      return failure("The selected default character does not exist.");
    }
    return failure("The channel could not be created.");
  }

  revalidate();
  return { ok: true };
}

export async function updateChannel(
  channelId: string,
  formData: FormData,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(channelId)) return failure("Invalid channel id.");

  const input = parseChannelInput(formData);
  if (!input.ok) return input;

  const row = toChannelRow(input, context.user.id);

  const { error, data } = await context.supabase
    .from("channels")
    .update(row)
    .eq("id", channelId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return failure("You already have a channel with this name.");
    }
    if (error.code === "23503") {
      return failure("The selected default character does not exist.");
    }
    return failure("The channel could not be updated.");
  }
  if (!data?.length) return failure("Channel not found.");

  revalidate();
  return { ok: true };
}

export async function setChannelArchived(
  channelId: string,
  archived: boolean,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(channelId)) return failure("Invalid channel id.");

  const { error, data } = await context.supabase
    .from("channels")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", channelId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return failure(
        "An active channel with this name already exists. Rename it before restoring.",
      );
    }
    return failure("The channel could not be updated.");
  }
  if (!data?.length) return failure("Channel not found.");

  revalidate();
  return { ok: true };
}
