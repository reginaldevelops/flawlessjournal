/**
 * Normalize Robinhood Crypto API orders into a stable read-only shape for the UI.
 */

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function parseRhSymbol(symbol) {
  const raw = String(symbol ?? "").toUpperCase();
  const [asset, quote = "USD"] = raw.split("-");
  return { asset, quote, pair: raw };
}

export function normalizeRobinhoodOrder(order) {
  if (!order?.id) return null;

  const { asset, quote, pair } = parseRhSymbol(order.symbol);
  const qty =
    n(order.filled_asset_quantity) ||
    n(order.market_order_config?.asset_quantity) ||
    n(order.limit_order_config?.asset_quantity) ||
    n(order.executions?.[0]?.quantity);

  const avgPrice = n(order.average_price) || n(order.executions?.[0]?.effective_price);
  const usdEstimate =
    qty > 0 && avgPrice > 0 ? qty * avgPrice : n(order.limit_order_config?.quote_amount);

  return {
    id: order.id,
    side: order.side ?? null,
    symbol: pair,
    asset,
    quote,
    type: order.type ?? null,
    state: order.state ?? null,
    quantity: qty,
    averagePrice: avgPrice || null,
    usdValue: usdEstimate || null,
    createdAt: order.created_at ?? null,
    updatedAt: order.updated_at ?? null,
    clientOrderId: order.client_order_id ?? null,
    executions: (order.executions ?? []).map((ex) => ({
      price: n(ex.effective_price) || null,
      quantity: n(ex.quantity) || null,
      timestamp: ex.timestamp ?? null,
    })),
  };
}

export function sortRobinhoodOrders(orders = []) {
  return [...orders].sort(
    (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
  );
}
