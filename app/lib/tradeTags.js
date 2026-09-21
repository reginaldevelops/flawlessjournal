/**
 * Shared trade-tag catalog (Edgewonk-style).
 *
 * Assigned tags live on the trade (`data.Tags`). The catalog is the list of
 * tags the user has created so they can reuse them on any other trade, with
 * stable colours.
 *
 * Persistence: localStorage (instant) + `table_settings.trade_tags` when the
 * column exists. Harvest from loaded trades so existing labels show up even
 * before the settings column is migrated. Explicitly deleted tags are
 * tombstoned so harvest cannot resurrect a typo.
 */

const STORAGE_KEY = "flawless.tradeTags.v1";
const DELETED_KEY = "flawless.tradeTags.deleted.v1";

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
  if (typeof value === "object") {
    return parseTags(value.catalog ?? value.tags ?? []);
  }
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

export function sameTag(a, b) {
  return normalizeTag(a).toLowerCase() === normalizeTag(b).toLowerCase();
}

export function excludeDeleted(names = [], deleted = []) {
  const blocked = new Set(uniqueTags(deleted).map((t) => t.toLowerCase()));
  return uniqueTags(names).filter((t) => !blocked.has(t.toLowerCase()));
}

export function mergeCatalog(a = [], b = []) {
  return uniqueTags([...parseTags(a), ...parseTags(b)]);
}

export function parseStoredTagLibrary(raw) {
  if (!raw) return { catalog: [], deleted: [] };
  if (Array.isArray(raw)) return { catalog: uniqueTags(raw), deleted: [] };
  if (typeof raw === "string") {
    try {
      return parseStoredTagLibrary(JSON.parse(raw));
    } catch {
      return { catalog: parseTags(raw), deleted: [] };
    }
  }
  if (typeof raw === "object") {
    return {
      catalog: uniqueTags(raw.catalog ?? raw.tags ?? []),
      deleted: uniqueTags(raw.deleted ?? []),
    };
  }
  return { catalog: [], deleted: [] };
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

function readJsonList(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return uniqueTags(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeJsonList(key, tags) {
  const catalog = uniqueTags(tags);
  if (typeof window === "undefined") return catalog;
  try {
    window.localStorage.setItem(key, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
  return catalog;
}

export function readLocalCatalog() {
  return readJsonList(STORAGE_KEY);
}

export function writeLocalCatalog(tags) {
  return writeJsonList(STORAGE_KEY, tags);
}

export function readDeletedTags() {
  return readJsonList(DELETED_KEY);
}

export function writeDeletedTags(tags) {
  return writeJsonList(DELETED_KEY, tags);
}

export function rememberTags(names) {
  const incoming = excludeDeleted(names, readDeletedTags());
  return writeLocalCatalog(mergeCatalog(readLocalCatalog(), incoming));
}

export function forgetTags(names, { catalog = readLocalCatalog(), deleted = readDeletedTags() } = {}) {
  const remove = uniqueTags(names);
  const nextCatalog = excludeDeleted(catalog, remove);
  const nextDeleted = uniqueTags([...deleted, ...remove]);
  writeLocalCatalog(nextCatalog);
  writeDeletedTags(nextDeleted);
  return { catalog: nextCatalog, deleted: nextDeleted };
}

function isMissingColumnError(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /trade_tags|column|schema cache|PGRST204|42703/i.test(msg);
}

function dropTagFromValue(value, tag) {
  if (Array.isArray(value)) return value.filter((item) => !sameTag(item, tag));
  if (typeof value === "string") {
    const next = parseTags(value).filter((item) => !sameTag(item, tag));
    return next;
  }
  return value;
}

function dropTagFromTradeData(data, tag) {
  if (!data || typeof data !== "object") return { data, changed: false };
  const next = { ...data };
  let changed = false;
  for (const key of ["Tags", "tags"]) {
    if (next[key] == null) continue;
    const stripped = dropTagFromValue(next[key], tag);
    const before = parseTags(next[key]);
    const after = parseTags(stripped);
    if (before.length !== after.length) {
      next[key] = stripped;
      changed = true;
    }
  }
  return { data: next, changed };
}

export function stripTagFromTradeRows(rows = [], tag) {
  const needle = normalizeTag(tag);
  if (!needle) return [];
  const updates = [];
  for (const row of rows) {
    if (!row?.id || !row.data) continue;
    const { data, changed } = dropTagFromTradeData(row.data, needle);
    if (changed) updates.push({ id: row.id, data });
  }
  return updates;
}

function isMissingRpcError(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /remove_trade_tag|could not find.*function|PGRST202|PGRST204/i.test(msg);
}

async function stripTagFromAllTrades(supabase, tag) {
  const { error } = await supabase.rpc("remove_trade_tag", { tag_name: normalizeTag(tag) });
  if (!error || isMissingRpcError(error)) return !error;
  console.warn("[tradeTags] strip from trades:", error.message);
  return false;
}

export async function loadTagCatalog(supabase, { extra = [] } = {}) {
  let deleted = readDeletedTags();
  let catalog = excludeDeleted(mergeCatalog(readLocalCatalog(), extra), deleted);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("table_settings")
        .select("trade_tags")
        .eq("id", 1)
        .maybeSingle();
      if (!error && data?.trade_tags) {
        const stored = parseStoredTagLibrary(data.trade_tags);
        deleted = uniqueTags([...deleted, ...stored.deleted]);
        catalog = excludeDeleted(mergeCatalog(catalog, stored.catalog), deleted);
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
          catalog = excludeDeleted(
            mergeCatalog(catalog, harvestTagsFromRows(data)),
            deleted
          );
        }
      } catch {
        /* ignore — list pages harvest from the full fetch instead */
      }
    }
  }

  writeDeletedTags(deleted);
  return writeLocalCatalog(catalog);
}

export async function saveTagCatalog(supabase, tags, deleted = readDeletedTags()) {
  const catalog = writeLocalCatalog(tags);
  const storedDeleted = writeDeletedTags(deleted);
  if (!supabase) return catalog;

  const payload = { catalog, deleted: storedDeleted };

  try {
    const existing = await supabase
      .from("table_settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (existing.error && isMissingColumnError(existing.error)) return catalog;

    const write = async (value) => {
      if (existing.data) {
        return supabase.from("table_settings").update({ trade_tags: value }).eq("id", 1);
      }
      if (!existing.error) {
        return supabase.from("table_settings").insert({ id: 1, trade_tags: value });
      }
      return { error: existing.error };
    };

    let { error } = await write(payload);
    if (error) ({ error } = await write(catalog));
    if (error && !isMissingColumnError(error)) {
      console.warn("[tradeTags] save failed:", error.message);
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

export async function forgetAndPersist(supabase, names) {
  const { catalog, deleted } = forgetTags(names);
  await saveTagCatalog(supabase, catalog, deleted);
  if (supabase) {
    for (const tag of uniqueTags(names)) {
      try {
        await stripTagFromAllTrades(supabase, tag);
      } catch {
        /* ignore missing RPC */
      }
    }
  }
  return catalog;
}
