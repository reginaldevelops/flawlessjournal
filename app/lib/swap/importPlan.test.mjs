/**
 * Import plan tests — run: npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildImportPlan,
  buildMintContextFromTrades,
  findLinkTradeIdAtTime,
  mergeImportSwaps,
  mergeScanData,
  isAutoImportEligible,
  JOURNAL_POSITION_KIND,
} from "./importPlanCore.js";
import {
  classifyFillRoleAfter,
  isOversell,
  tokensOpenAtTime,
} from "./position.js";
import {
  MINT_A,
  SCENARIO_JIMOTHY_FLAT,
  SCENARIO_ORPHAN_SELL,
  SCENARIO_OVERSELL,
  SCENARIO_REDUCE_CLOSE,
  SCENARIO_SIMPLE_CLOSE,
  SCENARIO_TWO_EPISODES,
  SCENARIO_TWO_MINTS,
  fill,
  journalRowsJimothyPrior,
  swap,
  tradeRow,
  BASE,
} from "./__fixtures__/walletImportScenarios.js";

function roles(trade) {
  return trade.fills.map((f) => f.role);
}

function includedRoles(plan) {
  return plan.trades.flatMap((t) =>
    t.fills.filter((f) => f.included && !f.excluded).map((f) => f.role)
  );
}

describe("classifyFillRoleAfter", () => {
  it("open on first buy when flat", () => {
    assert.equal(classifyFillRoleAfter(0, "buy", 100), "open");
  });

  it("add on buy when already holding", () => {
    assert.equal(classifyFillRoleAfter(500, "buy", 100), "add");
  });

  it("reduce on partial sell", () => {
    assert.equal(classifyFillRoleAfter(1000, "sell", 400), "reduce");
  });

  it("close when sell flats position", () => {
    assert.equal(classifyFillRoleAfter(1000, "sell", 1000), "close");
  });

  it("close when oversell exceeds holdings", () => {
    assert.equal(classifyFillRoleAfter(1180, "sell", 15000), "close");
    assert.equal(isOversell(1180, "sell", 15000), true);
  });

  it("orphan sell when flat", () => {
    assert.equal(classifyFillRoleAfter(0, "sell", 100), "orphan");
  });
});

describe("buildImportPlan — flat journal", () => {
  it("simple open → add → close imports only Open", () => {
    const plan = buildImportPlan(SCENARIO_SIMPLE_CLOSE);
    assert.equal(plan.trades.length, 1);
    assert.deepEqual(roles(plan.trades[0]), ["open", "add", "close"]);
    assert.ok(plan.trades[0].autoImportEligible);
    assert.equal(plan.includedCount, 1);
    assert.deepEqual(includedRoles(plan), ["open"]);
  });

  it("two episodes import one Open each", () => {
    const plan = buildImportPlan(SCENARIO_TWO_EPISODES);
    assert.equal(plan.trades.length, 2);
    assert.ok(plan.trades[0].autoImportEligible);
    assert.ok(plan.trades[1].autoImportEligible);
    assert.equal(plan.includedCount, 2);
    assert.deepEqual(includedRoles(plan), ["open", "open"]);
  });

  it("reduce then close imports only Open", () => {
    const plan = buildImportPlan(SCENARIO_REDUCE_CLOSE);
    assert.equal(plan.includedCount, 1);
    assert.deepEqual(includedRoles(plan), ["open"]);
  });

  it("Jimothy flat → both episodes import their Open", () => {
    const jimothy = SCENARIO_JIMOTHY_FLAT.map((s) => ({
      ...s,
      tokenMint: MINT_A,
    }));
    const plan = buildImportPlan(jimothy);
    assert.equal(plan.trades.length, 2);
    assert.ok(plan.trades[0].autoImportEligible);
    assert.ok(plan.trades[1].autoImportEligible);
    assert.equal(plan.includedCount, 2);
    assert.ok(plan.trades[0].warnings.includes("oversell"));
  });

  it("orphan episode skipped; open episode imports Open only", () => {
    const plan = buildImportPlan(SCENARIO_ORPHAN_SELL);
    const orphan = plan.trades.find((t) => t.fills[0]?.role === "orphan");
    const open = plan.trades.find((t) => t.fills[0]?.role === "open");
    assert.equal(orphan.autoImportEligible, false);
    assert.ok(open?.autoImportEligible);
    assert.equal(plan.includedCount, 1);
  });

  it("oversell episode still imports Open", () => {
    const plan = buildImportPlan(SCENARIO_OVERSELL);
    assert.ok(plan.trades[0].warnings.includes("oversell"));
    assert.ok(plan.trades[0].autoImportEligible);
    assert.equal(plan.includedCount, 1);
  });

  it("splits two mints — one Open per mint", () => {
    const plan = buildImportPlan(SCENARIO_TWO_MINTS);
    assert.equal(plan.includedCount, 2);
    assert.ok(plan.trades.every((t) => t.autoImportEligible));
  });
});

describe("buildImportPlan — with journal context", () => {
  it("Jimothy with prior journal → Add-only episode not auto imported", () => {
    const rows = journalRowsJimothyPrior();
    const ctx = buildMintContextFromTrades(rows, [MINT_A]);
    const batchStart = new Date(BASE * 1000).toISOString();
    assert.equal(tokensOpenAtTime(ctx[MINT_A].allFills, batchStart), 200000);

    const jimothy = SCENARIO_JIMOTHY_FLAT.map((s) => ({
      ...s,
      tokenMint: MINT_A,
    }));
    const plan = buildImportPlan(jimothy, ctx);
    assert.equal(plan.trades.length, 1);
    assert.equal(roles(plan.trades[0])[0], "add");
    assert.equal(plan.trades[0].autoImportEligible, false);
    assert.equal(plan.includedCount, 0);
  });

  it("JOURNAL_POSITION_KIND is solana_position", () => {
    assert.equal(JOURNAL_POSITION_KIND, "solana_position");
    const rows = [tradeRow("t1", MINT_A, "X", [fill("buy", 1000, -7200, "a")])];
    const ctx = buildMintContextFromTrades(rows, [MINT_A]);
    assert.equal(ctx[MINT_A].allFills.length, 1);
  });

  it("findLinkTradeIdAtTime picks live trade", () => {
    const rows = [
      tradeRow("closed", MINT_A, "X", [
        fill("buy", 100, -100000, "old-b"),
        fill("sell", 100, -90000, "old-s"),
      ]),
      tradeRow("live", MINT_A, "X", [fill("buy", 500, -3600, "live-b")]),
    ];
    const beforeIso = new Date(BASE * 1000).toISOString();
    assert.equal(findLinkTradeIdAtTime(rows, MINT_A, beforeIso), "live");
  });
});

describe("open-only import policy", () => {
  it("isAutoImportEligible when trade has Open fill", () => {
    const plan = buildImportPlan(SCENARIO_SIMPLE_CLOSE);
    assert.ok(isAutoImportEligible(plan.trades[0]));

    const oversell = buildImportPlan(SCENARIO_OVERSELL);
    assert.ok(isAutoImportEligible(oversell.trades[0]));
  });

  it("isAutoImportEligible false without Open", () => {
    const rows = journalRowsJimothyPrior();
    const ctx = buildMintContextFromTrades(rows, [MINT_A]);
    const jimothy = SCENARIO_JIMOTHY_FLAT.map((s) => ({ ...s, tokenMint: MINT_A }));
    const plan = buildImportPlan(jimothy, ctx);
    assert.equal(isAutoImportEligible(plan.trades[0]), false);
  });

  it("on-chain tokenPre>0 forces Add even if journal is flat", () => {
    const plan = buildImportPlan([
      swap({ i: 0, side: "buy", qty: 100, tokenPre: 50 }),
    ]);
    assert.equal(plan.trades[0].fills[0].role, "add");
    assert.equal(plan.includedCount, 0);
    assert.equal(plan.trades[0].autoImportEligible, false);
  });

  it("on-chain tokenPre=0 marks Open and auto-imports", () => {
    const plan = buildImportPlan([
      swap({ i: 0, side: "buy", qty: 100, tokenPre: 0 }),
      swap({ i: 1, side: "buy", qty: 50, tokenPre: 100 }),
    ]);
    assert.deepEqual(roles(plan.trades[0]), ["open", "add"]);
    assert.equal(plan.includedCount, 1);
    assert.deepEqual(includedRoles(plan), ["open"]);
  });
});

describe("dedup", () => {
  it("marks already-imported fills", () => {
    const rows = [tradeRow("t1", MINT_A, "X", [fill("buy", 100, -100, "sig-dup")])];
    const ctx = buildMintContextFromTrades(rows, [MINT_A]);
    const plan = buildImportPlan(
      [swap({ i: 0, side: "buy", qty: 100, sig: "sig-dup" })],
      ctx
    );
    assert.equal(plan.includedCount, 0);
    assert.ok(plan.trades[0].fills[0].alreadyImported);
  });
});

describe("mergeImportSwaps", () => {
  it("dedupes by signature+side and sorts chronologically", () => {
    const older = [swap({ i: 0, side: "buy", qty: 100, sig: "open-b" })];
    const current = [
      swap({ i: 1, side: "sell", qty: 50, sig: "sell-a" }),
      swap({ i: 0, side: "buy", qty: 100, sig: "open-b" }),
    ];
    const merged = mergeImportSwaps(current, older);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].signature, "open-b");
    assert.equal(merged[1].signature, "sell-a");
  });

  it("mergeScanData extends oldest boundary", () => {
    const base = {
      swaps: [swap({ i: 1, side: "sell", qty: 50, sig: "sell-a" })],
      scanned: 100,
      total: 100,
      oldestTime: 2000,
      oldestSignature: "sig-cursor",
      hasMoreOlder: true,
      mergedBatches: 1,
    };
    const older = {
      swaps: [swap({ i: 0, side: "buy", qty: 100, sig: "open-b" })],
      scanned: 100,
      total: 100,
      oldestTime: 1000,
      oldestSignature: "sig-older",
      hasMoreOlder: false,
    };
    const merged = mergeScanData(base, older);
    assert.equal(merged.swaps.length, 2);
    assert.equal(merged.oldestTime, 1000);
    assert.equal(merged.oldestSignature, "sig-older");
    assert.equal(merged.mergedBatches, 2);
    assert.equal(merged.hasMoreOlder, false);
  });
});
