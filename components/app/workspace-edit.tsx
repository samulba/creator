import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

import { SectionHeader } from "./section-header";

const moments = [
  { label: "Hook", included: true },
  { label: "First chase", included: true },
  { label: "Teammate fail", included: false },
  { label: "Second chase", included: true },
  { label: "Endgame", included: true },
  { label: "Escape", included: true },
] as const;

const controls = [
  ["Pacing", "Tight"],
  ["Gameplay preservation", "High"],
  ["Narration density", "Balanced"],
  ["Editing intensity", "Restrained"],
] as const;

export function WorkspaceEdit() {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <SectionHeader>Included moments</SectionHeader>
        <ul>
          {moments.map((moment) => (
            <li
              key={moment.label}
              className="flex items-center justify-between gap-4 border-b border-edge py-3"
            >
              <div className="flex items-center gap-4">
                <StatusBadge
                  tone={moment.included ? "ok" : "neutral"}
                  label={moment.included ? "Included" : "Excluded"}
                  className="w-20"
                />
                <p
                  className={
                    moment.included
                      ? "text-sm text-ink"
                      : "text-sm text-ink-muted line-through decoration-ink-muted/50"
                  }
                >
                  {moment.label}
                </p>
              </div>
              <Button size="sm" variant="ghost">
                {moment.included ? "Exclude" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Excluding a moment updates the edit plan. Narration that references it
          is rewritten before the next render.
        </p>
      </section>

      <aside>
        <SectionHeader>Creative direction</SectionHeader>
        <dl>
          {controls.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 border-b border-edge py-3"
            >
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-5 text-ink-muted">
          High-level controls shape the finished video. Creator does not expose
          a frame-level timeline editor.
        </p>
      </aside>
    </div>
  );
}
