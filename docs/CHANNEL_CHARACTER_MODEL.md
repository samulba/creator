# Creator — Channel & Character Model

## Why this exists

Per-channel consistency is mission-critical for Creator. A YouTube channel only works when every video feels like the same person made it: the same narrator voice, the same way of speaking, the same narration density, the same pacing, and the same editing style. Creator makes this a first-class, structural concept instead of hoping prompt-by-prompt generation stays consistent.

Two entities carry that identity:

- **Character** — a reusable narrator identity: voice plus speech style.
- **Channel** — one of the user's YouTube channels: creative defaults plus edit-style branding.

Characters are a **user-level library** shared across channels. A rebrand or a second channel can reuse a proven narrator; embedding characters per channel would force copies, and copies drift — the exact failure mode this model exists to prevent.

## Character

A character defines:

- **Identity**: name, description, primary `language`.
- **Voice**: `voice_provider` (ElevenLabs), `voice_key` (provider voice id, not a secret, nullable until Phase 7), `voice_settings` (object: `model_id`, `stability`, `similarity_boost`, `style`, `speed`). Pinning `model_id` per character prevents silent provider-side voice drift.
- **Speech style** (`speech_style` object — the persona constraints consumed by script generation):
  - `tone`, `humor_level`, `energy`, `sentence_length`, `vocabulary_notes`
  - `catchphrases[]` — recurring phrases, used with a frequency budget
  - `forbidden_words[]` — hard exclusions, enforced during script generation
  - `example_lines[]` — 3–8 canonical narration lines. **This is the strongest consistency lever**; the UI should push users to fill it.

Characters are archived rather than deleted in normal use. The server refuses hard deletion while a character is referenced by an active project's active settings.

## Channel

A channel defines:

- **Identity**: name, `youtube_handle`, description, `default_language`.
- **Default character**: `default_character_id`.
- **Creative defaults**: the five dials (`creative_direction`, `pacing`, `narration_density`, `gameplay_preservation`, `target_length`) with the same allowed values as `project_creative_settings`.
- **Edit style** (`edit_style` object of enumerated tokens, not freeform text): `caption_style`, `zoom_usage`, `transition_style`, `intro_style`, `outro_style`.

## The two freeze points (consistency mechanics)

1. **Project creation.** The channel's five dials and `edit_style` are copied **by value** into the project's first `project_creative_settings` version. The character is stored **by reference** (`character_id`). This is intentional: fixing a catchphrase typo on a character must flow into every not-yet-generated video on the channel — that is the consistency goal. Do not "fix" this into a full copy at creation time.
2. **Generation (Phases 6/7).** When script or voice is generated, the character's resolved configuration is frozen into the version rows (`script_versions.narrator_config`, `narration_assets.voice_config`, `generation_metadata`). Later character edits never change existing videos.

There is deliberately **no `character_versions` table**. Generation-time freezing provides reproducibility; character rows stay mutable.

## What "reproducibility" means here

LLM and voice output is not deterministic. Reproducibility means: recorded inputs plus frozen configs plus QC enforcement — not bit-identical regeneration. Every generation must record in `generation_metadata`: `model_id`, `model_version`, `prompt_template_version`, `character_config_hash`, and sampling parameters. Model ids are pinned via configuration, never provider "latest" aliases. Prompt templates are versioned in code.

## Pipeline consumption by phase

| Phase | Consumes |
| --- | --- |
| 1.4 Project creation | Channel defaults + default character → settings snapshot v1; channel `default_language` → `projects.target_language` |
| 6 Story/Script | `speech_style` as persona constraints in prompt assembly; `forbidden_words` enforced; catchphrase budget; template version recorded |
| 7 Voice | `voice_key` + `voice_settings` (model pinned per character); config frozen per narration asset; provider request ids stored |
| 8 Edit | `project_creative_settings.edit_style` tokens drive the edit plan; EDL uses enumerated style tokens |
| 10 Quality control | Channel-consistency check family: forbidden-word scan, catchphrase frequency, tone/style scoring, (later) speaker-similarity regression against a reference sample |
| 11 Experience | Dashboard grouping and filtering by channel |

## Guardrails

- Structured, bounded personas are in scope ("Characters"). A freeform prompt library remains out of scope.
- Character `language` is the character's primary language; a mismatch with the project's `target_language` warns but does not hard-block (provider voices are multilingual).
- Deferred until the `assets` table exists (Phase 2+): per-character reference audio for voice regression checks.

## Schema summary (migration 002)

- `characters` and `channels`: owner-scoped RLS CRUD, `updated_at` triggers, case-insensitive unique active names per user, `unique (id, user_id)` helpers.
- Cross-user integrity is enforced at the database level with composite foreign keys (`(default_character_id, user_id)`, `(channel_id, user_id)`) using PostgreSQL 15+ `on delete set null (column)` — RLS cannot validate referenced rows and service-role code bypasses RLS.
- `project_creative_settings.character_id` ownership is enforced in the RLS `with check` predicates plus server-side validation.
- `profiles.default_character_id` supersedes the deprecated `profiles.default_narrator_key` (kept for now, dropped in a later migration).
