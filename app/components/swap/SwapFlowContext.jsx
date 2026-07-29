"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TokenPickerSheet from "./TokenPickerSheet";
import SwapSheet from "./SwapSheet";

const SwapFlowContext = createContext(null);

export function SwapFlowProvider({ children }) {
  const router = useRouter();
  const onCompleteRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [tradeId, setTradeId] = useState(null);

  const openSwap = useCallback((opts = {}) => {
    onCompleteRef.current = opts.onComplete ?? null;
    setTradeId(opts.tradeId ?? null);
    setToken(null);
    setSwapOpen(false);
    setPickerOpen(true);
  }, []);

  const closeAll = useCallback(() => {
    setPickerOpen(false);
    setSwapOpen(false);
    setToken(null);
    setTradeId(null);
    onCompleteRef.current = null;
  }, []);

  const handleTokenConfirm = useCallback((resolved) => {
    setToken(resolved);
    setPickerOpen(false);
    setSwapOpen(true);
  }, []);

  const handleSwapSuccess = useCallback(
    (result) => {
      const complete = onCompleteRef.current;
      closeAll();
      if (complete) {
        complete(result);
        return;
      }
      if (result?.tradeId) {
        router.push(`/trade/${result.tradeId}`);
      }
    },
    [closeAll, router]
  );

  const value = useMemo(() => ({ openSwap }), [openSwap]);

  return (
    <SwapFlowContext.Provider value={value}>
      {children}
      <TokenPickerSheet
        open={pickerOpen}
        onClose={closeAll}
        onConfirm={handleTokenConfirm}
      />
      <SwapSheet
        open={swapOpen}
        onClose={closeAll}
        token={token}
        tradeId={tradeId}
        initialSide="buy"
        onSuccess={handleSwapSuccess}
      />
    </SwapFlowContext.Provider>
  );
}

export function useSwapFlow() {
  const ctx = useContext(SwapFlowContext);
  if (!ctx) throw new Error("useSwapFlow must be used within SwapFlowProvider");
  return ctx;
}
