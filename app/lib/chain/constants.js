/**
 * Chain metadata shared by the wallets UI and the portfolio API.
 *
 * Safe to import from client components: no node-only dependencies here.
 */

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Pseudo-mints for venue balances that have no on-chain mint. */
export const HL_PERP_ASSET = "hl:perp-equity";
export const hlSpotAsset = (coin) => `hl:spot:${coin}`;
export const evmAsset = (symbol) => `evm:${symbol.toLowerCase()}`;

export const CHAINS = {
  solana: {
    id: "solana",
    label: "Solana",
    short: "SOL",
    tone: "brand",
    description: "SOL plus every SPL and Token-2022 balance, priced through Jupiter.",
    addressPlaceholder: "5DdCjo3doetP3txpkQkXB5ymQp89SMEsHrPt4ZWqcoH1",
    addressHint: "Base58 public key, 32 bytes.",
    explorerName: "Solscan",
    explorer: (address) => `https://solscan.io/account/${address}`,
  },
  hyperliquid: {
    id: "hyperliquid",
    label: "Hyperliquid",
    short: "HL",
    tone: "info",
    description: "Perps account equity, open positions and spot balances.",
    addressPlaceholder: "0x50027f8cec746977c209C6684AD92a15c2fC7Fd2",
    addressHint: "The EVM address you trade Hyperliquid with.",
    explorerName: "Hyperliquid",
    explorer: (address) => `https://app.hyperliquid.xyz/explorer/address/${address}`,
  },
  evm: {
    id: "evm",
    label: "EVM",
    short: "EVM",
    tone: "warn",
    description: "Ethereum mainnet: native ETH plus the major stablecoins and wrappers.",
    addressPlaceholder: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    addressHint: "Ethereum-style address, 0x plus 40 hex characters.",
    explorerName: "Etherscan",
    explorer: (address) => `https://etherscan.io/address/${address}`,
  },
};

export const CHAIN_LIST = Object.values(CHAINS);

export function chainMeta(chain) {
  return (
    CHAINS[String(chain ?? "").toLowerCase()] ?? {
      id: String(chain ?? "unknown"),
      label: String(chain ?? "Unknown"),
      short: String(chain ?? "?").slice(0, 3).toUpperCase(),
      tone: "neutral",
      description: "",
      addressPlaceholder: "",
      addressHint: "",
      explorerName: null,
      explorer: () => null,
    }
  );
}

export function explorerUrl(chain, address) {
  if (!address) return null;
  return chainMeta(chain).explorer(address) ?? null;
}

/** Accent colours offered by the wallet colour picker (mirrors the chart palette). */
export const WALLET_COLORS = [
  "#7c6cff",
  "#4fd1ff",
  "#22d38a",
  "#fab73e",
  "#ff5c6e",
  "#a78bfa",
  "#34d399",
  "#f472b6",
];

export function nextWalletColor(used = []) {
  const taken = new Set(used.map((c) => String(c ?? "").toLowerCase()));
  return WALLET_COLORS.find((c) => !taken.has(c.toLowerCase())) ?? WALLET_COLORS[0];
}
