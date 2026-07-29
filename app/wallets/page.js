"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachRobinhoodCredentials,
  fetchRobinhoodTransactionsForWallet,
  loadRobinhoodTxCache,
  saveRobinhoodTxCache,
} from "../lib/wallets/robinhood";
import { subscribePositionChanged } from "../lib/swap/positionEvents";
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Download,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageBody,
  PageHeader,
  Skeleton,
  Switch,
  Tooltip,
  useToast,
} from "../components/ui";
import { chainMeta, explorerUrl } from "../lib/chain/constants";
import { formatCurrency, formatDate, formatRelative, truncateMiddle } from "../lib/format";
import { useWallets } from "./hooks";
import WalletFormModal from "./WalletFormModal";
import {
  getWalletSyncMeta,
  runWalletSync,
  clearWalletSyncMeta,
  formatSyncProgress,
} from "../lib/swap/importFills";
import { SYNC_BATCH_DEFAULT } from "../lib/swap/constants";

function formatScanSummary(result) {
  const range =
    result.oldestTime || result.newestTime
      ? (() => {
          const fmt = (ts) =>
            formatDate(new Date(Number(ts) * 1000), "medium");
          const oldest = result.oldestTime ? fmt(result.oldestTime) : null;
          const newest = result.newestTime ? fmt(result.newestTime) : null;
          if (oldest && newest && oldest !== newest) return `${oldest} – ${newest}`;
          return oldest || newest;
        })()
      : null;
  return `Scanned ${result.scanned}/${result.total ?? result.scanned} txs${
    range ? ` (${range})` : ""
  } · batch ≤${result.batchLimit ?? SYNC_BATCH_DEFAULT}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WalletsPage() {
  const { wallets, loading, error, schemaMissing, add, update, remove, toggleInclude, reload } =
    useWallets();
  const { balances, balancesLoading, refreshBalances } = usePortfolioBalances(wallets, loading);
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [syncTick, setSyncTick] = useState(0);
  const [syncProgress, setSyncProgress] = useState({});
  const [resetSyncTarget, setResetSyncTarget] = useState(null);
  const [resetSyncLoading, setResetSyncLoading] = useState(false);
  const [rhTxLoadingId, setRhTxLoadingId] = useState(null);
  const [rhTxByWallet, setRhTxByWallet] = useState({});
  const [rhTxExpanded, setRhTxExpanded] = useState({});

  useEffect(() => {
    if (!wallets.length) return;
    const cached = {};
    for (const w of wallets) {
      if (w.chain !== "robinhood") continue;
      const row = loadRobinhoodTxCache(w.id);
      if (row?.orders) cached[w.id] = row;
    }
    if (Object.keys(cached).length) {
      setRhTxByWallet((prev) => ({ ...cached, ...prev }));
    }
  }, [wallets]);

  const handleLoadRobinhoodTx = async (wallet) => {
    if (wallet.chain !== "robinhood") return;
    setRhTxLoadingId(wallet.id);
    try {
      const data = await fetchRobinhoodTransactionsForWallet(wallet);
      saveRobinhoodTxCache(wallet.id, data);
      setRhTxByWallet((prev) => ({ ...prev, [wallet.id]: data }));
      setRhTxExpanded((prev) => ({ ...prev, [wallet.id]: true }));
      toast.success(`Loaded ${data.orderCount ?? data.orders?.length ?? 0} Robinhood orders`, {
        description: "Read-only — balances and order history from Robinhood Crypto API.",
      });
    } catch (err) {
      toast.error("Could not load Robinhood transactions", { description: err.message });
    } finally {
      setRhTxLoadingId(null);
    }
  };

  const handleSyncWallet = async (wallet, { older = false, resync = false, reset = false } = {}) => {
    if (wallet.chain !== "solana") return;
    setSyncingId(wallet.id);
    setSyncProgress((prev) => ({
      ...prev,
      [wallet.id]: {
        label: reset
          ? "Resetting sync cursor…"
          : resync
            ? "Re-scanning recent txs…"
            : older
              ? "Scanning older txs…"
              : "Starting sync…",
        scanned: 0,
        total: 0,
        swapsFound: 0,
        lookbackDays: null,
        older,
        resync,
        reset,
      },
    }));
    try {
      const result = await runWalletSync(wallet.address, {
        limit: SYNC_BATCH_DEFAULT,
        older,
        resync,
        reset,
        onProgress: (ev) => {
          const label = formatSyncProgress(ev);
          setSyncProgress((prev) => ({
            ...prev,
            [wallet.id]: {
              label: label || prev[wallet.id]?.label || "Syncing…",
              scanned: ev.scanned ?? prev[wallet.id]?.scanned ?? 0,
              total: ev.total ?? prev[wallet.id]?.total ?? 0,
              swapsFound: ev.swapsFound ?? ev.swaps?.length ?? prev[wallet.id]?.swapsFound ?? 0,
              lookbackDays: ev.lookbackDays ?? prev[wallet.id]?.lookbackDays ?? null,
              batchLimit: ev.batchLimit ?? prev[wallet.id]?.batchLimit ?? SYNC_BATCH_DEFAULT,
              older,
              resync,
              reset,
            },
          }));
        },
      });
      setSyncTick((t) => t + 1);
      const n = result.imported?.length ?? 0;
      const deduped = result.deduped?.length ?? 0;
      const scanLine = formatScanSummary(result);
      if (n > 0) {
        toast.success(
          resync || reset ? `Re-imported ${n} fill${n === 1 ? "" : "s"}` : `Imported ${n} fill${n === 1 ? "" : "s"}`,
          {
            description: `${scanLine} · ${deduped} already known`,
            action: result.imported[0]?.tradeId
              ? {
                  label: "Open trade",
                  onClick: () => {
                    window.location.href = `/trade/${result.imported[0].tradeId}`;
                  },
                }
              : undefined,
          }
        );
      } else if (deduped > 0) {
        toast.info("No new swaps", {
          description: `${scanLine} · ${deduped} already journaled`,
        });
      } else {
        toast.info("No swaps in this batch", {
          description: resync || reset
            ? scanLine
            : `${scanLine} · Try Re-import if you deleted trades, or Reset sync to start over`,
        });
      }
    } catch (err) {
      toast.error("Wallet sync failed", { description: err.message });
    } finally {
      setSyncingId(null);
      setSyncProgress((prev) => {
        const next = { ...prev };
        delete next[wallet.id];
        return next;
      });
    }
  };

  const handleResetSyncCursor = async () => {
    if (!resetSyncTarget) return;
    setResetSyncLoading(true);
    try {
      clearWalletSyncMeta(resetSyncTarget.address);
      setResetSyncTarget(null);
      await handleSyncWallet(resetSyncTarget, { reset: true });
    } finally {
      setResetSyncLoading(false);
    }
  };

  const handleAdd = async (fields) => {
    const result = await add(fields);
    if (result?.ok) refreshBalances();
    return result;
  };

  const handleEdit = async (fields) => {
    if (!editTarget) return { ok: false };
    const result = await update(editTarget.id, fields);
    if (result?.ok) refreshBalances();
    return result;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    refreshBalances();
  };

  const handleRefresh = () => {
    reload();
    refreshBalances();
  };

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Track Solana, Robinhood Crypto, and Hyperliquid balances. Solana sync imports swaps to your journal; Robinhood shows read-only order history."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              iconOnly
              aria-label="Refresh"
              onClick={handleRefresh}
              className={loading || balancesLoading ? "pointer-events-none opacity-60" : undefined}
            />
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
              Add wallet
            </Button>
          </div>
        }
      />

      <PageBody>
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title={schemaMissing ? "Supabase schema update needed" : "Could not load wallets"}
            description={
              schemaMissing
                ? "Run the SQL file supabase/migrations/20260728_aaa_compat.sql in the Supabase SQL Editor, then refresh this page."
                : error
            }
            onRetry={reload}
          />
        ) : wallets.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No wallets yet"
            description="Add a Solana, Robinhood Crypto, or Hyperliquid wallet to see live balances."
            action={
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
                Add your first wallet
              </Button>
            }
          />
        ) : (
          <>
            {/* Summary strip */}
            <WalletSummary
              wallets={wallets}
              balances={balances}
              balancesLoading={balancesLoading}
            />

            <div className="mt-4 space-y-2.5">
              {wallets.map((wallet) => {
                const bal = balances.get(String(wallet.id));
                return (
                  <WalletCard
                    key={`${wallet.id}-${syncTick}`}
                    wallet={wallet}
                    balanceData={bal}
                    balancesLoading={balancesLoading}
                    syncing={syncingId === wallet.id}
                    syncProgress={syncProgress[wallet.id] || null}
                    onSync={() => handleSyncWallet(wallet)}
                    onSyncOlder={() => handleSyncWallet(wallet, { older: true })}
                    onResync={() => handleSyncWallet(wallet, { resync: true })}
                    onResetSync={() => setResetSyncTarget(wallet)}
                    rhTxLoading={rhTxLoadingId === wallet.id}
                    rhTxData={rhTxByWallet[wallet.id] ?? null}
                    rhTxExpanded={Boolean(rhTxExpanded[wallet.id])}
                    onLoadRhTx={() => handleLoadRobinhoodTx(wallet)}
                    onToggleRhTx={() =>
                      setRhTxExpanded((prev) => ({
                        ...prev,
                        [wallet.id]: !prev[wallet.id],
                      }))
                    }
                    onEdit={() => setEditTarget(wallet)}
                    onDelete={() => setDeleteTarget(wallet)}
                    onToggle={() => toggleInclude(wallet.id, wallet.include_in_balance)}
                  />
                );
              })}
            </div>

          </>
        )}
      </PageBody>

      <WalletFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
        usedColors={wallets.map((w) => w.color)}
      />
      <WalletFormModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSave={handleEdit}
        wallet={editTarget}
        usedColors={wallets.filter((w) => w.id !== editTarget?.id).map((w) => w.color)}
      />
      <ConfirmDialog
        open={Boolean(resetSyncTarget)}
        onClose={() => setResetSyncTarget(null)}
        onConfirm={handleResetSyncCursor}
        title="Reset wallet sync?"
        description={
          resetSyncTarget
            ? `Clear the sync cursor for "${resetSyncTarget.label}" and re-scan the latest batch. Use this after deleting trades — then press Older repeatedly to walk further back.`
            : undefined
        }
        confirmLabel="Reset & sync"
        loading={resetSyncLoading}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove wallet"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.label}"? This will stop tracking its balance.`
            : undefined
        }
        confirmLabel="Remove"
        loading={deleting}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Summary strip                                                       */
/* ------------------------------------------------------------------ */

function WalletSummary({ wallets, balances, balancesLoading }) {
  const included = wallets.filter((w) => w.include_in_balance);
  let totalUsd = null;
  let hasAny = false;

  for (const w of included) {
    const bd = balances.get(String(w.id));
    if (bd?.usdValue != null) {
      totalUsd = (totalUsd ?? 0) + bd.usdValue;
      hasAny = true;
    }
  }

  const chainCounts = wallets.reduce((acc, w) => {
    acc[w.chain] = (acc[w.chain] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-xs font-medium text-content-muted">Total balance</p>
        {balancesLoading && !hasAny ? (
          <div className="mt-2 h-7 w-28 skeleton rounded" />
        ) : (
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-content tnum">
            {totalUsd != null ? formatCurrency(totalUsd, { decimals: 0 }) : "—"}
          </p>
        )}
        <p className="mt-0.5 text-2xs text-content-subtle">
          across {included.length} included wallet{included.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-xs font-medium text-content-muted">Wallets connected</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-content tnum">
          {wallets.length}
        </p>
        <p className="mt-0.5 text-2xs text-content-subtle">
          {Object.entries(chainCounts)
            .map(([chain, n]) => `${n} ${chain.toUpperCase()}`)
            .join(" · ")}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm col-span-2 sm:col-span-1">
        <p className="text-xs font-medium text-content-muted">In balance total</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-content tnum">
          {included.length}
          <span className="ml-1 text-base font-normal text-content-muted">
            / {wallets.length}
          </span>
        </p>
        <p className="mt-0.5 text-2xs text-content-subtle">
          {wallets.length - included.length > 0
            ? `${wallets.length - included.length} excluded from dashboard`
            : "All wallets feeding dashboard"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio balance hook (fetches all wallets in one POST)            */
/* ------------------------------------------------------------------ */

function usePortfolioBalances(wallets, walletsLoading) {
  const toast = useToast();
  const [balances, setBalances] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  const fetch_ = useCallback(async (wals) => {
    if (!wals || !wals.length) {
      setBalances(new Map());
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const withCreds = await attachRobinhoodCredentials(wals);
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallets: withCreds.map((w) => ({
            id: w.id,
            label: w.label,
            chain: w.chain,
            address: w.address,
            color: w.color,
            ...(w.credentials ? { credentials: w.credentials } : {}),
          })),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!controller.signal.aborted && !res.ok) {
        throw new Error(data?.error || `Balance fetch failed (${res.status})`);
      }
      if (!controller.signal.aborted) {
        const map = new Map();
        for (const w of data?.wallets ?? []) {
          const assets =
            w.assets?.length > 0
              ? w.assets
              : (data?.assets ?? []).filter(
                  (a) => !a.chain || a.chain === w.chain
                );
          map.set(String(w.id), { ...w, assets });
        }
        setBalances(map);
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      toast.error("Could not load balances", { description: err.message });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [toast]);

  const refresh = useCallback(() => {
    fetch_(walletsRef.current);
  }, [fetch_]);

  useEffect(() => {
    if (!walletsLoading && wallets.length > 0) {
      fetch_(wallets);
    } else if (!walletsLoading && wallets.length === 0) {
      setBalances(new Map());
      setLoading(false);
    }
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletsLoading, wallets.length]);

  useEffect(() => {
    let timer;
    const unsub = subscribePositionChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => refresh(), 1500);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [refresh]);

  return { balances, balancesLoading: loading, refreshBalances: refresh };
}

/* ------------------------------------------------------------------ */
/* WalletCard                                                          */
/* ------------------------------------------------------------------ */

function WalletCard({
  wallet,
  balanceData,
  balancesLoading,
  syncing,
  syncProgress,
  onSync,
  onSyncOlder,
  onResync,
  onResetSync,
  rhTxLoading,
  rhTxData,
  rhTxExpanded,
  onLoadRhTx,
  onToggleRhTx,
  onEdit,
  onDelete,
  onToggle,
}) {
  const chain = chainMeta(wallet.chain);
  const explorer = explorerUrl(wallet.chain, wallet.address);
  const usdValue = balanceData?.usdValue ?? null;
  const assets = (balanceData?.assets ?? []).filter((a) => (a.usdValue ?? 0) > 0 || a.amount > 0);
  const walletError = balanceData?.error;
  const showAssets = !balancesLoading && assets.length > 0;
  const syncMeta =
    wallet.chain === "solana" ? getWalletSyncMeta(wallet.address) : null;
  const isRobinhood = wallet.chain === "robinhood";
  const rhOrders = rhTxData?.orders ?? [];
  const showRhTx = isRobinhood && rhTxExpanded && rhOrders.length > 0;
  const canScanOlder =
    wallet.chain === "solana" &&
    Boolean(syncMeta?.oldestSignature) &&
    syncMeta?.hasMoreOlder !== false;
  const progressPct =
    syncProgress?.total > 0
      ? Math.min(100, Math.round((syncProgress.scanned / syncProgress.total) * 100))
      : syncing
        ? 8
        : 0;

  return (
    <Card>
      <CardBody className="p-0">
        {/* Main row */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          {/* Color swatch */}
          <span
            className="h-3 w-3 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface"
            style={{ backgroundColor: wallet.color ?? "#7c6cff" }}
            aria-hidden
          />

          {/* Main info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-content">{wallet.label}</span>
              <Badge tone={chain.tone} size="xs">
                {chain.short}
              </Badge>
              {!wallet.include_in_balance && (
                <Badge tone="neutral" size="xs">
                  Excluded
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-content-muted">
                {truncateMiddle(wallet.address, 8, 6)}
              </span>
              {explorer && (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-2xs text-content-subtle transition-colors hover:text-brand"
                  aria-label={`View on ${chain.explorerName}`}
                >
                  {chain.explorerName}
                  <ExternalLink size={10} aria-hidden />
                </a>
              )}
              {syncMeta?.lastAt && !syncing && (
                <span className="text-2xs text-content-subtle">
                  Last sync {formatRelative(syncMeta.lastAt)}
                  {syncMeta.oldestScannedAt
                    ? ` · scanned back to ${formatDate(syncMeta.oldestScannedAt, "medium")}`
                    : syncMeta.lastScanned != null
                      ? ` · last batch ${syncMeta.lastScanned} tx${syncMeta.lastScanned === 1 ? "" : "s"}`
                      : ""}
                </span>
              )}
              {isRobinhood && rhTxData?.fetchedAt && !rhTxLoading && (
                <span className="text-2xs text-content-subtle">
                  Orders loaded {formatRelative(rhTxData.fetchedAt)}
                  {rhOrders.length ? ` · ${rhOrders.length} rows` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="shrink-0 text-right">
            {balancesLoading && usdValue == null ? (
              <div className="h-5 w-20 animate-pulse rounded bg-surface-raised" />
            ) : walletError && usdValue == null ? (
              <Tooltip content={walletError}>
                <span className="text-xs text-loss">Error</span>
              </Tooltip>
            ) : (
              <>
                <p className="font-mono text-sm font-semibold tnum text-content">
                  {usdValue != null ? formatCurrency(usdValue, { decimals: 0 }) : "—"}
                </p>
                {walletError && (
                  <Tooltip content={walletError}>
                    <Badge tone="warn" size="xs" className="mt-0.5">
                      Partial
                    </Badge>
                  </Tooltip>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {wallet.chain === "solana" && (
              <>
                <Tooltip content="Import only txs newer than the last sync">
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={Download}
                    loading={syncing && !syncProgress?.older && !syncProgress?.resync && !syncProgress?.reset}
                    disabled={syncing}
                    onClick={onSync}
                  >
                    Sync
                  </Button>
                </Tooltip>
                <Tooltip content="Re-scan the latest batch — use after deleting trades">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={syncing && syncProgress?.resync}
                    disabled={syncing}
                    onClick={onResync}
                  >
                    Re-import
                  </Button>
                </Tooltip>
                {canScanOlder && (
                  <Tooltip content="Scan the next older batch (same size cap — never full history)">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={syncing && syncProgress?.older}
                      disabled={syncing}
                      onClick={onSyncOlder}
                    >
                      Older
                    </Button>
                  </Tooltip>
                )}
                {syncMeta?.lastSignature && (
                  <Tooltip content="Clear sync cursor and start from the newest txs again">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={syncing && syncProgress?.reset}
                      disabled={syncing}
                      onClick={onResetSync}
                    >
                      Reset
                    </Button>
                  </Tooltip>
                )}
              </>
            )}
            {isRobinhood && (
              <>
                <Tooltip content="Fetch read-only order history from Robinhood Crypto API">
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={Download}
                    loading={rhTxLoading}
                    disabled={rhTxLoading}
                    onClick={onLoadRhTx}
                  >
                    {rhOrders.length ? "Refresh orders" : "Load orders"}
                  </Button>
                </Tooltip>
                {rhOrders.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={rhTxLoading}
                    onClick={onToggleRhTx}
                  >
                    {rhTxExpanded ? "Hide orders" : "Show orders"}
                  </Button>
                )}
              </>
            )}
            <Tooltip
              content={
                wallet.include_in_balance ? "Exclude from balance" : "Include in balance"
              }
            >
              <Switch
                checked={wallet.include_in_balance}
                onChange={onToggle}
                label={
                  wallet.include_in_balance ? "Exclude from balance" : "Include in balance"
                }
                size="sm"
              />
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={Pencil}
              aria-label="Edit"
              onClick={onEdit}
            />
            <Button
              variant="danger-ghost"
              size="sm"
              iconOnly
              icon={Trash2}
              aria-label="Remove wallet"
              onClick={onDelete}
            />
          </div>
        </div>

        {/* Live sync progress */}
        {syncing && syncProgress && (
          <div className="border-t border-line/40 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-2xs text-content-muted">
                {syncProgress.label || "Syncing…"}
              </p>
              {syncProgress.total > 0 && (
                <span className="shrink-0 font-mono text-2xs tnum text-content-subtle">
                  {syncProgress.scanned}/{syncProgress.total}
                </span>
              )}
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
              aria-label="Wallet sync progress"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-2xs text-content-subtle">
              Free RPC · max {syncProgress.batchLimit ?? SYNC_BATCH_DEFAULT} txs per
              press
              {syncProgress.reset
                ? " · reset cursor + fresh batch"
                : syncProgress.resync
                  ? " · re-scanning recent batch"
                  : syncProgress.older
                    ? " · walking older history"
                    : " · new txs only"}
            </p>
          </div>
        )}

        {/* Robinhood order history (read-only) */}
        {showRhTx && (
          <div className="border-t border-line/40 px-5 py-3">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              Recent orders
            </p>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto thin-scrollbar">
              {rhOrders.slice(0, 100).map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge
                      tone={order.side === "buy" ? "profit" : order.side === "sell" ? "loss" : "neutral"}
                      size="xs"
                    >
                      {order.side ?? "—"}
                    </Badge>
                    <span className="font-semibold text-content">{order.asset}</span>
                    <span className="font-mono tnum text-content-muted">
                      {order.quantity > 0
                        ? order.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })
                        : "—"}
                    </span>
                    <Badge tone={order.state === "filled" ? "neutral" : "warn"} size="xs">
                      {order.state ?? order.type ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-2xs text-content-subtle">
                    {order.usdValue > 0 && (
                      <span className="font-mono tnum text-content">
                        {formatCurrency(order.usdValue, { compact: true })}
                      </span>
                    )}
                    <span>{order.createdAt ? formatRelative(order.createdAt) : "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Token breakdown row */}
        {showAssets && (
          <div className="border-t border-line/40 px-5 pb-3.5 pt-2.5">
            <div className="flex flex-wrap gap-1.5">
              {assets.slice(0, 7).map((asset) => {
                const change = asset.priceChange24h;
                const changePos = change != null && change >= 0;
                return (
                  <div
                    key={asset.mint ?? asset.symbol}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2 py-1"
                  >
                    <span className="text-2xs font-semibold text-content">{asset.symbol}</span>
                    {asset.usdValue > 0 && (
                      <span className="font-mono text-2xs text-content-muted tnum">
                        {formatCurrency(asset.usdValue, { decimals: 0 })}
                      </span>
                    )}
                    {change != null && (
                      <span
                        className={`text-2xs font-medium ${
                          changePos ? "text-profit-fg" : "text-loss-fg"
                        }`}
                      >
                        {changePos ? "+" : ""}
                        {change.toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              })}
              {assets.length > 7 && (
                <div className="flex items-center rounded-md border border-line bg-surface-raised px-2 py-1">
                  <span className="text-2xs text-content-subtle">+{assets.length - 7} more</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
