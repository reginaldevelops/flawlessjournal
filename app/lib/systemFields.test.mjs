import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYSTEM_FIELD_KEYS,
  computeHoldMinutes,
  findMigrationCandidate,
  getSystemDataKey,
  getSystemVariable,
  getTradeSystemValue,
  matchesSystemAlias,
  parseTradeDateTime,
  systemFieldMap,
  toDatetimeLocalValue,
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

  it("parses and formats datetime-local", () => {
    const d = parseTradeDateTime("2026-08-01T14:05");
    assert.ok(d instanceof Date);
    assert.equal(toDatetimeLocalValue(d).slice(0, 16), "2026-08-01T14:05");
  });
});
