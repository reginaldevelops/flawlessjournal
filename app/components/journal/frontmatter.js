/**
 * Structured metadata inside a plain-text journal entry.
 *
 * `journal_entries` only has `content` + `created_at`, so mood and tags are
 * encoded as ONE machine-readable line at the very top of `content`:
 *
 *   <!--fj:1 {"mood":"focused","tags":["london","discipline"]}-->
 *   Everything from the next line on is the body, verbatim.
 *
 * Why this shape:
 *  - Single line, so parsing never has to scan past the first newline.
 *  - An HTML comment is inert if the text is ever rendered as markup, and a
 *    hand-written trading note realistically never starts with `<!--fj:`.
 *  - JSON removes all escaping questions: tags may contain commas, colons or
 *    quotes and still survive a round-trip untouched.
 *  - Versioned (`fj:1`) so the payload can evolve without breaking old rows.
 *  - The line is only written when metadata actually exists, so entries without
 *    a mood or tags stay pure plain text and legacy rows keep rendering exactly
 *    as they always did (they simply parse to `{ mood: null, tags: [] }`).
 */

const FRONT_MATTER = /^<!--fj:1 (\{[\s\S]*?\})-->(?:\r?\n)?/;

const EMPTY_META = { mood: null, tags: [] };

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const tag = String(raw ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 32);
    if (!tag) continue;
    const dedupe = tag.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

/** `content` -> `{ mood, tags, body }`. Never throws, never loses text. */
export function parseEntry(content) {
  const raw = typeof content === "string" ? content : "";
  const match = FRONT_MATTER.exec(raw);
  if (!match) return { ...EMPTY_META, body: raw };

  try {
    const meta = JSON.parse(match[1]);
    return {
      mood: typeof meta?.mood === "string" && meta.mood ? meta.mood : null,
      tags: cleanTags(meta?.tags),
      body: raw.slice(match[0].length),
    };
  } catch {
    // Malformed payload: treat the whole thing as body so nothing disappears.
    return { ...EMPTY_META, body: raw };
  }
}

/** `{ mood, tags, body }` -> `content`. Omits the header when there's no metadata. */
export function serializeEntry({ mood, tags, body }) {
  const text = typeof body === "string" ? body : "";
  const cleanMood = typeof mood === "string" && mood ? mood : null;
  const cleanedTags = cleanTags(tags);

  if (!cleanMood && !cleanedTags.length) return text;

  const payload = {};
  if (cleanMood) payload.mood = cleanMood;
  if (cleanedTags.length) payload.tags = cleanedTags;

  return `<!--fj:1 ${JSON.stringify(payload)}-->\n${text}`;
}

export { cleanTags };
