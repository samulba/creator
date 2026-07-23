const structure = [
  ["Hook", "Ghost Face ignores the match and tunnels one chase."],
  ["Setup", "A normal generator start turns into an obsession."],
  ["Escalation", "Every reset leads him back to the same survivor."],
  ["Turning point", "The team realizes the killer is throwing pressure away."],
  ["Climax", "Endgame chase decides whether the obsession pays off."],
  ["Payoff", "The chase becomes the whole story of the match."],
];
export function StoryWorkspace() { return <div className="space-y-5"><section className="rounded-xl border border-white/8 bg-white/[0.025] p-5"><p className="text-xs text-stone-500">Selected story angle</p><h3 className="mt-2 text-xl font-semibold">A Ghost Face sacrifices the entire match just to chase the player.</h3><button className="mt-4 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Change angle</button></section><section className="grid gap-3 md:grid-cols-2">{["The team quietly wins while one chase consumes the killer", "A calm survivor turns a tunnel into free generator pressure"].map((angle) => <button key={angle} className="rounded-lg border border-white/8 bg-white/[0.025] p-4 text-left text-sm text-stone-300 hover:bg-white/[0.05]">{angle}</button>)}</section><section className="rounded-xl border border-white/8 bg-white/[0.025] p-5"><h3 className="font-semibold">Narrative structure</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{structure.map(([label, copy]) => <div key={label} className="rounded-lg bg-black/20 p-4"><p className="text-xs text-sky-200">{label}</p><p className="mt-2 text-sm text-stone-300">{copy}</p></div>)}</div></section></div>; }
