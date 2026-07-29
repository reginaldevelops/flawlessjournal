"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ArrowRight,
  Command,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sun,
} from "lucide-react";
import { NAV_ITEMS } from "../../lib/nav";
import { isDemoMode, supabase } from "../../lib/supabaseClient";
import { createJournalTrade } from "../../lib/trades/createJournalTrade";
import { useSwapFlow } from "../swap/SwapFlowContext";
import { cn } from "../ui/cn";
import { Kbd } from "../ui/Badge";
import { useTheme } from "./ThemeProvider";

export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(0);
  }, [onOpenChange]);

  const { openSwap } = useSwapFlow();

  const addJournalEntry = useCallback(async () => {
    try {
      const id = await createJournalTrade(supabase);
      if (id) router.push(`/trade/${id}`);
    } catch (err) {
      console.error("Create journal trade failed:", err);
    }
  }, [router]);

  const commands = useMemo(() => {
    const nav = NAV_ITEMS.map((item) => ({
      id: `nav-${item.href}`,
      group: "Navigate",
      label: item.label,
      description: item.description,
      icon: item.icon,
      run: () => router.push(item.href),
    }));

    const actions = [
      {
        id: "journal-entry",
        group: "Actions",
        label: "New journal entry",
        description: "Manual trade log — pre/post fields, notes, tags",
        icon: Plus,
        shortcut: "N",
        run: addJournalEntry,
      },
      {
        id: "swap-trade",
        group: "Actions",
        label: "Swap trade",
        description: "Execute on Solana, then journal with fills and chart",
        icon: ArrowDownUp,
        run: () => openSwap(),
      },
      {
        id: "theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ];

    if (isDemoMode) {
      actions.push({
        id: "reset-demo",
        group: "Actions",
        label: "Reset demo data",
        description: "Restore the seeded dataset",
        icon: RotateCcw,
        run: () => {
          supabase.resetDemoData?.();
          window.location.reload();
        },
      });
    }

    return [...nav, ...actions];
  }, [router, addJournalEntry, openSwap, theme, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const out = new Map();
    filtered.forEach((c, i) => {
      if (!out.has(c.group)) out.set(c.group, []);
      out.get(c.group).push({ ...c, index: i });
    });
    return [...out.entries()];
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          close();
          cmd.run();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIndex, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-canvas/75 backdrop-blur-sm animate-fade-in"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface-overlay shadow-xl animate-fade-in-scale"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-content-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search pages and actions…"
            className="h-12 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-subtle"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[min(60vh,24rem)] overflow-y-auto p-2 thin-scrollbar">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-content-subtle">
              No results for “{query}”
            </p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                  {group}
                </p>
                {items.map((cmd) => {
                  const Icon = cmd.icon;
                  const active = cmd.index === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setActiveIndex(cmd.index)}
                      onClick={() => {
                        close();
                        cmd.run();
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        active ? "bg-surface-hover" : "hover:bg-surface-hover/60"
                      )}
                    >
                      {Icon && (
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                            active
                              ? "border-brand/30 bg-brand-soft text-brand"
                              : "border-line bg-surface-sunken text-content-subtle"
                          )}
                        >
                          <Icon size={14} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-content">
                          {cmd.label}
                        </span>
                        {cmd.description && (
                          <span className="block truncate text-xs text-content-subtle">
                            {cmd.description}
                          </span>
                        )}
                      </span>
                      {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
                      {active && (
                        <ArrowRight size={13} className="shrink-0 text-content-subtle" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-surface-sunken/60 px-4 py-2 text-2xs text-content-subtle">
          <span className="flex items-center gap-1.5">
            <Command size={11} /> Command palette
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> select
            </span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
