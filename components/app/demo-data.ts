import type { StatusTone } from "@/components/ui/status-badge";

/**
 * DEMO DATA — local prototype only.
 *
 * The /app workspace is currently a UI prototype. Nothing in this file is
 * read from Supabase, no upload/processing pipeline exists yet, and all
 * actions inside the workspace operate on this in-memory list. When the
 * real project model lands (Phase 1.4+), this file is replaced by data
 * loaded through the Supabase clients.
 */

export type ProjectStatus = "Ready" | "Rendering" | "Processing" | "Failed";

export type DemoProject = {
  id: string;
  title: string;
  duration?: string;
  status: ProjectStatus;
  activity: string;
  updated: string;
};

export const statusTone: Record<ProjectStatus, StatusTone> = {
  Ready: "ok",
  Rendering: "info",
  Processing: "info",
  Failed: "danger",
};

export const demoProjects: DemoProject[] = [
  {
    id: "ghost-face",
    title: "The Ghost Face Who Wouldn’t Leave Me Alone",
    duration: "10:42",
    status: "Ready",
    activity: "Final video ready for review",
    updated: "Today",
  },
  {
    id: "huntress-042",
    title: "Huntress Match 042",
    status: "Processing",
    activity: "Finding important moments",
    updated: "18 min ago",
  },
  {
    id: "gameplay-039",
    title: "Gameplay 039",
    status: "Rendering",
    activity: "Assembling final video",
    updated: "1 hr ago",
  },
  {
    id: "basement-save",
    title: "Basement Save Attempt",
    status: "Failed",
    activity: "Source audio could not be read",
    updated: "Yesterday",
  },
];
