const completed = ["Preparing footage", "Analyzing match structure"];
const upcoming = ["Building story", "Writing narration", "Creating edit", "Rendering"];

export function ProcessingStatus() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <p className="text-sm font-medium text-sky-200">Understanding gameplay</p>
      <h3 className="mt-2 text-3xl font-semibold tracking-tight">Finding important moments</h3>
      <p className="mt-3 text-stone-400">Creator is identifying chases, turning points, mistakes, and story-relevant gameplay sections.</p>
      <div className="mt-8 space-y-5">
        <Group title="Completed" items={completed} tone="done" />
        <Group title="Current" items={["Finding important moments"]} tone="current" />
        <Group title="Upcoming" items={upcoming} tone="upcoming" />
      </div>
    </div>
  );
}

function Group({ title, items, tone }: { title: string; items: string[]; tone: "done" | "current" | "upcoming" }) {
  return <section><h4 className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-500">{title}</h4><div className="space-y-2">{items.map((item) => <div key={item} className="rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3 text-sm"><span className={tone === "current" ? "text-sky-200" : tone === "done" ? "text-stone-200" : "text-stone-500"}>{item}</span></div>)}</div></section>;
}
