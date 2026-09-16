-- If 20260916 was already applied, re-run this so stripped charts stay "filled"
-- for journal STATUS (marker instead of empty string).
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
      result := result || jsonb_build_object(k, '[chart]');
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
