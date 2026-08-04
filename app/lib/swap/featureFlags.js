/**
 * Temporary kill-switches while wallet sync / live-bar balance checks are unreliable.
 * Flip back to true when open-sync + wallet balance reconcile are solid again.
 */

/** Global Live positions bar under the app header. */
export const LIVE_POSITIONS_BAR_ENABLED = false;

/** Background auto-sync of Solana wallets on app load. */
export const WALLET_AUTO_SYNC_ENABLED = false;

/** Manual Sync / Re-import / Older / Reset controls on the Wallets page. */
export const WALLET_SYNC_UI_ENABLED = false;

/**
 * Solana PositionPanel stats: unrealized/realized PnL, total invested, avg entry/sell.
 * Currently misleading when fills are incomplete (open-only sync). Journal PnL stays manual.
 */
export const TRADE_COMPUTED_STATS_ENABLED = false;

/**
 * When false, fill updates do not overwrite the journal "PnL" field with realized PnL.
 * Keep false while users enter PnL manually in the trade sidebar.
 */
export const MIRROR_COMPUTED_PNL_TO_JOURNAL = false;
