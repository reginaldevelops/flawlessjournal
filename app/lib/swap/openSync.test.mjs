import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterOpenSwaps, isTrueOpenSwap } from "./openSyncCore.js";

function swap(partial = {}) {
  return {
    side: "buy",
    tokenMint: "Mint111",
    signature: "Sig111",
    tokenAmount: 100,
    tokenPre: 0,
    ...partial,
  };
}

describe("isTrueOpenSwap", () => {
  it("accepts buy with tokenPre ≈ 0", () => {
    assert.equal(isTrueOpenSwap(swap({ tokenPre: 0 })), true);
    assert.equal(isTrueOpenSwap(swap({ tokenPre: 1e-15 })), true);
  });

  it("rejects buys with remaining balance", () => {
    assert.equal(isTrueOpenSwap(swap({ tokenPre: 1 })), false);
    assert.equal(isTrueOpenSwap(swap({ tokenPre: 0.0001 })), false);
  });

  it("rejects sells and missing on-chain pre", () => {
    assert.equal(isTrueOpenSwap(swap({ side: "sell", tokenPre: 0 })), false);
    assert.equal(isTrueOpenSwap(swap({ tokenPre: null })), false);
    assert.equal(isTrueOpenSwap(swap({ tokenPre: undefined })), false);
    assert.equal(isTrueOpenSwap(swap({ signature: null })), false);
  });
});

describe("filterOpenSwaps", () => {
  it("keeps only true opens from a mixed batch", () => {
    const opens = filterOpenSwaps([
      swap({ signature: "a", tokenPre: 0 }),
      swap({ signature: "b", tokenPre: 50 }),
      swap({ signature: "c", side: "sell", tokenPre: 100 }),
      swap({ signature: "d", tokenPre: 0 }),
    ]);
    assert.deepEqual(
      opens.map((s) => s.signature),
      ["a", "d"]
    );
  });
});
