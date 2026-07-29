import { SLIPPAGE_PRESETS } from "./constants";

/**
 * Suggest 0.5% or 4% from pair age + 1h price change.
 * Fresh or volatile pairs → 4%; calmer/older → 0.5%.
 */
export function suggestSlippageBps({ ageHours, changeH1 } = {}) {
  const age = Number.isFinite(ageHours) ? ageHours : null;
  const chg = Math.abs(Number(changeH1));
  // Pasted CA / no pair context — stay conservative; user can raise in settings
  if (age == null && !Number.isFinite(Number(changeH1))) {
    return SLIPPAGE_PRESETS.tight;
  }
  const fresh = age != null && age < 12;
  const volatile = Number.isFinite(chg) && chg >= 12;
  if (fresh || volatile) return SLIPPAGE_PRESETS.loose;
  return SLIPPAGE_PRESETS.tight;
}
