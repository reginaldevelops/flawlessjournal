"use client";

import { useEffect, useRef, useState } from "react";

/** True while the browser tab is in the foreground. */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return visible;
}

/**
 * Run `fn` on mount (when enabled + tab visible), then every `intervalMs`.
 * Pauses while the tab is hidden; runs once immediately when it returns.
 */
export function useVisibleInterval(fn, intervalMs, enabled = true) {
  const visible = useDocumentVisible();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || !visible || intervalMs <= 0) return undefined;
    fnRef.current();
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, visible, intervalMs]);
}
