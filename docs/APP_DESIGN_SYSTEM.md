# Creator — Application Design System

## Visual Direction

Creator should use a near-black, neutral dark-first interface with a subtle Framepath blue accent. The style should be clean, precise, restrained, and professional.

Avoid neon gaming aesthetics, excessive glassmorphism, loud gradients, heavy shadows, AI cliché visuals, or generic SaaS dashboard density.

## Color

### Backgrounds

- App background: near-black neutral.
- Primary surface: slightly elevated dark neutral.
- Secondary surface: subtle contrast from background.
- Input surface: dark neutral with clear border.

### Text

- Primary text: high-contrast off-white.
- Secondary text: muted neutral.
- Tertiary text: low-emphasis neutral.
- Disabled text: visibly muted but readable.

### Accent

Use Framepath blue sparingly for:

- Primary actions.
- Focus rings.
- Active navigation state.
- Progress highlights.
- Selected version or selected chapter.

### Status colors

- Processing: blue.
- Success/ready: green used sparingly.
- Warning: amber.
- Failure: red.
- Cancelled/archived: muted neutral.

Status colors should not dominate the screen.

## Typography

### Philosophy

Use high-quality, readable typography with clear hierarchy. Avoid overly futuristic or gaming-style fonts.

### Hierarchy

- Page title: clear, calm, not oversized.
- Section title: compact and structured.
- Body: highly readable.
- Metadata: smaller, muted, but legible.
- Buttons: medium weight, concise labels.

## Spacing

- Prefer generous outer margins.
- Use consistent spacing scale.
- Group related controls tightly.
- Separate unrelated sections with whitespace rather than heavy dividers.
- Maintain precise alignment across rows, panels, and controls.

## Surfaces

Use cards only where they define a clear object:

- Project row/card.
- Upload area.
- Review side panel.
- Version row.
- Error panel.

Avoid card nesting. Prefer flat, structured panels.

## Borders and Radii

- Borders should be subtle and functional.
- Radii should be restrained.
- Avoid pill-shaped everything.
- Use sharper professional forms for workspace panels.

## Shadows

Use minimal shadows. Depth should primarily come from contrast, spacing, and borders.

## Buttons

### Primary button

Used for one dominant action per screen.

Examples:

- Create Video.
- Review Video.
- Approve.
- Download.

### Secondary button

Used for safe alternate actions.

Examples:

- Change settings.
- Compare versions.
- View story.

### Destructive button

Used only with confirmation.

Examples:

- Delete project.
- Cancel processing.

## Forms

- Keep forms short.
- Use plain labels.
- Avoid clever placeholder text.
- Validate before submission where possible.
- Explain consequences for settings that trigger regeneration.

## Progress Components

### Upload progress

Can use true percentage because file transfer progress is measurable.

### Processing progress

Use semantic stage progress, not fake exact percentages.

Components:

- Current stage label.
- Stage description.
- Completed stage list.
- Current activity line.
- Partial results when available.

## Empty States

Empty states should be useful and quiet:

- One sentence explaining what is possible.
- One primary action.
- Optional small note about supported input.

No large mascot illustrations or AI-themed graphics.

## Responsive Behavior

### Desktop

- Dashboard uses structured lists.
- Review screen uses player plus side panel.
- Project workspace can use tabs or side navigation.

### Tablet

- Side panels become stacked panels.
- Primary action remains visible.

### Mobile

Mobile should support monitoring, review, and downloads where possible, but full creative revision workflows may be optimized for larger screens. Do not make mobile-specific vertical video features.

## Motion

Motion should be subtle and functional:

- Upload transitions.
- Stage completion changes.
- Panel expansion.
- Version switch.

Avoid celebratory animations, bouncing loaders, and excessive shimmer effects.

## Iconography

Use icons sparingly for recognition, not decoration. Avoid sparkle icons and generic AI magic symbols.

## Accessibility

- Maintain sufficient contrast.
- Provide visible focus states.
- Do not rely only on color for status.
- Ensure keyboard navigation for primary workflows.
- Provide readable status text for assistive technologies.
