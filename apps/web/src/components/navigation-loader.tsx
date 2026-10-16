"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SpagLoader } from "./spag-loader";

/**
 * Shows the centred logo animation the moment a link inside the app is clicked, and hides it
 * when the new page arrives. Covers the page area only (not the side panel or top bar).
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [loading, setLoading] = useState(false);

  // The new page is here.
  useEffect(() => { setLoading(false); }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // (Next.js links always cancel the browser default themselves, so that is not checked here.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      // data-no-loader: links that may be cancelled (e.g. after an "unsaved changes" question).
      if (!a || a.target || a.hasAttribute("download") || a.hasAttribute("data-no-loader")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or just a #section on it): nothing to load.
      if (url.pathname === location.pathname && url.search === location.search) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Never get stuck: give up after 30 seconds.
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 30_000);
    return () => clearTimeout(id);
  }, [loading]);

  if (!loading) return null;
  return (
    <div className="absolute inset-0 z-20 bg-background" role="status" aria-label="Loading">
      {/* Centred in the visible part of the page, below the top bar. */}
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4">
        <SpagLoader className="h-16 text-foreground" label="Loading" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
