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

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const seed = {
    Datum: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    Entreetijd: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
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
}) {
  const trade = await findOrCreatePositionTrade({
    tokenMint,
    tokenSymbol,
    tokenName,
    pairUrl,
    imageUrl,
  });

  const fj = trade.data._fj ?? {
    kind: POSITION_KIND,
    chain: "solana",
    tokenMint,
    tokenSymbol,
    fills: [],
  };

  // Dedupe by signature+side
  if (
    signature &&
    (fj.fills ?? []).some((f) => f.signature === signature && f.side === side)
  ) {
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
  });

  const fills = [...(fj.fills ?? []), fill];
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
