import { PublicKey } from "@solana/web3.js";
import { fromRawAmount } from "./amount";

/** Sum SPL token balance for one mint in the connected wallet. */
export async function fetchWalletMintBalance(connection, owner, mint) {
  if (!connection || !owner || !mint) return null;
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(
      typeof owner === "string" ? new PublicKey(owner) : owner,
      { mint: new PublicKey(mint) }
    );
    let raw = 0n;
    let decimals = 6;
    for (const { account } of accounts.value) {
      const ta = account.data.parsed.info.tokenAmount;
      decimals = ta.decimals;
      raw += BigInt(ta.amount);
    }
    return {
      raw: raw.toString(),
      ui: fromRawAmount(raw.toString(), decimals),
      decimals,
    };
  } catch {
    return null;
  }
}
