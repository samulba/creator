import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

import { SectionHeader } from "./section-header";

const outputFacts = [
  ["Resolution", "1440p"],
  ["Duration", "10:42"],
  ["Quality check", "Passed"],
  ["Version", "01 · current"],
] as const;

const titleSuggestions = [
  "The Ghost Face Who Wouldn’t Leave Me Alone",
  "He Threw the Match for One Chase",
] as const;

export function WorkspaceOutput() {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <div className="flex items-center justify-between gap-4">
          <StatusBadge tone="ok" label="Final video · Ready" />
        </div>
        <div className="mt-4 aspect-video border border-edge bg-black/40" />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary">Download</Button>
          <Button>Create new version</Button>
        </div>
      </section>

      <aside className="space-y-10">
        <section>
          <SectionHeader>Output</SectionHeader>
          <dl>
            {outputFacts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-edge py-3"
              >
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="tabular text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <SectionHeader>Title suggestions</SectionHeader>
          <ul className="mt-1">
            {titleSuggestions.map((title) => (
              <li
                key={title}
                className="border-b border-edge py-3 text-sm leading-6 text-ink-secondary"
              >
                {title}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeader>Description draft</SectionHeader>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            A Dead by Daylight match where one Ghost Face chase becomes the
            entire story.
          </p>
        </section>
      </aside>
    </div>
  );
}
