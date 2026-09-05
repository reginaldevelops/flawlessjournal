import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAINS, computeHeat } from "./defillama.js";

describe("chain analysis chains", () => {
  it("includes BNB mapped to DefiLlama BSC", () => {
    assert.equal(CHAINS.bnb.label, "BNB Chain");
    assert.equal(CHAINS.bnb.llamaDex, "BSC");
    assert.equal(CHAINS.bnb.llamaTvl, "BSC");
    assert.equal(CHAINS.bnb.llamaFees, "BSC");
    assert.equal(CHAINS.bnb.hasLaunchpads, true);
    assert.match("Four.meme", CHAINS.bnb.launchpadPattern);
    assert.match("Pinksale", CHAINS.bnb.launchpadPattern);
  });

  it("keeps solana / HL / Robinhood", () => {
    assert.deepEqual(Object.keys(CHAINS), ["solana", "bnb", "hyperliquid", "robinhood"]);
  });

  it("scores heat from volume momentum", () => {
    const hot = computeHeat({ change1d: 40, change7d: 20, volume24h: 200, volume7dAvg: 100 });
    assert.equal(hot.label, "Hot");
    const cold = computeHeat({ change1d: -40, change7d: -20, volume24h: 50, volume7dAvg: 100 });
    assert.equal(cold.label, "Cold");
  });
});
