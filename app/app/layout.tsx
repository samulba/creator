import type { ReactNode } from "react";

/**
 * Application shell wrapper. Marks everything under /app as app chrome so text
 * selection is disabled by default (it feels like an app, not a document);
 * form fields and `.selectable` content stay copyable. The workspace and
 * settings size themselves with viewport units, so this block wrapper does not
 * affect their layout.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>;
}
