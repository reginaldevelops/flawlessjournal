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

export default function SolanaWalletProvider({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const endpoint = useMemo(() => getClientRpcEndpoint(), []);
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
