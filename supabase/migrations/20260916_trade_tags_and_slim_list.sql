-- =============================================================================
-- Slim trade list payloads + persist a reusable trade-tag catalog.
-- Safe to re-run.
-- =============================================================================

-- Strip chart screenshots (data:image…) and fill OHLC snapshots from JSON.
CREATE OR REPLACE FUNCTION public.strip_trade_media(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  fj jsonb;
  fills jsonb;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RETURN COALESCE(payload, '{}'::jsonb);
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each(payload)
  LOOP
    IF jsonb_typeof(v) = 'string' AND left(v #>> '{}', 10) = 'data:image' THEN
      result := result || jsonb_build_object(k, '');
    ELSIF k = '_fj' AND jsonb_typeof(v) = 'object' THEN
      fj := v;
      IF fj ? 'fills' AND jsonb_typeof(fj->'fills') = 'array' THEN
        SELECT COALESCE(jsonb_agg(elem - 'ohlcSnapshot'), '[]'::jsonb)
          INTO fills
          FROM jsonb_array_elements(fj->'fills') elem;
        fj := jsonb_set(fj, '{fills}', fills);
      END IF;
      IF jsonb_typeof(fj->'imageUrl') = 'string'
         AND left(fj->>'imageUrl', 10) = 'data:image' THEN
        fj := jsonb_set(fj, '{imageUrl}', '""'::jsonb);
      END IF;
      result := result || jsonb_build_object(k, fj);
    ELSE
      result := result || jsonb_build_object(k, v);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- PostgREST computed column: select=id,trade_number,data:strip_trade_media
CREATE OR REPLACE FUNCTION public.strip_trade_media(t public.trades)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT public.strip_trade_media(t.data);
$$;

GRANT EXECUTE ON FUNCTION public.strip_trade_media(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.strip_trade_media(public.trades) TO anon, authenticated;

-- Reusable tag library (names only — colour is derived client-side).
ALTER TABLE public.table_settings
  ADD COLUMN IF NOT EXISTS trade_tags jsonb DEFAULT '[]'::jsonb;
