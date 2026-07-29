"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ArrowDownUp,
  ExternalLink,
  Settings2,
  Wallet,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Sheet,
  useToast,
  cn,
} from "../ui";
import SwapSettingsPanel from "./SwapSettingsPanel";
import {
  FARTCOIN_MINT,
  QUOTE_TOKENS,
  SLIPPAGE_OPTIONS,
  SLIPPAGE_PRESETS,
} from "../../lib/swap/constants";
import { loadSwapSettings, saveSwapSettings } from "../../lib/swap/settings";
import { suggestSlippageBps } from "../../lib/swap/slippage";
import { appendFillToPosition } from "../../lib/swap/journal";
import { formatSwapExecutionError } from "../../lib/swap/errors";
import {
  getSuccessfulSignatureStatus,
  waitForSignatureConfirmation,
} from "../../lib/swap/confirm";
import { formatCurrency } from "../../lib/format";

const QUOTE_REFRESH_MS = 5000;

function toRawAmount(human, decimals) {
  const n = Number(human);
  if (!Number.isFinite(n) || n <= 0) return null;
  const [i, f = ""] = String(human).replace(/,/g, "").split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  const raw = BigInt(i || "0") * BigInt(10 ** decimals) + BigInt(frac || "0");
  return raw.toString();
}

function fromRawAmount(raw, decimals) {
  const s = String(raw ?? "0");
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : whole;
  return Number(neg ? `-${out}` : out);
}

async function fetchUsdPrices(mints) {
  const ids = [...new Set(mints.filter(Boolean))].join(",");
  if (!ids) return {};
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
  if (!res.ok) return {};
  const data = await res.json();
  const out = {};
  for (const [mint, row] of Object.entries(data ?? {})) {
    out[mint] = Number.isFinite(row?.usdPrice) ? row.usdPrice : null;
  }
  return out;
}

export default function SwapSheet({
  open,
  onClose,
  /** Position token (what the trade is about) */
  token,
  /** Optional: force initial side */
  initialSide = "buy",
  /** When set, attach the fill to this journal trade instead of find/create by mint */
  tradeId = null,
  /** Called after a successful swap; default navigates to the trade */
  onSuccess,
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { success: toastSuccess, error: toastError } = useToast();

  const [side, setSide] = useState(initialSide);
  const [settings, setSettings] = useState(() => loadSwapSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quoteMint, setQuoteMint] = useState(
    () => loadSwapSettings().defaultQuoteMint || FARTCOIN_MINT
  );
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState("quote"); // quote | usd
  const [quote, setQuote] = useState(null);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState(null);
  const [prices, setPrices] = useState({});
  const [feeEstimate, setFeeEstimate] = useState(null);

  const quoteToken = useMemo(
    () => QUOTE_TOKENS.find((t) => t.mint === quoteMint) ?? QUOTE_TOKENS[0],
    [quoteMint]
  );

  const positionMint = token?.address;
  const positionSymbol = token?.symbol || "TOKEN";
  const [tokenDecimals] = useState(6);

  const pairContext = useMemo(
    () => ({
      ageHours: token?.ageHours ?? null,
      changeH1: token?.changeH1 ?? null,
    }),
    [token?.ageHours, token?.changeH1]
  );

  useEffect(() => {
    if (!open) return;
    setSide(initialSide);
    setAmount("");
    setQuote(null);
    setQuoteUpdatedAt(null);
    setError(null);
    const s = loadSwapSettings();
    const autoBps = suggestSlippageBps({
      ageHours: token?.ageHours ?? null,
      changeH1: token?.changeH1 ?? null,
    });
    const next = {
      ...s,
      slippageBps:
        s.slippageAuto !== false
          ? autoBps
          : normalizeSlippage(s.slippageBps),
      slippageAuto: s.slippageAuto !== false,
    };
    saveSwapSettings(next);
    setSettings(next);
    setQuoteMint(next.defaultQuoteMint || FARTCOIN_MINT);
  }, [open, initialSide, token?.address, token?.ageHours, token?.changeH1]);

  // Live p90 fee estimate (capped)
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/swap/fees?feeMode=${settings.feeMode === "jito" ? "jito" : "priority"}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) setFeeEstimate(data);
      } catch {
        /* ignore — build route re-estimates anyway */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, settings.feeMode]);

  useEffect(() => {
    if (!open || !positionMint) return undefined;
    let cancelled = false;
    fetchUsdPrices([positionMint, quoteMint, FARTCOIN_MINT]).then((p) => {
      if (!cancelled) setPrices(p);
    });
    return () => {
      cancelled = true;
    };
  }, [open, positionMint, quoteMint]);

  const inputMint = side === "buy" ? quoteMint : positionMint;
  const outputMint = side === "buy" ? positionMint : quoteMint;
  const inputDecimals = side === "buy" ? quoteToken.decimals : tokenDecimals;
  const inputSymbol = side === "buy" ? quoteToken.symbol : positionSymbol;

  const resolveHumanInput = useCallback(() => {
    const rawNum = Number(String(amount).replace(/,/g, ""));
    if (!Number.isFinite(rawNum) || rawNum <= 0) return null;
    if (amountUnit === "usd") {
      const px =
        side === "buy" ? prices[quoteMint] : prices[positionMint];
      if (!px || px <= 0) return null;
      return rawNum / px;
    }
    return rawNum;
  }, [amount, amountUnit, side, prices, quoteMint, positionMint]);

  const fetchQuoteAtSlippage = useCallback(
    async (slippageBps) => {
      const human = resolveHumanInput();
      if (human == null) throw new Error("Enter an amount");
      const raw = toRawAmount(human, inputDecimals);
      if (!raw || raw === "0") throw new Error("Enter an amount");
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: raw,
        slippageBps: String(slippageBps),
        swapMode: "ExactIn",
      });
      const res = await fetch(`/api/swap/quote?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote failed");
      return data;
    },
    [resolveHumanInput, inputDecimals, inputMint, outputMint]
  );

  const computePreviewFromQuote = useCallback(
    (q) => {
      if (!q) return null;
      const inAmt = fromRawAmount(q.inAmount, inputDecimals);
      const outDec = side === "buy" ? tokenDecimals : quoteToken.decimals;
      const outAmt = fromRawAmount(q.outAmount, outDec);
      const tokenAmt = side === "buy" ? outAmt : inAmt;
      const quoteAmt = side === "buy" ? inAmt : outAmt;
      const tokenPx = prices[positionMint];
      const quotePx = prices[quoteMint];
      const usdFromQuote = quotePx != null ? quoteAmt * quotePx : null;
      const usdFromToken = tokenPx != null ? tokenAmt * tokenPx : null;
      const usdValue = usdFromQuote ?? usdFromToken ?? 0;
      const priceUsd =
        tokenAmt > 0 && usdValue > 0 ? usdValue / tokenAmt : tokenPx ?? 0;
      return { inAmt, outAmt, tokenAmt, quoteAmt, usdValue, priceUsd };
    },
    [
      inputDecimals,
      side,
      tokenDecimals,
      quoteToken.decimals,
      prices,
      positionMint,
      quoteMint,
    ]
  );

  // Debounced quote
  useEffect(() => {
    if (!open || !positionMint || !wallet.publicKey) {
      setQuote(null);
      return undefined;
    }
    const human = resolveHumanInput();
    if (human == null) {
      setQuote(null);
      return undefined;
    }
    const raw = toRawAmount(human, inputDecimals);
    if (!raw || raw === "0") {
      setQuote(null);
      return undefined;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          inputMint,
          outputMint,
          amount: raw,
          slippageBps: String(settings.slippageBps || 100),
          swapMode: "ExactIn",
        });
        const res = await fetch(`/api/swap/quote?${params}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Quote failed");
        setQuote(data);
        setQuoteUpdatedAt(Date.now());
        // Infer token decimals from route amounts when buying
        if (side === "buy" && data.outAmount) {
          // keep existing unless we learn better — pump tokens are usually 6
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setQuote(null);
        setError(err.message);
      } finally {
        setQuoting(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [
    open,
    positionMint,
    wallet.publicKey,
    resolveHumanInput,
    inputMint,
    outputMint,
    inputDecimals,
    settings.slippageBps,
    side,
  ]);

  // Keep quote fresh while the sheet is open (avoids stale prices at sign time)
  useEffect(() => {
    if (!open || !positionMint || !wallet.publicKey || swapping) return undefined;
    const human = resolveHumanInput();
    if (human == null) return undefined;
    const raw = toRawAmount(human, inputDecimals);
    if (!raw || raw === "0") return undefined;

    const refresh = async () => {
      try {
        const data = await fetchQuoteAtSlippage(
          settings.slippageBps || SLIPPAGE_PRESETS.tight
        );
        setQuote(data);
        setQuoteUpdatedAt(Date.now());
      } catch {
        /* keep last quote on background refresh failure */
      }
    };

    const id = setInterval(refresh, QUOTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [
    open,
    positionMint,
    wallet.publicKey,
    swapping,
    resolveHumanInput,
    inputDecimals,
    settings.slippageBps,
    fetchQuoteAtSlippage,
  ]);

  const preview = useMemo(
    () => computePreviewFromQuote(quote),
    [quote, computePreviewFromQuote]
  );

  const handleSwap = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setWalletModalVisible(true);
      return;
    }
    if (!quote || !preview) {
      setError("Wait for a quote first.");
      return;
    }
    if (token?.chainId && token.chainId !== "solana") {
      setError("Swaps are Solana-only for now.");
      return;
    }

    setSwapping(true);
    setError(null);
    let signature = null;
    let livePreview = null;
    try {
      const slippageBps = Number(settings.slippageBps) || SLIPPAGE_PRESETS.tight;

      const freshQuote = await fetchQuoteAtSlippage(slippageBps);
      livePreview = computePreviewFromQuote(freshQuote);
      if (!livePreview) throw new Error("Could not compute swap preview");

      setQuote(freshQuote);
      setQuoteUpdatedAt(Date.now());

      const buildRes = await fetch("/api/swap/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: freshQuote,
          userPublicKey: wallet.publicKey.toBase58(),
          settings: { ...settings, slippageBps },
        }),
      });
      const built = await buildRes.json();
      if (!buildRes.ok) throw new Error(built.error || "Could not build swap");

      const tx = VersionedTransaction.deserialize(
        b64ToBytes(built.swapTransaction)
      );
      const signed = await wallet.signTransaction(tx);
      const raw = signed.serialize();

      const b64 = bytesToB64(raw);
      const broadcastRes = await fetch("/api/solana/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transaction: b64,
          mode: settings.feeMode === "jito" ? "jito" : "priority",
        }),
      });
      const broadcastJson = await broadcastRes.json();
      if (!broadcastRes.ok || !broadcastJson.signature) {
        throw new Error(broadcastJson.error || "Transaction broadcast failed");
      }
      signature = broadcastJson.signature;

      await waitForSignatureConfirmation(connection, signature);

      let blockTime = Math.floor(Date.now() / 1000);
      try {
        const parsed = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (parsed?.blockTime) blockTime = parsed.blockTime;
      } catch {
        /* keep wall-clock fallback */
      }

      const result = await appendFillToPosition({
        tradeId,
        tokenMint: positionMint,
        tokenSymbol: positionSymbol,
        tokenName: token?.name,
        pairUrl: token?.url,
        imageUrl: token?.imageUrl,
        side,
        signature,
        quoteMint,
        quoteSymbol: quoteToken.symbol,
        quoteAmount: livePreview.quoteAmt,
        tokenAmount: livePreview.tokenAmt,
        priceUsd: livePreview.priceUsd,
        usdValue: livePreview.usdValue,
        wallet: wallet.publicKey.toBase58(),
        blockTime,
      });

      toastSuccess(side === "buy" ? "Buy filled" : "Sell filled", {
        description: `${livePreview.tokenAmt.toPrecision(6)} ${positionSymbol} · ${formatCurrency(livePreview.usdValue, { compact: true })}`,
      });

      onClose?.();
      if (onSuccess) {
        onSuccess(result);
      } else if (result?.tradeId) {
        window.location.href = `/trade/${result.tradeId}`;
      }
    } catch (err) {
      if (signature && livePreview) {
        const recovered = await getSuccessfulSignatureStatus(connection, signature);
        if (recovered) {
          try {
            let blockTime = Math.floor(Date.now() / 1000);
            try {
              const parsed = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0,
              });
              if (parsed?.blockTime) blockTime = parsed.blockTime;
            } catch {
              /* keep wall-clock fallback */
            }

            const result = await appendFillToPosition({
              tradeId,
              tokenMint: positionMint,
              tokenSymbol: positionSymbol,
              tokenName: token?.name,
              pairUrl: token?.url,
              imageUrl: token?.imageUrl,
              side,
              signature,
              quoteMint,
              quoteSymbol: quoteToken.symbol,
              quoteAmount: livePreview.quoteAmt,
              tokenAmount: livePreview.tokenAmt,
              priceUsd: livePreview.priceUsd,
              usdValue: livePreview.usdValue,
              wallet: wallet.publicKey.toBase58(),
              blockTime,
            });

            toastSuccess(side === "buy" ? "Buy filled" : "Sell filled", {
              description: `${livePreview.tokenAmt.toPrecision(6)} ${positionSymbol} · ${formatCurrency(livePreview.usdValue, { compact: true })}`,
            });

            onClose?.();
            if (onSuccess) {
              onSuccess(result);
            } else if (result?.tradeId) {
              window.location.href = `/trade/${result.tradeId}`;
            }
            return;
          } catch (recoverErr) {
            console.error("[swap] recovery failed after on-chain success", recoverErr);
          }
        }
      }

      console.error(err);
      const message = formatSwapExecutionError(err, {
        slippageBps: settings.slippageBps,
      });
      setError(message);
      toastError("Swap failed", { description: message });
    } finally {
      setSwapping(false);
    }
  };

  const connected = Boolean(wallet.publicKey);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={side === "buy" ? `Buy ${positionSymbol}` : `Sell ${positionSymbol}`}
      description="Quote tokens (Fartcoin / SOL / USDC) are payment only — the journal trade is always this token."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={swapping}>
            Cancel
          </Button>
          {!connected ? (
            <Button
              variant="primary"
              size="sm"
              icon={Wallet}
              onClick={() => setWalletModalVisible(true)}
            >
              Connect Phantom
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              loading={swapping}
              disabled={!quote || quoting}
              onClick={handleSwap}
            >
              {side === "buy" ? "Swap · Buy" : "Swap · Sell"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Side toggle */}
        <div className="flex gap-1 rounded-lg border border-line bg-surface-sunken p-0.5">
          {["buy", "sell"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition",
                side === s
                  ? s === "buy"
                    ? "bg-profit/20 text-profit"
                    : "bg-loss/20 text-loss"
                  : "text-content-muted hover:text-content"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Token chip */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
          {token?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.imageUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {positionSymbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-content">
              {positionSymbol}
            </p>
            <p className="truncate text-2xs text-content-subtle">
              {token?.name || positionMint}
            </p>
          </div>
          {token?.url && (
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-subtle hover:text-brand"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-2 rounded-xl border border-line bg-surface-sunken p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              You pay ({side === "buy" ? "quote" : positionSymbol})
            </p>
            <div className="flex gap-1">
              {["quote", "usd"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setAmountUnit(u)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-2xs font-medium uppercase",
                    amountUnit === u
                      ? "bg-brand-soft text-brand"
                      : "text-content-subtle hover:text-content"
                  )}
                >
                  {u === "quote" ? inputSymbol : "USD"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="font-mono text-lg"
              autoFocus
            />
            {side === "buy" ? (
              <Select
                value={quoteMint}
                onChange={(e) => setQuoteMint(e.target.value)}
                className="w-32 shrink-0"
              >
                {QUOTE_TOKENS.map((t) => (
                  <option key={t.mint} value={t.mint}>
                    {t.symbol}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="flex w-28 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-raised text-xs font-semibold text-content">
                {positionSymbol}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center py-1 text-content-subtle">
            <ArrowDownUp size={14} />
          </div>

          <div className="rounded-lg border border-line bg-surface-raised px-3 py-2.5">
            <p className="text-2xs text-content-subtle">
              You receive ({side === "buy" ? positionSymbol : quoteToken.symbol})
            </p>
            <p className="mt-0.5 font-mono text-base tnum text-content">
              {quoting
                ? "…"
                : preview
                  ? preview.outAmt.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })
                  : "—"}
            </p>
          </div>
        </div>

        {preview && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat
                label="Est. entry / px"
                value={formatCurrency(preview.priceUsd, {
                  compact: preview.priceUsd < 0.01,
                  decimals: preview.priceUsd < 0.01 ? 6 : 4,
                })}
              />
              <Stat
                label="$ value"
                value={formatCurrency(preview.usdValue, { compact: true })}
              />
            </div>
            <p className="px-0.5 text-2xs text-content-subtle">
              Slippage{" "}
              <span className="font-mono tnum text-content">
                {(Number(settings.slippageBps) / 100).toFixed(1)}%
              </span>
              {settings.slippageAuto !== false ? " · auto" : ""}
              {quoteUpdatedAt ? (
                <>
                  {" · "}
                  {quoting ? "Updating quote…" : "Quote live · refreshes every 5s"}
                </>
              ) : null}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="xs"
            icon={Settings2}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            Swap settings
          </Button>
          {connected && (
            <p className="font-mono text-2xs text-content-subtle">
              {wallet.publicKey.toBase58().slice(0, 4)}…
              {wallet.publicKey.toBase58().slice(-4)}
            </p>
          )}
        </div>

        <SwapSettingsPanel
          open={settingsOpen}
          onChange={setSettings}
          pairContext={pairContext}
          feeEstimate={feeEstimate}
        />

        <p className="text-2xs leading-relaxed text-content-subtle">
          Phantom will ask you to sign once per swap (web apps can’t silent
          auto-sign). After confirm, Flawless journals the fill on this token’s
          trade — Fartcoin spent is payment, not a separate trade.
        </p>
      </div>
    </Sheet>
  );
}

function normalizeSlippage(bps) {
  const n = Number(bps);
  if (n === SLIPPAGE_OPTIONS[1].bps) return SLIPPAGE_OPTIONS[1].bps;
  return SLIPPAGE_OPTIONS[0].bps;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised px-3 py-2">
      <p className="text-2xs text-content-subtle">{label}</p>
      <p className="mt-0.5 font-mono tnum text-sm text-content">{value}</p>
    </div>
  );
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
