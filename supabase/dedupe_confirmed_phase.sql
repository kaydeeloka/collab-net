-- Run in Supabase SQL Editor if dedupe_confirmed_phase RPC is missing.
-- Also included at the end of supabase_migration.sql for fresh installs.

CREATE OR REPLACE FUNCTION public.dedupe_confirmed_phase(p_phase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_removed INT := 0;
  v_platforms_removed INT := 0;
  v_seq_renumbered    BOOLEAN := false;
  v_seq_updates       INT := 0;
BEGIN
  IF p_phase_id IS NULL THEN
    RETURN jsonb_build_object(
      'confirmed_removed', 0,
      'platforms_removed', 0,
      'seq_renumbered', false
    );
  END IF;

  -- 1) Merge influencer_id onto keeper, then delete duplicate confirmed rows
  WITH enriched AS (
    SELECT
      ci.id,
      ci.influencer_id,
      ci.seq,
      COALESCE(
        NULLIF(lower(trim(regexp_replace(coalesce(i.handle, ''), '^@', ''))), ''),
        (
          SELECT NULLIF(lower(trim(regexp_replace(coalesce(ip.handle, ''), '^@', ''))), '')
          FROM influencer_platform ip
          WHERE ip.confirmed_influencer_id = ci.id
          ORDER BY ip.followers DESC NULLS LAST, ip.id
          LIMIT 1
        )
      ) AS norm_handle,
      lower(trim(coalesce(ci.email, ''))) AS norm_email,
      (
        (CASE WHEN ci.influencer_id IS NOT NULL THEN 100 ELSE 0 END)
        + (CASE WHEN ci.form_submitted THEN 50 ELSE 0 END)
        + (CASE WHEN ci.phone IS NOT NULL AND ci.phone <> '' THEN 10 ELSE 0 END)
        + (CASE WHEN ci.email IS NOT NULL AND ci.email <> '' THEN 5 ELSE 0 END)
        + (CASE WHEN EXISTS (
            SELECT 1 FROM influencer_platform ip WHERE ip.confirmed_influencer_id = ci.id
          ) THEN 3 ELSE 0 END)
        + (CASE WHEN ci.seq IS NOT NULL THEN 1 ELSE 0 END)
      ) AS score
    FROM confirmed_influencers ci
    LEFT JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.phase_id = p_phase_id
  ),
  keyed AS (
    SELECT *,
      COALESCE(
        NULLIF(norm_handle, ''),
        CASE
          WHEN norm_email <> '' THEN '__email__:' || norm_email
          ELSE '__id__:' || id::text
        END
      ) AS dup_key
    FROM enriched
  ),
  keepers AS (
    SELECT DISTINCT ON (dup_key)
      dup_key,
      id AS keeper_id
    FROM keyed
    ORDER BY dup_key, score DESC, COALESCE(seq, 999999) ASC, id
  ),
  dups AS (
    SELECT k.id AS dup_id, k.influencer_id AS dup_influencer_id, ke.keeper_id
    FROM keyed k
    JOIN keepers ke ON ke.dup_key = k.dup_key
    WHERE k.id <> ke.keeper_id
  ),
  _merge AS (
    UPDATE confirmed_influencers ci
    SET influencer_id = d.dup_influencer_id
    FROM dups d
    WHERE ci.id = d.keeper_id
      AND d.dup_influencer_id IS NOT NULL
      AND ci.influencer_id IS NULL
    RETURNING ci.id
  ),
  _deleted AS (
    DELETE FROM confirmed_influencers ci
    USING dups d
    WHERE ci.id = d.dup_id
    RETURNING ci.id
  )
  SELECT COUNT(*)::INT INTO v_confirmed_removed FROM _deleted;

  -- 2) Dedupe influencer_platform rows (same platform + handle per confirmed)
  WITH ranked AS (
    SELECT ip.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          ip.confirmed_influencer_id,
          lower(trim(coalesce(ip.platform, ''))),
          lower(trim(regexp_replace(coalesce(ip.handle, ''), '^@', '')))
        ORDER BY ip.followers DESC NULLS LAST, ip.id
      ) AS rn
    FROM influencer_platform ip
    JOIN confirmed_influencers ci ON ci.id = ip.confirmed_influencer_id
    WHERE ci.phase_id = p_phase_id
  )
  DELETE FROM influencer_platform ip
  USING ranked r
  WHERE ip.id = r.id
    AND r.rn > 1;

  GET DIAGNOSTICS v_platforms_removed = ROW_COUNT;

  -- 3) Renumber seq 1..N within phase
  WITH ordered AS (
    SELECT
      ci.id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(ci.seq, 999999) ASC, ci.created_at ASC, ci.id
      )::INT AS new_seq
    FROM confirmed_influencers ci
    WHERE ci.phase_id = p_phase_id
  )
  UPDATE confirmed_influencers ci
  SET seq = o.new_seq
  FROM ordered o
  WHERE ci.id = o.id
    AND ci.seq IS DISTINCT FROM o.new_seq;

  GET DIAGNOSTICS v_seq_updates = ROW_COUNT;
  v_seq_renumbered := v_seq_updates > 0;

  RETURN jsonb_build_object(
    'confirmed_removed', v_confirmed_removed,
    'platforms_removed', v_platforms_removed,
    'seq_renumbered', v_seq_renumbered
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dedupe_confirmed_phase(UUID) TO anon, authenticated;
