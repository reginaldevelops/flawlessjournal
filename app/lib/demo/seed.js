/**
 * Deterministic demo dataset.
 *
 * Used when Supabase credentials are not configured (local development,
 * previews, screenshots). The numbers are generated from a fixed seed so the
 * app looks identical on every run, and the distribution is intentionally
 * realistic: a positive but imperfect edge, one leaking setup, a revenge-trading
 * pattern on Fridays, and a drawdown to recover from.
 */

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260728);

const pick = (arr) => arr[Math.floor(rng() * arr.length)];
/** Picks a full weighted entry (weight is always the second element). */
const pickEntry = (entries) => {
  const total = entries.reduce((a, e) => a + e[1], 0);
  let r = rng() * total;
  for (const entry of entries) {
    r -= entry[1];
    if (r <= 0) return entry;
  }
  return entries[entries.length - 1];
};

const pickWeighted = (pairs) => pickEntry(pairs)[0];
const round = (n, dp = 2) => Number(n.toFixed(dp));
const pad = (n) => String(n).padStart(2, "0");

const SYMBOLS = [
  ["SOL/USDT", 22],
  ["BTC/USDT", 20],
  ["ETH/USDT", 18],
  ["HYPE/USDT", 9],
  ["JUP/USDT", 7],
  ["WIF/USDT", 6],
  ["NQ", 10],
  ["ES", 8],
];

const SETUPS = [
  // [name, weight, edgeQuality]  edgeQuality drives win rate + payoff
  ["Liquidity sweep", 26, 0.8],
  ["Break & retest", 21, 0.6],
  ["Trend continuation", 17, 0.54],
  ["Range fade", 13, 0.4],
  ["News momentum", 11, 0.2],
  ["Counter-trend scalp", 12, 0.12],
];

const SESSIONS = [
  ["London", 34, 0.68],
  ["New York", 38, 0.6],
  ["Asia", 16, 0.4],
  ["London close", 12, 0.22],
];

const TIMEFRAMES = [
  ["5m", 30],
  ["15m", 34],
  ["1H", 24],
  ["4H", 12],
];

const EMOTIONS_WIN = ["Calm", "Focused", "Confident", "Patient"];
const EMOTIONS_LOSS = ["Frustrated", "Impatient", "FOMO", "Anxious", "Revenge"];
const MISTAKES = [
  "None",
  "None",
  "None",
  "Early entry",
  "Moved stop",
  "Oversized",
  "No confirmation",
  "Chased entry",
  "Ignored plan",
];
const GRADES = ["A+", "A", "B", "C", "D"];

const WIN_NOTES = [
  "Textbook execution. Waited for the sweep of the Asian low, entered on the 5m displacement close, scaled 50% at 1R and trailed the rest under structure.",
  "Patience paid. Sat on hands for 40 minutes until price tapped the level, then took the entry exactly as planned.",
  "Clean break and retest of the daily level. Risk was defined, sizing was correct, no interference after entry.",
  "Followed the plan to the letter. Target hit while I was away from the desk — the setup did the work, not me.",
  "Good read on the higher timeframe. Continuation entry after the pullback held the 15m order block.",
];

const LOSS_NOTES = [
  "Entered before the confirmation candle closed. Price wicked straight through my stop then went my way. Pure impatience.",
  "Revenge trade after the previous loss. Sized up to 'get it back' and got punished. This is the pattern I keep repeating.",
  "Setup was valid but I moved my stop to give it room. Turned a 1R loss into a 2.4R loss. Unforgivable.",
  "Traded into high-impact news without checking the calendar. Slippage on entry, slippage on exit.",
  "Counter-trend scalp against a clean uptrend. I know this setup is negative expectancy for me and I took it anyway.",
  "Chased the entry after missing the initial move. Entry was 0.8% worse than planned which broke the risk/reward.",
];

function noteFor(pnl, mistake) {
  const base = pnl > 0 ? pick(WIN_NOTES) : pick(LOSS_NOTES);
  if (mistake && mistake !== "None" && pnl <= 0) {
    return `${base}\n\nRoot cause: ${mistake.toLowerCase()}.`;
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export const DEMO_USER = {
  id: "demo-user-0001",
  email: "demo@flawless.journal",
  user_metadata: { full_name: "Demo Trader" },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2025-01-04T09:00:00.000Z",
};

const VARIABLE_DEFS = [
  ["Datum", "date", "pre", null],
  ["Entreetijd", "time", "pre", null],
  ["Coin", "dropdown", "pre", SYMBOLS.map(([s]) => s)],
  ["Direction", "dropdown", "pre", ["Long", "Short"]],
  ["Setup", "dropdown", "pre", SETUPS.map(([s]) => s)],
  ["Session", "dropdown", "pre", SESSIONS.map(([s]) => s)],
  ["Timeframe", "dropdown", "pre", TIMEFRAMES.map(([s]) => s)],
  ["Risk", "number", "pre", null],
  ["Confidence", "number", "pre", null],
  ["Entry chart", "chart", "pre", null],
  ["Exittijd", "time", "post", null],
  ["PnL", "number", "post", null],
  ["R", "number", "post", null],
  ["Emotion", "dropdown", "post", [...EMOTIONS_WIN, ...EMOTIONS_LOSS]],
  ["Mistakes", "dropdown", "post", [...new Set(MISTAKES)]],
  ["Grade", "dropdown", "post", GRADES],
  ["Exit chart", "chart", "post", null],
  ["Notes", "textarea", "post", null],
];

function buildVariables() {
  return VARIABLE_DEFS.map(([name, varType, phase, options], i) => ({
    id: `var-${i + 1}`,
    user_id: DEMO_USER.id,
    name,
    type: name === "PnL" ? "system" : "custom",
    varType,
    phase,
    options: options ?? null,
    formula: name === "R" ? "pnl/risk" : null,
    visible: true,
    editable: true,
    order: i + 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Trades                                                              */
/* ------------------------------------------------------------------ */

function buildTrades() {
  const trades = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const START_DAYS_AGO = 400;
  let tradeNumber = 0;

  for (let offset = START_DAYS_AGO; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const weekday = day.getDay();

    // No weekend trading, and some days are simply skipped.
    if (weekday === 0 || weekday === 6) continue;
    if (rng() < 0.32) continue;

    // Volume varies; Fridays run hot (the overtrading pattern).
    const base = weekday === 5 ? 4 : 2.4;
    const count = Math.max(1, Math.round(base * (0.4 + rng() * 1.3)));

    // Progression: the trader got better after ~day 200, and had a drawdown
    // around day 120-90 before the last stretch.
    const progress = 1 - offset / START_DAYS_AGO;
    const skill = 0.38 + progress * 0.26;
    const inDrawdown = offset < 150 && offset > 105;
    const skillToday = clamp(skill * (inDrawdown ? 0.6 : 1) * (weekday === 5 ? 0.84 : 1), 0.18, 0.78);

    for (let i = 0; i < count; i += 1) {
      tradeNumber += 1;

      const symbol = pickWeighted(SYMBOLS);
      const [setup, , setupEdge] = pickEntry(SETUPS);
      const [session, , sessionEdge] = pickEntry(SESSIONS);
      const timeframe = pickWeighted(TIMEFRAMES);
      const direction = rng() < 0.54 ? "Long" : "Short";

      const winProbability = clamp(
        skillToday * 0.4 + setupEdge * 0.42 + sessionEdge * 0.22 - 0.05,
        0.12,
        0.82
      );
      const isWin = rng() < winProbability;

      // Risk: mostly consistent, occasionally blown out (the risk-management leak)
      const disciplined = rng() > (weekday === 5 ? 0.2 : 0.08);
      const risk = disciplined
        ? round(180 + rng() * 60, 0)
        : round(310 + rng() * 430, 0);

      // R outcome — a modest positive expectancy, not a fantasy curve
      let r;
      if (isWin) {
        r = round(0.5 + setupEdge * 1.1 + rng() * 1.3, 2);
        if (rng() < 0.05) r = round(r * (1.6 + rng() * 1.1), 2); // occasional runner
      } else {
        r = round(-(0.74 + rng() * 0.42), 2);
        if (!disciplined) r = round(r * (1.3 + rng() * 0.9), 2);
        if (rng() < 0.035) r = round(-(2.3 + rng() * 1.5), 2); // blowup
      }
      if (rng() < 0.045) r = 0; // scratch

      const pnl = round(r * risk, 2);

      const startHour =
        session === "Asia" ? 1 + Math.floor(rng() * 5)
        : session === "London" ? 7 + Math.floor(rng() * 4)
        : session === "New York" ? 13 + Math.floor(rng() * 5)
        : 17 + Math.floor(rng() * 3);
      const startMin = Math.floor(rng() * 60);
      const holdMin = Math.round(
        (timeframe === "5m" ? 8 : timeframe === "15m" ? 34 : timeframe === "1H" ? 110 : 320) *
          (0.4 + rng() * 1.6) *
          (isWin ? 1.25 : 0.8)
      );
      const endTotal = startHour * 60 + startMin + holdMin;
      const exitHour = Math.floor(endTotal / 60) % 24;
      const exitMin = endTotal % 60;

      const mistake = isWin
        ? rng() < 0.82
          ? "None"
          : pick(MISTAKES)
        : disciplined
          ? pick(MISTAKES)
          : pick(MISTAKES.filter((m) => m !== "None"));

      const grade = isWin
        ? pickWeighted([["A+", 22], ["A", 38], ["B", 28], ["C", 10], ["D", 2]])
        : pickWeighted([["A+", 4], ["A", 14], ["B", 26], ["C", 34], ["D", 22]]);

      const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

      trades.push({
        id: `trade-${tradeNumber}`,
        trade_number: tradeNumber,
        created_at: new Date(day.getTime() + startHour * 3600000).toISOString(),
        data: {
          Datum: dateStr,
          Entreetijd: `${pad(startHour)}:${pad(startMin)}`,
          Exittijd: `${pad(exitHour)}:${pad(exitMin)}`,
          Coin: symbol,
          Direction: direction,
          Setup: setup,
          Session: session,
          Timeframe: timeframe,
          Risk: risk,
          Confidence: Math.max(1, Math.min(10, Math.round(3 + winProbability * 8 + (rng() - 0.5) * 3))),
          PnL: pnl,
          R: r,
          Emotion: isWin ? pick(EMOTIONS_WIN) : pick(EMOTIONS_LOSS),
          Mistakes: mistake,
          Grade: grade,
          Notes: noteFor(pnl, mistake),
          "Entry chart": "",
          "Exit chart": "",
        },
      });
    }
  }

  // A couple of still-open trades at the top so status badges have something to show.
  const openDay = new Date(today);
  for (let i = 0; i < 2; i += 1) {
    tradeNumber += 1;
    trades.push({
      id: `trade-${tradeNumber}`,
      trade_number: tradeNumber,
      created_at: openDay.toISOString(),
      data: {
        Datum: `${openDay.getFullYear()}-${pad(openDay.getMonth() + 1)}-${pad(openDay.getDate())}`,
        Entreetijd: `${pad(9 + i * 4)}:15`,
        Coin: i === 0 ? "SOL/USDT" : "BTC/USDT",
        Direction: i === 0 ? "Long" : "Short",
        Setup: i === 0 ? "Liquidity sweep" : "Break & retest",
        Session: i === 0 ? "London" : "New York",
        Timeframe: "15m",
        Risk: 220,
        Confidence: 8,
        PnL: "",
        R: "",
        Notes: "",
        "Entry chart": "",
        "Exit chart": "",
      },
    });
  }

  return trades.reverse();
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

const JOURNAL_TEMPLATES = [
  "Pre-market: SPX futures flat overnight, DXY holding the weekly level. Watching SOL for a sweep of yesterday's low into the London open. Max 2 setups today, {risk} risk each.",
  "Post-session review. {trades} trades taken, net {pnl}. The process score matters more than the number — I followed the plan on all but one entry.",
  "I noticed I get restless after 45 minutes of no setup. That restlessness is what produces the C-grade trades. Tomorrow: hard rule, screen break at the 45 minute mark.",
  "Reviewed the last 20 trades. Counter-trend scalps are still net negative for me over any sample I look at. Removing it from the playbook entirely, not 'trading it smaller'.",
  "Good discipline day. Passed on three marginal setups and took the one that met all criteria. Zero trades would also have been an acceptable outcome.",
  "Sizing crept up again after the winning streak. The account grew 8% but my risk per trade grew 30%. That asymmetry is how good months become bad quarters.",
  "Weekly plan: focus purely on liquidity sweeps in London. No New York afternoon trades — the data says my edge disappears after 18:00.",
  "Journalling the emotion, not just the number: I felt genuine indifference to the loss today. That's the first time in months. Progress.",
  "Mechanical error today — I had the right thesis and entered on the wrong timeframe. The idea was correct and I still lost money. Execution is the edge.",
  "Market conditions changed: ranges have compressed and my breakout setups keep failing. Adapting to fades until volatility expands again.",
];

function buildJournalEntries() {
  const entries = [];
  const today = new Date();
  let id = 1;

  for (let offset = 220; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    if (day.getDay() === 0 || day.getDay() === 6) {
      if (rng() > 0.2) continue;
    }
    if (rng() < 0.52) continue;

    const perDay = rng() < 0.25 ? 2 : 1;
    for (let i = 0; i < perDay; i += 1) {
      const hour = 7 + Math.floor(rng() * 13);
      const at = new Date(day);
      at.setHours(hour, Math.floor(rng() * 60), 0, 0);
      const content = pick(JOURNAL_TEMPLATES)
        .replace("{risk}", `$${180 + Math.floor(rng() * 8) * 10}`)
        .replace("{trades}", String(1 + Math.floor(rng() * 5)))
        .replace("{pnl}", `${rng() > 0.45 ? "+" : "-"}$${(rng() * 1800).toFixed(0)}`);

      entries.push({
        id: `journal-${id++}`,
        created_at: at.toISOString(),
        content,
      });
    }
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* Notebook                                                            */
/* ------------------------------------------------------------------ */

const NOTEBOOK_TAGS = [
  { id: "tag-1", name: "Playbooks", fixed: true },
  { id: "tag-2", name: "Weekly reviews", fixed: true },
  { id: "tag-3", name: "Monthly reviews", fixed: true },
  { id: "tag-4", name: "Psychology", fixed: false },
  { id: "tag-5", name: "Research", fixed: false },
];

const NOTEBOOK_NOTES = [
  {
    tag: "tag-1",
    title: "Playbook — Liquidity Sweep Reversal",
    content: `<h1>Liquidity Sweep Reversal</h1>
<p>My highest-expectancy setup. Only valid during <strong>London</strong> and the first two hours of <strong>New York</strong>.</p>
<h2>Criteria</h2>
<ul><li>Clear session high or low with at least two equal touches</li><li>Sweep of that level with a rejection wick on the 5m</li><li>Displacement candle closing back inside the range</li><li>Entry on the 50% retracement of the displacement leg</li></ul>
<h2>Invalidation</h2>
<p>Price closes a 5m candle beyond the sweep extreme. No exceptions, no "giving it room".</p>
<h2>Management</h2>
<ol><li>Stop below/above the sweep wick + 0.1 ATR</li><li>Scale 50% at 1R</li><li>Trail remainder under 15m structure</li></ol>
<blockquote>Sample: 125 trades, 54% win rate, 1.9 profit factor. Together with the break &amp; retest this is what pays for everything else.</blockquote>`,
  },
  {
    tag: "tag-1",
    title: "Playbook — Break & Retest",
    content: `<h1>Break &amp; Retest</h1>
<p>Secondary setup. Works best on the 15m and 1H when the daily bias is clean.</p>
<h2>Checklist</h2>
<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Daily bias defined before the session</p></div></li><li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Level has at least 3 prior reactions</p></div></li><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Volume expansion on the break</p></div></li><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Retest holds within 2 candles</p></div></li></ul>
<p>If the retest takes more than 2 candles the move is usually distribution, not accumulation. Skip it.</p>`,
  },
  {
    tag: "tag-1",
    title: "Playbook — Setups I no longer trade",
    content: `<h1>The graveyard</h1>
<p>Every setup here was removed for a documented, statistical reason. Re-adding one requires 30 paper trades of evidence.</p>
<table><tbody><tr><th>Setup</th><th>Sample</th><th>Why it died</th></tr><tr><td>Counter-trend scalp</td><td>68 trades</td><td>-$7,389 net at a 25% win rate. Negative in every regime.</td></tr><tr><td>News momentum</td><td>73 trades</td><td>-$10,094. Slippage destroyed the theoretical edge.</td></tr><tr><td>Asia range breakout</td><td>22 trades</td><td>28% win rate, no payoff compensation.</td></tr></tbody></table>`,
  },
  {
    tag: "tag-2",
    title: "Weekly review — discipline over outcome",
    content: `<h1>Week in review</h1>
<p><strong>Net:</strong> +$2,140 across 11 trades.</p>
<h2>What worked</h2>
<p>Waiting. I took four fewer trades than my weekly average and made more money. The setups I passed on would have been two losers and a scratch.</p>
<h2>What didn't</h2>
<p>Friday. Again. Three trades after 15:00, all losers, all outside the plan. Friday afternoon is now a hard no-trade window.</p>
<h2>One change for next week</h2>
<p>Platform closed at 15:00 Friday. Not "I'll be careful" — closed.</p>`,
  },
  {
    tag: "tag-2",
    title: "Weekly review — the drawdown post-mortem",
    content: `<h1>Drawdown post-mortem</h1>
<p>Peak-to-trough of 18% over nine sessions. Painful, but the forensics are clear.</p>
<h2>Cause</h2>
<ol><li>Risk per trade drifted from 1% to 2.4% without a decision being made</li><li>Traded a regime change with a trend playbook</li><li>Two revenge trades on the worst day accounted for 40% of the drawdown</li></ol>
<h2>Fix</h2>
<p>Hard-coded position size calculator. If the ticket is above 1.2% the order does not get placed.</p>`,
  },
  {
    tag: "tag-3",
    title: "Monthly review — the numbers",
    content: `<h1>Monthly review</h1>
<h2>Headline</h2>
<p>Profit factor 1.87, expectancy $148/trade, max drawdown 9.4%. The edge is real but the variance is wider than I would like.</p>
<h2>Distribution</h2>
<p>82% of profit came from 21% of trades. That concentration is fine — it is what a positive-skew strategy looks like — but it means the losing stretches will feel long.</p>
<h2>Next month's single focus</h2>
<blockquote>Cut the bottom decile. My worst 10% of trades cost more than my best 10% earned.</blockquote>`,
  },
  {
    tag: "tag-4",
    title: "Trigger log — what actually precedes a bad trade",
    content: `<h1>Trigger log</h1>
<p>Patterns I have observed in myself, written down so I can catch them in real time.</p>
<ul><li><strong>Missing a move</strong> → chase entry within 20 minutes. Almost always a loser.</li><li><strong>Two losses in a row</strong> → size up on the third. Documented as my single most expensive habit.</li><li><strong>Green by 10:00</strong> → get sloppy, give it back by noon.</li><li><strong>Poor sleep</strong> → dramatically worse patience. Score below 6 = no trading.</li></ul>
<p>The common thread is all four are emotional states, not market states.</p>`,
  },
  {
    tag: "tag-4",
    title: "Pre-session routine",
    content: `<h1>Pre-session routine</h1>
<ol><li>Economic calendar — mark red-folder events, block those windows</li><li>Higher timeframe bias: daily, then 4H</li><li>Mark session high/low and prior day high/low</li><li>Write the plan: two setups maximum, defined risk, defined invalidation</li><li>Read yesterday's journal entry</li></ol>
<p>If step 5 gets skipped, the day statistically goes worse. That is not superstition, I checked.</p>`,
  },
  {
    tag: "tag-5",
    title: "Research — funding rates as a filter",
    content: `<h1>Funding rates as a mean-reversion filter</h1>
<p>Hypothesis: extreme positive funding on perps precedes short-term reversals on the majors.</p>
<h2>Method</h2>
<p>Pulled 18 months of hourly funding for SOL and BTC, flagged the top decile, measured forward returns at 4h/12h/24h.</p>
<h2>Result</h2>
<p>Weak but present: 4h forward return of -0.38% on average vs -0.04% baseline. Not tradeable alone; potentially useful as a confluence filter on short setups.</p>
<pre><code>funding_zscore &gt; 2.0 AND setup == "liquidity_sweep" AND direction == "short"</code></pre>`,
  },
  {
    tag: "tag-5",
    title: "Research — session volatility profile",
    content: `<h1>Session volatility profile</h1>
<p>Average true range by hour, last 90 days. The takeaway is that my edge lives between 07:00 and 16:00 UTC and effectively vanishes outside that window.</p>
<p>Two consequences:</p>
<ul><li>Stops sized on a 24h ATR are too wide during Asia and too tight during the London open</li><li>The "one more trade" at 19:00 is not the same game I trained for</li></ul>`,
  },
];

function buildNotebook() {
  const now = Date.now();
  return NOTEBOOK_NOTES.map((n, i) => {
    const updated = new Date(now - i * 3.4 * 86400000 - Math.floor(rng() * 6) * 3600000);
    const created = new Date(updated.getTime() - (4 + Math.floor(rng() * 40)) * 86400000);
    return {
      id: `note-${i + 1}`,
      title: n.title,
      content: n.content,
      tag_id: n.tag,
      created_at: created.toISOString(),
      updated_at: updated.toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Misc tables                                                         */
/* ------------------------------------------------------------------ */

const NOTES_ROWS = [
  {
    id: "note-main",
    type: "note",
    content:
      "Focus this month:\n• One setup, traded well, beats five traded adequately.\n• Size stays at 1% until the equity curve makes a new high.\n• Friday afternoons are closed.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-1",
    type: "goal",
    content: "Reach $10,000 account equity",
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "goal-2",
    type: "goal",
    content: "Zero rule violations for 20 consecutive sessions",
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "goal-3",
    type: "goal",
    content: "Keep max drawdown under 8% this quarter",
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "goal-4",
    type: "goal",
    content: "Journal every session before 21:00",
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

const WALLETS = [
  {
    id: "wallet-1",
    user_id: DEMO_USER.id,
    label: "Phantom — main",
    chain: "solana",
    address: "5DdCjo3doetP3txpkQkXB5ymQp89SMEsHrPt4ZWqcoH1",
    include_in_balance: true,
    color: "#7c6cff",
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
  {
    id: "wallet-2",
    user_id: DEMO_USER.id,
    label: "Hyperliquid",
    chain: "hyperliquid",
    address: "0x50027f8cec746977c209C6684AD92a15c2fC7Fd2",
    include_in_balance: true,
    color: "#4fd1ff",
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
];

/* ------------------------------------------------------------------ */

export function buildSeed() {
  const trades = buildTrades();
  return {
    variables: buildVariables(),
    trades,
    journal_entries: buildJournalEntries(),
    notebook_tags: NOTEBOOK_TAGS.map((t) => ({
      ...t,
      created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
    })),
    notebook: buildNotebook(),
    notes: NOTES_ROWS,
    wallets: WALLETS,
    table_settings: [
      {
        id: 1,
        visible_columns: [
          "Datum",
          "Coin",
          "Direction",
          "Setup",
          "Session",
          "Risk",
          "PnL",
          "R",
          "Grade",
        ],
        sort_key: "Datum",
        sort_direction: "desc",
      },
    ],
    columns: [],
  };
}
