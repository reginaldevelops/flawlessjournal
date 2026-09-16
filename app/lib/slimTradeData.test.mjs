import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slimTradeData, slimTradeRow } from "./slimTradeData.js";

describe("slimTradeData", () => {
  it("strips data-url chart screenshots but keeps tags and numbers", () => {
    const slim = slimTradeData({
      Coin: "SOL",
      PnL: 120,
      Tags: ["FOMO", "News"],
      "Entry chart": "data:image/jpeg;base64,AAAA",
      "Exit chart": "data:image/png;base64,BBBB",
      Notes: "good read",
    });
    assert.equal(slim.Coin, "SOL");
    assert.equal(slim.PnL, 120);
    assert.deepEqual(slim.Tags, ["FOMO", "News"]);
    assert.equal(slim["Entry chart"], "");
    assert.equal(slim["Exit chart"], "");
    assert.equal(slim.Notes, "good read");
  });

  it("drops fill OHLC snapshots from _fj but keeps position stats", () => {
    const slim = slimTradeData({
      _fj: {
        kind: "solana_position",
        tokenMint: "Mint111",
        tokenSymbol: "BONK",
        computed: { tokens: 12, investedUsd: 40 },
        fills: [
          { side: "buy", signature: "abc", ohlcSnapshot: { candles: [1, 2, 3] } },
          { side: "sell", signature: "def" },
        ],
      },
    });
    assert.equal(slim._fj.kind, "solana_position");
    assert.equal(slim._fj.tokenMint, "Mint111");
    assert.deepEqual(slim._fj.computed, { tokens: 12, investedUsd: 40 });
    assert.equal("ohlcSnapshot" in slim._fj.fills[0], false);
    assert.equal(slim._fj.fills[0].signature, "abc");
    assert.equal(slim._fj.fills[1].signature, "def");
  });

  it("slims a trade row in place of data only", () => {
    const row = slimTradeRow({
      id: 9,
      trade_number: 9,
      data: { Coin: "BTC", chart: "data:image/jpeg;base64,xx" },
    });
    assert.equal(row.id, 9);
    assert.equal(row.data.Coin, "BTC");
    assert.equal(row.data.chart, "");
  });
});
