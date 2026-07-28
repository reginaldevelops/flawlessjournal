-- =============================================================================
-- Flawless Journal — schema upgrade for the AAA overhaul
-- Run this once in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. trades.trade_number
--    Older journals only stored the index inside data->>'Trade number'.
--    The new dashboard/analytics select this column, so add + backfill it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS trade_number bigint;

-- Backfill from common JSON keys, then fall back to created_at order.
WITH numbered AS (
  SELECT
    id,
    COALESCE(
      CASE WHEN data->>'Trade number' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN trunc((data->>'Trade number')::numeric)::bigint END,
      CASE WHEN data->>'Trade Number' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN trunc((data->>'Trade Number')::numeric)::bigint END,
      CASE WHEN data->>'trade_number' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN trunc((data->>'trade_number')::numeric)::bigint END,
      CASE WHEN data->>'number' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN trunc((data->>'number')::numeric)::bigint END,
      CASE WHEN data->>'Number' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN trunc((data->>'Number')::numeric)::bigint END
    ) AS from_data
  FROM public.trades
)
UPDATE public.trades t
SET trade_number = numbered.from_data
FROM numbered
WHERE t.id = numbered.id
  AND t.trade_number IS NULL
  AND numbered.from_data IS NOT NULL;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(
          NULLIF(data->>'Datum', '')::date,
          created_at::date,
          '1970-01-01'::date
        ),
        created_at NULLS LAST,
        id
    ) AS rn
  FROM public.trades
  WHERE trade_number IS NULL
)
UPDATE public.trades t
SET trade_number = ordered.rn
FROM ordered
WHERE t.id = ordered.id;

CREATE INDEX IF NOT EXISTS trades_trade_number_idx
  ON public.trades (trade_number);

CREATE SEQUENCE IF NOT EXISTS trades_trade_number_seq;
SELECT setval(
  'trades_trade_number_seq',
  GREATEST(COALESCE((SELECT MAX(trade_number) FROM public.trades), 0), 1)
);

CREATE OR REPLACE FUNCTION public.trades_set_trade_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trade_number IS NULL THEN
    NEW.trade_number := nextval('trades_trade_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trades_set_trade_number ON public.trades;
CREATE TRIGGER trg_trades_set_trade_number
BEFORE INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.trades_set_trade_number();

-- ---------------------------------------------------------------------------
-- 2. wallets (new in the overhaul — Solana / Hyperliquid balances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Wallet',
  chain text NOT NULL CHECK (chain IN ('solana', 'hyperliquid', 'evm')),
  address text NOT NULL,
  color text DEFAULT '#7c6cff',
  include_in_balance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_chain_address_uidx
  ON public.wallets (user_id, chain, lower(address));

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
DROP POLICY IF EXISTS "wallets_update_own" ON public.wallets;
DROP POLICY IF EXISTS "wallets_delete_own" ON public.wallets;

CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "wallets_update_own" ON public.wallets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "wallets_delete_own" ON public.wallets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Seed the wallets that used to be hard-coded in the old API routes.
-- Adjust addresses if yours differ. Safe to re-run.
INSERT INTO public.wallets (user_id, label, chain, address, color, include_in_balance)
SELECT
  u.id,
  v.label,
  v.chain,
  v.address,
  v.color,
  true
FROM auth.users u
CROSS JOIN (
  VALUES
    ('Phantom — main', 'solana', '5DdCjo3doetP3txpkQkXB5ymQp89SMEsHrPt4ZWqcoH1', '#7c6cff'),
    ('Hyperliquid', 'hyperliquid', '0x50027f8cec746977c209C6684AD92a15c2fC7Fd2', '#4fd1ff')
) AS v(label, chain, address, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.wallets w
  WHERE w.chain = v.chain
    AND lower(w.address) = lower(v.address)
    AND (w.user_id = u.id OR w.user_id IS NULL)
);

-- ---------------------------------------------------------------------------
-- 3. notes — goals + scratchpad need type + updated_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.notes SET type = 'note' WHERE type IS NULL;
UPDATE public.notes SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_type_idx ON public.notes (type);

-- ---------------------------------------------------------------------------
-- 4. notebook — autosave writes updated_at; tags need `fixed`
-- ---------------------------------------------------------------------------
ALTER TABLE public.notebook
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tag_id uuid;

ALTER TABLE public.notebook_tags
  ADD COLUMN IF NOT EXISTS fixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.notebook SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. table_settings — column visibility + sort
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.table_settings (
  id integer PRIMARY KEY,
  visible_columns jsonb DEFAULT '[]'::jsonb,
  sort_key text,
  sort_direction text DEFAULT 'desc'
);

ALTER TABLE public.table_settings
  ADD COLUMN IF NOT EXISTS visible_columns jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS sort_direction text DEFAULT 'desc';

INSERT INTO public.table_settings (id, visible_columns, sort_key, sort_direction)
VALUES (1, '[]'::jsonb, 'Datum', 'desc')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. RPC used when deleting a variable (strips the key from every trade)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_variable_key(key_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trades
  SET data = data - key_name
  WHERE data ? key_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_variable_key(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. variables.user_id — stop onboarding redirect for legacy rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.variables
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.variables v
SET user_id = u.id
FROM auth.users u
WHERE v.user_id IS NULL;

-- ---------------------------------------------------------------------------
-- Done. Reload the app — dashboard, analytics, wallets and notebook should
-- light up against your real data.
-- =============================================================================
