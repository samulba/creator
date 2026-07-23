const completed = ["Story approved", "Narration prepared", "Edit assembled"];
const current = ["Creating the final review video"];
const upcoming = ["Check the render", "Prepare download"];

export function RenderingStatus() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <p className="text-sm font-medium text-sky-200">Rendering</p>
      <h3 className="mt-2 text-3xl font-semibold tracking-tight">
        Creating the final video
      </h3>
      <p className="mt-3 text-stone-400">
        The creative decisions are set. Creator is assembling the final review file,
        so review and download actions will appear when the render is ready.
      </p>
      <div className="mt-8 space-y-5">
        <StageGroup title="Completed" items={completed} tone="done" />
        <StageGroup title="Current" items={current} tone="current" />
        <StageGroup title="Upcoming" items={upcoming} tone="upcoming" />
      </div>
    </div>
  );
}

function StageGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "done" | "current" | "upcoming";
}) {
  return (
    <section>
      <h4 className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-500">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3 text-sm"
          >
            <span
              className={
                tone === "current"
                  ? "text-sky-200"
                  : tone === "done"
                    ? "text-stone-200"
                    : "text-stone-500"
              }
            >
              {item}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
