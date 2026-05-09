-- =============================================================================
-- 003_rpc_functions.sql
-- Supabase RPC Analytics Functions — Multi-Tenant Compliance Quiz Platform
--
-- FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
--   get_accuracy_by_subheading  — correct answer rate grouped by sub_heading
--   get_retake_frequency        — retake behaviour per user per policy
--   get_completion_rates        — session completion and pass rates
--
-- SECURITY MODEL
-- ─────────────────────────────────────────────────────────────────────────────
--   · All functions are SECURITY DEFINER — they run with elevated privileges
--     so they can read across joined tables efficiently.
--   · Tenant isolation is enforced MANUALLY inside every function via
--     auth_tenant_id(). Callers cannot override their own tenant.
--   · access_guard() is called at the top of each function to restrict
--     analytics to client_admin and service_role only.
--   · SET search_path = '' on every function prevents search_path injection.
--   · Parameters never include p_tenant_id — callers cannot spoof a tenant.
--
-- SUPABASE COMPATIBILITY
-- ─────────────────────────────────────────────────────────────────────────────
--   · All functions live in the public schema — exposed via supabase.rpc().
--   · TABLE(...) return types map cleanly to the Supabase JS client.
--   · Default parameters allow partial argument passing from the client.
--
-- CALL EXAMPLES (Supabase JS client)
-- ─────────────────────────────────────────────────────────────────────────────
--   supabase.rpc('get_accuracy_by_subheading', { p_policy_id: uuid })
--   supabase.rpc('get_retake_frequency', { p_min_attempts: 2 })
--   supabase.rpc('get_completion_rates', { p_group_by: 'branch' })
-- =============================================================================

-- =============================================================================
-- SECTION 0 — SHARED GUARD FUNCTION
-- Called at entry to every analytics RPC.
-- Raises an error if the caller is not client_admin or service_role.
-- This prevents employees / cxo from calling admin-only analytics.
-- =============================================================================

CREATE OR REPLACE FUNCTION access_guard_analytics()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role bypasses RLS and has unconditional access
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  -- Must be an authenticated session with a valid tenant
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'analytics_error: unauthenticated request'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (auth.jwt() ->> 'tenant_id') IS NULL THEN
    RAISE EXCEPTION 'analytics_error: missing tenant context in JWT'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Only client_admin may call analytics RPCs
  IF (auth.jwt() ->> 'user_role') <> 'client_admin' THEN
    RAISE EXCEPTION 'analytics_error: role % is not permitted to call analytics functions',
      COALESCE(auth.jwt() ->> 'user_role', 'unknown')
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- =============================================================================
-- SECTION 1 — get_accuracy_by_subheading
--
-- Returns the correct-answer rate for every sub_heading within the caller's
-- tenant, optionally filtered by policy, branch, and date range.
--
-- Questions come from two sources (master + tenant). Both are resolved to their
-- sub_heading via LEFT JOIN so the aggregation stays source-agnostic.
--
-- Return columns:
--   policy_code        — e.g. 'AML'
--   policy_title       — e.g. 'Anti-Money Laundering'
--   sub_heading_code   — e.g. 'AML-03'  (NULL if question has no sub_heading)
--   sub_heading_title  — e.g. 'Customer Due Diligence'
--   question_source    — 'master' | 'tenant' | 'mixed'
--   total_responses    — total answer events in the window
--   correct_responses  — number answered correctly
--   incorrect_responses
--   accuracy_pct       — 0.00–100.00
--   unique_users       — distinct user_ids who answered in this sub_heading
-- =============================================================================

CREATE OR REPLACE FUNCTION get_accuracy_by_subheading(
  p_policy_id  UUID        DEFAULT NULL,
  p_branch_id  UUID        DEFAULT NULL,
  p_date_from  TIMESTAMPTZ DEFAULT NULL,
  p_date_to    TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  policy_code          TEXT,
  policy_title         TEXT,
  sub_heading_code     TEXT,
  sub_heading_title    TEXT,
  question_source      TEXT,
  total_responses      BIGINT,
  correct_responses    BIGINT,
  incorrect_responses  BIGINT,
  accuracy_pct         NUMERIC(5,2),
  unique_users         BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  -- ── Access control ────────────────────────────────────────────────────────
  PERFORM public.access_guard_analytics();

  -- ── Guard: empty result if tenant context is absent ───────────────────────
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH resolved AS (
    -- Resolve each response back to its sub_heading via the appropriate
    -- question bank. tenant_questions join is tenant-gated for safety.
    SELECT
      tr.policy_id,
      tr.user_id,
      tr.is_correct,
      tr.created_at,
      tr.question_source,
      ts.branch_id,
      COALESCE(mq.sub_heading_id, tq.sub_heading_id) AS sub_heading_id
    FROM public.test_responses  tr
    JOIN public.test_sessions   ts  ON ts.id        = tr.session_id
                                   AND ts.tenant_id  = v_tenant_id   -- tenant-gate on session
    LEFT JOIN public.master_questions mq
      ON tr.question_source = 'master'
     AND tr.question_id     = mq.id
    LEFT JOIN public.tenant_questions tq
      ON tr.question_source  = 'tenant'
     AND tr.question_id      = tq.id
     AND tq.tenant_id        = v_tenant_id                           -- tenant-gate on question
    WHERE tr.tenant_id                   = v_tenant_id               -- primary tenant gate
      AND (p_policy_id  IS NULL OR tr.policy_id    = p_policy_id)
      AND (p_branch_id  IS NULL OR ts.branch_id    = p_branch_id)
      AND (p_date_from  IS NULL OR tr.created_at  >= p_date_from)
      AND (p_date_to    IS NULL OR tr.created_at  <= p_date_to)
  ),
  aggregated AS (
    SELECT
      r.policy_id,
      r.sub_heading_id,
      -- Collapse mixed-source sub_headings into a single label
      CASE
        WHEN COUNT(DISTINCT r.question_source) > 1 THEN 'mixed'
        ELSE MAX(r.question_source)
      END                                                    AS q_source,
      COUNT(*)                                               AS total_resp,
      COUNT(*) FILTER (WHERE r.is_correct = TRUE)            AS correct_resp,
      COUNT(*) FILTER (WHERE r.is_correct = FALSE)           AS incorrect_resp,
      COUNT(DISTINCT r.user_id)                              AS uniq_users
    FROM resolved r
    GROUP BY r.policy_id, r.sub_heading_id
  )
  SELECT
    p.code                                                   AS policy_code,
    p.title                                                  AS policy_title,
    sh.code                                                  AS sub_heading_code,
    sh.title                                                 AS sub_heading_title,
    a.q_source                                               AS question_source,
    a.total_resp                                             AS total_responses,
    a.correct_resp                                           AS correct_responses,
    a.incorrect_resp                                         AS incorrect_responses,
    ROUND(
      a.correct_resp::NUMERIC / NULLIF(a.total_resp, 0) * 100,
      2
    )                                                        AS accuracy_pct,
    a.uniq_users                                             AS unique_users
  FROM aggregated               a
  JOIN public.policies          p  ON p.id  = a.policy_id
  LEFT JOIN public.sub_headings sh ON sh.id = a.sub_heading_id
  ORDER BY p.code, COALESCE(sh.code, 'ZZZ');

END;
$$;

-- Grant execute to authenticated role (guard inside function restricts further)
GRANT EXECUTE ON FUNCTION get_accuracy_by_subheading(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;

-- =============================================================================
-- SECTION 2 — get_retake_frequency
--
-- Returns the retake behaviour for every user/policy combination in the
-- caller's tenant. Shows how many times each user attempted each policy,
-- how many they passed, and whether they eventually passed at all.
--
-- Useful for identifying users who are struggling and policies that have
-- high failure rates causing repeated attempts.
--
-- Return columns:
--   user_id            — UUID
--   full_name          — from users table
--   employee_id        — HR reference
--   branch_name        — branch the user belongs to
--   policy_code        — e.g. 'AML'
--   policy_title
--   total_attempts     — total sessions started for this policy
--   completed_attempts — sessions that reached 'completed' status
--   passed_attempts    — sessions where passed = TRUE
--   failed_attempts    — sessions where passed = FALSE
--   first_attempt_at   — timestamp of first session
--   last_attempt_at    — timestamp of most recent session
--   eventually_passed  — TRUE if any session for this policy has passed = TRUE
--   avg_score_pct      — average score across completed sessions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_retake_frequency(
  p_policy_id    UUID    DEFAULT NULL,
  p_branch_id    UUID    DEFAULT NULL,
  p_min_attempts INT     DEFAULT 1,        -- set to 2 to see only retakers
  p_date_from    TIMESTAMPTZ DEFAULT NULL,
  p_date_to      TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id            UUID,
  full_name          TEXT,
  employee_id        TEXT,
  branch_name        TEXT,
  policy_code        TEXT,
  policy_title       TEXT,
  total_attempts     BIGINT,
  completed_attempts BIGINT,
  passed_attempts    BIGINT,
  failed_attempts    BIGINT,
  first_attempt_at   TIMESTAMPTZ,
  last_attempt_at    TIMESTAMPTZ,
  eventually_passed  BOOLEAN,
  avg_score_pct      NUMERIC(5,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  -- ── Access control ────────────────────────────────────────────────────────
  PERFORM public.access_guard_analytics();

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id                                                    AS user_id,
    u.full_name,
    u.employee_id,
    COALESCE(b.name, '— no branch —')                      AS branch_name,
    p.code                                                  AS policy_code,
    p.title                                                 AS policy_title,
    COUNT(ts.id)                                            AS total_attempts,
    COUNT(ts.id) FILTER (WHERE ts.status = 'completed')     AS completed_attempts,
    COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)            AS passed_attempts,
    COUNT(ts.id) FILTER (WHERE ts.passed = FALSE)           AS failed_attempts,
    MIN(ts.started_at)                                      AS first_attempt_at,
    MAX(ts.started_at)                                      AS last_attempt_at,
    BOOL_OR(ts.passed = TRUE)                               AS eventually_passed,
    ROUND(
      AVG(ts.score_percentage) FILTER (WHERE ts.status = 'completed'),
      2
    )                                                       AS avg_score_pct
  FROM public.test_sessions   ts
  JOIN public.users           u   ON u.id        = ts.user_id
                                 AND u.tenant_id  = v_tenant_id   -- tenant-gate on user
  JOIN public.policies        p   ON p.id        = ts.policy_id
  LEFT JOIN public.branches   b   ON b.id        = ts.branch_id
                                 AND b.tenant_id  = v_tenant_id   -- tenant-gate on branch
  WHERE ts.tenant_id                    = v_tenant_id             -- primary tenant gate
    AND (p_policy_id  IS NULL OR ts.policy_id  = p_policy_id)
    AND (p_branch_id  IS NULL OR ts.branch_id  = p_branch_id)
    AND (p_date_from  IS NULL OR ts.started_at >= p_date_from)
    AND (p_date_to    IS NULL OR ts.started_at <= p_date_to)
  GROUP BY
    u.id, u.full_name, u.employee_id,
    b.name,
    p.code, p.title
  HAVING COUNT(ts.id) >= GREATEST(p_min_attempts, 1)             -- default: show all
  ORDER BY
    total_attempts DESC,
    u.full_name,
    p.code;

END;
$$;

GRANT EXECUTE ON FUNCTION get_retake_frequency(UUID, UUID, INT, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;

-- =============================================================================
-- SECTION 3 — get_completion_rates
--
-- Returns session completion and pass rates for the caller's tenant,
-- groupable by 'policy', 'branch', or 'month'.
--
-- Completion rate = completed sessions / total sessions × 100
-- Pass rate       = passed sessions    / completed sessions × 100
--
-- Return columns:
--   group_label        — policy code, branch name, or YYYY-MM
--   group_id           — UUID of the group entity (NULL for month grouping)
--   total_sessions     — all sessions in this group
--   completed          — sessions with status = 'completed'
--   passed             — sessions where passed = TRUE
--   failed             — sessions where passed = FALSE and status = 'completed'
--   in_progress        — sessions still open
--   expired            — sessions that timed out
--   abandoned          — sessions that were abandoned
--   completion_rate    — 0.00–100.00
--   pass_rate          — 0.00–100.00 (of completed sessions)
--   avg_score_pct      — mean score across completed sessions
--   avg_time_seconds   — mean time taken across completed sessions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_completion_rates(
  p_policy_id  UUID        DEFAULT NULL,
  p_branch_id  UUID        DEFAULT NULL,
  p_date_from  TIMESTAMPTZ DEFAULT NULL,
  p_date_to    TIMESTAMPTZ DEFAULT NULL,
  p_group_by   TEXT        DEFAULT 'policy'   -- 'policy' | 'branch' | 'month'
)
RETURNS TABLE (
  group_label       TEXT,
  group_id          UUID,
  total_sessions    BIGINT,
  completed         BIGINT,
  passed            BIGINT,
  failed            BIGINT,
  in_progress       BIGINT,
  expired           BIGINT,
  abandoned         BIGINT,
  completion_rate   NUMERIC(5,2),
  pass_rate         NUMERIC(5,2),
  avg_score_pct     NUMERIC(5,2),
  avg_time_seconds  NUMERIC(10,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  -- ── Access control ────────────────────────────────────────────────────────
  PERFORM public.access_guard_analytics();

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- ── Validate p_group_by ───────────────────────────────────────────────────
  IF p_group_by NOT IN ('policy', 'branch', 'month') THEN
    RAISE EXCEPTION 'analytics_error: p_group_by must be ''policy'', ''branch'', or ''month''. Got: %',
      p_group_by
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Policy grouping ───────────────────────────────────────────────────────
  IF p_group_by = 'policy' THEN
    RETURN QUERY
    SELECT
      p.code                                                              AS group_label,
      p.id                                                                AS group_id,
      COUNT(ts.id)                                                        AS total_sessions,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed')                AS completed,
      COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)                       AS passed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed'
                               AND ts.passed = FALSE)                    AS failed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'in_progress')              AS in_progress,
      COUNT(ts.id) FILTER (WHERE ts.status = 'expired')                  AS expired,
      COUNT(ts.id) FILTER (WHERE ts.status = 'abandoned')                AS abandoned,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.status = 'completed')::NUMERIC
          / NULLIF(COUNT(ts.id), 0) * 100,
        2
      )                                                                   AS completion_rate,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)::NUMERIC
          / NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0) * 100,
        2
      )                                                                   AS pass_rate,
      ROUND(
        AVG(ts.score_percentage) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_score_pct,
      ROUND(
        AVG(ts.time_taken_seconds) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_time_seconds
    FROM public.test_sessions  ts
    JOIN public.policies       p   ON p.id = ts.policy_id
    WHERE ts.tenant_id                    = v_tenant_id
      AND (p_policy_id  IS NULL OR ts.policy_id  = p_policy_id)
      AND (p_branch_id  IS NULL OR ts.branch_id  = p_branch_id)
      AND (p_date_from  IS NULL OR ts.started_at >= p_date_from)
      AND (p_date_to    IS NULL OR ts.started_at <= p_date_to)
    GROUP BY p.id, p.code
    ORDER BY p.code;

  -- ── Branch grouping ───────────────────────────────────────────────────────
  ELSIF p_group_by = 'branch' THEN
    RETURN QUERY
    SELECT
      COALESCE(b.name, '— no branch —')                                  AS group_label,
      b.id                                                                AS group_id,
      COUNT(ts.id)                                                        AS total_sessions,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed')                AS completed,
      COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)                       AS passed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed'
                               AND ts.passed = FALSE)                    AS failed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'in_progress')              AS in_progress,
      COUNT(ts.id) FILTER (WHERE ts.status = 'expired')                  AS expired,
      COUNT(ts.id) FILTER (WHERE ts.status = 'abandoned')                AS abandoned,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.status = 'completed')::NUMERIC
          / NULLIF(COUNT(ts.id), 0) * 100,
        2
      )                                                                   AS completion_rate,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)::NUMERIC
          / NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0) * 100,
        2
      )                                                                   AS pass_rate,
      ROUND(
        AVG(ts.score_percentage) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_score_pct,
      ROUND(
        AVG(ts.time_taken_seconds) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_time_seconds
    FROM public.test_sessions  ts
    LEFT JOIN public.branches  b   ON b.id       = ts.branch_id
                                  AND b.tenant_id = v_tenant_id   -- tenant-gate on branch
    WHERE ts.tenant_id                    = v_tenant_id
      AND (p_policy_id  IS NULL OR ts.policy_id  = p_policy_id)
      AND (p_branch_id  IS NULL OR ts.branch_id  = p_branch_id)
      AND (p_date_from  IS NULL OR ts.started_at >= p_date_from)
      AND (p_date_to    IS NULL OR ts.started_at <= p_date_to)
    GROUP BY b.id, b.name
    ORDER BY COALESCE(b.name, 'ZZZ');

  -- ── Month grouping ────────────────────────────────────────────────────────
  ELSIF p_group_by = 'month' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(ts.started_at, 'YYYY-MM')                                  AS group_label,
      NULL::UUID                                                          AS group_id,
      COUNT(ts.id)                                                        AS total_sessions,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed')                AS completed,
      COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)                       AS passed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'completed'
                               AND ts.passed = FALSE)                    AS failed,
      COUNT(ts.id) FILTER (WHERE ts.status = 'in_progress')              AS in_progress,
      COUNT(ts.id) FILTER (WHERE ts.status = 'expired')                  AS expired,
      COUNT(ts.id) FILTER (WHERE ts.status = 'abandoned')                AS abandoned,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.status = 'completed')::NUMERIC
          / NULLIF(COUNT(ts.id), 0) * 100,
        2
      )                                                                   AS completion_rate,
      ROUND(
        COUNT(ts.id) FILTER (WHERE ts.passed = TRUE)::NUMERIC
          / NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0) * 100,
        2
      )                                                                   AS pass_rate,
      ROUND(
        AVG(ts.score_percentage) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_score_pct,
      ROUND(
        AVG(ts.time_taken_seconds) FILTER (WHERE ts.status = 'completed'),
        2
      )                                                                   AS avg_time_seconds
    FROM public.test_sessions ts
    WHERE ts.tenant_id                    = v_tenant_id
      AND (p_policy_id  IS NULL OR ts.policy_id  = p_policy_id)
      AND (p_branch_id  IS NULL OR ts.branch_id  = p_branch_id)
      AND (p_date_from  IS NULL OR ts.started_at >= p_date_from)
      AND (p_date_to    IS NULL OR ts.started_at <= p_date_to)
    GROUP BY TO_CHAR(ts.started_at, 'YYYY-MM')
    ORDER BY group_label;

  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION get_completion_rates(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO authenticated;

-- =============================================================================
-- SECTION 4 — VERIFICATION
-- Confirms all three functions and the guard exist in the public schema.
-- =============================================================================

DO $$
DECLARE
  v_missing TEXT := '';
  v_fn      TEXT;
  required_fns TEXT[] := ARRAY[
    'access_guard_analytics',
    'get_accuracy_by_subheading',
    'get_retake_frequency',
    'get_completion_rates'
  ];
BEGIN
  FOREACH v_fn IN ARRAY required_fns LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      v_missing := v_missing || format(E'\n  · Missing function: %s', v_fn);
    ELSE
      RAISE NOTICE '  ✓ %', v_fn;
    END IF;
  END LOOP;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'RPC verification FAILED:%', v_missing;
  END IF;

  RAISE NOTICE '─────────────────────────────────────────────────────────';
  RAISE NOTICE 'All RPC functions verified. Tenant isolation enforced.';
  RAISE NOTICE '─────────────────────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
