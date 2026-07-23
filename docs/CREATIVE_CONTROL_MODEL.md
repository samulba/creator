# Creator — Creative Control Model

## Purpose

Creator should automate aggressively while giving users high-leverage creative control. The product should not become a full Adobe Premiere clone. It should expose creative direction, story decisions, narration, moment inclusion, and version approval.

## Creative Director Abstraction

Creator should present a compact **Creative Director** model: a small set of meaningful dimensions that shape the final video.

### MVP dimensions

1. **Creative direction**
   - Balanced.
   - Funnier.
   - More Dramatic.
   - More Analytical.

2. **Pacing**
   - Relaxed.
   - Balanced.
   - Tight.

3. **Narration density**
   - Light.
   - Balanced.
   - Detailed.

4. **Gameplay preservation**
   - Preserve more gameplay.
   - Balanced.
   - Cut more aggressively.

### Defaults

Default to Balanced for all dimensions. The New Video flow should ask only for Creative direction and target length initially. Other dimensions can live in the workspace as refinement controls.

## Story Control

Users can:

- View the selected story angle.
- View alternate story angles when available.
- Select another angle.
- See which key moments support each angle.

Users should not:

- Write arbitrary prompts as the primary way to shape story.
- Force story claims unsupported by the gameplay.

## Moment Control

Users can:

- Exclude a gameplay moment.
- Restore an excluded moment.
- Jump to a moment in the video.
- See why a moment was included.

Moment types may include:

- Hook.
- Chase.
- Rescue.
- Mistake.
- Turning point.
- Funny moment.
- Climax.
- Payoff.

Excluding a moment should explain whether it affects story, script, voice, edit, or render.

## Narration Control

Users can:

- Edit selected narration.
- Regenerate selected narration.
- Regenerate narration for a chapter.
- Change narrator.
- Change narration density.

The UI should preserve previous text and create a revision path. Regeneration should be scoped to the selected section whenever possible.

## Edit Control

Users can:

- Adjust pacing globally.
- Adjust gameplay preservation globally.
- Exclude or restore moments.
- Regenerate affected edit sections.
- Compare versions.

Users should not edit:

- Individual frame cuts.
- Raw FFmpeg filters.
- Audio ducking keyframes.
- Low-level caption timings.
- Encoding settings.

## Version Model

Each meaningful creative change should produce a version when it affects rendered output.

A version should preserve:

- Story angle.
- Creative Director settings.
- Script state.
- Narrator.
- Included/excluded moments.
- Edit plan.
- Render output.
- QC status.
- Approval status.

Only one version can be approved at a time.

## Targeted Regeneration

### Regenerate selected narration

Input: script section.

Output: revised text and voice for that section.

May require: edit timing update and partial/full render.

### Change narrator

Input: narrator choice.

Output: regenerated voice track.

May require: audio mix and render.

### Exclude moment

Input: moment.

Output: revised edit plan.

May require: script changes if narration references the moment.

### Change pacing

Input: pacing setting.

Output: revised edit plan and render.

### Select alternate story

Input: story angle.

Output: revised structure, script, voice, edit, and render.

## Final Review Controls

The final review interface should allow:

- Watch final video.
- Open chapter list.
- Jump to story beats.
- Jump to included moments.
- Request change at current timestamp.
- View script for current section.
- Compare current and previous version.
- Approve current version.
- Download approved version.

## Change Request UI

Do not use an open-ended chat box as the default.

Use constrained actions:

- “Rewrite this narration.”
- “Make this section tighter.”
- “Remove this moment.”
- “Use less narration here.”
- “Try a different story angle.”
- “Change narrator.”

A small optional note field may be added after the user chooses a concrete action, but it should not be the main interaction model.

## Guardrails

- The system should reject or warn about unsupported creative requests.
- The system should not fabricate gameplay events.
- The original uploaded source should remain unchanged.
- Previous versions should remain accessible until deleted intentionally.
- User approval should be explicit.

## What Not to Build

Do not build in MVP:

- Full timeline editor.
- Multitrack audio mixer.
- Manual keyframe editor.
- Prompt library.
- Chat-based project assistant.
- Meme effect browser.
- Unlimited style knobs.
- Provider/model selector for normal users.
