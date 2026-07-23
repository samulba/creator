const stages = ["Gameplay uploaded", "Gameplay understood", "Key moments selected", "Story built", "Narration generated", "Edit assembled", "Final render ready"];

export function ProductionOverview() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
      <div>
        <div className="aspect-video rounded-xl border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-[#101827] p-4">
          <div className="flex h-full items-center justify-center rounded-lg border border-white/6 bg-black/30">
            <div className="text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full border border-white/15 bg-white/5" />
              <p className="font-medium">Final video preview</p>
              <p className="mt-2 text-sm text-stone-500">10:42 · 1440p review render</p>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] p-5">
          <h3 className="font-semibold">Production flow</h3>
          <div className="mt-5 space-y-3">
            {stages.map((stage) => (
              <div key={stage} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                <span>{stage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="space-y-3">
        <Info label="Final duration" value="10:42" />
        <Info label="Story" value="A Ghost Face sacrifices the entire match just to chase the player." />
        <Info label="Narrator" value="Calm documentary" />
        <Info label="Status" value="Ready" />
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-sm text-stone-100">{value}</p></div>;
}
