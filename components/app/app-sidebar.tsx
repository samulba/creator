"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { cx } from "@/components/ui/cx";

type SidebarView = "projects" | "preview" | "settings";

const itemClass = (active: boolean) =>
  cx(
    "block w-full rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
    active
      ? "bg-raised font-medium text-ink"
      : "text-ink-secondary hover:bg-raised hover:text-ink",
  );

/**
 * Shared application sidebar. Inside the workspace, Projects/Preview switch
 * client-side via onNavigate; from other routes they render as links.
 */
export function AppSidebar({
  userEmail,
  active,
  onNavigate,
  onNewVideo,
}: {
  userEmail: string;
  active: SidebarView;
  onNavigate?: (view: "projects" | "preview") => void;
  onNewVideo?: () => void;
}) {
  return (
    <aside className="flex items-center justify-between border-b border-edge px-5 py-3 lg:w-56 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:border-r lg:border-b-0 lg:px-0 lg:py-0">
      <div className="lg:border-b lg:border-edge lg:px-5 lg:py-5">
        <Wordmark />
        <p className="mt-1 hidden text-xs text-ink-muted lg:block">
          Video production
        </p>
      </div>

      <nav className="hidden flex-1 space-y-0.5 px-3 py-4 lg:block">
        {onNavigate ? (
          <button
            className={itemClass(active === "projects")}
            aria-current={active === "projects" ? "page" : undefined}
            onClick={() => onNavigate("projects")}
          >
            Projects
          </button>
        ) : (
          <Link
            href="/app"
            className={itemClass(active === "projects")}
            aria-current={active === "projects" ? "page" : undefined}
          >
            Projects
          </Link>
        )}

        {onNewVideo ? (
          <button className={itemClass(false)} onClick={onNewVideo}>
            New video
          </button>
        ) : (
          <Link href="/app" className={itemClass(false)}>
            New video
          </Link>
        )}

        {onNavigate ? (
          <button
            className={itemClass(active === "preview")}
            aria-current={active === "preview" ? "page" : undefined}
            onClick={() => onNavigate("preview")}
          >
            Product preview
          </button>
        ) : (
          <Link href="/app" className={itemClass(active === "preview")}>
            Product preview
          </Link>
        )}

        <Link
          href="/app/settings"
          className={itemClass(active === "settings")}
          aria-current={active === "settings" ? "page" : undefined}
        >
          Settings
        </Link>
      </nav>

      <div className="hidden border-t border-edge px-5 py-4 lg:block">
        <p className="text-[11px] tracking-wide text-ink-muted uppercase">
          Prototype
        </p>
        <p className="mt-2 truncate text-xs text-ink-secondary">{userEmail}</p>
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
        {onNewVideo ? (
          <Button size="sm" variant="primary" onClick={onNewVideo}>
            New video
          </Button>
        ) : (
          <Link href="/app" className="text-sm text-ink-secondary">
            Projects
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <Button size="sm" variant="ghost" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </aside>
  );
}
