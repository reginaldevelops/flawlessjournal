/**
 * Shared trade-tag catalog (Edgewonk-style).
 *
 * Assigned tags live on the trade (`data.Tags`). The catalog is the list of
 * tags the user has created so they can reuse them on any other trade, with
 * stable colours.
 *
 * Persistence: localStorage (instant) + `table_settings.trade_tags` when the
 * column exists. Harvest from loaded trades so existing labels show up even
 * before the settings column is migrated.
 */

const STORAGE_KEY = "flawless.tradeTags.v1";

export const TAG_PALETTE = [
  "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "bg-lime-500/15 text-lime-300 border-lime-500/30",
];

export function normalizeTag(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^#+/, "")
    .slice(0, 32);
}

export function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(normalizeTag).filter(Boolean);
  return String(value)
    .split(/[,;|]/)
    .map(normalizeTag)
    .filter(Boolean);
}

export function tagTone(tag) {
  const s = String(tag || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

function uniqueTags(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const tag = normalizeTag(name);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function mergeCatalog(a = [], b = []) {
  return uniqueTags([...parseTags(a), ...parseTags(b)]);
}

function tagsFromUnknown(value) {
  if (!value) return [];
  if (Array.isArray(value) || typeof value === "string") return parseTags(value);
  if (typeof value === "object") {
    return parseTags(value.Tags ?? value.tags ?? value.name);
  }
  return [];
}

export function harvestTagsFromRows(rows = []) {
  const names = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const data = row.data && typeof row.data === "object" ? row.data : null;
    names.push(...tagsFromUnknown(data?.Tags ?? data?.tags));
    names.push(...tagsFromUnknown(row.Tags ?? row.tags));
  }
  return uniqueTags(names);
}

export function readLocalCatalog() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return uniqueTags(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeLocalCatalog(tags) {
  const catalog = uniqueTags(tags);
  if (typeof window === "undefined") return catalog;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
  return catalog;
}

export function rememberTags(names) {
  return writeLocalCatalog(mergeCatalog(readLocalCatalog(), names));
}

function isMissingColumnError(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /trade_tags|column|schema cache|PGRST204|42703/i.test(msg);
}

export async function loadTagCatalog(supabase, { extra = [] } = {}) {
  let catalog = mergeCatalog(readLocalCatalog(), extra);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("table_settings")
        .select("trade_tags")
        .eq("id", 1)
        .maybeSingle();
      if (!error && data?.trade_tags) {
        catalog = mergeCatalog(catalog, data.trade_tags);
      }
    } catch {
      /* ignore */
    }

    if (catalog.length === 0) {
      try {
        const { data, error } = await supabase
          .from("trades")
          .select("data->Tags, data->tags");
        if (!error && data?.length) {
          catalog = mergeCatalog(catalog, harvestTagsFromRows(data));
        }
      } catch {
        /* ignore — list pages harvest from the full fetch instead */
      }
    }
  }

  return writeLocalCatalog(catalog);
}

export async function saveTagCatalog(supabase, tags) {
  const catalog = writeLocalCatalog(tags);
  if (!supabase) return catalog;

  try {
    const existing = await supabase
      .from("table_settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (existing.error && isMissingColumnError(existing.error)) return catalog;

    if (existing.data) {
      const { error } = await supabase
        .from("table_settings")
        .update({ trade_tags: catalog })
        .eq("id", 1);
      if (error && !isMissingColumnError(error)) {
        console.warn("[tradeTags] save failed:", error.message);
      }
    } else if (!existing.error) {
      const { error } = await supabase
        .from("table_settings")
        .insert({ id: 1, trade_tags: catalog });
      if (error && !isMissingColumnError(error)) {
        console.warn("[tradeTags] insert failed:", error.message);
      }
    }
  } catch (err) {
    console.warn("[tradeTags] save failed:", err?.message || err);
  }

  return catalog;
}

export async function rememberAndPersist(supabase, names) {
  const catalog = rememberTags(names);
  return saveTagCatalog(supabase, catalog);
}
