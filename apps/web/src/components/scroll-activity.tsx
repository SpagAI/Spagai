"use client";

import { useEffect } from "react";

/** Marks whatever is being scrolled with data-scrolling for a moment, so its thin scrollbar shows only then. */
export function ScrollActivity() {
  useEffect(() => {
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.documentElement;
      el.setAttribute("data-scrolling", "");
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => { el.removeAttribute("data-scrolling"); timers.delete(el); }, 900));
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
