import type { User } from "@supabase/supabase-js";

import { getOptionalSupabaseConfig } from "@/src/lib/supabase/config";
import { createClient } from "@/src/lib/supabase/server";

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string };

export function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Resolves the Supabase client + authenticated user for a server action,
 * or a user-facing error when auth/config is unavailable.
 */
export async function requireActionContext(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: User;
    }
  | { ok: false; error: string }
> {
  if (!getOptionalSupabaseConfig()) {
    return failure("Supabase is not configured in this environment.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return failure("You are not logged in.");
  }

  return { ok: true, supabase, user };
}

export function readString(
  formData: FormData,
  name: string,
  { maxLength, required = false }: { maxLength: number; required?: boolean },
): { value: string | null; error?: string } {
  const raw = formData.get(name);

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return required
      ? { value: null, error: `Missing required field: ${name}.` }
      : { value: null };
  }

  const value = raw.trim();

  if (value.length > maxLength) {
    return {
      value: null,
      error: `Field ${name} must be at most ${maxLength} characters.`,
    };
  }

  return { value };
}

/** Parses a newline-separated textarea into a bounded string list. */
export function readStringList(
  formData: FormData,
  name: string,
  { maxItems, maxItemLength }: { maxItems: number; maxItemLength: number },
): { value: string[]; error?: string } {
  const raw = formData.get(name);

  if (typeof raw !== "string") {
    return { value: [] };
  }

  const items = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (items.length > maxItems) {
    return {
      value: [],
      error: `Field ${name} allows at most ${maxItems} entries.`,
    };
  }

  if (items.some((item) => item.length > maxItemLength)) {
    return {
      value: [],
      error: `Entries in ${name} must be at most ${maxItemLength} characters.`,
    };
  }

  return { value: items };
}

export function readNumber(
  formData: FormData,
  name: string,
  { min, max }: { min: number; max: number },
): { value: number | null; error?: string } {
  const raw = formData.get(name);

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { value: null };
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < min || value > max) {
    return {
      value: null,
      error: `Field ${name} must be a number between ${min} and ${max}.`,
    };
  }

  return { value };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
