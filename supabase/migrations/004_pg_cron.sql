-- =============================================================================
-- 004_pg_cron.sql
-- Scheduled Jobs — Multi-Tenant Compliance Quiz Platform
--
-- JOBS
-- ─────────────────────────────────────────────────────────────────────────────
--   cancel-paused-sessions   daily 02:00 UTC
--     Sets test_sessions.status = 'cancelled' where status = 'paused'
--     and expires_at < NOW().
--
-- PREREQUISITE FIX
-- ─────────────────────────────────────────────────────────────────────────────
--   Migration 001 defined the test_sessions status CHECK constraint as:
--     ('in_progress', 'completed', 'expired', 'abandoned')
--   Neither 'paused' nor 'cancelled' are present — the cron UPDATE would
--   violate the constraint at runtime. This migration extends it first.
--
-- SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
--   pg_cron jobs run as the database superuser and bypass RLS.
--   The UPDATE is intentionally scoped to a narrow predicate
--   (status + expires_at) to limit blast radius.
--   Rows touched are written to audit_logs for traceability.
-- =============================================================================

-- =============================================================================
-- SECTION 0 — ENABLE pg_cron EXTENSION
-- Must be enabled in Supabase dashboard under Database → Extensions first.
-- The CREATE EXTENSION here is a no-op if already enabled.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron
  SCHEMA pg_catalog;                        -- Supabase requires pg_catalog schema

-- Grant the postgres role permission to manage cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;

-- =============================================================================
-- SECTION 1 — EXTEND test_sessions STATUS CHECK CONSTRAINT
--
-- The original constraint from 001_initial_schema.sql does not include
-- 'paused' or 'cancelled'. We locate the constraint dynamically (its
-- auto-generated name varies across environments) and replace it.
-- =============================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing status CHECK constraint on test_sessions
  SELECT conname INTO v_constraint_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.test_sessions'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;

  -- Drop it if found (it will be recreated below with the full value list)
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.test_sessions DROP CONSTRAINT %I',
      v_constraint_name
    );
    RAISE NOTICE 'Dropped existing status constraint: %', v_constraint_name;
  END IF;

  -- Recreate with extended value list including 'paused' and 'cancelled'
  ALTER TABLE public.test_sessions
    ADD CONSTRAINT test_sessions_status_check
    CHECK (status IN (
      'in_progress',
      'paused',       -- ← new: session temporarily suspended
      'completed',
      'expired',
      'abandoned',
      'cancelled'     -- ← new: set by cron when paused session expires
    ));

  RAISE NOTICE 'test_sessions status constraint extended to include paused + cancelled.';
END $$;

-- =============================================================================
-- SECTION 2 — CANCEL PAUSED SESSIONS FUNCTION
--
-- Encapsulating the job logic in a named function gives:
--   · Testability  — call manually: SELECT cancel_paused_sessions();
--   · Auditability — returns a row count the cron runner can log
--   · Replaceability — update logic without touching the cron schedule
-- =============================================================================

CREATE OR REPLACE FUNCTION cancel_paused_sessions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated_count INT  := 0;
  v_result        JSONB;
  v_run_at        TIMESTAMPTZ := NOW();
BEGIN

  -- ── Core update ────────────────────────────────────────────────────────────
  WITH cancelled AS (
    UPDATE public.test_sessions
    SET
      status     = 'cancelled',
      updated_at = v_run_at
    WHERE status     = 'paused'
      AND expires_at < v_run_at
    RETURNING id, tenant_id, user_id, policy_id
  ),

  -- ── Write one audit log row per cancelled session ──────────────────────────
  audit AS (
    INSERT INTO public.audit_logs (
      id,
      tenant_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    SELECT
      gen_random_uuid(),
      c.tenant_id,
      NULL,                                         -- system job, no human actor
      'test_session.auto_cancelled',
      'test_session',
      c.id,
      jsonb_build_object(
        'reason',     'paused_and_expired',
        'job',        'cancel-paused-sessions',
        'run_at',     v_run_at
      ),
      v_run_at
    FROM cancelled c
    RETURNING 1
  )

  SELECT COUNT(*) INTO v_updated_count FROM cancelled;

  -- ── Build result summary ───────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'job',          'cancel-paused-sessions',
    'run_at',       v_run_at,
    'rows_updated', v_updated_count,
    'status',       'ok'
  );

  RAISE NOTICE 'cancel_paused_sessions: cancelled % session(s) at %',
    v_updated_count, v_run_at;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Surface the error without silently swallowing it
  RAISE WARNING 'cancel_paused_sessions FAILED: % — %', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object(
    'job',    'cancel-paused-sessions',
    'run_at', v_run_at,
    'status', 'error',
    'code',   SQLSTATE,
    'detail', SQLERRM
  );
END;
$$;

-- =============================================================================
-- SECTION 3 — SCHEDULE THE CRON JOB
--
-- Cron expression: '0 2 * * *'
--   ┌─ minute  (0)
--   │ ┌─ hour  (2 = 02:00 UTC)
--   │ │ ┌─ day of month  (* = every day)
--   │ │ │ ┌─ month  (* = every month)
--   │ │ │ │ ┌─ day of week  (* = every day)
--   0 2 * * *
--
-- Idempotent: unschedules any existing job with the same name before
-- creating, so re-running the migration is safe.
-- =============================================================================

DO $$
BEGIN
  -- Remove existing job with this name if it exists (idempotent re-run)
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cancel-paused-sessions'
  ) THEN
    PERFORM cron.unschedule('cancel-paused-sessions');
    RAISE NOTICE 'Removed existing cron job: cancel-paused-sessions';
  END IF;

  -- Schedule the job
  PERFORM cron.schedule(
    'cancel-paused-sessions',               -- job name (unique key)
    '0 2 * * *',                            -- daily at 02:00 UTC
    $job$
      SELECT cancel_paused_sessions();
    $job$
  );

  RAISE NOTICE 'Scheduled cron job: cancel-paused-sessions at 02:00 UTC daily.';
END $$;

-- =============================================================================
-- SECTION 4 — VERIFICATION
-- Confirms the constraint was extended, the function exists,
-- and the cron job is registered.
-- =============================================================================

DO $$
DECLARE
  v_issues TEXT := '';

  v_constraint_ok  BOOLEAN;
  v_function_ok    BOOLEAN;
  v_cron_ok        BOOLEAN;
  v_cron_schedule  TEXT;
BEGIN

  -- 1. Check that 'paused' and 'cancelled' are in the CHECK constraint
  SELECT pg_get_constraintdef(oid) LIKE '%paused%'
    AND  pg_get_constraintdef(oid) LIKE '%cancelled%'
  INTO v_constraint_ok
  FROM pg_constraint
  WHERE conrelid = 'public.test_sessions'::regclass
    AND conname  = 'test_sessions_status_check';

  IF NOT COALESCE(v_constraint_ok, FALSE) THEN
    v_issues := v_issues ||
      E'\n  · test_sessions status constraint does not include paused/cancelled';
  ELSE
    RAISE NOTICE '  ✓ test_sessions status constraint extended';
  END IF;

  -- 2. Check that cancel_paused_sessions() function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname  = 'public'
      AND  p.proname  = 'cancel_paused_sessions'
  ) INTO v_function_ok;

  IF NOT v_function_ok THEN
    v_issues := v_issues ||
      E'\n  · Function cancel_paused_sessions() not found';
  ELSE
    RAISE NOTICE '  ✓ cancel_paused_sessions() function exists';
  END IF;

  -- 3. Check that the cron job is registered with the correct schedule
  SELECT schedule INTO v_cron_schedule
  FROM   cron.job
  WHERE  jobname = 'cancel-paused-sessions';

  IF v_cron_schedule IS NULL THEN
    v_issues := v_issues ||
      E'\n  · Cron job cancel-paused-sessions not found in cron.job';
  ELSIF v_cron_schedule <> '0 2 * * *' THEN
    v_issues := v_issues ||
      format(E'\n  · Cron schedule mismatch: expected ''0 2 * * *'', got ''%s''',
             v_cron_schedule);
  ELSE
    RAISE NOTICE '  ✓ Cron job scheduled: % [%]',
      'cancel-paused-sessions', v_cron_schedule;
  END IF;

  -- Raise if anything failed
  IF v_issues <> '' THEN
    RAISE EXCEPTION 'Migration 004 verification FAILED:%', v_issues;
  END IF;

  RAISE NOTICE '─────────────────────────────────────────────────────────';
  RAISE NOTICE 'Migration 004 verified. Job runs daily at 02:00 UTC.';
  RAISE NOTICE '─────────────────────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================
