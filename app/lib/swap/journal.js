import { supabase } from "../supabaseClient";
import { POSITION_KIND } from "./constants";
import {
  computePosition,
  makeFill,
  mirrorJournalFields,
} from "./position";

/**
 * Find an existing Solana position trade for a mint, or create a new one.
 */
export async function findOrCreatePositionTrade({
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  executedAt,
}) {
  const { data: rows, error } = await supabase
    .from("trades")
    .select("id, data, trade_number")
    .order("id", { ascending: false })
    .limit(400);

  if (error) throw error;

  const existing = (rows ?? []).find(
    (row) =>
      row.data?._fj?.kind === POSITION_KIND &&
      row.data?._fj?.tokenMint === tokenMint
  );

  if (existing) {
    return {
      id: existing.id,
      trade_number: existing.trade_number,
      data: existing.data ?? {},
    };
  }

  const when = executedAt ? new Date(executedAt) : new Date();
  const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;
  const pad = (n) => String(n).padStart(2, "0");
  const seed = {
    Datum: `${safeWhen.getFullYear()}-${pad(safeWhen.getMonth() + 1)}-${pad(safeWhen.getDate())}`,
    Entreetijd: `${pad(safeWhen.getHours())}:${pad(safeWhen.getMinutes())}`,
    Coin: tokenSymbol,
    Coins: tokenSymbol,
    Direction: "Long",
    _fj: {
      kind: POSITION_KIND,
      chain: "solana",
      tokenMint,
      tokenSymbol,
      tokenName: tokenName || tokenSymbol,
      pairUrl: pairUrl || null,
      imageUrl: imageUrl || null,
      fills: [],
      computed: computePosition([]),
    },
  };

  const { data: inserted, error: insertError } = await supabase
    .from("trades")
    .insert([{ data: seed }])
    .select("id, data, trade_number")
    .single();

  if (insertError) throw insertError;
  return {
    id: inserted.id,
    trade_number: inserted.trade_number,
    data: inserted.data ?? seed,
  };
}

/**
 * Append a buy/sell fill and refresh avg entry / invested / PnL mirrors.
 */
export async function appendFillToPosition({
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  side,
  signature,
  quoteMint,
  quoteSymbol,
  quoteAmount,
  tokenAmount,
  priceUsd,
  usdValue,
  wallet,
  ts,
  blockTime,
}) {
  const executedAt =
    ts ??
    (blockTime != null
      ? new Date(blockTime > 1e12 ? blockTime : blockTime * 1000).toISOString()
      : undefined);

  const trade = await findOrCreatePositionTrade({
    tokenMint,
    tokenSymbol,
    tokenName,
    pairUrl,
    imageUrl,
    executedAt,
  });

  const fj = trade.data._fj ?? {
    kind: POSITION_KIND,
    chain: "solana",
    tokenMint,
    tokenSymbol,
    fills: [],
  };

  // Dedupe by signature+side — still refresh ts from on-chain time if we have it
  const existingIdx = signature
    ? (fj.fills ?? []).findIndex((f) => f.signature === signature && f.side === side)
    : -1;
  if (existingIdx >= 0) {
    const existing = fj.fills[existingIdx];
    if (
      executedAt &&
      existing.ts &&
      Math.abs(Date.parse(existing.ts) - Date.parse(executedAt)) > 60_000
    ) {
      const fills = [...fj.fills];
      fills[existingIdx] = { ...existing, ts: executedAt };
      fills.sort((a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0));
      const nextData = {
        ...trade.data,
        _fj: {
          ...fj,
          fills,
          computed: computePosition(fills),
          updatedAt: new Date().toISOString(),
        },
      };
      await supabase.from("trades").update({ data: nextData }).eq("id", trade.id);
      return { tradeId: trade.id, data: nextData, deduped: true, tsFixed: true };
    }
    return { tradeId: trade.id, data: trade.data, deduped: true };
  }

  const fill = makeFill({
    side,
    signature,
    quoteMint,
    quoteSymbol,
    quoteAmount,
    tokenAmount,
    priceUsd,
    usdValue,
    wallet,
    ts: executedAt,
  });

  const fills = [...(fj.fills ?? []), fill].sort(
    (a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0)
  );
  const computed = computePosition(fills);
  const mirrored = mirrorJournalFields({
    symbol: tokenSymbol,
    computed,
    existing: trade.data,
  });

  const nextData = {
    ...trade.data,
    ...mirrored,
    _fj: {
      ...fj,
      tokenMint,
      tokenSymbol,
      tokenName: tokenName || fj.tokenName || tokenSymbol,
      pairUrl: pairUrl || fj.pairUrl || null,
      imageUrl: imageUrl || fj.imageUrl || null,
      fills,
      computed,
      updatedAt: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("trades")
    .update({ data: nextData })
    .eq("id", trade.id);

  if (error) throw error;
  return { tradeId: trade.id, data: nextData, fill, computed, deduped: false };
}
