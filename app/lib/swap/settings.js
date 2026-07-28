import { DEFAULT_SWAP_SETTINGS, SWAP_SETTINGS_KEY } from "./constants";

export function loadSwapSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SWAP_SETTINGS };
  try {
    const raw = localStorage.getItem(SWAP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SWAP_SETTINGS };
    return { ...DEFAULT_SWAP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SWAP_SETTINGS };
  }
}

export function saveSwapSettings(next) {
  const merged = { ...DEFAULT_SWAP_SETTINGS, ...next };
  try {
    localStorage.setItem(SWAP_SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}
