"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { cx } from "@/components/ui/cx";

type SidebarView = "projects" | "preview" | "settings";

const itemClass = (active: boolean) =>
  cx(
    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
    active
      ? "bg-raised font-medium text-ink"
      : "text-ink-secondary hover:bg-raised/70 hover:text-ink",
  );

function Icon({ name, active }: { name: string; active: boolean }) {
  const cls = cx(
    "h-4 w-4 shrink-0 transition-colors",
    active ? "text-accent" : "text-ink-muted group-hover:text-ink-secondary",
  );
  const common = {
    className: cls,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "projects")
    return (
      <svg {...common}>
        <rect x="2" y="2.5" width="5" height="5" rx="1" />
        <rect x="9" y="2.5" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="4.5" rx="1" />
        <rect x="9" y="9" width="5" height="4.5" rx="1" />
      </svg>
    );
  if (name === "new")
    return (
      <svg {...common}>
        <path d="M8 3.5v9M3.5 8h9" />
      </svg>
    );
  if (name === "preview")
    return (
      <svg {...common}>
        <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
        <circle cx="8" cy="8" r="1.8" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  );
}

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
  const navButton = (
    view: "projects" | "preview" | null,
    icon: string,
    label: string,
    onClick?: () => void,
  ): ReactNode => {
    const isActive = view !== null && active === view;
    return (
      <button
        className={itemClass(isActive)}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
      >
        <Icon name={icon} active={isActive} />
        {label}
      </button>
    );
  };

  return (
    <aside className="flex items-center justify-between border-b border-edge bg-sunken/40 px-5 py-3 lg:w-56 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:border-r lg:border-b-0 lg:px-0 lg:py-0">
      <div className="lg:border-b lg:border-edge lg:px-5 lg:py-5">
        <Wordmark />
        <p className="mt-1 hidden text-xs text-ink-muted lg:block">
          Video production studio
        </p>
      </div>

      <nav className="hidden flex-1 space-y-1 px-3 py-4 lg:block">
        {onNavigate ? (
          navButton("projects", "projects", "Projects", () =>
            onNavigate("projects"),
          )
        ) : (
          <Link
            href="/app"
            className={itemClass(active === "projects")}
            aria-current={active === "projects" ? "page" : undefined}
          >
            <Icon name="projects" active={active === "projects"} />
            Projects
          </Link>
        )}

        {onNewVideo ? (
          navButton(null, "new", "New video", onNewVideo)
        ) : (
          <Link href="/app" className={itemClass(false)}>
            <Icon name="new" active={false} />
            New video
          </Link>
        )}

        {onNavigate ? (
          navButton("preview", "preview", "Product preview", () =>
            onNavigate("preview"),
          )
        ) : (
          <Link href="/app" className={itemClass(active === "preview")}>
            <Icon name="preview" active={active === "preview"} />
            Product preview
          </Link>
        )}

        <Link
          href="/app/settings"
          className={itemClass(active === "settings")}
          aria-current={active === "settings" ? "page" : undefined}
        >
          <Icon name="settings" active={active === "settings"} />
          Settings
        </Link>
      </nav>

      <div className="hidden border-t border-edge px-5 py-4 lg:block">
        <p className="text-[11px] tracking-wider text-ink-muted uppercase">
          Signed in
        </p>
        <p className="mt-1.5 truncate text-xs text-ink-secondary">
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
