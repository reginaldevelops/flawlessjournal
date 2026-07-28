"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { DEFAULT_RPC } from "../../lib/swap/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function SolanaWalletProvider({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC,
    []
  );
  const wallets = useMemo(
    () => (ready ? [new PhantomWalletAdapter()] : []),
    [ready]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={ready}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
