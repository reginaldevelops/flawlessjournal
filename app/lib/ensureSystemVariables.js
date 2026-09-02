/**
 * Ensure required system variables exist and promote matching custom columns.
 * Safe to call repeatedly. Remaps trade.data when a custom var is promoted
 * onto a canonical system name (no duplicate Exit-time columns).
 */

import {
  REQUIRED_SYSTEM_KEYS,
  SYSTEM_FIELDS,
  findMigrationCandidate,
  getSystemVariable,
  normalizeFieldToken,
  readSystemKey,
} from "./systemFields";

const ENSURE_FLAG = "flawless.systemFields.ensured.v2";

function hasSystemKeyColumnError(error) {
  const msg = String(error?.message ?? error?.code ?? "");
  return /system_key|column|schema cache|42703/i.test(msg);
}

async function selectVariables(supabase) {
  const full = await supabase
    .from("variables")
    .select(
      "id, user_id, name, type, varType, phase, options, formula, visible, order, system_key"
    )
    .order("order", { ascending: true });

  if (!full.error) return { variables: full.data ?? [], supportsSystemKey: true };

  if (!hasSystemKeyColumnError(full.error)) {
    return { variables: [], supportsSystemKey: false, error: full.error };
  }

  const legacy = await supabase
    .from("variables")
    .select("id, user_id, name, type, varType, phase, options, formula, visible, order")
    .order("order", { ascending: true });

  if (legacy.error) {
    return { variables: [], supportsSystemKey: false, error: legacy.error };
  }
  return { variables: legacy.data ?? [], supportsSystemKey: false };
}

async function remapTradeKeys(supabase, renames) {
  const pairs = Object.entries(renames).filter(([from, to]) => from && to && from !== to);
  if (!pairs.length) return { remapped: 0 };

  const { data: trades, error } = await supabase.from("trades").select("id, data");
  if (error) throw error;

  const updates = [];
  for (const trade of trades ?? []) {
    if (!trade?.data || typeof trade.data !== "object") continue;
    let changed = false;
    const next = { ...trade.data };
    for (const [from, to] of pairs) {
      if (!Object.prototype.hasOwnProperty.call(next, from)) continue;
      if (next[to] === undefined || next[to] === "") next[to] = next[from];
      delete next[from];
      changed = true;
    }
    if (changed) updates.push({ id: trade.id, data: next });
  }

  if (!updates.length) return { remapped: 0 };

  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    const { error: upErr } = await supabase
      .from("trades")
      .upsert(chunk, { onConflict: "id" });
    if (upErr) throw upErr;
  }
  return { remapped: updates.length };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ userId?: string, force?: boolean, keys?: string[] }} [opts]
 */
export async function ensureSystemVariables(supabase, opts = {}) {
  const { userId = null, force = false, keys = REQUIRED_SYSTEM_KEYS } = opts;

  if (typeof window !== "undefined" && !force) {
    try {
      if (sessionStorage.getItem(ENSURE_FLAG) === "1") {
        const { variables, error } = await selectVariables(supabase);
        if (!error) return { variables, skipped: true, changes: [] };
      }
    } catch {
      /* ignore */
    }
  }

  const { variables: existing, supportsSystemKey, error } =
    await selectVariables(supabase);
  if (error) return { variables: [], error, changes: [] };

  const changes = [];
  const renames = {};
  const claimedIds = new Set();
  let working = [...existing];
  let nextOrder =
    working.reduce((max, v) => Math.max(max, Number(v.order) || 0), 0) + 1;

  for (const v of working) {
    const sk = readSystemKey(v);
    if (sk && keys.includes(sk)) claimedIds.add(v.id);
  }

  for (const systemKey of keys) {
    const def = SYSTEM_FIELDS[systemKey];
    if (!def) continue;

    let bound = getSystemVariable(working, systemKey);

    if (!bound) {
      const candidate = findMigrationCandidate(
        working.filter((v) => !claimedIds.has(v.id)),
        systemKey
      );
      if (candidate) bound = candidate;
    }

    if (bound) {
      const patch = {
        type: "system",
        varType: def.varType,
        phase: def.phase,
      };
      if (supportsSystemKey) patch.system_key = systemKey;

      // Keep custom PnL display name; canonicalize other system data keys.
      const shouldCanonicalize =
        systemKey !== "pnl" &&
        normalizeFieldToken(bound.name) !== normalizeFieldToken(def.defaultName);
      if (shouldCanonicalize) {
        renames[bound.name] = def.defaultName;
        patch.name = def.defaultName;
      }

      let { error: updErr } = await supabase
        .from("variables")
        .update(patch)
        .eq("id", bound.id);

      if (updErr && hasSystemKeyColumnError(updErr) && patch.system_key) {
        delete patch.system_key;
        ({ error: updErr } = await supabase
          .from("variables")
          .update(patch)
          .eq("id", bound.id));
      }
      if (updErr) throw updErr;

      working = working.map((v) =>
        v.id === bound.id ? { ...v, ...patch } : v
      );
      claimedIds.add(bound.id);
      changes.push({
        action: getSystemVariable(existing, systemKey) ? "promote" : "link",
        systemKey,
        from: bound.name,
        to: patch.name ?? bound.name,
      });
      continue;
    }

    const row = {
      name: def.defaultName,
      type: "system",
      varType: def.varType,
      phase: def.phase,
      options: [],
      formula: null,
      visible: true,
      order: nextOrder++,
    };
    if (userId) row.user_id = userId;
    if (supportsSystemKey) row.system_key = systemKey;

    let insertRes = await supabase.from("variables").insert([row]).select("*").single();
    if (insertRes.error && hasSystemKeyColumnError(insertRes.error) && row.system_key) {
      delete row.system_key;
      insertRes = await supabase.from("variables").insert([row]).select("*").single();
    }
    if (insertRes.error) throw insertRes.error;

    working.push(insertRes.data);
    claimedIds.add(insertRes.data.id);
    changes.push({ action: "create", systemKey, to: def.defaultName });
  }

  // Remove leftover custom duplicates that still alias a bound system field
  for (const systemKey of keys) {
    const bound = getSystemVariable(working, systemKey);
    if (!bound) continue;
    const dupes = working.filter(
      (v) =>
        v.id !== bound.id &&
        v.type !== "system" &&
        !readSystemKey(v) &&
        matchesAliasOnly(v.name, systemKey)
    );
    for (const dupe of dupes) {
      renames[dupe.name] = bound.name;
      const { error: delErr } = await supabase
        .from("variables")
        .delete()
        .eq("id", dupe.id);
      if (delErr) {
        console.warn("[ensureSystemVariables] dedupe failed", dupe.name, delErr);
        continue;
      }
      working = working.filter((v) => v.id !== dupe.id);
      changes.push({
        action: "dedupe",
        systemKey,
        from: dupe.name,
        to: bound.name,
      });
    }
  }

  if (Object.keys(renames).length) {
    await remapTradeKeys(supabase, renames);
  }

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(ENSURE_FLAG, "1");
    } catch {
      /* ignore */
    }
  }

  return { variables: working, changes, supportsSystemKey };
}

function matchesAliasOnly(name, systemKey) {
  return findMigrationCandidate([{ id: "x", name, type: "custom" }], systemKey) != null;
}

export function resetSystemVariablesEnsureFlag() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ENSURE_FLAG);
  } catch {
    /* ignore */
  }
}
