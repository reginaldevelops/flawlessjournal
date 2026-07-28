import { SLIPPAGE_PRESETS } from "./constants";

/**
 * Suggest 0.5% or 4% from pair age + 1h price change.
 * Fresh or volatile pairs → 4%; calmer/older → 0.5%.
 */
export function suggestSlippageBps({ ageHours, changeH1 } = {}) {
  const age = Number.isFinite(ageHours) ? ageHours : null;
  const chg = Math.abs(Number(changeH1));
  const fresh = age != null && age < 12;
  const volatile = Number.isFinite(chg) && chg >= 12;
  if (fresh || volatile) return SLIPPAGE_PRESETS.loose; // 4%
  return SLIPPAGE_PRESETS.tight; // 0.5%
}
