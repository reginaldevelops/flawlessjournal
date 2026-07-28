"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
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
} from "../components/ui";
import { chainMeta, explorerUrl } from "../lib/chain/constants";
import { formatCurrency, truncateMiddle } from "../lib/format";
import { useWallets } from "./hooks";
import WalletFormModal from "./WalletFormModal";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WalletsPage() {
  const { wallets, loading, error, add, update, remove, toggleInclude, reload } = useWallets();
  const { balances, balancesLoading, refreshBalances } = usePortfolioBalances(wallets, loading);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
        description="Track on-chain balances across Solana and Hyperliquid. Connected wallets feed your dashboard equity total."
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
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Could not load wallets"
            description={error}
            onRetry={reload}
          />
        ) : wallets.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No wallets yet"
            description="Add a Solana or Hyperliquid address to see live balances on your dashboard."
            action={
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
                Add your first wallet
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => {
              const bal = balances.get(String(wallet.id));
              return (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  balanceData={bal}
                  balancesLoading={balancesLoading}
                  onEdit={() => setEditTarget(wallet)}
                  onDelete={() => setDeleteTarget(wallet)}
                  onToggle={() => toggleInclude(wallet.id, wallet.include_in_balance)}
                />
              );
            })}
          </div>
        )}

        {wallets.length > 0 && !loading && (
          <p className="mt-6 text-xs text-content-subtle">
            {wallets.filter((w) => w.include_in_balance).length} of {wallets.length}{" "}
            wallet{wallets.length !== 1 ? "s" : ""} included in balance
          </p>
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
/* Portfolio balance hook (fetches all wallets in one POST)            */
/* ------------------------------------------------------------------ */

function usePortfolioBalances(wallets, walletsLoading) {
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
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallets: wals.map((w) => ({
            id: w.id,
            label: w.label,
            chain: w.chain,
            address: w.address,
            color: w.color,
          })),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!controller.signal.aborted) {
        const map = new Map();
        for (const w of data?.wallets ?? []) {
          const assets = (data?.assets ?? []).filter(
            (a) => !a.chain || a.chain === w.chain
          );
          map.set(String(w.id), { ...w, assets });
        }
        setBalances(map);
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

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

  return { balances, balancesLoading: loading, refreshBalances: refresh };
}

/* ------------------------------------------------------------------ */
/* WalletCard                                                          */
/* ------------------------------------------------------------------ */

function WalletCard({ wallet, balanceData, balancesLoading, onEdit, onDelete, onToggle }) {
  const chain = chainMeta(wallet.chain);
  const explorer = explorerUrl(wallet.chain, wallet.address);
  const usdValue = balanceData?.usdValue ?? null;
  const assets = balanceData?.assets ?? [];
  const walletError = balanceData?.error;

  return (
    <Card>
      <CardBody className="p-0">
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
            <div className="mt-0.5 flex items-center gap-2">
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
                {assets.length > 0 && (
                  <p className="mt-0.5 text-2xs text-content-subtle">
                    {assets
                      .slice(0, 3)
                      .map((a) => a.symbol)
                      .join(" · ")}
                    {assets.length > 3 ? ` +${assets.length - 3}` : ""}
                  </p>
                )}
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
      </CardBody>
    </Card>
  );
}
