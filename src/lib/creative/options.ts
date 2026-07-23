import type {
  CreativeDirection,
  GameplayPreservation,
  NarrationDensity,
  Pacing,
  TargetLength,
} from "@/src/lib/supabase/database.types";

/**
 * Canonical option lists for the creative dials, edit-style tokens, and
 * speech-style enumerations. Shared by forms (labels) and server actions
 * (validation) so the allowed values exist in exactly one place.
 * Values must stay in sync with the database check constraints
 * (see supabase migrations 001/002) and docs/CHANNEL_CHARACTER_MODEL.md.
 */

export type Option<T extends string = string> = {
  value: T;
  label: string;
};

export const creativeDirectionOptions: Option<CreativeDirection>[] = [
  { value: "balanced", label: "Balanced" },
  { value: "funnier", label: "Funnier" },
  { value: "more_dramatic", label: "More dramatic" },
  { value: "more_analytical", label: "More analytical" },
];

export const pacingOptions: Option<Pacing>[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "tight", label: "Tight" },
];

export const narrationDensityOptions: Option<NarrationDensity>[] = [
  { value: "light", label: "Light" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

export const gameplayPreservationOptions: Option<GameplayPreservation>[] = [
  { value: "preserve_more", label: "Preserve more gameplay" },
  { value: "balanced", label: "Balanced" },
  { value: "cut_more_aggressively", label: "Cut more aggressively" },
];

export const targetLengthOptions: Option<TargetLength>[] = [
  { value: "auto", label: "Auto (8–15 min)" },
  { value: "shorter", label: "Shorter" },
  { value: "standard", label: "Standard" },
  { value: "longer", label: "Longer" },
];

/** Edit-style branding tokens (channels.edit_style / settings snapshot). */
export const editStyleOptions = {
  caption_style: [
    { value: "none", label: "No captions" },
    { value: "minimal", label: "Minimal" },
    { value: "standard", label: "Standard" },
    { value: "expressive", label: "Expressive" },
  ],
  zoom_usage: [
    { value: "none", label: "No zooms" },
    { value: "subtle", label: "Subtle" },
    { value: "moderate", label: "Moderate" },
    { value: "frequent", label: "Frequent" },
  ],
  transition_style: [
    { value: "cut_only", label: "Cuts only" },
    { value: "subtle", label: "Subtle" },
    { value: "dynamic", label: "Dynamic" },
  ],
  intro_style: [
    { value: "cold_open", label: "Cold open" },
    { value: "hook_first", label: "Hook first" },
    { value: "narrated_intro", label: "Narrated intro" },
  ],
  outro_style: [
    { value: "hard_end", label: "Hard end" },
    { value: "payoff_summary", label: "Payoff summary" },
    { value: "call_to_action", label: "Call to action" },
  ],
} as const satisfies Record<string, readonly Option[]>;

export type EditStyleKey = keyof typeof editStyleOptions;

export const editStyleKeys = Object.keys(editStyleOptions) as EditStyleKey[];

/** Speech-style enumerations (characters.speech_style). */
export const humorLevelOptions: Option[] = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

export const energyOptions: Option[] = [
  { value: "calm", label: "Calm" },
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
];

export const sentenceLengthOptions: Option[] = [
  { value: "short", label: "Short" },
  { value: "mixed", label: "Mixed" },
  { value: "long", label: "Long" },
];

export function isOptionValue<T extends string>(
  value: string,
  options: readonly Option<T>[],
): value is T {
  return options.some((option) => option.value === value);
}

export function labelFor(
  options: readonly Option[],
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  return options.find((option) => option.value === value)?.label ?? value;
}
