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
  MINT_B,
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
  it("simple open → add → close = 1 closed trade", () => {
    const plan = buildImportPlan(SCENARIO_SIMPLE_CLOSE);
    assert.equal(plan.trades.length, 1);
    assert.equal(plan.trades[0].status, "closed");
    assert.deepEqual(roles(plan.trades[0]), ["open", "add", "close"]);
    assert.ok(plan.trades[0].autoImportEligible);
    assert.equal(plan.includedCount, 3);
  });

  it("two episodes → 2 trades (first closed, second open)", () => {
    const plan = buildImportPlan(SCENARIO_TWO_EPISODES);
    assert.equal(plan.trades.length, 2);
    assert.equal(plan.trades[0].status, "closed");
    assert.equal(plan.trades[1].status, "open");
    assert.deepEqual(roles(plan.trades[0]), ["open", "close"]);
    assert.deepEqual(roles(plan.trades[1]), ["open", "add"]);
    assert.ok(plan.trades[0].autoImportEligible);
    assert.ok(plan.trades[1].autoImportEligible);
    assert.equal(plan.includedCount, 4);
  });

  it("reduce then close", () => {
    const plan = buildImportPlan(SCENARIO_REDUCE_CLOSE);
    assert.equal(plan.trades.length, 1);
    assert.deepEqual(roles(plan.trades[0]), ["open", "reduce", "close"]);
    assert.ok(plan.trades[0].autoImportEligible);
  });

  it("Jimothy flat start → oversell stub skipped, second episode imports", () => {
    const jimothy = SCENARIO_JIMOTHY_FLAT.map((s) => ({
      ...s,
      tokenMint: MINT_A,
    }));
    const plan = buildImportPlan(jimothy);
    assert.equal(plan.trades.length, 2);
    assert.equal(plan.trades[0].autoImportEligible, false);
    assert.equal(plan.trades[0].skipReason, "oversell");
    assert.ok(plan.trades[1].autoImportEligible);
    assert.ok(plan.includedCount > 0);
  });

  it("orphan sell episode skipped; later open episode imports", () => {
    const plan = buildImportPlan(SCENARIO_ORPHAN_SELL);
    const orphan = plan.trades.find((t) => t.fills[0]?.role === "orphan");
    const open = plan.trades.find((t) => t.fills[0]?.role === "open");
    assert.ok(orphan);
    assert.equal(orphan.autoImportEligible, false);
    assert.ok(open?.autoImportEligible);
  });

  it("oversell episode gets oversell warning and skips auto import", () => {
    const plan = buildImportPlan(SCENARIO_OVERSELL);
    assert.equal(plan.trades.length, 1);
    assert.ok(plan.trades[0].warnings.includes("oversell"));
    assert.equal(plan.trades[0].autoImportEligible, false);
    assert.equal(plan.trades[0].skipReason, "oversell");
  });

  it("splits two mints — both open episodes import", () => {
    const plan = buildImportPlan(SCENARIO_TWO_MINTS);
    assert.equal(plan.trades.length, 2);
    const aaa = plan.trades.find((t) => t.tokenSymbol === "AAA");
    const bbb = plan.trades.find((t) => t.tokenSymbol === "BBB");
    assert.ok(aaa.autoImportEligible);
    assert.ok(bbb.autoImportEligible);
  });
});

describe("buildImportPlan — with journal context", () => {
  it("Jimothy with 200k prior → continues journal and auto imports", () => {
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
    assert.equal(plan.trades[0].status, "open");
    assert.equal(roles(plan.trades[0])[0], "add");
    assert.ok(plan.trades[0].warnings.includes("continues"));
    assert.equal(plan.trades[0].linkTradeId, "trade-prior");
    assert.ok(plan.trades[0].autoImportEligible);
    assert.ok(plan.includedCount > 0);
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

describe("auto import policy", () => {
  it("isAutoImportEligible allows open episodes and journal continues", () => {
    const closedPlan = buildImportPlan(SCENARIO_SIMPLE_CLOSE);
    assert.ok(isAutoImportEligible(closedPlan.trades[0]));

    const openPlan = buildImportPlan(SCENARIO_TWO_EPISODES);
    assert.ok(isAutoImportEligible(openPlan.trades[1]));

    const rows = journalRowsJimothyPrior();
    const ctx = buildMintContextFromTrades(rows, [MINT_A]);
    const jimothy = SCENARIO_JIMOTHY_FLAT.map((s) => ({ ...s, tokenMint: MINT_A }));
    const contPlan = buildImportPlan(jimothy, ctx);
    assert.ok(isAutoImportEligible(contPlan.trades[0]));
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
