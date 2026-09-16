import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  harvestTagsFromRows,
  mergeCatalog,
  normalizeTag,
  parseTags,
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
});

function TAG_PALETTE_HAS(tone) {
  return typeof tone === "string" && tone.includes("bg-");
}
