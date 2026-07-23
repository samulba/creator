"use client";

import { useMemo, useState } from "react";
import { EditWorkspace } from "@/components/edit/edit-workspace";
import { OutputWorkspace } from "@/components/output/output-workspace";
import { ProcessingStatus } from "@/components/production/processing-status";
import { ProductionOverview } from "@/components/production/production-overview";
import { NewVideoPanel } from "@/components/projects/new-video-panel";
import { ProjectsList } from "@/components/projects/projects-list";
import { ScriptWorkspace } from "@/components/script/script-workspace";
import { StoryWorkspace } from "@/components/story/story-workspace";

export type ProjectStatus = "Ready" | "Rendering" | "Analyzing" | "Failed";

type Project = {
  id: string;
  title: string;
  duration?: string;
  status: ProjectStatus;
  detail: string;
  updated: string;
};

const projects: Project[] = [
  {
    id: "ghost-face",
    title: "The Ghost Face Who Wouldn’t Leave Me Alone",
    duration: "10:42",
    status: "Ready",
    detail: "Final video ready for review",
    updated: "Today",
  },
  {
    id: "huntress-042",
    title: "Huntress Match 042",
    status: "Analyzing",
    detail: "Processing — Building story",
    updated: "18 min ago",
  },
  {
    id: "gameplay-039",
    title: "Gameplay 039",
    status: "Rendering",
    detail: "Rendering final version",
    updated: "1 hr ago",
  },
  {
    id: "basement-save",
    title: "Basement Save Attempt",
    status: "Failed",
    detail: "Source audio could not be read",
    updated: "Yesterday",
  },
];

const workspaceTabs = ["Overview", "Story", "Script", "Edit", "Output"] as const;
type WorkspaceTab = (typeof workspaceTabs)[number];

export function CreatorApp() {
  const [selectedProjectId, setSelectedProjectId] = useState("ghost-face");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Overview");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [selectedProjectId],
  );

  const isProcessing = selectedProject.status === "Analyzing";

  return (
    <div className="min-h-screen bg-[#07090d] text-stone-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/8 bg-[#090c12] px-5 py-4 lg:w-64 lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="flex items-center justify-between lg:block">
            <div>
              <div className="text-xl font-semibold tracking-tight">Creator</div>
              <p className="mt-1 text-xs text-stone-500">Video production</p>
            </div>
            <button
              className="rounded-md bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 lg:hidden"
              onClick={() => setIsCreating(true)}
            >
              New Video
            </button>
          </div>
          <nav className="mt-8 hidden space-y-1 lg:block">
            {[
              ["Projects", true],
              ["New Video", false],
              ["Settings", false],
            ].map(([label, active]) => (
              <button
                key={String(label)}
                onClick={() => label === "New Video" && setIsCreating(true)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  active ? "bg-white/7 text-white" : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <section className="rounded-xl border border-white/8 bg-[#0d1118] p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
                  <p className="mt-1 text-sm text-stone-500">Long-form YouTube productions</p>
                </div>
                <button
                  className="hidden rounded-md bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 lg:inline-flex"
                  onClick={() => setIsCreating(true)}
                >
                  New Video
                </button>
              </div>
              <ProjectsList projects={projects} selectedId={selectedProject.id} onSelect={setSelectedProjectId} />
            </section>

            <section className="min-w-0 rounded-xl border border-white/8 bg-[#0d1118]">
              <div className="border-b border-white/8 p-4 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="mb-3 inline-flex rounded-md border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-200">
                      {selectedProject.status}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{selectedProject.title}</h2>
                    <p className="mt-2 text-sm text-stone-400">{selectedProject.detail}</p>
                  </div>
                </div>
                {!isProcessing && (
                  <div className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-black/20 p-1">
                    {workspaceTabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-md px-3 py-2 text-sm whitespace-nowrap transition ${
                          activeTab === tab ? "bg-white/10 text-white" : "text-stone-400 hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6">
                {isProcessing ? <ProcessingStatus /> : null}
                {!isProcessing && activeTab === "Overview" ? <ProductionOverview /> : null}
                {!isProcessing && activeTab === "Story" ? <StoryWorkspace /> : null}
                {!isProcessing && activeTab === "Script" ? <ScriptWorkspace /> : null}
                {!isProcessing && activeTab === "Edit" ? <EditWorkspace /> : null}
                {!isProcessing && activeTab === "Output" ? <OutputWorkspace /> : null}
              </div>
            </section>
          </div>
        </main>
      </div>

      {isCreating ? <NewVideoPanel onClose={() => setIsCreating(false)} /> : null}
    </div>
  );
}
