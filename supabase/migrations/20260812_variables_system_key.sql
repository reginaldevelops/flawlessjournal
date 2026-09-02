-- System field bindings for journal variables.
-- system_key is stable (pnl, date, entryTime, exitTime, coin); `name` is the trade.data column.

ALTER TABLE public.variables
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS variables_user_system_key_uidx
  ON public.variables (user_id, system_key)
  WHERE system_key IS NOT NULL;

COMMENT ON COLUMN public.variables.system_key IS
  'Stable system field id (pnl, date, entryTime, exitTime, coin).';
