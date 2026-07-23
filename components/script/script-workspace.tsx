const blocks = [
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
    narration: "This is where the obsession either becomes a strategy or a disaster.",
    purpose: "Set up climax",
  },
];

export function ScriptWorkspace() {
  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <article
          key={block.time}
          className="rounded-xl border border-white/8 bg-white/[0.025] p-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs text-stone-500">
                {block.time} · {block.section}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-100">
                {block.narration}
              </p>
              <p className="mt-3 text-xs text-stone-500">
                Purpose: {block.purpose}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <button className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/5">
                Edit
              </button>
              <button className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/5">
                Regenerate line
              </button>
              <button className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/5">
                Remove
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
