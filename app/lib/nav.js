import {
  BookOpen,
  ChartNoAxesCombined,
  LayoutDashboard,
  NotebookPen,
  Table2,
  Wallet,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Today's session, balances and economic events",
  },
  {
    href: "/trades",
    label: "Trades",
    icon: Table2,
    description: "Every logged trade with custom columns",
  },
  {
    href: "/journal",
    label: "Journal",
    icon: NotebookPen,
    description: "Daily reflections tied to your calendar",
  },
  {
    href: "/notebook",
    label: "Notebook",
    icon: BookOpen,
    description: "Playbooks, reviews and research documents",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    description: "Edge breakdowns, reports and risk metrics",
  },
  {
    href: "/wallets",
    label: "Wallets",
    icon: Wallet,
    description: "Solana and exchange balances",
  },
];

/** Route -> page title used by the top bar. */
export function routeMeta(pathname) {
  if (!pathname) return { label: "", parent: null };
  const exact = NAV_ITEMS.find((n) => n.href === pathname);
  if (exact) return { label: exact.label, parent: null, icon: exact.icon };

  if (pathname.startsWith("/trade/")) {
    return { label: "Trade detail", parent: { label: "Trades", href: "/trades" }, icon: Table2 };
  }
  if (pathname.startsWith("/onboarding")) return { label: "Set up your journal", parent: null };

  const partial = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
  if (partial) return { label: partial.label, parent: null, icon: partial.icon };
  return { label: "", parent: null };
}
