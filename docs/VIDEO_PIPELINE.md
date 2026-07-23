# Creator — Video Pipeline

## Goal

The video pipeline transforms raw Dead by Daylight gameplay into a polished long-form YouTube video.

The pipeline must be modular, observable, retryable, and designed for high-quality output.

Each stage should have a clearly defined input, output, status, and failure state.

---

## Pipeline Overview

Upload

↓

Source Validation

↓

Media Probe

↓

Proxy Generation

↓

Coarse Gameplay Analysis

↓

Candidate Moment Detection

↓

Deep Analysis

↓

Story Selection

↓

Narrative Structure

↓

Voiceover Script

↓

Voice Generation

↓

Edit Decision List

↓

Automated Edit

↓

Audio Mix

↓

Render

↓

Quality Control

↓

Final Output

---

## Stage 1 — Upload

The user uploads the original gameplay recording.

Requirements:

* support large video files
* avoid routing full uploads through normal Vercel request handlers
* support resumable uploads in a later implementation phase
* preserve the original source file
* store upload metadata
* provide clear upload progress and failure states

The original gameplay file must never be modified.

---

## Stage 2 — Source Validation

Before processing begins, validate the uploaded asset.

Checks should eventually include:

* supported container format
* readable video stream
* readable audio stream where expected
* valid duration
* file integrity
* reasonable resolution
* reasonable frame rate
* supported codecs

Invalid inputs must fail clearly and safely.

---

## Stage 3 — Media Probe

Use FFprobe to extract technical metadata.

Example data:

* duration
* width
* height
* frame rate
* video codec
* audio codec
* audio channels
* bitrate
* file size

Store relevant metadata in structured application data.

---

## Stage 4 — Proxy Generation

Create lower-cost analysis assets from the original gameplay.

The goal is to reduce AI processing cost and improve analysis speed without losing the information required to understand the match.

Possible outputs:

* lower-resolution proxy video
* reduced-frame-rate analysis video
* extracted audio
* selected frame samples
* segmented analysis files

The original source remains the master media for final rendering.

---

## Stage 5 — Coarse Gameplay Analysis

Perform a first-pass analysis of the full gameplay.

The goal is not perfect frame-level understanding.

The goal is to understand the overall match and identify potentially important sections.

Detect information such as:

* match start
* killer identity where detectable
* survivor state
* chases
* hooks
* rescues
* generators
* escapes
* deaths
* strong gameplay moments
* mistakes
* funny events
* unusual teammate behavior
* turning points
* endgame events

Results must be returned in structured machine-readable form.

Avoid relying exclusively on unstructured prose.

---

## Stage 6 — Candidate Moment Detection

Use the coarse analysis to select important time ranges for deeper inspection.

Each candidate should include information such as:

* start timestamp
* end timestamp
* event type
* confidence
* importance score
* reason for selection

Not every part of the gameplay requires expensive detailed analysis.

---

## Stage 7 — Deep Analysis

Analyze selected candidate moments with greater temporal detail.

The goal is to understand:

* what actually happened
* why the moment matters
* player decisions
* killer behavior
* teammate behavior
* cause and effect
* comedic potential
* narrative relevance
* whether the moment should appear in the final video

Deep analysis should improve accuracy before story generation begins.

---

## Stage 8 — Story Selection

The system determines the strongest narrative angle for the video.

Examples:

* a killer becomes obsessed with chasing the player
* an impossible comeback
* terrible teammates create chaos
* one mistake changes the entire match
* an unexpectedly strong killer
* a ridiculous escape
* a sequence of increasingly unlucky events

The selected story must be grounded in actual gameplay events.

Do not invent events that did not happen.

---

## Stage 9 — Narrative Structure

Build a clear story structure.

Typical structure:

Hook

↓

Setup

↓

Escalation

↓

Major Gameplay Moments

↓

Turning Point

↓

Climax

↓

Payoff

The structure should adapt to the actual match.

Strong gameplay should be allowed to breathe without unnecessary narration.

---

## Stage 10 — Voiceover Script

Create narration that supports the gameplay rather than simply describing everything visible on screen.

The script should:

* establish context
* create anticipation
* explain relevant decisions
* add humor
* connect events
* maintain pacing
* avoid redundant narration
* avoid fabricated claims

Narration must reference accurate timestamps or timeline sections.

---

## Stage 11 — Voice Generation

Generate narrator audio through the configured voice provider.

Initial intended provider:

ElevenLabs.

Store:

* source text
* generated audio asset
* voice configuration
* generation metadata
* duration

Voice generation should be reproducible where practical.

---

## Stage 12 — Edit Decision List

Before rendering, create a structured Edit Decision List.

The edit plan should define:

* source ranges to keep
* source ranges to remove
* voiceover placement
* game audio levels
* zooms
* freeze frames
* captions
* transitions where justified
* optional sound effects
* optional music cues

The edit plan must remain inspectable and editable.

Do not hard-code creative decisions directly into rendering logic.

---

## Stage 13 — Automated Edit

Build the final timeline from the Edit Decision List.

Use the original high-quality gameplay source whenever possible.

The editor should prioritize:

* clean pacing
* readable storytelling
* preservation of important gameplay
* intentional cuts
* minimal unnecessary effects

Avoid excessive meme editing or random visual effects.

---

## Stage 14 — Audio Mix

Combine:

* gameplay audio
* narrator voice
* optional music
* optional sound effects

Requirements:

* narrator must remain clearly understandable
* game audio should remain present
* automatic ducking should reduce game audio during narration where needed
* avoid clipping
* avoid abrupt volume changes
* preserve important gameplay audio cues

---

## Stage 15 — Render

Render the final long-form YouTube video.

Initial target:

* high-quality MP4
* suitable for YouTube upload
* preserve source quality where reasonable
* predictable codec configuration
* valid audio/video synchronization

Rendering must run on the dedicated video worker.

---

## Stage 16 — Quality Control

Before marking a video complete, perform automated checks.

Technical checks:

* output file exists
* output is readable
* video stream is valid
* audio stream is valid
* expected duration
* no obvious render corruption
* no missing required assets

Creative checks may eventually include:

* hook quality
* pacing
* story clarity
* narration accuracy
* excessive dead time
* repeated content
* missing payoff
* narration timing

Quality-control failures must be visible.

The system may eventually create a revised version automatically, but this should not be assumed in the initial implementation.

---

## Stage 17 — Final Output

The completed project should eventually provide:

* final rendered video
* video preview
* download option
* final title suggestions
* description draft
* thumbnail concept
* script
* analysis
* edit plan

The primary product output is the finished long-form YouTube video.

---

## Pipeline Rules

1. Never modify or overwrite the original gameplay source.
2. Every major stage must have an explicit status.
3. Failed stages must provide meaningful error information.
4. Expensive stages should be independently retryable where safe.
5. AI-generated claims must remain grounded in analyzed gameplay.
6. Structured data should be preferred between pipeline stages.
7. Final rendering must use high-quality source media, not low-quality analysis proxies.
8. Creative logic and rendering logic must remain separated.
9. Do not build Shorts or vertical-video processing into the initial pipeline.
10. Quality is more important than maximum processing speed.
