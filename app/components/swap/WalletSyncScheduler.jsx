"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  runWalletSync,
  shouldAutoSync,
} from "../../lib/swap/importFills";
import { SYNC_BATCH_DEFAULT } from "../../lib/swap/constants";

/**
 * On app load: quietly sync Solana wallets that haven't synced in 24h.
 * Manual sync should call `runWalletSync` directly from the Wallets UI.
 */
export default function WalletSyncScheduler() {
  const ran = useRef(false);
  const [status, setStatus] = useState(null);

  const autoSync = useCallback(async () => {
    if (ran.current) return;
    ran.current = true;

    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("id, address, chain")
        .eq("chain", "solana");
      if (error || !data?.length) return;

      const due = data.filter((w) => w.address && shouldAutoSync(w.address));
      if (!due.length) return;

      setStatus(`Auto-syncing ${due.length} wallet${due.length > 1 ? "s" : ""}…`);
      for (const w of due) {
        try {
          await runWalletSync(w.address, { limit: SYNC_BATCH_DEFAULT, quiet: true });
        } catch (err) {
          console.warn("[wallet-auto-sync]", w.address, err.message);
        }
      }
      setStatus(null);
    } catch (err) {
      console.warn("[wallet-auto-sync]", err);
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(autoSync, 8_000); // after shell settles
    return () => clearTimeout(t);
  }, [autoSync]);

  if (!status) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-toast max-w-xs rounded-lg border border-line bg-surface-overlay px-3 py-2 text-2xs text-content-muted shadow-lg animate-fade-in">
      {status}
    </div>
  );
}
