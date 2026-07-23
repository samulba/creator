export function NewVideoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1118] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">New Video</h2>
            <p className="mt-2 text-sm text-stone-400">Start with gameplay. Creator will turn it into a reviewable long-form video.</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-stone-400 hover:bg-white/5 hover:text-white">Close</button>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-sky-300/30 bg-sky-400/[0.04] px-6 py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-sky-300/25 bg-sky-300/10" />
          <p className="text-lg font-medium">Drop gameplay here</p>
          <p className="mt-2 text-sm text-stone-400">Supported gameplay recording · MP4 or MOV prototype</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {["Video language: English", "Narrator: Calm documentary", "Target length: 8–12 minutes", "Creative profile: Story-first"].map((option) => (
            <button key={option} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-sm text-stone-200 hover:bg-white/[0.05]">
              {option}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-stone-400 hover:text-white">Cancel</button>
          <button onClick={onClose} className="rounded-md bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300">Create Video</button>
        </div>
      </section>
    </div>
  );
}
