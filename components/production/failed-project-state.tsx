export function FailedProjectState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <p className="text-sm font-medium text-red-200">Needs attention</p>
      <h3 className="mt-2 text-3xl font-semibold tracking-tight">
        Creator could not continue with this gameplay
      </h3>
      <p className="mt-3 text-stone-400">
        The source audio could not be read clearly enough to prepare a reliable video.
        Nothing was published or exported.
      </p>

      <div className="mt-8 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-5">
        <h4 className="font-medium text-red-100">What you can do</h4>
        <div className="mt-4 space-y-3 text-sm text-stone-300">
          <p>Use a gameplay recording with a readable audio track.</p>
          <p>Start a new video when you have a corrected source file.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300"
            onClick={onCreateNew}
          >
            New Video
          </button>
          <button className="rounded-md border border-white/10 px-4 py-2 text-sm text-stone-200 hover:bg-white/[0.05]">
            Keep for later
          </button>
        </div>
      </div>
    </div>
  );
}
