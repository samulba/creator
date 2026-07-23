"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

type SidebarView = "projects" | "preview" | "settings";

function initials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[._+-]+/).filter(Boolean);
  const chars =
    parts.length >= 2 && parts[0] && parts[1]
      ? parts[0][0] + parts[1][0]
      : name.slice(0, 2);
  return chars.toUpperCase();
}

function Icon({ name }: { name: string }) {
  const common = {
    className: "h-[18px] w-[18px]",
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

const railItem = (active: boolean) =>
  cx(
    "group relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
    active
      ? "border-accent/40 bg-accent/15 text-accent"
      : "border-transparent text-ink-muted hover:bg-raised hover:text-ink",
  );

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-2 hidden -translate-y-1/2 rounded-md border border-edge bg-overlay px-2 py-1 text-xs whitespace-nowrap text-ink opacity-0 shadow-panel transition-opacity group-hover:opacity-100 lg:top-1/2 lg:block">
      {label}
    </span>
  );
}

/**
 * Slim application icon rail. A single elegant navigation strip (not a second
 * text menu), with the brand mark on top, icon nav with tooltips, and a user
 * avatar menu at the bottom. On small screens it collapses to a top bar.
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
  const [menuOpen, setMenuOpen] = useState(false);

  const navNode = (
    key: string,
    icon: string,
    label: string,
    isActive: boolean,
    onClick?: () => void,
    href?: string,
  ) => {
    const content = (
      <>
        <Icon name={icon} />
        <Tooltip label={label} />
      </>
    );
    return href ? (
      <Link
        key={key}
        href={href}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={railItem(isActive)}
      >
        {content}
      </Link>
    ) : (
      <button
        key={key}
        type="button"
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
        className={railItem(isActive)}
      >
        {content}
      </button>
    );
  };

  return (
    <aside className="flex items-center justify-between border-b border-edge bg-sunken/50 px-4 py-2.5 lg:w-[68px] lg:shrink-0 lg:flex-col lg:items-center lg:justify-start lg:gap-1 lg:border-r lg:border-b-0 lg:px-0 lg:py-4">
      {/* Brand mark */}
      <Link
        href="/app"
        aria-label="Creator"
        className="flex items-center gap-2 lg:mb-3 lg:h-10 lg:w-10 lg:justify-center"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-accent/40 bg-accent/15 lg:h-9 lg:w-9">
          <span className="text-sm font-bold tracking-tight text-accent">
            C
          </span>
        </span>
        <span className="text-base font-semibold tracking-tight text-ink lg:hidden">
          Creator
        </span>
      </Link>

      {/* Nav — desktop rail */}
      <nav className="hidden flex-1 flex-col items-center gap-1.5 lg:flex">
        {onNavigate
          ? navNode(
              "projects",
              "projects",
              "Projects",
              active === "projects",
              () => onNavigate("projects"),
            )
          : navNode(
              "projects",
              "projects",
              "Projects",
              active === "projects",
              undefined,
              "/app",
            )}
        {onNewVideo
          ? navNode("new", "new", "New video", false, onNewVideo)
          : navNode("new", "new", "New video", false, undefined, "/app")}
        {onNavigate
          ? navNode(
              "preview",
              "preview",
              "Product preview",
              active === "preview",
              () => onNavigate("preview"),
            )
          : navNode(
              "preview",
              "preview",
              "Product preview",
              active === "preview",
              undefined,
              "/app",
            )}
        {navNode(
          "settings",
          "settings",
          "Settings",
          active === "settings",
          undefined,
          "/app/settings",
        )}
      </nav>

      {/* User avatar menu — desktop */}
      <div className="relative hidden lg:block">
        <button
          type="button"
          aria-label="Account menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-edge-strong bg-raised text-xs font-semibold text-ink transition-colors hover:border-accent/50"
        >
          {initials(userEmail)}
        </button>
        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="panel absolute bottom-0 left-full z-50 ml-3 w-60 overflow-hidden p-1.5">
              <div className="px-3 py-2">
                <p className="text-[11px] tracking-wider text-ink-muted uppercase">
                  Signed in
                </p>
                <p className="selectable mt-1 truncate text-sm text-ink">
                  {userEmail}
                </p>
              </div>
              <div className="my-1 h-px bg-edge" />
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-raised hover:text-ink"
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
                    <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11l3-3-3-3M13.5 8H6" />
                  </svg>
                  Log out
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>

      {/* Compact actions — small screens */}
      <div className="flex items-center gap-2 lg:hidden">
        {active === "settings" ? (
          <Link href="/app" className="text-sm text-ink-secondary">
            Projects
          </Link>
        ) : (
          <Link
            href="/app/settings"
            className="text-sm text-ink-secondary"
            aria-current={undefined}
          >
            Settings
          </Link>
        )}
        {onNewVideo ? (
          <Button size="sm" variant="primary" onClick={onNewVideo}>
            New video
          </Button>
        ) : null}
        <form action="/auth/signout" method="post">
          <Button size="sm" variant="ghost" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </aside>
  );
}
