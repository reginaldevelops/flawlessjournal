-- Remove a trade tag from every journal row without fetching chart images.
-- Safe to re-run. App still works if this function is missing (catalog tombstone only).
CREATE OR REPLACE FUNCTION public.remove_trade_tag(tag_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needle text := btrim(tag_name);
BEGIN
  IF needle IS NULL OR needle = '' THEN
    RETURN;
  END IF;

  UPDATE public.trades t
  SET data = (
    SELECT COALESCE(jsonb_object_agg(
      e.key,
      CASE
        WHEN e.key IN ('Tags', 'tags') AND jsonb_typeof(e.value) = 'array' THEN
          COALESCE((
            SELECT jsonb_agg(to_jsonb(elem))
            FROM jsonb_array_elements_text(e.value) elem
            WHERE lower(elem) <> lower(needle)
          ), '[]'::jsonb)
        ELSE e.value
      END
    ), '{}'::jsonb)
    FROM jsonb_each(t.data) e
  )
  WHERE t.data IS NOT NULL
    AND (
      (
        jsonb_typeof(t.data->'Tags') = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(t.data->'Tags') elem
          WHERE lower(elem) = lower(needle)
        )
      )
      OR (
        jsonb_typeof(t.data->'tags') = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(t.data->'tags') elem
          WHERE lower(elem) = lower(needle)
        )
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_trade_tag(text) TO anon, authenticated;
