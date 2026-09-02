/**
 * Drop bulky journal blobs that the trades table never renders.
 * Chart screenshots and position fills can be megabytes per row; keeping them
 * in list state makes /trades feel frozen even after the network returns.
 */

const IMAGE_PLACEHOLDER = "data:image";

export function isHeavyJournalValue(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/")) return true;
  return value.length > 20_000;
}

export function slimTradeDataForList(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;

  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "_fj") {
      const completion = value?.completion;
      if (completion && typeof completion === "object") {
        out._fj = { completion };
      }
      continue;
    }
    if (key.startsWith("_")) continue;
    if (isHeavyJournalValue(value)) {
      out[key] = IMAGE_PLACEHOLDER;
      continue;
    }
    out[key] = value;
  }
  return out;
}
