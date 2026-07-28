import {
  BrainCog,
  ClipboardList,
  Flame,
  Frown,
  GraduationCap,
  Minus,
  ShieldAlert,
  Smile,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

/**
 * Mood vocabulary. `id` is what gets persisted in the entry front-matter, so
 * these strings are part of the storage format — rename with care.
 */
export const MOODS = [
  { id: "calm", label: "Calm", icon: Smile, tone: "profit" },
  { id: "focused", label: "Focused", icon: Target, tone: "brand" },
  { id: "confident", label: "Confident", icon: TrendingUp, tone: "info" },
  { id: "neutral", label: "Neutral", icon: Minus, tone: "neutral" },
  { id: "anxious", label: "Anxious", icon: TriangleAlert, tone: "warn" },
  { id: "frustrated", label: "Frustrated", icon: Frown, tone: "loss" },
  { id: "tilted", label: "Tilted", icon: Flame, tone: "loss" },
];

export const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

export function moodOf(id) {
  return id ? (MOOD_BY_ID[id] ?? null) : null;
}

/**
 * Structured prompt skeletons. Inserting one pre-fills the composer with the
 * questions worth answering rather than an empty box.
 */
export const TEMPLATES = [
  {
    id: "pre-market",
    label: "Pre-market plan",
    description: "Bias, levels and the setups you will allow yourself",
    icon: ClipboardList,
    mood: "focused",
    tags: ["plan"],
    body: [
      "Pre-market plan",
      "",
      "Higher timeframe bias: ",
      "Key levels: ",
      "Setups I will take: ",
      "No-trade conditions: ",
      "Max risk per trade: ",
      "Max trades today: ",
    ].join("\n"),
  },
  {
    id: "post-session",
    label: "Post-session review",
    description: "Score the process, not the P&L",
    icon: BrainCog,
    mood: "neutral",
    tags: ["review"],
    body: [
      "Post-session review",
      "",
      "What I planned: ",
      "What I actually did: ",
      "Process score (1-10): ",
      "Best decision: ",
      "Worst decision: ",
      "One thing to repeat tomorrow: ",
    ].join("\n"),
  },
  {
    id: "lesson",
    label: "Lesson learned",
    description: "Turn one observation into a rule",
    icon: GraduationCap,
    mood: "calm",
    tags: ["lesson"],
    body: [
      "Lesson learned",
      "",
      "What happened: ",
      "Why it happened: ",
      "The rule I am adding: ",
      "How I will catch it in real time: ",
    ].join("\n"),
  },
  {
    id: "mistake",
    label: "Mistake log",
    description: "Name the trigger and price the damage",
    icon: ShieldAlert,
    mood: "frustrated",
    tags: ["mistake"],
    body: [
      "Mistake log",
      "",
      "Mistake: ",
      "Trigger that preceded it: ",
      "Cost (R and $): ",
      "Was it in my plan? ",
      "Correction: ",
    ].join("\n"),
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
