import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schemaAlreadyHealthy } from "./ensureSystemVariables.js";

const healthy = [
  { id: 1, name: "PnL", type: "system", varType: "number", phase: "post", system_key: "pnl" },
  { id: 2, name: "Entreetijd", type: "system", varType: "datetime", phase: "pre", system_key: "entryTime" },
  { id: 3, name: "Exittijd", type: "system", varType: "datetime", phase: "post", system_key: "exitTime" },
  { id: 4, name: "Coin", type: "custom", varType: "dropdown", phase: "pre" },
  { id: 5, name: "Datum", type: "custom", varType: "date", phase: "pre", visible: false },
];

describe("schemaAlreadyHealthy", () => {
  it("accepts a migrated journal", () => {
    assert.equal(schemaAlreadyHealthy(healthy), true);
  });

  it("rejects a missing required system field", () => {
    assert.equal(schemaAlreadyHealthy(healthy.filter((v) => v.system_key !== "exitTime")), false);
  });

  it("rejects leftover system Datum / Coin", () => {
    assert.equal(
      schemaAlreadyHealthy([
        ...healthy.filter((v) => v.name !== "Datum"),
        { id: 5, name: "Datum", type: "system", varType: "date", phase: "pre", system_key: "date" },
      ]),
      false
    );
    assert.equal(
      schemaAlreadyHealthy([
        ...healthy.filter((v) => v.name !== "Coin"),
        { id: 4, name: "Coin", type: "system", varType: "text", phase: "pre", system_key: "coin" },
      ]),
      false
    );
  });
});
