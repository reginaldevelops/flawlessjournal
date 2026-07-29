export const POSITION_CHANGED = "fj:position-changed";

export function notifyPositionChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POSITION_CHANGED, { detail }));
}

export function subscribePositionChanged(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(POSITION_CHANGED, handler);
  return () => window.removeEventListener(POSITION_CHANGED, handler);
}
