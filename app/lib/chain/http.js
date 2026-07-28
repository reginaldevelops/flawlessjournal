/**
 * Every outbound call in the chain layer goes through here so that a slow or
 * unreachable upstream can never hang a route: each request carries an
 * AbortSignal.timeout and errors are normalised into readable messages.
 */

const DEFAULT_TIMEOUT = 9000;

export class UpstreamError extends Error {
  constructor(label, message, { status = null, cause = null } = {}) {
    super(`${label}: ${message}`);
    this.name = "UpstreamError";
    this.label = label;
    this.status = status;
    this.cause = cause;
  }
}

function describe(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timed out";
  const message = String(error?.message ?? error ?? "unknown error");
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return "network unreachable";
  }
  return message;
}

/**
 * Fetches JSON with a hard timeout and one optional retry.
 * Throws `UpstreamError` so callers can surface a per-wallet message instead of
 * failing the whole aggregate.
 */
export async function fetchJson(
  url,
  { label = "upstream", timeout = DEFAULT_TIMEOUT, retries = 1, retryDelay = 350, ...init } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
        headers: { accept: "application/json", ...(init.headers ?? {}) },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const retryable = response.status === 429 || response.status >= 500;
        const error = new UpstreamError(
          label,
          `HTTP ${response.status}${body ? ` ${body.slice(0, 120)}` : ""}`,
          { status: response.status }
        );
        if (retryable && attempt < retries) {
          lastError = error;
          await sleep(retryDelay * (attempt + 1));
          continue;
        }
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      lastError = new UpstreamError(label, describe(error), { cause: error });
      if (attempt < retries) {
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new UpstreamError(label, "unknown error");
}

export function postJson(url, body, options = {}) {
  return fetchJson(url, {
    ...options,
    method: "POST",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toNum(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}
