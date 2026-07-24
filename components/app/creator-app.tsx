"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cx } from "@/components/ui/cx";
import { deleteProject, setProjectArchived } from "@/src/lib/actions/projects";
import type {
  AssetRow,
  ChannelRow,
  CharacterRow,
  ProjectCreativeSettingsRow,
  ProjectPipelineState,
  ProjectRow,
  UserJobRow,
} from "@/src/lib/supabase/database.types";

import { AppSidebar } from "./app-sidebar";
import { demoProjects, statusTone } from "./demo-data";
import { NewVideoDialog } from "./new-video-dialog";
import { ProjectDraft } from "./project-draft";
import { ProjectPipeline } from "./project-pipeline";
import { ProjectReview } from "./project-review";
import { ProjectFailed } from "./project-failed";
import {
  ProjectProgress,
  processingStages,
  renderingStages,
} from "./project-progress";
import { ProjectsList, type ProjectListItem } from "./projects-list";
import { WorkspaceEdit } from "./workspace-edit";
import { WorkspaceOutput } from "./workspace-output";
import { WorkspaceOverview } from "./workspace-overview";
import { WorkspaceScript } from "./workspace-script";
import { WorkspaceStory } from "./workspace-story";

const readyTabs = ["Overview", "Story", "Script", "Edit", "Output"] as const;
type ReadyTab = (typeof readyTabs)[number];

/** User-facing display for the canonical pipeline states (Phase 1.4:
 * real projects are drafts until uploads/processing exist). */
const pipelineDisplay: Record<
  ProjectPipelineState,
  { label: string; tone: StatusTone; activity: string }
> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    activity: "Waiting for gameplay upload",
  },
  uploading: { label: "Uploading", tone: "info", activity: "Uploading source" },
  preparing: {
    label: "Preparing",
    tone: "info",
    activity: "Preparing footage",
  },
  understanding_gameplay: {
    label: "Processing",
    tone: "info",
    activity: "Understanding gameplay",
  },
  building_story: {
    label: "Processing",
    tone: "info",
    activity: "Building the story",
  },
  generating_voice: {
    label: "Processing",
    tone: "info",
    activity: "Generating voice",
  },
  building_edit: {
    label: "Processing",
    tone: "info",
    activity: "Building the edit",
  },
  rendering: {
    label: "Rendering",
    tone: "info",
    activity: "Rendering final video",
  },
  checking_quality: {
    label: "Quality check",
    tone: "info",
    activity: "Checking quality",
  },
  ready_for_review: {
    label: "Ready",
    tone: "ok",
    activity: "Final video ready for review",
  },
  approved: { label: "Approved", tone: "ok", activity: "Approved" },
  failed: { label: "Failed", tone: "danger", activity: "Needs attention" },
  cancelled: { label: "Cancelled", tone: "neutral", activity: "Cancelled" },
  archived: { label: "Archived", tone: "neutral", activity: "Archived" },
  deleting: { label: "Deleting", tone: "neutral", activity: "Deleting" },
};

/** Pipeline states where the worker is actively progressing the project, so
 * the UI should poll for updates. Terminal/idle states are excluded. */
const LIVE_STATES = new Set<ProjectPipelineState>([
  "preparing",
  "understanding_gameplay",
  "building_story",
  "generating_voice",
  "building_edit",
  "rendering",
  "checking_quality",
]);

const REFRESH_INTERVAL_MS = 6000;

type CreatorAppProps = {
  userEmail: string;
  projects: ProjectRow[];
  settings: ProjectCreativeSettingsRow[];
  channels: ChannelRow[];
  characters: CharacterRow[];
  sourceAssets: AssetRow[];
  jobs: UserJobRow[];
  /** False while migration 002 has not been applied to the database yet. */
  schemaReady: boolean;
  /** False while migration 003 has not been applied to the database yet. */
  assetsReady: boolean;
  /** False while the R2_* environment variables are absent. */
  storageConfigured: boolean;
};

export function CreatorApp({
  userEmail,
  projects,
  settings,
  channels,
  characters,
  sourceAssets,
  jobs,
  schemaReady,
  assetsReady,
  storageConfigured,
}: CreatorAppProps) {
  const router = useRouter();
  const [view, setView] = useState<"projects" | "preview">("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [selectedDemoId, setSelectedDemoId] = useState(demoProjects[0].id);
  const [demoTab, setDemoTab] = useState<ReadyTab>("Overview");
  const [isCreating, setIsCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Selecting a project also clears any pending delete confirmation.
  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setConfirmingDelete(false);
  };

  const settingsByProject = useMemo(() => {
    const map = new Map<string, ProjectCreativeSettingsRow>();
    for (const row of settings) {
      map.set(row.project_id, row);
    }
    return map;
  }, [settings]);

  const sourceAssetByProject = useMemo(() => {
    const map = new Map<string, AssetRow>();
    for (const asset of sourceAssets) {
      map.set(asset.project_id, asset);
    }
    return map;
  }, [sourceAssets]);

  const jobsByProject = useMemo(() => {
    const map = new Map<string, UserJobRow[]>();
    for (const job of jobs) {
      const list = map.get(job.project_id) ?? [];
      list.push(job);
      map.set(job.project_id, list);
    }
    return map;
  }, [jobs]);

  const channelNameById = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel.name])),
    [channels],
  );
  const characterNameById = useMemo(
    () =>
      new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  );

  const projectItems: ProjectListItem[] = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        title: project.title,
        statusLabel: pipelineDisplay[project.pipeline_state].label,
        statusTone: pipelineDisplay[project.pipeline_state].tone,
        updated: project.updated_at.slice(0, 10),
      })),
    [projects],
  );

  const demoItems: ProjectListItem[] = useMemo(
    () =>
      demoProjects.map((project) => ({
        id: project.id,
        title: project.title,
        statusLabel: project.status,
        statusTone: statusTone[project.status],
        trailing: project.duration,
        updated: project.updated,
      })),
    [],
  );

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ??
    projects[0] ??
    null;
  const selectedDemo =
    demoProjects.find((project) => project.id === selectedDemoId) ??
    demoProjects[0];

  // While any real project is actively processing, poll server state so the
  // pipeline view advances on its own as the worker completes stages.
  const hasLiveProject = projects.some((project) =>
    LIVE_STATES.has(project.pipeline_state),
  );
  useEffect(() => {
    if (view === "preview" || !hasLiveProject) {
      return;
    }
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [view, hasLiveProject, router]);

  const runProjectAction = async (
    action: () => Promise<{ ok: boolean } & { error?: string }>,
  ): Promise<boolean> => {
    setPending(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error ?? "The action failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setActionError("The action failed. Check your connection and retry.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const isPreview = view === "preview";

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <AppSidebar
        userEmail={userEmail}
        active={isPreview ? "preview" : "projects"}
        onNavigate={setView}
        onNewVideo={() => setIsCreating(true)}
      />

      {/* Project library */}
      <section className="flex flex-col border-b border-edge bg-sunken/30 lg:w-80 lg:shrink-0 lg:border-r lg:border-b-0">
        <header className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">
              {isPreview ? "Product preview" : "Projects"}
            </h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {isPreview
                ? "Demo data — target experience"
                : "One production per match"}
            </p>
          </div>
          {!isPreview ? (
            <span className="hidden lg:block">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsCreating(true)}
              >
                New video
              </Button>
            </span>
          ) : null}
        </header>
        <div className="max-h-64 overflow-y-auto lg:max-h-none lg:flex-1">
          {isPreview ? (
            <ProjectsList
              items={demoItems}
              selectedId={selectedDemo.id}
              onSelect={(id) => {
                setSelectedDemoId(id);
                setDemoTab("Overview");
              }}
            />
          ) : projectItems.length ? (
            <ProjectsList
              items={projectItems}
              selectedId={selectedProject?.id ?? ""}
              onSelect={selectProject}
            />
          ) : (
            <p className="px-5 py-6 text-xs leading-5 text-ink-muted">
              No projects yet.
            </p>
          )}
        </div>
      </section>

      {/* Workspace */}
      <main className="dot-grid relative flex min-w-0 flex-1 flex-col">
        {isPreview ? (
          <DemoWorkspace
            selectedDemo={selectedDemo}
            demoTab={demoTab}
            setDemoTab={setDemoTab}
            onCreateNew={() => setIsCreating(true)}
          />
        ) : (
          <>
            {!schemaReady ? (
              <div className="border-b border-edge px-5 py-3 sm:px-8">
                <p className="text-[13px] leading-5 text-warn">
                  Database migration pending: run{" "}
                  <code className="font-mono text-xs">
                    supabase/migrations/002_channels_and_characters.sql
                  </code>{" "}
                  in the Supabase SQL Editor, then reload. Channels, characters,
                  and project creation are unavailable until then.
                </p>
              </div>
            ) : null}

            {actionError ? (
              <div className="border-b border-edge px-5 py-3 sm:px-8">
                <p className="text-[13px] leading-5 text-danger">
                  {actionError}
                </p>
              </div>
            ) : null}

            {selectedProject ? (
              <>
                <header className="relative z-10 border-b border-edge bg-canvas px-5 pt-5 pb-6 sm:px-8 sm:pt-6">
                  {/* Breadcrumb + actions */}
                  <div className="flex items-center justify-between gap-3">
                    <nav className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                      <span>Projects</span>
                      {selectedProject.channel_id &&
                      channelNameById.get(selectedProject.channel_id) ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="text-ink-muted/50"
                          >
                            /
                          </span>
                          <span className="truncate text-ink-secondary">
                            {channelNameById.get(selectedProject.channel_id)}
                          </span>
                        </>
                      ) : null}
                    </nav>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-ink-muted sm:inline">
                        Updated {selectedProject.updated_at.slice(0, 10)}
                      </span>
                      {confirmingDelete ? (
                        <span className="flex items-center gap-2">
                          <span className="hidden text-xs text-ink-muted sm:inline">
                            Delete this project?
                          </span>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={pending}
                            onClick={async () => {
                              const ok = await runProjectAction(() =>
                                deleteProject(selectedProject.id),
                              );
                              // Keep the selection when deletion failed so
                              // the user still looks at the affected project.
                              if (ok) {
                                setConfirmingDelete(false);
                                setSelectedProjectId(null);
                              }
                            }}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setConfirmingDelete(false)}
                          >
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label="Delete project"
                          disabled={pending}
                          onClick={() => setConfirmingDelete(true)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-ink-muted transition-colors hover:border-edge hover:bg-raised hover:text-danger disabled:opacity-50"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 4h11M6 4V2.5h4V4M4.5 4l.5 9h6l.5-9M6.5 6.5v4M9.5 6.5v4" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title + live status */}
                  <h2 className="mt-4 max-w-3xl text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-3xl">
                    {selectedProject.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusBadge
                      tone={
                        pipelineDisplay[selectedProject.pipeline_state].tone
                      }
                      label={
                        pipelineDisplay[selectedProject.pipeline_state].label
                      }
                      pulse={LIVE_STATES.has(selectedProject.pipeline_state)}
                    />
                    <span className="text-sm text-ink-secondary">
                      {selectedProject.pipeline_state === "draft" &&
                      sourceAssetByProject.get(selectedProject.id)?.status ===
                        "available"
                        ? "Source uploaded — ready to process"
                        : pipelineDisplay[selectedProject.pipeline_state]
                            .activity}
                    </span>
                  </div>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                  {selectedProject.pipeline_state === "ready_for_review" ||
                  selectedProject.pipeline_state === "approved" ? (
                    <ProjectReview
                      key={selectedProject.id}
                      project={selectedProject}
                      onRefresh={() => router.refresh()}
                    />
                  ) : selectedProject.pipeline_state !== "draft" &&
                    selectedProject.pipeline_state !== "archived" ? (
                    <ProjectPipeline
                      key={selectedProject.id}
                      project={selectedProject}
                      jobs={jobsByProject.get(selectedProject.id) ?? []}
                      onRefresh={() => router.refresh()}
                    />
                  ) : (
                    <ProjectDraft
                      key={selectedProject.id}
                      project={selectedProject}
                      settings={
                        settingsByProject.get(selectedProject.id) ?? null
                      }
                      sourceAsset={
                        sourceAssetByProject.get(selectedProject.id) ?? null
                      }
                      storageConfigured={storageConfigured}
                      assetsReady={assetsReady}
                      onRefresh={() => router.refresh()}
                      channelName={
                        selectedProject.channel_id
                          ? (channelNameById.get(selectedProject.channel_id) ??
                            null)
                          : null
                      }
                      characterName={(() => {
                        const characterId = settingsByProject.get(
                          selectedProject.id,
                        )?.character_id;
                        return characterId
                          ? (characterNameById.get(characterId) ?? null)
                          : null;
                      })()}
                      pending={pending}
                      onArchive={() =>
                        runProjectAction(() =>
                          setProjectArchived(selectedProject.id, true),
                        )
                      }
                      onDelete={() =>
                        runProjectAction(() =>
                          deleteProject(selectedProject.id),
                        )
                      }
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-start px-5 py-8 sm:px-8">
                <EmptyState
                  title="Start your first production"
                  description="Create a project for one Dead by Daylight match. The channel you pick defines the narrator, speech style, and edit style, so every video on that channel feels identical."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => setIsCreating(true)}
                      disabled={!schemaReady}
                    >
                      New video
                    </Button>
                  }
                  note="Uploads and processing arrive with Phase 2 — projects keep their setup until then."
                />
              </div>
            )}
          </>
        )}
      </main>

      {isCreating && schemaReady ? (
        <NewVideoDialog
          channels={channels}
          characters={characters}
          onClose={() => setIsCreating(false)}
          onCreated={(projectId) => {
            setIsCreating(false);
            setView("projects");
            if (projectId) {
              setSelectedProjectId(projectId);
            }
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** The pre-pipeline prototype workspace, kept as a clearly labeled preview
 * of the target experience. Runs entirely on demo data. */
function DemoWorkspace({
  selectedDemo,
  demoTab,
  setDemoTab,
  onCreateNew,
}: {
  selectedDemo: (typeof demoProjects)[number];
  demoTab: ReadyTab;
  setDemoTab: (tab: ReadyTab) => void;
  onCreateNew: () => void;
}) {
  return (
    <>
      <div className="border-b border-edge bg-raised/60 px-5 py-2.5 sm:px-8">
        <p className="text-xs leading-5 text-ink-secondary">
          <span className="font-semibold text-ink">Product preview.</span> Demo
          data only — this is the experience the pipeline phases (2–10) build
          toward. Nothing here touches your real projects.
        </p>
      </div>
      <header className="border-b border-edge px-5 pt-5 sm:px-8 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge
            tone={statusTone[selectedDemo.status]}
            label={selectedDemo.status}
          />
          <span className="text-xs text-ink-muted">
            Updated {selectedDemo.updated}
          </span>
        </div>
        <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {selectedDemo.title}
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {selectedDemo.activity}
        </p>

        {selectedDemo.status === "Ready" ? (
          <nav className="mt-5 -mb-px flex gap-6 overflow-x-auto">
            {readyTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setDemoTab(tab)}
                aria-current={demoTab === tab ? "true" : undefined}
                className={cx(
                  "border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors",
                  demoTab === tab
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
        {selectedDemo.status === "Ready" ? (
          <>
            {demoTab === "Overview" ? <WorkspaceOverview /> : null}
            {demoTab === "Story" ? <WorkspaceStory /> : null}
            {demoTab === "Script" ? <WorkspaceScript /> : null}
            {demoTab === "Edit" ? <WorkspaceEdit /> : null}
            {demoTab === "Output" ? <WorkspaceOutput /> : null}
          </>
        ) : null}
        {selectedDemo.status === "Processing" ? (
          <ProjectProgress
            heading="Finding important moments"
            description="Creator is reviewing the match for chases, turning points, and story-relevant gameplay."
            stages={processingStages}
          />
        ) : null}
        {selectedDemo.status === "Rendering" ? (
          <ProjectProgress
            heading="Creating the final video"
            description="The creative decisions are set. Creator is assembling the final review file — review and download actions appear when the render is ready."
            stages={renderingStages}
          />
        ) : null}
        {selectedDemo.status === "Failed" ? (
          <ProjectFailed onCreateNew={onCreateNew} />
        ) : null}
      </div>
    </>
  );
}
