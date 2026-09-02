import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYSTEM_FIELD_KEYS,
  computeHoldMinutes,
  findMigrationCandidate,
  getSystemDataKey,
  getSystemVariable,
  getTradeSystemValue,
  isTimeOnlyValue,
  matchesSystemAlias,
  parseTradeDateTime,
  systemFieldMap,
  toDatetimeLocalValue,
  upgradeLegacyTimesInTradeData,
} from "./systemFields.js";

describe("systemFields", () => {
  it("matches exit tijd alias exactly and ignores entry", () => {
    assert.equal(matchesSystemAlias("exit tijd", SYSTEM_FIELD_KEYS.exitTime), true);
    assert.equal(matchesSystemAlias("Exittijd", SYSTEM_FIELD_KEYS.exitTime), true);
    assert.equal(matchesSystemAlias("Entreetijd", SYSTEM_FIELD_KEYS.exitTime), false);
  });

  it("resolves system vars by system_key", () => {
    const variables = [
      { id: 1, name: "My PnL", type: "system", system_key: "pnl" },
      { id: 2, name: "Exittijd", type: "system", system_key: "exitTime" },
    ];
    assert.equal(getSystemVariable(variables, "pnl").name, "My PnL");
    assert.equal(getSystemDataKey(variables, "exitTime"), "Exittijd");
    assert.equal(getTradeSystemValue({ "My PnL": 9 }, variables, "pnl"), 9);
  });

  it("picks custom exit tijd as migration candidate", () => {
    const hit = findMigrationCandidate(
      [
        { id: 1, name: "exit tijd", type: "custom" },
        { id: 2, name: "Setup", type: "custom" },
      ],
      SYSTEM_FIELD_KEYS.exitTime
    );
    assert.equal(hit.name, "exit tijd");
  });

  it("systemFieldMap prefers bound system columns", () => {
    const map = systemFieldMap([
      { name: "Exittijd", type: "system", system_key: "exitTime" },
      { name: "close time", type: "custom" },
      { name: "Entreetijd", type: "system", system_key: "entryTime" },
    ]);
    assert.equal(map.exitTime, "Exittijd");
    assert.equal(map.entryTime, "Entreetijd");
  });
});

describe("legacy HH:MM never invents today", () => {
  it("returns null for time-only without fallback date", () => {
    assert.equal(parseTradeDateTime("14:30"), null);
    assert.equal(toDatetimeLocalValue("14:30"), "");
  });

  it("combines HH:MM with string Datum fallback", () => {
    const d = parseTradeDateTime("14:30", "2026-07-15");
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 15);
    assert.equal(d.getHours(), 14);
    assert.equal(toDatetimeLocalValue("09:05", "2026-07-15"), "2026-07-15T09:05");
  });

  it("upgrades trade data HH:MM using Datum", () => {
    const next = upgradeLegacyTimesInTradeData({
      Datum: "2026-07-20",
      Entreetijd: "10:15",
      Exittijd: "11:00",
      PnL: 12,
    });
    assert.equal(next.Entreetijd, "2026-07-20T10:15");
    assert.equal(next.Exittijd, "2026-07-20T11:00");
    assert.equal(next.Datum, "2026-07-20");
    assert.equal(isTimeOnlyValue("10:15"), true);
    assert.equal(isTimeOnlyValue("2026-07-20T10:15"), false);
  });
});

describe("computeHoldMinutes multi-day", () => {
  it("supports datetime-local across days", () => {
    const mins = computeHoldMinutes({
      entryValue: "2026-08-01T10:00",
      exitValue: "2026-08-03T12:30",
    });
    assert.equal(mins, 2 * 24 * 60 + 150);
  });

  it("supports legacy HH:MM with trade date overnight wrap", () => {
    const mins = computeHoldMinutes({
      entryValue: "22:00",
      exitValue: "01:30",
      tradeDate: "2026-08-01",
    });
    assert.equal(mins, 3.5 * 60);
  });
});
