import type { ProjectStatus } from "@/components/app-shell/creator-app";

type Project = {
  id: string;
  title: string;
  duration?: string;
  status: ProjectStatus;
  detail: string;
  updated: string;
};

const statusClass: Record<ProjectStatus, string> = {
  Ready: "bg-emerald-400/10 text-emerald-200 border-emerald-400/20",
  Rendering: "bg-sky-400/10 text-sky-200 border-sky-400/20",
  Analyzing: "bg-amber-300/10 text-amber-100 border-amber-300/20",
  Failed: "bg-red-400/10 text-red-200 border-red-400/20",
};

export function ProjectsList({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onSelect(project.id)}
          className={`w-full rounded-lg border p-4 text-left transition ${
            selectedId === project.id
              ? "border-sky-400/35 bg-sky-400/8"
              : "border-white/7 bg-white/[0.025] hover:border-white/12 hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-medium leading-5 text-stone-100">{project.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass[project.status]}`}>
              {project.status}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
            <span>{project.duration ?? project.detail}</span>
            <span>{project.updated}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
