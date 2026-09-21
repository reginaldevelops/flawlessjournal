import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  excludeDeleted,
  forgetTags,
  harvestTagsFromRows,
  mergeCatalog,
  normalizeTag,
  parseStoredTagLibrary,
  parseTags,
  stripTagFromTradeRows,
  tagTone,
} from "./tradeTags.js";

describe("tradeTags", () => {
  it("normalizes and parses tag lists", () => {
    assert.equal(normalizeTag("  A plus  "), "A-plus");
    assert.equal(normalizeTag("#FOMO"), "FOMO");
    assert.deepEqual(parseTags("FOMO, News | Revenge"), ["FOMO", "News", "Revenge"]);
    assert.deepEqual(parseTags(["#edge", " edge "]), ["edge", "edge"]);
  });

  it("merges catalogs without case duplicates", () => {
    assert.deepEqual(mergeCatalog(["FOMO", "News"], ["fomo", "A-plus"]), [
      "FOMO",
      "News",
      "A-plus",
    ]);
  });

  it("keeps a stable colour for the same tag name", () => {
    assert.equal(tagTone("FOMO"), tagTone("FOMO"));
    assert.notEqual(TAG_PALETTE_HAS(tagTone("FOMO")), false);
  });

  it("harvests tags from mixed row shapes", () => {
    const names = harvestTagsFromRows([
      { data: { Tags: ["FOMO", "News"] } },
      { Tags: "Patience,FOMO" },
      { data: { tags: ["Revenge"] } },
    ]);
    assert.deepEqual(names, ["FOMO", "News", "Patience", "Revenge"]);
  });

  it("parses stored catalog objects and array payloads", () => {
    assert.deepEqual(parseStoredTagLibrary(["FOMO", "News"]), {
      catalog: ["FOMO", "News"],
      deleted: [],
    });
    assert.deepEqual(
      parseStoredTagLibrary({ catalog: ["FOMO"], deleted: ["typo"] }),
      { catalog: ["FOMO"], deleted: ["typo"] }
    );
  });

  it("forgets a tag from the catalog and tombstones it", () => {
    const { catalog, deleted } = forgetTags(["FOMO"], {
      catalog: ["FOMO", "News"],
      deleted: [],
    });
    assert.deepEqual(catalog, ["News"]);
    assert.deepEqual(deleted, ["FOMO"]);
    assert.deepEqual(excludeDeleted(["FOMO", "News", "fomo"], deleted), ["News"]);
  });

  it("strips a deleted tag from trade rows", () => {
    const updates = stripTagFromTradeRows(
      [
        { id: 1, data: { Tags: ["FOMO", "News"], Coin: "SOL" } },
        { id: 2, data: { Tags: ["Patience"] } },
        { id: 3, data: { tags: "FOMO, Revenge" } },
      ],
      "fomo"
    );
    assert.equal(updates.length, 2);
    assert.deepEqual(updates[0].data.Tags, ["News"]);
    assert.equal(updates[0].data.Coin, "SOL");
    assert.deepEqual(updates[1].data.tags, ["Revenge"]);
  });
});

function TAG_PALETTE_HAS(tone) {
  return typeof tone === "string" && tone.includes("bg-");
}
