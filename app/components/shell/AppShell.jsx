"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { NAV_ITEMS, routeMeta } from "../../lib/nav";
import { isDemoMode, supabase } from "../../lib/supabaseClient";
import { createJournalTrade } from "../../lib/trades/createJournalTrade";
import Button from "../ui/Button";
import { Badge, Kbd } from "../ui/Badge";
import { Tooltip, Popover, MenuItem, MenuSeparator, MenuLabel } from "../ui/Overlays";
import { cn } from "../ui/cn";
import { LogoMark, Wordmark } from "./Logo";
import { useTheme } from "./ThemeProvider";
import CommandPalette from "./CommandPalette";
import LivePositionsBar from "../swap/LivePositionsBar";
import { useSwapFlow } from "../swap/SwapFlowContext";

const COLLAPSE_KEY = "flawless.sidebar.collapsed";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const { openSwap } = useSwapFlow();

  const activeTradeId = useMemo(() => {
    const match = pathname?.match(/^\/trade\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [pathname]);

  const openSwapForContext = useCallback(() => {
    openSwap(activeTradeId ? { tradeId: activeTradeId } : {});
  }, [openSwap, activeTradeId]);

  const addJournalEntry = useCallback(async () => {
    try {
      const id = await createJournalTrade(supabase);
      if (id) router.push(`/trade/${id}`);
    } catch (err) {
      console.error("Create journal trade failed:", err);
    }
  }, [router]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
        return;
      }
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName) ||
        e.target?.isContentEditable;
      if (!mod && !typing && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addJournalEntry();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addJournalEntry, toggleCollapsed]);

  const meta = useMemo(() => routeMeta(pathname), [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navList = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/trades" && pathname?.startsWith("/trade/"));
        const Icon = item.icon;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150 ease-out-expo",
              collapsed ? "justify-center px-0" : "px-2.5",
              active
                ? "bg-surface-hover text-content"
                : "text-content-muted hover:bg-surface-hover/70 hover:text-content"
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brand transition-all duration-200 ease-out-expo",
                active ? "opacity-100" : "scale-y-0 opacity-0"
              )}
              aria-hidden
            />
            <Icon
              size={17}
              className={cn(
                "shrink-0 transition-colors",
                active ? "text-brand" : "text-content-subtle group-hover:text-content-muted"
              )}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={item.href} content={item.label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-sidebar hidden flex-col border-r border-line bg-canvas-inset md:flex",
          "transition-[width] duration-250 ease-out-expo"
        )}
        style={{ width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
      >
        <div
          className={cn(
            "flex h-topbar items-center border-b border-line",
            collapsed ? "justify-center px-0" : "gap-2.5 px-4"
          )}
        >
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={26} />
            {!collapsed && <Wordmark />}
          </Link>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto py-3 no-scrollbar">
          {navList}

          <div className={cn("mt-auto space-y-1 px-2 pt-3")}>
            {isDemoMode && !collapsed && (
              <div className="mb-2 rounded-lg border border-brand/20 bg-brand-soft/50 px-2.5 py-2">
                <Badge tone="brand" size="xs" dot>
                  Demo data
                </Badge>
                <p className="mt-1.5 text-2xs leading-relaxed text-content-muted">
                  Seeded locally. Connect Supabase to use your own trades.
                </p>
              </div>
            )}

            <button
              onClick={toggleCollapsed}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg py-2 text-sm text-content-subtle transition hover:bg-surface-hover hover:text-content",
                collapsed ? "justify-center px-0" : "px-2.5"
              )}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              {!collapsed && <span className="flex-1 text-left">Collapse</span>}
              {!collapsed && <Kbd>⌘\</Kbd>}
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- Mobile drawer ---------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-modal md:hidden">
          <div
            className="absolute inset-0 bg-canvas/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-canvas-inset animate-slide-in-right">
            <div className="flex h-topbar items-center justify-between gap-2 border-b border-line px-4">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <LogoMark size={26} />
                <Wordmark />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              />
            </div>
            <div className="flex flex-1 flex-col py-3">{navList}</div>
            <div className="border-t border-line p-3">
              <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout} className="w-full justify-start">
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Main column ---------------- */}
      <div
        className="app-main flex min-h-screen flex-col"
        style={{
          "--shell-pad": collapsed
            ? "var(--sidebar-w-collapsed)"
            : "var(--sidebar-w)",
        }}
      >
        <header className="sticky top-0 z-header flex h-topbar items-center gap-3 border-b border-line bg-canvas/85 px-3 backdrop-blur-xl sm:px-5">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Menu}
            aria-label="Open menu"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {meta.parent && (
              <>
                <Link
                  href={meta.parent.href}
                  className="hidden shrink-0 text-sm text-content-subtle transition hover:text-content sm:block"
                >
                  {meta.parent.label}
                </Link>
                <span className="hidden text-content-subtle sm:block" aria-hidden>
                  /
                </span>
              </>
            )}
            {meta.label && (
              <h1 className="truncate text-sm font-semibold tracking-tight text-content">
                {meta.label}
              </h1>
            )}
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className={cn(
              "group hidden items-center gap-2 rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5 lg:flex",
              "text-xs text-content-subtle transition hover:border-line-strong hover:text-content-muted"
            )}
          >
            <Search size={13} />
            <span className="w-28 text-left">Search…</span>
            <Kbd>⌘K</Kbd>
          </button>

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Search}
            aria-label="Search"
            className="lg:hidden"
            onClick={() => setPaletteOpen(true)}
          />

          <div className="flex items-center gap-1.5">
            <Tooltip content={<span className="flex items-center gap-1.5">Journal entry <Kbd>N</Kbd></span>}>
              <Button variant="primary" size="sm" icon={Plus} onClick={addJournalEntry}>
                <span className="hidden sm:inline">Journal entry</span>
              </Button>
            </Tooltip>
            <Tooltip content="Swap on Solana → journal trade with fills">
              <Button variant="secondary" size="sm" icon={ArrowDownUp} onClick={openSwapForContext}>
                <span className="hidden sm:inline">Swap</span>
              </Button>
            </Tooltip>
          </div>

          <Tooltip content={theme === "dark" ? "Light theme" : "Dark theme"}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={theme === "dark" ? Sun : Moon}
              aria-label="Toggle theme"
              onClick={toggle}
            />
          </Tooltip>

          <Popover
            align="end"
            width="w-52"
            trigger={
              <button
                aria-label="Account"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-2xs font-bold text-white shadow-sm transition hover:brightness-110"
              >
                DT
              </button>
            }
          >
            {(close) => (
              <>
                <MenuLabel>{isDemoMode ? "Demo trader" : "Account"}</MenuLabel>
                <MenuItem
                  icon={Settings2}
                  onClick={() => {
                    close();
                    router.push("/onboarding");
                  }}
                >
                  Journal setup
                </MenuItem>
                {isDemoMode && (
                  <MenuItem
                    icon={RotateCcw}
                    onClick={() => {
                      supabase.resetDemoData?.();
                      window.location.reload();
                    }}
                  >
                    Reset demo data
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem icon={LogOut} tone="danger" onClick={handleLogout}>
                  Sign out
                </MenuItem>
              </>
            )}
          </Popover>
        </header>

        <LivePositionsBar />

        <main key={pathname} className="route-transition flex flex-1 flex-col">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
