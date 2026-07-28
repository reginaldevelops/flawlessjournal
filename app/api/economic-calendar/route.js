/**
 * Economic calendar feed.
 *
 * ForexFactory's own /calendar pages sit behind Cloudflare and can no longer be
 * scraped, but the same data is published as a static weekly feed on
 * nfs.faireconomy.media. This route reads that feed, normalises it to a stable
 * shape and never fails hard: on any network problem it serves the last good
 * payload (marked `stale`) or an empty list with an `error` string, so the
 * widget renders a tidy offline state instead of breaking.
 *
 * Feed availability (verified against the live host):
 *   ff_calendar_thisweek.json  200  ← the only week that is actually published
 *   ff_calendar_nextweek.json  404
 *   ff_calendar_lastweek.json  404
 * The `nextweek` / `lastweek` ranges are still wired up so the route keeps
 * working the day ForexFactory republishes them; until then they resolve to an
 * empty list plus an explanatory `error`, and `sources` reports what happened.
 *
 * Query params
 *   range=thisweek|nextweek|lastweek|both   default: thisweek
 *   week=this|next                          legacy alias for range
 *   currencies=USD,EUR                      comma separated currency filter
 *   impact=high,medium                      comma separated impact filter
 *
 * Response
 *   { events, count, range, sources, fetchedAt, stale, error? }
 *
 * Each event is
 *   { id, title, currency, country, impact, date, dateKey, time, allDay,
 *     actual, forecast, previous, url }
 * where `date` is the absolute instant as an ISO string and `dateKey` / `time`
 * are the wall clock in ForexFactory's own timezone (US Eastern). Clients
 * should format `date` so users always see their own local time.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://nfs.faireconomy.media";

/** Ordered fallback chain per week. The XML feed carries the same rows in GMT. */
const FEEDS = {
  thisweek: [
    { source: "faireconomy-json", kind: "json", url: `${BASE}/ff_calendar_thisweek.json` },
    { source: "faireconomy-xml", kind: "xml", url: `${BASE}/ff_calendar_thisweek.xml` },
  ],
  nextweek: [
    { source: "faireconomy-json", kind: "json", url: `${BASE}/ff_calendar_nextweek.json` },
    { source: "faireconomy-xml", kind: "xml", url: `${BASE}/ff_calendar_nextweek.xml` },
  ],
  lastweek: [
    { source: "faireconomy-json", kind: "json", url: `${BASE}/ff_calendar_lastweek.json` },
    { source: "faireconomy-xml", kind: "xml", url: `${BASE}/ff_calendar_lastweek.xml` },
  ],
};

const RANGE_WEEKS = {
  thisweek: ["thisweek"],
  nextweek: ["nextweek"],
  lastweek: ["lastweek"],
  both: ["thisweek", "nextweek"],
};

const TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const SOURCE_TZ = "America/New_York";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** week -> { events, source, fetchedAt, expiresAt } */
const cache = new Map();

const COUNTRY_BY_CURRENCY = {
  USD: "United States",
  EUR: "Euro Area",
  GBP: "United Kingdom",
  JPY: "Japan",
  CHF: "Switzerland",
  AUD: "Australia",
  NZD: "New Zealand",
  CAD: "Canada",
  CNY: "China",
  ALL: "Global",
};

const IMPACT_MAP = {
  high: "high",
  medium: "medium",
  moderate: "medium",
  low: "low",
  holiday: "holiday",
  "non-economic": "holiday",
  none: "low",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * FNV-1a. The id has to survive the feed being re-ordered or re-fetched,
 * otherwise React would remount every row on each refresh, so it is derived
 * purely from the event's identity (day + clock + currency + title).
 */
function fingerprint(parts) {
  let hash = 0x811c9dc5;
  const input = parts.join("\u0000").toLowerCase();
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

function cleanText(value) {
  const s = String(value ?? "").trim();
  return s && s !== "-" ? s : null;
}

function normalizeImpact(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return IMPACT_MAP[key] ?? "low";
}

/** Wall-clock parts of an instant inside a named timezone. */
function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  const hour = out.hour === "24" ? "00" : out.hour;
  return {
    dateKey: `${out.year}-${out.month}-${out.day}`,
    time: `${hour}:${out.minute}`,
  };
}

function buildEvent({ title, currency, impact, dateKey, time, date, allDay, actual, forecast, previous, url }) {
  const currencyCode = String(currency ?? "").trim().toUpperCase() || "ALL";
  const cleanTitle = String(title ?? "").trim();
  return {
    id: fingerprint([dateKey ?? "tbd", allDay ? "allday" : (time ?? ""), currencyCode, cleanTitle]),
    title: cleanTitle,
    currency: currencyCode,
    country: COUNTRY_BY_CURRENCY[currencyCode] ?? currencyCode,
    impact,
    date: date ?? null,
    dateKey: dateKey ?? null,
    time: allDay ? null : (time ?? null),
    allDay,
    actual: cleanText(actual),
    forecast: cleanText(forecast),
    previous: cleanText(previous),
    url: url ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

/**
 * JSON feed rows look like
 *   { title, country, date: "2026-07-28T08:30:00-04:00", impact, forecast, previous }
 * The offset is ForexFactory's own (US Eastern), so the wall clock in the
 * string is already the source-timezone reading.
 */
function parseJsonFeed(payload) {
  if (!Array.isArray(payload)) throw new Error("Unexpected JSON feed shape");

  return payload
    .map((row) => {
      const raw = String(row?.date ?? "");
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw);
      if (!match || !row?.title) return null;

      const [, year, month, day, hour, minute] = match;
      const instant = new Date(raw);
      const valid = !Number.isNaN(instant.getTime());
      const impact = normalizeImpact(row.impact);
      const time = `${hour}:${minute}`;
      // ForexFactory publishes all-day items (holidays, tentative releases) at
      // midnight in its own timezone.
      const allDay = impact === "holiday" || time === "00:00";

      return buildEvent({
        title: row.title,
        currency: row.country,
        impact,
        dateKey: `${year}-${month}-${day}`,
        time,
        date: valid ? instant.toISOString() : null,
        allDay,
        actual: row.actual,
        forecast: row.forecast,
        previous: row.previous,
        url: row.url,
      });
    })
    .filter(Boolean);
}

const XML_EVENT_RE = /<event>([\s\S]*?)<\/event>/g;

function xmlField(block, name) {
  const re = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`, "i");
  const match = re.exec(block);
  return match ? match[1].trim() : "";
}

/** "11:50pm" -> minutes from midnight, or null for "All Day" / "Tentative". */
function parseClock(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(value ?? "").trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hour !== 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * XML feed rows carry `MM-DD-YYYY` plus a GMT clock, so they are converted to
 * an absolute instant first and then re-expressed in the source timezone.
 */
function parseXmlFeed(text) {
  const events = [];
  let match;

  XML_EVENT_RE.lastIndex = 0;
  while ((match = XML_EVENT_RE.exec(text)) !== null) {
    const block = match[1];
    const title = xmlField(block, "title");
    const rawDate = xmlField(block, "date");
    const dateMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(rawDate);
    if (!title || !dateMatch) continue;

    const [, month, day, year] = dateMatch;
    const impact = normalizeImpact(xmlField(block, "impact"));
    const minutes = parseClock(xmlField(block, "time"));
    const allDay = impact === "holiday" || minutes === null;

    let dateKey = `${year}-${month}-${day}`;
    let time = null;
    let date = null;

    if (!allDay) {
      const instant = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day), Math.floor(minutes / 60), minutes % 60)
      );
      date = instant.toISOString();
      const local = partsInZone(instant, SOURCE_TZ);
      dateKey = local.dateKey;
      time = local.time;
    }

    events.push(
      buildEvent({
        title,
        currency: xmlField(block, "country"),
        impact,
        dateKey,
        time,
        date,
        allDay,
        actual: xmlField(block, "actual"),
        forecast: xmlField(block, "forecast"),
        previous: xmlField(block, "previous"),
        url: xmlField(block, "url") || null,
      })
    );
  }

  if (!events.length) throw new Error("No events found in XML feed");
  return events;
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

async function readFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: feed.kind === "json" ? "application/json,text/plain,*/*" : "application/xml,text/xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (feed.kind === "json") {
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Feed did not return JSON");
      }
      return parseJsonFeed(payload);
    }
    return parseXmlFeed(text);
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`timed out after ${FETCH_TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const dayA = String(a.dateKey ?? "");
    const dayB = String(b.dateKey ?? "");
    if (dayA !== dayB) return dayA.localeCompare(dayB);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return String(a.time ?? "").localeCompare(String(b.time ?? ""));
  });
}

/** Loads one week, preferring fresh cache, then live feeds, then stale cache. */
async function loadWeek(week) {
  const cached = cache.get(week);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return { ...cached, stale: false, cached: true };
  }

  const failures = [];
  for (const feed of FEEDS[week]) {
    try {
      const events = sortEvents(await readFeed(feed));
      const entry = {
        events,
        source: feed.source,
        fetchedAt: new Date().toISOString(),
        expiresAt: now + TTL_MS,
      };
      cache.set(week, entry);
      return { ...entry, stale: false, cached: false };
    } catch (err) {
      failures.push(`${feed.source} ${err?.message ?? "failed"}`);
    }
  }

  const error = `${week} feed unreachable (${failures.join("; ")})`;
  if (cached) return { ...cached, stale: true, cached: true, error };
  return {
    events: [],
    source: "unavailable",
    fetchedAt: new Date().toISOString(),
    stale: false,
    cached: false,
    error,
  };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

function parseList(value) {
  if (!value) return null;
  const list = String(value)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

function resolveRange(params) {
  const raw = String(params.get("range") ?? "").trim().toLowerCase();
  if (RANGE_WEEKS[raw]) return raw;
  // Legacy alias used before `range` existed.
  const week = String(params.get("week") ?? "").trim().toLowerCase();
  if (week === "next") return "nextweek";
  if (week === "last") return "lastweek";
  if (week === "both") return "both";
  return "thisweek";
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const range = resolveRange(params);
  const currencies = parseList(params.get("currencies"));
  const impacts = parseList(params.get("impact"));

  const results = [];
  for (const week of RANGE_WEEKS[range]) {
    try {
      results.push({ week, ...(await loadWeek(week)) });
    } catch (err) {
      // Defensive: loadWeek already swallows feed errors, so this only fires on
      // something genuinely unexpected. The widget still gets a usable payload.
      results.push({
        week,
        events: [],
        source: "unavailable",
        fetchedAt: new Date().toISOString(),
        stale: false,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  const seen = new Set();
  let events = [];
  for (const result of results) {
    for (const event of result.events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      events.push(event);
    }
  }
  events = sortEvents(events);

  if (currencies) events = events.filter((e) => currencies.includes(e.currency.toLowerCase()));
  if (impacts) events = events.filter((e) => impacts.includes(e.impact));

  const errors = results.map((r) => r.error).filter(Boolean);
  const fetchedAt = results.map((r) => r.fetchedAt).filter(Boolean).sort().pop() ?? null;
  // Only surface an error when nothing at all came back — a 404 on next week
  // while this week loaded fine is not something the user needs to see.
  const error = events.length === 0 && errors.length ? errors.join(" · ") : null;

  const body = {
    events,
    count: events.length,
    range,
    sources: results.map((r) => ({
      week: r.week,
      source: r.source,
      count: r.events.length,
      stale: Boolean(r.stale),
      ...(r.error ? { error: r.error } : {}),
    })),
    fetchedAt,
    stale: results.some((r) => r.stale),
    ...(error ? { error } : {}),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
