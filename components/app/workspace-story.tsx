import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

const structure = [
  ["Hook", "Ghost Face ignores the match and tunnels one chase."],
  ["Setup", "A normal generator start turns into an obsession."],
  ["Escalation", "Every reset leads him back to the same survivor."],
  ["Turning point", "The team realizes the killer is throwing pressure away."],
  ["Climax", "Endgame chase decides whether the obsession pays off."],
  ["Payoff", "The chase becomes the whole story of the match."],
] as const;

const alternatives = [
  "The team quietly wins while one chase consumes the killer",
  "A calm survivor turns a tunnel into free generator pressure",
] as const;

export function WorkspaceStory() {
  return (
    <div className="space-y-10">
      <section>
        <SectionHeader>Selected story direction</SectionHeader>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h4 className="text-xl leading-8 font-semibold tracking-tight text-ink">
              A Ghost Face sacrifices the entire match just to chase the player.
            </h4>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              This gives the video a simple premise viewers can understand
              immediately.
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader>Narrative structure</SectionHeader>
        <ol className="mt-1 grid md:grid-cols-2 md:gap-x-10">
          {structure.map(([label, copy], index) => (
            <li key={label} className="flex gap-4 border-b border-edge py-3.5">
              <span className="tabular w-6 shrink-0 pt-0.5 font-mono text-xs text-ink-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-1 text-sm leading-6 text-ink-secondary">
                  {copy}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHeader>Other possible angles</SectionHeader>
        <ul>
          {alternatives.map((angle) => (
            <li
              key={angle}
              className="flex flex-col gap-3 border-b border-edge py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm leading-6 text-ink-secondary">{angle}</p>
              <Button size="sm" variant="ghost" className="shrink-0">
                Use this angle
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Choosing another angle rewrites the story, narration, and edit, and
          creates a new version.
        </p>
      </section>
    </div>
  );
}
