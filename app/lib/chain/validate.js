/**
 * Address validation used by both the add-wallet form and the portfolio API.
 *
 * Base58 is decoded by hand instead of pulling `@solana/web3.js` into the client
 * bundle — the check is identical (must decode to exactly 32 bytes) and costs a
 * few hundred bytes rather than a few hundred kilobytes.
 */

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = (() => {
  const map = new Map();
  for (let i = 0; i < B58_ALPHABET.length; i += 1) map.set(B58_ALPHABET[i], i);
  return map;
})();

/** Returns the decoded bytes, or null when `value` is not valid base58. */
export function base58Decode(value) {
  const str = String(value ?? "");
  if (!str.length) return null;

  const bytes = [0];
  for (const char of str) {
    const digit = B58_MAP.get(char);
    if (digit === undefined) return null;

    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Leading '1's are leading zero bytes.
  for (let i = 0; i < str.length && str[i] === "1"; i += 1) bytes.push(0);

  return Uint8Array.from(bytes.reverse());
}

export function isValidSolanaAddress(value) {
  const decoded = base58Decode(String(value ?? "").trim());
  return decoded != null && decoded.length === 32;
}

export function isValidEvmAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value ?? "").trim());
}

export function isValidRobinhoodAccountId(value) {
  const v = String(value ?? "").trim();
  return v.length >= 4 && v.length <= 80;
}

export function validateRobinhoodCredentials({ apiKey, privateKeyBase64 }) {
  const key = String(apiKey ?? "").trim();
  const pk = String(privateKeyBase64 ?? "").trim();
  if (!key.startsWith("rh-api-")) {
    return { ok: false, error: "Robinhood API key should start with rh-api-." };
  }
  if (!pk) {
    return { ok: false, error: "Paste the base64 private key from Robinhood API setup." };
  }
  try {
    const normalized = pk.replace(/\s/g, "");
    let byteLen = 0;
    if (typeof atob === "function") {
      byteLen = atob(normalized).length;
    } else if (typeof Buffer !== "undefined") {
      byteLen = Buffer.from(normalized, "base64").length;
    }
    if (byteLen !== 32) {
      return { ok: false, error: "Private key must decode to 32 bytes (Ed25519 seed)." };
    }
  } catch {
    return { ok: false, error: "Private key is not valid base64." };
  }
  return { ok: true, error: null };
}

/**
 * Validates an address for a chain.
 * Returns `{ ok, error }` so forms can show the message inline.
 */
export function validateAddress(chain, address) {
  const value = String(address ?? "").trim();
  if (!value) return { ok: false, error: "Enter a wallet address." };

  switch (String(chain ?? "").toLowerCase()) {
    case "solana":
      if (/^0x/i.test(value)) {
        return { ok: false, error: "That looks like an EVM address — pick the EVM or Hyperliquid chain." };
      }
      if (!isValidSolanaAddress(value)) {
        return {
          ok: false,
          error: "Not a valid Solana address: it must be base58 and decode to 32 bytes.",
        };
      }
      return { ok: true, error: null };

    case "hyperliquid":
    case "evm":
      if (!value.startsWith("0x")) {
        return { ok: false, error: "Addresses on this chain start with 0x." };
      }
      if (!isValidEvmAddress(value)) {
        return { ok: false, error: "Not a valid address: expected 0x followed by 40 hex characters." };
      }
      return { ok: true, error: null };

    case "robinhood":
      if (!isValidRobinhoodAccountId(value)) {
        return { ok: false, error: "Robinhood account id missing — reconnect API credentials." };
      }
      return { ok: true, error: null };

    default:
      return { ok: false, error: "Pick a chain first." };
  }
}

/** Canonical form used for duplicate detection (EVM addresses are case-insensitive). */
export function addressKey(chain, address) {
  const value = String(address ?? "").trim();
  const id = String(chain ?? "").toLowerCase();
  return `${id}:${id === "solana" ? value : value.toLowerCase()}`;
}

export function isRobinhoodChain(chain) {
  return String(chain ?? "").toLowerCase() === "robinhood";
}

export function validateLabel(label) {
  const value = String(label ?? "").trim();
  if (!value) return { ok: false, error: "Give the wallet a name you will recognise." };
  if (value.length > 60) return { ok: false, error: "Keep the name under 60 characters." };
  return { ok: true, error: null };
}

/** Strict https DexScreener Solana pair URL — rejects embedded/substring matches. */
export function isValidDexScreenerSolanaUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" || url.hostname !== "dexscreener.com") return false;
    return /^\/solana\/[1-9A-HJ-NP-Za-km-z]{32,48}\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
