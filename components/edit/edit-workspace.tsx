const sections = [
  { label: "Hook", included: true },
  { label: "First Chase", included: true },
  { label: "Teammate Fail", included: false },
  { label: "Second Chase", included: true },
  { label: "Endgame", included: true },
  { label: "Escape", included: true },
];

const controls = [
  "Pacing: Tight",
  "Gameplay preservation: High",
  "Narration density: Balanced",
  "Editing intensity: Restrained",
];

export function EditWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
        <h3 className="font-semibold">Creative edit</h3>
        <p className="mt-2 text-sm text-stone-400">
          High-level controls for the finished story, without a complex editing timeline.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {sections.map((section) => (
            <button
              key={section.label}
              className={`rounded-lg border p-4 text-left ${
                section.included
                  ? "border-sky-400/20 bg-sky-400/[0.04] text-stone-100"
                  : "border-white/8 bg-black/20 text-stone-500"
              }`}
            >
              <p className="text-sm font-medium">{section.label}</p>
              <p className="mt-2 text-xs">
                {section.included ? "Included" : "Excluded"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {controls.map((control) => (
          <button
            key={control}
            className="rounded-lg border border-white/8 bg-white/[0.025] p-4 text-left text-sm hover:bg-white/[0.05]"
          >
            {control}
          </button>
        ))}
      </div>
    </div>
  );
}
