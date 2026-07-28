/**
 * Minimal in-module TTL cache.
 *
 * Route handlers are long-lived in the Node runtime, so keeping prices, token
 * metadata and balances here avoids hammering the public RPC endpoints on every
 * refresh. Entries are pruned lazily on read plus whenever the map grows large.
 */

export function createCache({ ttl, max = 4000, name = "cache" } = {}) {
  const store = new Map();

  function prune(now) {
    for (const [key, entry] of store) {
      if (entry.expires <= now) store.delete(key);
    }
    if (store.size > max) {
      // Drop the oldest insertions first.
      const excess = store.size - max;
      let i = 0;
      for (const key of store.keys()) {
        if (i >= excess) break;
        store.delete(key);
        i += 1;
      }
    }
  }

  return {
    name,
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expires <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    /** Returns the value even when stale, together with a freshness flag. */
    getStale(key) {
      const entry = store.get(key);
      if (!entry) return { value: undefined, stale: false, age: null };
      return {
        value: entry.value,
        stale: entry.expires <= Date.now(),
        age: Date.now() - entry.created,
      };
    },
    set(key, value, customTtl) {
      const now = Date.now();
      store.set(key, { value, created: now, expires: now + (customTtl ?? ttl) });
      if (store.size > max) prune(now);
      return value;
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}

/** Splits a list into fixed-size chunks so query strings stay well under limits. */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
