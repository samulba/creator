# Creator — Application UX Principles

## Core Principle

Creator should make a technically complex production pipeline feel calm, obvious, and professionally directed. The user should feel in control of creative decisions without being exposed to infrastructure complexity.

## No AI Slop

Creator must not feel like a generic AI wrapper.

Avoid:

- Chat boxes as the default interface.
- “Ask AI” buttons everywhere.
- Sparkle icons.
- Constant generated suggestions.
- Prompt engineering as the main workflow.
- Generic wizard templates.
- Meaningless settings.
- Overconfident AI claims.

Prefer:

- Clear workflow stages.
- Inspectable decisions.
- Plain language.
- Constrained creative controls.
- Reviewable outputs.
- Professional editing concepts.

## Product Personality

Creator should feel:

- Calm.
- Precise.
- Restrained.
- Fast to understand.
- Serious about craft.
- Built for professional output.

Creator should not feel:

- Gimmicky.
- Loud.
- Over-animated.
- Like a game HUD.
- Like a generic SaaS admin template.
- Like an AI chatbot with file upload.

## Interaction Principles

### One obvious next action

Every major screen should have one dominant next action. Secondary actions should be clearly less prominent.

### Reveal complexity progressively

Normal users see the workflow and high-level decisions. Advanced details are available but collapsed.

### Use semantic progress

For long-running processing, show named stages and completed milestones. Avoid fake precision.

### Preserve user trust

If the system fails, say what failed in human terms and what can be done. Do not hide or over-simplify failures.

### Keep creative control high-leverage

Expose controls that meaningfully affect the final video: story angle, pacing, narration, moment inclusion, narrator, and version approval.

Do not expose low-level timeline manipulation unless a future product phase explicitly requires it.

### Never interrupt without value

Do not surface suggestions unless they are tied to a concrete user decision.

### Ground every creative claim

When Creator says a story angle or moment matters, it should be tied to actual gameplay evidence.

## Language Guidelines

Use product language like:

- Preparing footage.
- Understanding gameplay.
- Finding key moments.
- Building the story.
- Writing narration.
- Rendering final video.
- Ready for review.

Avoid infrastructure language like:

- Running Gemini job.
- Proxy transcode step.
- Queue retry attempt.
- FFmpeg render node.
- LLM token generation.

## Decision Copy

When the user makes a change, show the consequence:

- “This will rewrite the narration for this chapter and create a new version.”
- “This will remove the chase from the edit but keep it available to restore.”
- “Changing narrator requires regenerating the voice track.”

## Visual UX Principles

- Prefer lists and structured panels over dense cards.
- Use whitespace to clarify hierarchy.
- Keep borders subtle.
- Use accent color sparingly for action, focus, and active state.
- Avoid decorative gradients except where they improve depth without noise.
- Avoid heavy shadows.
- Avoid excessive rounded corners.
- Avoid neon gaming aesthetics.

## MVP UX Standard

The MVP does not need every advanced control, but every visible interaction must feel intentional and complete. A small, polished workflow is better than a broad, unfinished product surface.
