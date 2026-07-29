import { isValidEvmAddress, isValidSolanaAddress } from "../chain/validate";

export function isValidTerminalTokenAddress(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (raw.startsWith("0x")) return isValidEvmAddress(raw);
  return isValidSolanaAddress(raw);
}

export function terminalAddressError(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Enter a contract address.";
  if (raw.startsWith("0x")) {
    if (!isValidEvmAddress(raw)) {
      return "Enter a valid EVM address (0x + 40 hex chars) for Robinhood / EVM tokens.";
    }
    return null;
  }
  if (!isValidSolanaAddress(raw)) {
    return "Enter a valid Solana mint (base58, 32 bytes) or EVM address (0x…).";
  }
  return null;
}

export function normalizeTerminalQuery(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  if (raw.startsWith("0x")) return raw.toLowerCase();
  return raw;
}
