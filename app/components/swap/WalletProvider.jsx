"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { getClientRpcEndpoint } from "../../lib/swap/rpc";

import "@solana/wallet-adapter-react-ui/styles.css";

/** HTTP RPC is proxied; WebSocket must hit a real wss endpoint (not our POST-only route). */
const SOLANA_WS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL || "wss://solana-rpc.publicnode.com";

export default function SolanaWalletProvider({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const endpoint = useMemo(() => getClientRpcEndpoint(), []);
  const wallets = useMemo(
    () => (ready ? [new PhantomWalletAdapter()] : []),
    [ready]
  );

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: "confirmed", wsEndpoint: SOLANA_WS_ENDPOINT }}
    >
      <WalletProvider wallets={wallets} autoConnect={ready}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
