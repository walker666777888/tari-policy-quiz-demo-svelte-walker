-- =============================================================================
-- supabase/seed/system_parameters.sql
-- System Parameters — Global Defaults + Tenant Override Infrastructure
--
-- Architecture:
--   tenant_id IS NULL  →  platform-wide default (seed data below)
--   tenant_id IS NOT NULL  →  tenant-level override (inserted at runtime)
--
-- Read priority (enforced in application / RPC layer):
--   1. Tenant-specific row  (tenant_id = <current_tenant>)
--   2. Global default row   (tenant_id IS NULL)
--
-- Schema enforces uniqueness via:
--   UNIQUE NULLS NOT DISTINCT (tenant_id, key)
-- =============================================================================

-- =============================================================================
-- HELPER: get_system_parameter(key, tenant_id)
-- Returns the effective value for a parameter — tenant override takes priority.
-- Safe to call from RLS policies, RPC functions, and application code.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_system_parameter(
  p_key       TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''                   -- SECURITY FIX (HIGH-2): prevents search-path injection
AS $$
  SELECT COALESCE(
    -- 1st: tenant-specific override
    (
      SELECT value FROM public.system_parameters   -- fully-qualified (required when search_path = '')
      WHERE key       = p_key
        AND tenant_id = p_tenant_id
      LIMIT 1
    ),
    -- 2nd: platform-wide default (tenant_id IS NULL)
    (
      SELECT value FROM public.system_parameters
      WHERE key       = p_key
        AND tenant_id IS NULL
      LIMIT 1
    )
  );
$$;

-- =============================================================================
-- GLOBAL DEFAULT PARAMETERS (tenant_id = NULL)
-- =============================================================================

INSERT INTO system_parameters
  (id, tenant_id, key, value, value_type, description, is_secret)
VALUES

  -- ── Quiz behaviour ──────────────────────────────────────────────────────────

  (gen_random_uuid(), NULL,
   'default_pass_threshold', '60',
   'integer',
   'Minimum score percentage (0–100) a user must achieve to pass a quiz and receive a certificate.',
   FALSE),

  (gen_random_uuid(), NULL,
   'default_question_count', '20',
   'integer',
   'Number of questions drawn per quiz session when no policy-level override is set.',
   FALSE),

  (gen_random_uuid(), NULL,
   'session_expiry_days', '7',
   'integer',
   'Number of days before an in-progress or unstarted test session expires and is marked abandoned.',
   FALSE),

  -- ── Certificate and completion ──────────────────────────────────────────────

  (gen_random_uuid(), NULL,
   'certificate_validity_days', '365',
   'integer',
   'Number of days a certificate remains valid before a re-assessment is required.',
   FALSE),

  (gen_random_uuid(), NULL,
   'max_attempts_per_session', '3',
   'integer',
   'Maximum number of times a user may retake a quiz for the same policy within a validity cycle.',
   FALSE),

  -- ── Question pool behaviour ─────────────────────────────────────────────────

  (gen_random_uuid(), NULL,
   'master_question_ratio', '0.5',
   'string',
   'Proportion (0.0–1.0) of questions drawn from the master pool vs tenant pool when both are available.',
   FALSE),

  (gen_random_uuid(), NULL,
   'history_reset_days', '180',
   'integer',
   'Days after which a user''s seen-question history is cleared, allowing questions to recycle.',
   FALSE),

  -- ── Platform behaviour ──────────────────────────────────────────────────────

  (gen_random_uuid(), NULL,
   'maintenance_mode', 'false',
   'boolean',
   'When true, the platform displays a maintenance notice and blocks new quiz sessions.',
   FALSE),

  (gen_random_uuid(), NULL,
   'support_email', 'support@tariplatform.com',
   'string',
   'Default support email address shown to users in error messages and notifications.',
   FALSE),

  (gen_random_uuid(), NULL,
   'platform_timezone', 'UTC',
   'string',
   'Default timezone used for scheduled jobs, certificate dates, and audit log timestamps.',
   FALSE)

ON CONFLICT (tenant_id, key) DO UPDATE SET          -- idempotent re-runs
  value       = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- =============================================================================
-- TENANT OVERRIDE EXAMPLE (commented out — applied at onboarding time)
--
-- To override a parameter for a specific tenant, insert a row with that
-- tenant's id. get_system_parameter() will return this value instead of the
-- global default automatically.
--
-- Example:
--
--   INSERT INTO system_parameters (id, tenant_id, key, value, value_type, description)
--   VALUES (
--     gen_random_uuid(),
--     '<tenant-uuid>',
--     'default_pass_threshold', '80',
--     'integer',
--     'Acme Corp requires 80% pass threshold per internal policy.'
--   )
--   ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
--
-- The above does NOT affect any other tenant or the global default.
-- =============================================================================

-- =============================================================================
-- VERIFY
-- =============================================================================

DO $$
DECLARE
  v_count INT;
  v_pass  TEXT;
  v_qcount TEXT;
  v_expiry TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM system_parameters WHERE tenant_id IS NULL;

  SELECT get_system_parameter('default_pass_threshold')  INTO v_pass;
  SELECT get_system_parameter('default_question_count')  INTO v_qcount;
  SELECT get_system_parameter('session_expiry_days')     INTO v_expiry;

  RAISE NOTICE '─────────────────────────────────────────────────';
  RAISE NOTICE 'system_parameters seed verification:';
  RAISE NOTICE '  Global defaults inserted : %', v_count;
  RAISE NOTICE '  default_pass_threshold   : %', v_pass;
  RAISE NOTICE '  default_question_count   : %', v_qcount;
  RAISE NOTICE '  session_expiry_days      : %', v_expiry;

  IF v_pass   IS NULL THEN RAISE EXCEPTION 'default_pass_threshold missing';  END IF;
  IF v_qcount IS NULL THEN RAISE EXCEPTION 'default_question_count missing';  END IF;
  IF v_expiry IS NULL THEN RAISE EXCEPTION 'session_expiry_days missing';     END IF;

  RAISE NOTICE 'All system_parameters assertions passed.';
  RAISE NOTICE '─────────────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF SEED: system_parameters.sql
-- =============================================================================
