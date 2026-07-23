"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Wordmark } from "@/components/ui/wordmark";
import { cx } from "@/components/ui/cx";

import { demoProjects, statusTone } from "./demo-data";
import { NewVideoDialog } from "./new-video-dialog";
import {
  ProjectProgress,
  processingStages,
  renderingStages,
} from "./project-progress";
import { ProjectFailed } from "./project-failed";
import { ProjectsList } from "./projects-list";
import { WorkspaceEdit } from "./workspace-edit";
import { WorkspaceOutput } from "./workspace-output";
import { WorkspaceOverview } from "./workspace-overview";
import { WorkspaceScript } from "./workspace-script";
import { WorkspaceStory } from "./workspace-story";

const readyTabs = ["Overview", "Story", "Script", "Edit", "Output"] as const;
type ReadyTab = (typeof readyTabs)[number];

type CreatorAppProps = {
  userEmail: string;
};

export function CreatorApp({ userEmail }: CreatorAppProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(
    demoProjects[0].id,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<ReadyTab>("Overview");

  const selectedProject = useMemo(
    () =>
      demoProjects.find((project) => project.id === selectedProjectId) ??
      demoProjects[0],
    [selectedProjectId],
  );

  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab("Overview");
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* App sidebar */}
      <aside className="flex items-center justify-between border-b border-edge px-5 py-3 lg:w-56 lg:shrink-0 lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:px-0 lg:py-0">
        <div className="lg:border-b lg:border-edge lg:px-5 lg:py-5">
          <Wordmark />
          <p className="mt-1 hidden text-xs text-ink-muted lg:block">
            Video production
          </p>
        </div>

        <nav className="hidden flex-1 space-y-0.5 px-3 py-4 lg:block">
          <button
            className="w-full rounded-sm bg-raised px-2.5 py-2 text-left text-sm font-medium text-ink"
            aria-current="page"
          >
            Projects
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="w-full rounded-sm px-2.5 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-raised hover:text-ink"
          >
            New video
          </button>
          <div
            className="flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left text-sm text-ink-muted"
            title="Settings are not available in the prototype yet"
          >
            Settings
            <span className="text-[10px] font-medium tracking-wide text-ink-muted uppercase">
              Soon
            </span>
          </div>
        </nav>

        <div className="hidden border-t border-edge px-5 py-4 lg:block">
          <p className="text-[11px] tracking-wide text-ink-muted uppercase">
            Prototype · demo data
          </p>
          <p className="mt-2 truncate text-xs text-ink-secondary">
            {userEmail}
          </p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>

        {/* Compact actions on small screens */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreating(true)}
          >
            New video
          </Button>
          <form action="/auth/signout" method="post">
            <Button size="sm" variant="ghost" type="submit">
              Log out
            </Button>
          </form>
        </div>
      </aside>

      {/* Project library */}
      <section className="flex flex-col border-b border-edge lg:w-80 lg:shrink-0 lg:border-r lg:border-b-0">
        <header className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <div>
            <h1 className="text-sm font-semibold text-ink">Projects</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              One production per match
            </p>
          </div>
          <span className="hidden lg:block">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreating(true)}
            >
              New video
            </Button>
          </span>
        </header>
        <div className="max-h-64 overflow-y-auto lg:max-h-none lg:flex-1">
          <ProjectsList
            projects={demoProjects}
            selectedId={selectedProject.id}
            onSelect={selectProject}
          />
        </div>
      </section>

      {/* Project workspace */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-edge px-5 pt-5 sm:px-8 sm:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge
              tone={statusTone[selectedProject.status]}
              label={selectedProject.status}
            />
            <span className="text-xs text-ink-muted">
              Updated {selectedProject.updated}
            </span>
          </div>
          <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {selectedProject.title}
          </h2>
          <p className="mt-1.5 text-sm text-ink-secondary">
            {selectedProject.activity}
          </p>

          {selectedProject.status === "Ready" ? (
            <nav className="mt-5 -mb-px flex gap-6 overflow-x-auto">
              {readyTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-current={activeTab === tab ? "true" : undefined}
                  className={cx(
                    "border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors",
                    activeTab === tab
                      ? "border-accent font-medium text-ink"
                      : "border-transparent text-ink-secondary hover:text-ink",
                  )}
                >
                  {tab}
                </button>
              ))}
            </nav>
          ) : (
            <div className="pb-5" />
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          {selectedProject.status === "Ready" ? (
            <>
              {activeTab === "Overview" ? <WorkspaceOverview /> : null}
              {activeTab === "Story" ? <WorkspaceStory /> : null}
              {activeTab === "Script" ? <WorkspaceScript /> : null}
              {activeTab === "Edit" ? <WorkspaceEdit /> : null}
              {activeTab === "Output" ? <WorkspaceOutput /> : null}
            </>
          ) : null}
          {selectedProject.status === "Processing" ? (
            <ProjectProgress
              heading="Finding important moments"
              description="Creator is reviewing the match for chases, turning points, and story-relevant gameplay."
              stages={processingStages}
            />
          ) : null}
          {selectedProject.status === "Rendering" ? (
            <ProjectProgress
              heading="Creating the final video"
              description="The creative decisions are set. Creator is assembling the final review file — review and download actions appear when the render is ready."
              stages={renderingStages}
            />
          ) : null}
          {selectedProject.status === "Failed" ? (
            <ProjectFailed onCreateNew={() => setIsCreating(true)} />
          ) : null}
        </div>
      </main>

      {isCreating ? (
        <NewVideoDialog onClose={() => setIsCreating(false)} />
      ) : null}
    </div>
  );
}
