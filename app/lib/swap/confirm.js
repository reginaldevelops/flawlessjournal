import { SWAP_CONFIRM_POLL_MS } from "./constants";

const DEFAULT_TIMEOUT_MS = 90_000;
const POLL_MS = SWAP_CONFIRM_POLL_MS;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConfirmedStatus(status) {
  return (
    status?.confirmationStatus === "confirmed" ||
    status?.confirmationStatus === "finalized"
  );
}

/**
 * Poll signature status instead of confirmTransaction with a mismatched blockhash.
 * Jupiter embeds its own recent blockhash; fetching a new one after broadcast
 * can falsely report "expired" while the tx still lands on-chain.
 */
export async function waitForSignatureConfirmation(
  connection,
  signature,
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value?.[0];

    if (status?.err) {
      throw new Error(JSON.stringify(status.err));
    }

    if (isConfirmedStatus(status)) {
      return status;
    }

    await sleep(POLL_MS);
  }

  throw new Error("Transaction confirmation timed out — check your wallet before retrying.");
}

/** If the UI errored but the chain shows success, recover instead of failing. */
export async function getSuccessfulSignatureStatus(connection, signature) {
  if (!signature) return null;
  try {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value?.[0];
    if (status?.err) return null;
    if (isConfirmedStatus(status)) return status;
    return null;
  } catch {
    return null;
  }
}
