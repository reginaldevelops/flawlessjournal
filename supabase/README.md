# Supabase schema upgrade (required after the AAA overhaul)

Your existing database is missing a few columns/tables the new app expects.
The app is now **tolerant** of the old schema, but for full wallets + reliable
trade numbering you should run the migration once.

## What to do

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor** → **New query**
2. Paste the full contents of [`supabase/migrations/20260728_aaa_compat.sql`](./migrations/20260728_aaa_compat.sql)
3. Click **Run**
4. Hard-refresh the deployed app

## What it fixes

| Change | Why |
| --- | --- |
| `trades.trade_number` column + backfill | Dashboard/analytics were selecting a column that didn't exist |
| `wallets` table + RLS + seed of your old Phantom/HL addresses | New Wallets page and dashboard balances |
| `notes.type` / `updated_at` | Goals + scratchpad |
| `notebook.updated_at`, `notebook_tags.fixed` | Google-Docs autosave |
| `table_settings` sort columns | Trades table preferences |
| `remove_variable_key` RPC | Deleting a variable from a trade |
| Backfill `variables.user_id` | Stops a false redirect to onboarding |

## Optional checks after running

```sql
SELECT count(*) AS trades, count(trade_number) AS with_number FROM trades;
SELECT * FROM wallets;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'trades' AND column_name = 'trade_number';
```
