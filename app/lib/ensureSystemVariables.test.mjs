import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  coinVarNeedsRestore,
  dateVarNeedsDemote,
  ensureSystemVariables,
  patchNeedsWrite,
  resetEnsureCachesForTests,
  systemVariablePatch,
} from "./ensureSystemVariables.js";
import { slimTradeDataForList, isHeavyJournalValue } from "./slimTradeData.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function thenable(result) {
  const query = {
    select() {
      return query;
    },
    order() {
      return query;
    },
    eq() {
      return query;
    },
    single() {
      return query;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return query;
}

function readyVariables() {
  return [
    {
      id: "pnl",
      name: "PnL",
      type: "system",
      varType: "number",
      phase: "post",
      system_key: "pnl",
      visible: true,
      order: 1,
    },
    {
      id: "entry",
      name: "Entreetijd",
      type: "system",
      varType: "datetime",
      phase: "pre",
      system_key: "entryTime",
      visible: true,
      order: 2,
    },
    {
      id: "exit",
      name: "Exittijd",
      type: "system",
      varType: "datetime",
      phase: "post",
      system_key: "exitTime",
      visible: true,
      order: 3,
    },
    {
      id: "date",
      name: "Datum",
      type: "custom",
      varType: "date",
      phase: "pre",
      system_key: null,
      visible: false,
      order: 4,
    },
    {
      id: "coin",
      name: "Coin",
      type: "custom",
      varType: "dropdown",
      phase: "pre",
      system_key: null,
      visible: true,
      order: 5,
      options: ["BTC"],
    },
  ];
}

function createMockSupabase({ variables, trades }) {
  const calls = { select: [], update: [], upsert: [], insert: [], delete: [] };
  const state = {
    variables: variables.map((row) => ({ ...row })),
    trades: trades.map((row) => ({ ...row, data: { ...(row.data || {}) } })),
  };

  return {
    calls,
    from(table) {
      return {
        select(cols) {
          calls.select.push({ table, cols });
          return thenable({ data: state[table] ?? [], error: null });
        },
        update(patch) {
          calls.update.push({ table, patch });
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(chunk) {
          calls.upsert.push({ table, chunk });
          return Promise.resolve({ error: null });
        },
        insert(rows) {
          calls.insert.push({ table, rows });
          const inserted = { id: `new-${calls.insert.length}`, ...rows[0] };
          state[table].push(inserted);
          return thenable({ data: inserted, error: null });
        },
        delete() {
          return {
            eq() {
              calls.delete.push({ table });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

describe("ensureSystemVariables skip work", () => {
  beforeEach(() => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
    resetEnsureCachesForTests();
  });

  it("does not rewrite already-migrated variables", async () => {
    const supabase = createMockSupabase({
      variables: readyVariables(),
      trades: [
        {
          id: "t1",
          data: {
            Entreetijd: "2026-07-20T10:15",
            Exittijd: "2026-07-20T11:00",
            Datum: "2026-07-20",
          },
        },
      ],
    });

    const first = await ensureSystemVariables(supabase, { force: true });
    assert.equal(first.changes.length, 0);
    assert.equal(supabase.calls.update.length, 0);
    assert.equal(supabase.calls.upsert.length, 0);
    assert.equal(
      supabase.calls.select.filter((call) => call.table === "trades").length,
      1
    );

    const second = await ensureSystemVariables(supabase, { force: true });
    assert.equal(second.changes.length, 0);
    assert.equal(supabase.calls.update.length, 0);
    assert.equal(
      supabase.calls.select.filter((call) => call.table === "trades").length,
      1,
      "second visit must not download all trades again"
    );
  });

  it("upgrades legacy HH:MM once then skips the full trade scan", async () => {
    const supabase = createMockSupabase({
      variables: readyVariables(),
      trades: [
        {
          id: "t1",
          data: {
            Datum: "2026-07-20",
            Entreetijd: "10:15",
            Exittijd: "11:00",
          },
        },
      ],
    });

    const first = await ensureSystemVariables(supabase, { force: true });
    assert.equal(
      first.changes.some((change) => change.action === "upgrade_timestamps"),
      true
    );
    assert.equal(supabase.calls.upsert.length, 1);
    assert.equal(supabase.calls.upsert[0].chunk[0].data.Entreetijd, "2026-07-20T10:15");

    await ensureSystemVariables(supabase, { force: true });
    assert.equal(
      supabase.calls.select.filter((call) => call.table === "trades").length,
      1
    );
    assert.equal(supabase.calls.upsert.length, 1);
  });
});

describe("patch helpers", () => {
  it("patchNeedsWrite is false when fields already match", () => {
    const bound = {
      name: "Entreetijd",
      type: "system",
      varType: "datetime",
      phase: "pre",
      system_key: "entryTime",
    };
    const { patch } = systemVariablePatch(
      bound,
      { varType: "datetime", phase: "pre", defaultName: "Entreetijd" },
      "entryTime",
      true
    );
    assert.equal(patchNeedsWrite(bound, patch), false);
  });

  it("skips date/coin writes after demote", () => {
    assert.equal(
      dateVarNeedsDemote({ type: "custom", visible: false, system_key: null }, true),
      false
    );
    assert.equal(
      coinVarNeedsRestore(
        { type: "custom", varType: "dropdown", system_key: null },
        true
      ),
      false
    );
    assert.equal(
      coinVarNeedsRestore({ type: "system", varType: "text", system_key: "coin" }, true),
      true
    );
  });
});

describe("slimTradeDataForList", () => {
  it("drops fills and replaces chart data URLs", () => {
    const slim = slimTradeDataForList({
      Coin: "BTC",
      Chart: `data:image/jpeg;base64,${"A".repeat(40_000)}`,
      _fj: {
        fills: [{ signature: "x" }],
        completion: { checkedEmpty: { Notes: { checkedAt: "2026-01-01" } } },
      },
    });
    assert.equal(slim.Coin, "BTC");
    assert.equal(slim.Chart, "data:image");
    assert.deepEqual(slim._fj, {
      completion: { checkedEmpty: { Notes: { checkedAt: "2026-01-01" } } },
    });
    assert.equal(isHeavyJournalValue(`data:image/png;base64,${"B".repeat(100)}`), true);
  });
});
