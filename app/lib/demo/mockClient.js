/**
 * A small in-memory stand-in for the Supabase JS client.
 *
 * It implements the subset of the PostgREST query builder this app uses
 * (filters, ordering, JSON `->>` paths, insert/update/upsert/delete, rpc) plus
 * the auth calls. Data is seeded deterministically and persisted to
 * localStorage in the browser so demo edits survive a refresh.
 *
 * This exists so the app is fully usable — and visually reviewable — without
 * Supabase credentials. When credentials are present the real client is used
 * and none of this code runs.
 */

import { buildSeed, DEMO_USER } from "./seed";

const STORAGE_KEY = "flawless.demo.db.v1";
const SCHEMA_VERSION = 3;

let memory = null;

function freshDb() {
  return { __version: SCHEMA_VERSION, ...buildSeed() };
}

function loadDb() {
  if (memory) return memory;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.__version === SCHEMA_VERSION) {
          memory = parsed;
          return memory;
        }
      }
    } catch {
      /* corrupt payload — fall through to a fresh seed */
    }
  }

  memory = freshDb();
  persist();
  return memory;
}

function persist() {
  if (typeof window === "undefined" || !memory) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* quota exceeded — demo data simply won't persist */
  }
}

export function resetDemoData() {
  memory = freshDb();
  persist();
  return memory;
}

function table(name) {
  const db = loadDb();
  if (!Array.isArray(db[name])) db[name] = [];
  return db[name];
}

function uid(prefix = "row") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Column paths                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resolves PostgREST-style column references:
 *   "PnL"                -> row.PnL
 *   "data->>Datum"       -> row.data.Datum   (as text)
 *   'data->>"Setup"'     -> row.data.Setup
 *   "data->meta->>x"     -> row.data.meta.x
 */
function readPath(row, path) {
  if (!path) return undefined;
  const clean = String(path).trim().replace(/^"|"$/g, "");
  if (!clean.includes("->")) return row?.[clean];

  const [head, ...rest] = clean.split(/->>?/).map((p) => p.trim().replace(/^"|"$/g, ""));
  let value = row?.[head];
  for (const key of rest) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  // `->>` yields text in PostgREST
  if (clean.includes("->>") && value !== null && value !== undefined && typeof value !== "object") {
    return String(value);
  }
  return value;
}

function pathLeaf(path) {
  const clean = String(path).replace(/"/g, "");
  const parts = clean.split(/->>?/);
  return parts[parts.length - 1].trim();
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  const sa = String(a);
  const sb = String(b);
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
  return out;
}

/* ------------------------------------------------------------------ */
/* Query builder                                                       */
/* ------------------------------------------------------------------ */

class MockQuery {
  constructor(tableName) {
    this.tableName = tableName;
    this.filters = [];
    this.orders = [];
    this.selection = null;
    this.limitCount = null;
    this.rangeBounds = null;
    this.mode = "select";
    this.payload = null;
    this.wantSingle = false;
    this.allowNull = false;
    this.returning = true;
    this.conflictKey = "id";
  }

  /* ---- projection ---- */

  select(cols) {
    this.selection = cols && cols !== "*" ? String(cols) : null;
    if (this.mode !== "select") this.returning = true;
    return this;
  }

  /* ---- filters ---- */

  eq(col, value) {
    this.filters.push((r) => looseEq(readPath(r, col), value));
    return this;
  }

  neq(col, value) {
    this.filters.push((r) => !looseEq(readPath(r, col), value));
    return this;
  }

  gt(col, value) {
    this.filters.push((r) => compare(readPath(r, col), value) > 0);
    return this;
  }

  gte(col, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      return v !== undefined && v !== null && compare(v, value) >= 0;
    });
    return this;
  }

  lt(col, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      return v !== undefined && v !== null && compare(v, value) < 0;
    });
    return this;
  }

  lte(col, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      return v !== undefined && v !== null && compare(v, value) <= 0;
    });
    return this;
  }

  in(col, values) {
    const set = (values ?? []).map((v) => String(v));
    this.filters.push((r) => set.includes(String(readPath(r, col))));
    return this;
  }

  is(col, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      if (value === null) return v === null || v === undefined;
      return v === value;
    });
    return this;
  }

  not(col, op, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      if (op === "is" && value === null) return v !== null && v !== undefined && v !== "";
      if (op === "eq") return !looseEq(v, value);
      if (op === "in") return !(value ?? []).map(String).includes(String(v));
      return true;
    });
    return this;
  }

  like(col, pattern) {
    return this.#pattern(col, pattern, false);
  }

  ilike(col, pattern) {
    return this.#pattern(col, pattern, true);
  }

  #pattern(col, pattern, insensitive) {
    const rx = new RegExp(
      `^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
      insensitive ? "i" : ""
    );
    this.filters.push((r) => rx.test(String(readPath(r, col) ?? "")));
    return this;
  }

  contains(col, value) {
    this.filters.push((r) => {
      const v = readPath(r, col);
      if (Array.isArray(v)) return (Array.isArray(value) ? value : [value]).every((x) => v.includes(x));
      return false;
    });
    return this;
  }

  or(expression) {
    // Supports the "col.op.value,col.op.value" form.
    const clauses = String(expression)
      .split(",")
      .map((part) => part.split("."))
      .filter((p) => p.length >= 3)
      .map(([col, op, ...rest]) => ({ col, op, value: rest.join(".") }));

    this.filters.push((r) =>
      clauses.some(({ col, op, value }) => {
        const v = readPath(r, col);
        switch (op) {
          case "eq":
            return looseEq(v, value);
          case "gte":
            return compare(v, value) >= 0;
          case "lte":
            return compare(v, value) <= 0;
          case "gt":
            return compare(v, value) > 0;
          case "lt":
            return compare(v, value) < 0;
          case "ilike":
            return String(v ?? "")
              .toLowerCase()
              .includes(value.replace(/%/g, "").toLowerCase());
          case "is":
            return value === "null" ? v === null || v === undefined : v === value;
          default:
            return false;
        }
      })
    );
    return this;
  }

  /* ---- shaping ---- */

  order(col, { ascending = true, nullsFirst = false } = {}) {
    this.orders.push({ col, ascending, nullsFirst });
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  range(from, to) {
    this.rangeBounds = [from, to];
    return this;
  }

  single() {
    this.wantSingle = true;
    this.allowNull = false;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    this.allowNull = true;
    return this;
  }

  /* ---- mutations ---- */

  insert(rows) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.returning = false;
    return this;
  }

  update(patch) {
    this.mode = "update";
    this.payload = patch;
    this.returning = false;
    return this;
  }

  upsert(rows, { onConflict = "id" } = {}) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictKey = onConflict;
    this.returning = false;
    return this;
  }

  delete() {
    this.mode = "delete";
    this.returning = false;
    return this;
  }

  /* ---- execution ---- */

  #matching(rows) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  #project(rows) {
    if (!this.selection) return rows.map(deepClone);

    const cols = this.selection
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    // `count` style selections aren't used by the app; ignore gracefully.
    return rows.map((row) => {
      const out = {};
      for (const col of cols) {
        if (col === "*") {
          Object.assign(out, deepClone(row));
          continue;
        }
        const aliasMatch = /^([\w"'->\s]+):(.+)$/.exec(col);
        const path = aliasMatch ? aliasMatch[2].trim() : col;
        const key = aliasMatch ? aliasMatch[1].trim() : pathLeaf(col);
        out[key] = deepClone(readPath(row, path));
      }
      return out;
    });
  }

  #sort(rows) {
    if (!this.orders.length) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      for (const { col, ascending } of this.orders) {
        const r = compare(readPath(a, col), readPath(b, col));
        if (r !== 0) return ascending ? r : -r;
      }
      return 0;
    });
    return sorted;
  }

  #slice(rows) {
    let out = rows;
    if (this.rangeBounds) {
      const [from, to] = this.rangeBounds;
      out = out.slice(from, to + 1);
    }
    if (this.limitCount != null) out = out.slice(0, this.limitCount);
    return out;
  }

  #run() {
    const rows = table(this.tableName);
    let result = [];

    switch (this.mode) {
      case "insert": {
        const inserted = this.payload.map((row) => {
          const record = {
            id: row.id ?? uid(this.tableName.slice(0, 4)),
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            ...deepClone(row),
          };
          if (this.tableName === "trades" && record.trade_number == null) {
            record.trade_number =
              rows.reduce((max, r) => Math.max(max, r.trade_number ?? 0), 0) + 1;
          }
          rows.push(record);
          return record;
        });
        persist();
        result = inserted;
        break;
      }

      case "update": {
        const targets = this.#matching(rows);
        for (const row of targets) {
          Object.assign(row, deepClone(this.payload));
          if ("updated_at" in row && !("updated_at" in this.payload)) {
            row.updated_at = new Date().toISOString();
          }
        }
        persist();
        result = targets;
        break;
      }

      case "upsert": {
        const affected = [];
        for (const row of this.payload) {
          const key = this.conflictKey;
          const existing = rows.find((r) => looseEq(r[key], row[key]));
          if (existing) {
            Object.assign(existing, deepClone(row));
            affected.push(existing);
          } else {
            const record = {
              created_at: new Date().toISOString(),
              ...deepClone(row),
              id: row.id ?? uid(this.tableName.slice(0, 4)),
            };
            rows.push(record);
            affected.push(record);
          }
        }
        persist();
        result = affected;
        break;
      }

      case "delete": {
        const targets = this.#matching(rows);
        const ids = new Set(targets);
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (ids.has(rows[i])) rows.splice(i, 1);
        }
        persist();
        result = targets;
        break;
      }

      case "select":
      default:
        result = this.#slice(this.#sort(this.#matching(rows)));
        break;
    }

    const projected = this.#project(result);

    if (this.wantSingle) {
      if (!projected.length) {
        return {
          data: null,
          error: this.allowNull
            ? null
            : { message: "No rows found", code: "PGRST116", details: null, hint: null },
          count: 0,
          status: this.allowNull ? 200 : 406,
        };
      }
      return { data: projected[0], error: null, count: 1, status: 200 };
    }

    if (this.mode !== "select" && !this.returning) {
      return { data: null, error: null, count: projected.length, status: 204 };
    }

    return { data: projected, error: null, count: projected.length, status: 200 };
  }

  then(onFulfilled, onRejected) {
    return new Promise((resolve) => {
      // Small delay keeps optimistic-UI code paths honest.
      setTimeout(() => resolve(this.#run()), 12);
    }).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(cb) {
    return this.then(
      (v) => {
        cb?.();
        return v;
      },
      (e) => {
        cb?.();
        throw e;
      }
    );
  }
}

function looseEq(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "flawless.demo.session.v1";

function readSession() {
  if (typeof window === "undefined") return { user: DEMO_USER };
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw === "signed-out") return null;
  } catch {
    /* ignore */
  }
  return {
    access_token: "demo-token",
    token_type: "bearer",
    user: DEMO_USER,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
  };
}

function writeSession(signedIn) {
  if (typeof window === "undefined") return;
  try {
    if (signedIn) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, "signed-out");
  } catch {
    /* ignore */
  }
}

const authListeners = new Set();

function emitAuth(event) {
  const session = readSession();
  for (const cb of authListeners) {
    try {
      cb(event, session);
    } catch {
      /* listener errors shouldn't break the app */
    }
  }
}

const auth = {
  async getUser() {
    const session = readSession();
    return session
      ? { data: { user: session.user }, error: null }
      : { data: { user: null }, error: { message: "Auth session missing!" } };
  },
  async getSession() {
    return { data: { session: readSession() }, error: null };
  },
  async signInWithPassword() {
    writeSession(true);
    emitAuth("SIGNED_IN");
    return { data: { user: DEMO_USER, session: readSession() }, error: null };
  },
  async signInWithOAuth() {
    writeSession(true);
    emitAuth("SIGNED_IN");
    return {
      data: { provider: "google", url: null },
      error: null,
    };
  },
  async exchangeCodeForSession() {
    writeSession(true);
    emitAuth("SIGNED_IN");
    return { data: { session: readSession() }, error: null };
  },
  async signUp() {
    writeSession(true);
    emitAuth("SIGNED_IN");
    return { data: { user: DEMO_USER, session: readSession() }, error: null };
  },
  async signOut() {
    writeSession(false);
    emitAuth("SIGNED_OUT");
    return { error: null };
  },
  onAuthStateChange(cb) {
    authListeners.add(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(cb),
        },
      },
    };
  },
};

/* ------------------------------------------------------------------ */
/* RPCs                                                               */
/* ------------------------------------------------------------------ */

const rpcHandlers = {
  remove_variable_key({ key_name: keyName }) {
    for (const row of table("trades")) {
      if (row.data && keyName in row.data) delete row.data[keyName];
    }
    persist();
    return { data: null, error: null };
  },
};

/* ------------------------------------------------------------------ */

export function createMockClient() {
  return {
    isDemo: true,
    from: (tableName) => new MockQuery(tableName),
    rpc: async (name, params = {}) => {
      const handler = rpcHandlers[name];
      if (!handler) {
        return { data: null, error: { message: `Unknown demo RPC: ${name}` } };
      }
      return handler(params);
    },
    auth,
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
    }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "Storage is unavailable in demo mode" } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    resetDemoData,
  };
}
