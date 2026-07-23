"use server";

import { revalidatePath } from "next/cache";

import {
  creativeDirectionOptions,
  isOptionValue,
  targetLengthOptions,
} from "@/src/lib/creative/options";
import type {
  CreativeDirection,
  TargetLength,
} from "@/src/lib/supabase/database.types";

import {
  failure,
  isUuid,
  readString,
  requireActionContext,
  type ActionResult,
} from "./shared";

function revalidate() {
  revalidatePath("/app");
}

/**
 * Creates a project channel-first: the channel's creative dials and edit
 * style are copied BY VALUE into the first settings snapshot, while the
 * narrator character is stored BY REFERENCE. See
 * docs/CHANNEL_CHARACTER_MODEL.md (freeze point 1).
 */
export async function createProject(
  formData: FormData,
): Promise<ActionResult<{ projectId: string }>> {
  const context = await requireActionContext();
  if (!context.ok) return context;

  const title = readString(formData, "title", {
    maxLength: 200,
    required: true,
  });
  if (title.error || !title.value) {
    return failure(title.error ?? "A project title is required.");
  }

  const channelIdRaw = readString(formData, "channel_id", { maxLength: 36 });
  if (channelIdRaw.error) return failure(channelIdRaw.error);
  if (!channelIdRaw.value || !isUuid(channelIdRaw.value)) {
    return failure("Choose a channel for this video.");
  }

  // Optional per-video overrides.
  const directionOverride = readString(formData, "creative_direction", {
    maxLength: 40,
  });
  let direction: CreativeDirection | null = null;
  if (directionOverride.value) {
    if (!isOptionValue(directionOverride.value, creativeDirectionOptions)) {
      return failure("Invalid creative direction.");
    }
    direction = directionOverride.value;
  }
  const lengthOverride = readString(formData, "target_length", {
    maxLength: 40,
  });
  let length: TargetLength | null = null;
  if (lengthOverride.value) {
    if (!isOptionValue(lengthOverride.value, targetLengthOptions)) {
      return failure("Invalid target length.");
    }
    length = lengthOverride.value;
  }
  const characterOverride = readString(formData, "character_id", {
    maxLength: 36,
  });
  if (characterOverride.value && !isUuid(characterOverride.value)) {
    return failure("Invalid character.");
  }

  // RLS scopes this to the user's own channels.
  const { data: channel, error: channelError } = await context.supabase
    .from("channels")
    .select("*")
    .eq("id", channelIdRaw.value)
    .is("archived_at", null)
    .maybeSingle();

  if (channelError) return failure("The channel could not be loaded.");
  if (!channel) return failure("Channel not found. Create a channel first.");

  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .insert({
      user_id: context.user.id,
      title: title.value,
      channel_id: channel.id,
      target_language: channel.default_language,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return failure("The project could not be created.");
  }

  const { error: settingsError } = await context.supabase
    .from("project_creative_settings")
    .insert({
      project_id: project.id,
      version_number: 1,
      creative_direction: direction ?? channel.creative_direction,
      pacing: channel.pacing,
      narration_density: channel.narration_density,
      gameplay_preservation: channel.gameplay_preservation,
      target_length: length ?? channel.target_length,
      character_id: characterOverride.value ?? channel.default_character_id,
      edit_style: channel.edit_style,
      is_active: true,
      created_by: context.user.id,
    });

  if (settingsError) {
    // Best-effort cleanup so a half-created project does not linger.
    await context.supabase.from("projects").delete().eq("id", project.id);
    return failure("The project settings could not be created.");
  }

  revalidate();
  return { ok: true, data: { projectId: project.id } };
}

export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(projectId)) return failure("Invalid project id.");

  const { error, data } = await context.supabase
    .from("projects")
    .update(
      archived
        ? { archived_at: new Date().toISOString(), pipeline_state: "archived" }
        : { archived_at: null, pipeline_state: "draft" },
    )
    .eq("id", projectId)
    .select("id");

  if (error) return failure("The project could not be updated.");
  if (!data?.length) return failure("Project not found.");

  revalidate();
  return { ok: true };
}

/**
 * Soft deletion. No storage assets exist yet (pre Phase 2), so the delete
 * request and logical deletion happen in one step.
 */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(projectId)) return failure("Invalid project id.");

  const now = new Date().toISOString();

  const { error, data } = await context.supabase
    .from("projects")
    .update({ delete_requested_at: now, deleted_at: now })
    .eq("id", projectId)
    .select("id");

  if (error) return failure("The project could not be deleted.");
  if (!data?.length) return failure("Project not found.");

  revalidate();
  return { ok: true };
}
