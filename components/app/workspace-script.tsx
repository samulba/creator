import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

const sections = [
  {
    time: "00:00",
    section: "Hook",
    narration:
      "He was supposed to be pressuring generators. Instead, Ghost Face found one survivor and made that the entire match.",
    purpose: "Create immediate premise",
  },
  {
    time: "02:18",
    section: "First chase",
    narration:
      "At this point, every second he spends here is time the rest of the team gets for free.",
    purpose: "Explain stakes",
  },
  {
    time: "07:40",
    section: "Endgame",
    narration:
      "This is where the obsession either becomes a strategy or a disaster.",
    purpose: "Set up climax",
  },
] as const;

export function WorkspaceScript() {
  return (
    <div>
      <SectionHeader>Narration script</SectionHeader>
      <ol>
        {sections.map((block) => (
          <li
            key={block.time}
            className="grid gap-3 border-b border-edge py-5 lg:grid-cols-[64px_minmax(0,1fr)_auto] lg:gap-6"
          >
            <span className="tabular pt-0.5 font-mono text-xs text-ink-muted">
              {block.time}
            </span>
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-ink-muted">
                {block.section}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-ink">
                {block.narration}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Purpose: {block.purpose}
              </p>
            </div>
            <div className="flex items-start gap-1">
              <Button size="sm" variant="ghost">
                Edit
              </Button>
              <Button size="sm" variant="ghost">
                Regenerate
              </Button>
              <Button size="sm" variant="ghost">
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-muted">
        Regenerating a section rewrites its narration and voice, then updates
        the affected part of the edit.
      </p>
    </div>
  );
}
