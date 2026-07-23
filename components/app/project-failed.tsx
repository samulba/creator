import { Button } from "@/components/ui/button";

export function ProjectFailed({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h3 className="text-2xl font-semibold tracking-tight text-ink">
        Creator could not continue with this gameplay
      </h3>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        The source audio could not be read clearly enough to prepare a reliable
        video. Nothing was published or exported.
      </p>

      <div className="mt-8 border-l-2 border-danger/60 pl-5">
        <h4 className="text-sm font-medium text-ink">What you can do</h4>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-secondary">
          <li>Use a gameplay recording with a readable audio track.</li>
          <li>Start a new video when you have a corrected source file.</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" onClick={onCreateNew}>
          New video
        </Button>
        <Button>Keep for later</Button>
      </div>
    </div>
  );
}
