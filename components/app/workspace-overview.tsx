import { StageList } from "@/components/ui/stage-list";

import { SectionHeader } from "./section-header";

const productionStages = [
  "Gameplay uploaded",
  "Gameplay understood",
  "Key moments selected",
  "Story built",
  "Narration generated",
  "Edit assembled",
  "Final render ready",
] as const;

const facts = [
  ["Final duration", "10:42"],
  ["Resolution", "1440p review render"],
  ["Narrator", "Calm documentary"],
  [
    "Story angle",
    "A Ghost Face sacrifices the entire match just to chase the player.",
  ],
] as const;

export function WorkspaceOverview() {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-10">
        <div className="flex aspect-video items-center justify-center border border-edge bg-black/40">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-edge-strong">
              <svg
                viewBox="0 0 16 16"
                className="ml-0.5 h-4 w-4 text-ink-secondary"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5 3.5v9l7-4.5-7-4.5z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-ink">
              Final video preview
            </p>
            <p className="tabular mt-1 text-xs text-ink-muted">
              10:42 · 1440p review render
            </p>
          </div>
        </div>

        <section>
          <SectionHeader>How this video was made</SectionHeader>
          <div className="mt-1">
            <StageList
              stages={productionStages.map((label) => ({
                label,
                state: "done",
              }))}
            />
          </div>
        </section>
      </div>

      <aside>
        <SectionHeader>Project</SectionHeader>
        <dl>
          {facts.map(([label, value]) => (
            <div key={label} className="border-b border-edge py-3">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="mt-1 text-sm leading-6 text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
