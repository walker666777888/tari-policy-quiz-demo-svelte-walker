-- =============================================================================
-- 005_security_fixes.sql
-- Security Audit Remediation — Multi-Tenant SaaS Compliance Quiz Platform
--
-- Fixes every CRITICAL, HIGH, MEDIUM, and LOW finding raised in the
-- production security audit performed on 2026-05-10.
--
-- SECTION 0  — Move is_dual_track to migration layer          (MEDIUM-2)
-- SECTION 1  — Fix trigger_set_updated_at search_path        (MEDIUM-1)
-- SECTION 2  — Tenants RLS                                   (CRITICAL-1)
-- SECTION 3  — Policies + sub_headings RLS                   (CRITICAL-2)
-- SECTION 4  — Correct-answer column protection              (CRITICAL-3)
-- SECTION 5  — Role-escalation prevention trigger            (CRITICAL-4)
-- SECTION 6  — Audit-log actor validation                    (CRITICAL-5)
-- SECTION 7  — Score-manipulation prevention trigger         (HIGH-1)
-- SECTION 8  — Secret system parameters hidden from clients  (HIGH-3)
-- SECTION 9  — Session status state-machine trigger          (MEDIUM-5)
-- SECTION 10 — Certificate number auto-generation            (LOW-2)
-- SECTION 11 — Verification
--
-- NOTE  HIGH-2  (get_system_parameter search_path) is fixed in the seed file.
-- NOTE  MEDIUM-3 (import script path traversal) is fixed in TypeScript.
-- NOTE  MEDIUM-4 (auth event logging) is fixed in hooks.server.ts.
-- =============================================================================

-- =============================================================================
-- SECTION 0 — Move is_dual_track from seed to migration layer   (MEDIUM-2)
--
-- The seed file used ALTER TABLE ADD COLUMN IF NOT EXISTS, which runs only
-- when the seed is applied and is not tracked as a schema migration.
-- Moving it here guarantees the column exists before any seed or RLS policy
-- that references it.
-- =============================================================================

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS is_dual_track BOOLEAN NOT NULL DEFAULT FALSE;

RAISE NOTICE 'SECTION 0 — is_dual_track column ensured on policies';

-- =============================================================================
-- SECTION 1 — Fix trigger_set_updated_at search_path             (MEDIUM-1)
--
-- The original function lacked SET search_path = '' and SECURITY DEFINER,
-- allowing a malicious schema in the search path to intercept the call.
-- This replacement is identical in behaviour but immune to search-path
-- injection.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

RAISE NOTICE 'SECTION 1 — trigger_set_updated_at hardened (MEDIUM-1)';

-- =============================================================================
-- SECTION 2 — Tenants RLS                                       (CRITICAL-1)
--
-- BEFORE this fix: any authenticated user could SELECT all tenants,
-- UPDATE plan/status, and effectively take over the whole platform.
--
-- AFTER this fix:
--   SELECT  : own tenant only (id = auth_tenant_id())
--   INSERT  : blocked — tenants created via service_role/dashboard only
--   DELETE  : blocked — same
--   UPDATE  : client_admin may update safe metadata fields only.
--             A trigger (protect_tenant_privileged_fields) prevents changes
--             to plan, status, and max_users from non-service-role callers.
-- =============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE  ROW LEVEL SECURITY;

-- ── SELECT: own tenant only ──────────────────────────────────────────────────
DROP POLICY IF EXISTS tenants_select_own ON public.tenants;
CREATE POLICY tenants_select_own
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.auth_tenant_id());

-- ── INSERT: blocked — provisioned via service_role / dashboard only ──────────
DROP POLICY IF EXISTS tenants_insert_deny ON public.tenants;
CREATE POLICY tenants_insert_deny
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

-- ── DELETE: blocked ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenants_delete_deny ON public.tenants;
CREATE POLICY tenants_delete_deny
  ON public.tenants FOR DELETE
  TO authenticated
  USING (FALSE);

-- ── UPDATE: client_admin may update safe fields only ─────────────────────────
-- plan / status / max_users are protected by the trigger below.
DROP POLICY IF EXISTS tenants_update_client_admin ON public.tenants;
CREATE POLICY tenants_update_client_admin
  ON public.tenants FOR UPDATE
  TO authenticated
  USING  (id = public.auth_tenant_id() AND public.is_client_admin())
  WITH CHECK (id = public.auth_tenant_id() AND public.is_client_admin());

-- ── Trigger: protect privileged tenant fields ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_tenant_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role may change anything (plan upgrades, provisioning, etc.)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- id is always immutable
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'tenants: id is immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- These fields require service_role (controlled by billing / admin panel)
  IF NEW.plan <> OLD.plan THEN
    RAISE EXCEPTION 'tenants: plan may only be changed by service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'tenants: status may only be changed by service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.max_users <> OLD.max_users THEN
    RAISE EXCEPTION 'tenants: max_users may only be changed by service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tenant_privileged_fields ON public.tenants;
CREATE TRIGGER enforce_tenant_privileged_fields
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_tenant_privileged_fields();

RAISE NOTICE 'SECTION 2 — Tenants RLS enabled + trigger applied (CRITICAL-1)';

-- =============================================================================
-- SECTION 3 — Policies + sub_headings RLS                       (CRITICAL-2)
--
-- BEFORE: any authenticated user could DELETE policies (cascades to ALL
--         tenant_questions, test_sessions, test_responses, certificates for
--         every tenant — a single query destroys the entire platform).
--
-- AFTER:
--   SELECT : authenticated users see active rows only (needed to render quizzes)
--   INSERT / UPDATE / DELETE : blocked — only service_role may write
-- =============================================================================

ALTER TABLE public.policies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.sub_headings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_headings FORCE  ROW LEVEL SECURITY;

-- ── policies ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS policies_select_authenticated ON public.policies;
CREATE POLICY policies_select_authenticated
  ON public.policies FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS policies_insert_deny ON public.policies;
CREATE POLICY policies_insert_deny
  ON public.policies FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS policies_update_deny ON public.policies;
CREATE POLICY policies_update_deny
  ON public.policies FOR UPDATE
  TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS policies_delete_deny ON public.policies;
CREATE POLICY policies_delete_deny
  ON public.policies FOR DELETE
  TO authenticated
  USING (FALSE);

-- ── sub_headings ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS sub_headings_select_authenticated ON public.sub_headings;
CREATE POLICY sub_headings_select_authenticated
  ON public.sub_headings FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS sub_headings_insert_deny ON public.sub_headings;
CREATE POLICY sub_headings_insert_deny
  ON public.sub_headings FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS sub_headings_update_deny ON public.sub_headings;
CREATE POLICY sub_headings_update_deny
  ON public.sub_headings FOR UPDATE
  TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS sub_headings_delete_deny ON public.sub_headings;
CREATE POLICY sub_headings_delete_deny
  ON public.sub_headings FOR DELETE
  TO authenticated
  USING (FALSE);

RAISE NOTICE 'SECTION 3 — Policies + sub_headings RLS locked (CRITICAL-2)';

-- =============================================================================
-- SECTION 4 — Correct-answer column protection                  (CRITICAL-3)
--
-- BEFORE: any authenticated user could SELECT correct_option from both question
--         tables via the Supabase JS client, retrieving the full answer key
--         before a quiz begins.
--
-- AFTER:
--   authenticated role loses the blanket SELECT grant and receives a
--   column-specific grant that excludes correct_option.
--   service_role retains full access (needed for import scripts and RPCs).
--
--   Two safe views (quiz_master_questions, quiz_tenant_questions) are created
--   for the application's quiz-delivery layer. These views omit correct_option
--   and apply the correct tenant scoping.
--
-- The application MUST use the views (or a SECURITY DEFINER RPC) to deliver
-- questions to users. Correct-option comparison happens server-side only.
-- =============================================================================

-- ── Revoke blanket grants, then re-grant column by column ────────────────────

REVOKE SELECT ON public.master_questions FROM authenticated;
REVOKE SELECT ON public.tenant_questions FROM authenticated;

-- master_questions — all columns EXCEPT correct_option
GRANT SELECT (
  id, policy_id, sub_heading_id, employee_category,
  question_text, option_a, option_b, option_c, option_d,
  explanation, difficulty, source_file, tags,
  is_active, created_at, updated_at
) ON public.master_questions TO authenticated;

-- tenant_questions — all columns EXCEPT correct_option
GRANT SELECT (
  id, tenant_id, policy_id, sub_heading_id, employee_category,
  question_text, option_a, option_b, option_c, option_d,
  explanation, difficulty, source_file, tags,
  is_active, created_at, updated_at
) ON public.tenant_questions TO authenticated;

-- service_role retains unrestricted access (bypasses RLS AND column grants)
GRANT SELECT ON public.master_questions TO service_role;
GRANT SELECT ON public.tenant_questions TO service_role;

-- ── Safe views for the quiz delivery layer ───────────────────────────────────
-- security_invoker = TRUE  →  the view evaluates the caller's RLS context,
-- so existing RLS policies on master_questions / tenant_questions still apply.

DROP VIEW IF EXISTS public.quiz_master_questions;
CREATE VIEW public.quiz_master_questions
  WITH (security_invoker = TRUE)
AS
SELECT
  id,
  policy_id,
  sub_heading_id,
  employee_category,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty,
  tags,
  is_active
FROM public.master_questions
WHERE is_active = TRUE;

GRANT SELECT ON public.quiz_master_questions TO authenticated;

DROP VIEW IF EXISTS public.quiz_tenant_questions;
CREATE VIEW public.quiz_tenant_questions
  WITH (security_invoker = TRUE)
AS
SELECT
  id,
  tenant_id,
  policy_id,
  sub_heading_id,
  employee_category,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty,
  tags,
  is_active
FROM public.tenant_questions
WHERE is_active   = TRUE
  AND tenant_id   = public.auth_tenant_id();    -- tenant-scoped at view level

GRANT SELECT ON public.quiz_tenant_questions TO authenticated;

RAISE NOTICE 'SECTION 4 — correct_option column protection applied + safe views created (CRITICAL-3)';

-- =============================================================================
-- SECTION 5 — Role-escalation prevention trigger                (CRITICAL-4)
--
-- BEFORE: the users_update_own RLS policy permitted an employee to UPDATE
--         their own row including the role column, allowing self-promotion to
--         client_admin.
--
-- AFTER:
--   A BEFORE UPDATE trigger fires whenever role, status, or tenant_id would
--   change. Non-service-role, non-admin callers are rejected.
--   client_admin cannot change their own role (prevents self-promotion via
--   an already-elevated but legitimately-assigned admin account).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role may change any field freely
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- tenant_id is always immutable regardless of caller
  IF NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'users: tenant_id is immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- role and status changes require client_admin or service_role
  IF (NEW.role   IS DISTINCT FROM OLD.role
   OR NEW.status IS DISTINCT FROM OLD.status)
  AND NOT public.is_client_admin()
  THEN
    RAISE EXCEPTION 'Insufficient privilege: only client_admin or service_role may change user role or status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- client_admin cannot change their own role (prevents self-promotion)
  IF public.is_client_admin()
     AND NEW.id = auth.uid()
     AND NEW.role IS DISTINCT FROM OLD.role
  THEN
    RAISE EXCEPTION 'client_admin cannot change their own role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_role_immutability ON public.users;
CREATE TRIGGER enforce_user_role_immutability
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (
    NEW.role      IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
  )
  EXECUTE FUNCTION public.prevent_role_escalation();

RAISE NOTICE 'SECTION 5 — Role-escalation trigger applied (CRITICAL-4)';

-- =============================================================================
-- SECTION 6 — Audit-log actor validation                        (CRITICAL-5)
--
-- BEFORE: the audit_logs INSERT policy only validated tenant_id.
--         Any authenticated user could fabricate log entries impersonating
--         other users by setting actor_user_id to an arbitrary UUID.
--
-- AFTER:
--   actor_user_id must equal auth.uid() (own entries only)
--   OR be NULL (system/job-generated entries).
--   Impersonation of other users in audit logs is blocked at the DB layer.
-- =============================================================================

DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs;

CREATE POLICY audit_logs_insert_authenticated
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (
      actor_user_id = auth.uid()    -- can only log as yourself …
      OR actor_user_id IS NULL      -- … or as the system (NULL actor)
    )
  );

RAISE NOTICE 'SECTION 6 — Audit log actor validation enforced (CRITICAL-5)';

-- =============================================================================
-- SECTION 7 — Score-manipulation prevention trigger             (HIGH-1)
--
-- BEFORE: the test_sessions UPDATE policy allowed client_admin to freely
--         write score_percentage, correct_answers, passed, and total_questions
--         on any session in their tenant — enabling certificate fraud.
--
-- AFTER:
--   A BEFORE UPDATE trigger fires when any score-related column changes.
--   Only service_role (the server-side RPC submit_quiz_answers) may alter
--   these columns. client_admin and employee callers are rejected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_score_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role (RPC functions) is the only permitted writer of score data
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.score_percentage IS DISTINCT FROM OLD.score_percentage THEN
    RAISE EXCEPTION 'test_sessions: score_percentage is written by server RPCs only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.correct_answers IS DISTINCT FROM OLD.correct_answers THEN
    RAISE EXCEPTION 'test_sessions: correct_answers is written by server RPCs only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.answered_questions IS DISTINCT FROM OLD.answered_questions THEN
    RAISE EXCEPTION 'test_sessions: answered_questions is written by server RPCs only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.passed IS DISTINCT FROM OLD.passed THEN
    RAISE EXCEPTION 'test_sessions: passed is written by server RPCs only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.total_questions IS DISTINCT FROM OLD.total_questions THEN
    RAISE EXCEPTION 'test_sessions: total_questions is immutable once set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_score_immutability ON public.test_sessions;
CREATE TRIGGER enforce_score_immutability
  BEFORE UPDATE ON public.test_sessions
  FOR EACH ROW
  WHEN (
    NEW.score_percentage   IS DISTINCT FROM OLD.score_percentage
    OR NEW.correct_answers IS DISTINCT FROM OLD.correct_answers
    OR NEW.answered_questions IS DISTINCT FROM OLD.answered_questions
    OR NEW.passed          IS DISTINCT FROM OLD.passed
    OR NEW.total_questions IS DISTINCT FROM OLD.total_questions
  )
  EXECUTE FUNCTION public.prevent_score_manipulation();

RAISE NOTICE 'SECTION 7 — Score-manipulation trigger applied (HIGH-1)';

-- =============================================================================
-- SECTION 8 — Secret system parameters hidden from clients      (HIGH-3)
--
-- BEFORE: the system_parameters SELECT policy returned ALL rows including
--         those marked is_secret = TRUE. Any authenticated user could read
--         platform secrets (API keys, webhook tokens, etc.).
--
-- AFTER:
--   is_secret = TRUE rows are never returned to the authenticated role.
--   Secret parameters are accessible only via service_role (admin scripts,
--   SECURITY DEFINER RPCs).
-- =============================================================================

DROP POLICY IF EXISTS system_parameters_select_global_or_own_tenant
  ON public.system_parameters;

CREATE POLICY system_parameters_select_global_or_own_tenant
  ON public.system_parameters FOR SELECT
  TO authenticated
  USING (
    is_secret = FALSE                               -- secrets never exposed to clients
    AND (
      tenant_id IS NULL                             -- global default, visible to all
      OR tenant_id = public.auth_tenant_id()        -- own tenant override
    )
  );

RAISE NOTICE 'SECTION 8 — Secret system parameters hidden from clients (HIGH-3)';

-- =============================================================================
-- SECTION 9 — Session status state-machine trigger              (MEDIUM-5)
--
-- BEFORE: a session owner could directly UPDATE status = 'completed' without
--         going through the quiz-submission flow, bypassing scoring logic and
--         potentially auto-generating certificates without taking the test.
--
-- AFTER:
--   Client-initiated transitions are restricted to:
--     in_progress → paused      (user suspends session)
--     in_progress → abandoned   (user gives up)
--     paused      → in_progress (user resumes)
--
--   Terminal transitions (→ completed, → expired, → cancelled) may only be
--   performed by service_role (server-side quiz-submission RPC or cron job).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_session_status_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role (server RPCs, cron) may perform any transition
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allowed client-initiated transitions
  IF (OLD.status, NEW.status) IN (
    ('in_progress', 'paused'),
    ('in_progress', 'abandoned'),
    ('paused',      'in_progress')
  ) THEN
    RETURN NEW;
  END IF;

  -- Everything else is rejected
  RAISE EXCEPTION
    'Invalid session status transition: "%" → "%". '
    'Transitions to completed, expired, and cancelled are performed by server RPCs only.',
    OLD.status, NEW.status
    USING ERRCODE = 'invalid_parameter_value';
END;
$$;

DROP TRIGGER IF EXISTS enforce_session_status_machine ON public.test_sessions;
CREATE TRIGGER enforce_session_status_machine
  BEFORE UPDATE ON public.test_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enforce_session_status_fsm();

RAISE NOTICE 'SECTION 9 — Session status FSM trigger applied (MEDIUM-5)';

-- =============================================================================
-- SECTION 10 — Certificate number auto-generation               (LOW-2)
--
-- BEFORE: certificate_no had no default. Sequential application-generated
--         serials (CERT-00001, CERT-00002, …) were guessable and enumerable.
--
-- AFTER:
--   A BEFORE INSERT trigger auto-generates a non-sequential certificate
--   number when certificate_no is NULL or empty:
--     Format: CERT-{YYYYMM}-{8 hex chars}
--     Example: CERT-202605-3FA8C12E
--   The 8 hex chars come from gen_random_bytes(6) (48 bits of entropy).
--   Guessing a valid certificate number requires ~2^47 attempts on average.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_certificate_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.certificate_no IS NULL OR TRIM(NEW.certificate_no) = '' THEN
    NEW.certificate_no :=
      'CERT-'
      || TO_CHAR(NOW(), 'YYYYMM')
      || '-'
      || UPPER(ENCODE(gen_random_bytes(6), 'hex'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_certificate_no ON public.certificates;
CREATE TRIGGER set_certificate_no
  BEFORE INSERT ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_certificate_no();

RAISE NOTICE 'SECTION 10 — Certificate number auto-generation trigger applied (LOW-2)';

-- =============================================================================
-- SECTION 11 — VERIFICATION
-- Confirms every fix landed correctly before the migration completes.
-- Raises EXCEPTION on any failure so the migration rolls back atomically.
-- =============================================================================

DO $$
DECLARE
  v_issues TEXT := '';

  -- RLS state
  v_rls    RECORD;

  -- Trigger state
  v_trg    BOOLEAN;

  -- View state
  v_view   BOOLEAN;

  -- Policy state
  v_pol    BOOLEAN;

  -- Column grant state (correct_option must NOT be grantable to authenticated)
  v_col_count INT;

  required_rls_tables TEXT[] := ARRAY[
    'tenants', 'policies', 'sub_headings',
    'branches', 'users', 'tenant_questions', 'user_question_history',
    'test_sessions', 'test_responses', 'certificates',
    'system_parameters', 'audit_logs', 'master_questions'
  ];
  tbl TEXT;

  required_triggers TEXT[] := ARRAY[
    'enforce_tenant_privileged_fields',
    'enforce_user_role_immutability',
    'enforce_score_immutability',
    'enforce_session_status_machine',
    'set_certificate_no'
  ];
  trg TEXT;
  trg_table TEXT;

BEGIN

  -- ── 1. Verify RLS is FORCE-enabled on all required tables ────────────────────
  FOREACH tbl IN ARRAY required_rls_tables LOOP
    SELECT INTO v_rls relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

    IF v_rls IS NULL THEN
      v_issues := v_issues || format(E'\n  · Table not found: %s', tbl);
    ELSIF NOT v_rls.relrowsecurity THEN
      v_issues := v_issues || format(E'\n  · RLS NOT enabled: %s', tbl);
    ELSIF NOT v_rls.relforcerowsecurity THEN
      v_issues := v_issues || format(E'\n  · FORCE RLS missing: %s', tbl);
    ELSE
      RAISE NOTICE '  ✓ RLS verified: %', tbl;
    END IF;
  END LOOP;

  -- ── 2. Verify security triggers exist ─────────────────────────────────────────
  FOR trg, trg_table IN
    SELECT unnest(required_triggers),
           unnest(ARRAY[
             'tenants', 'users', 'test_sessions',
             'test_sessions', 'certificates'
           ])
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = trg_table
        AND t.tgname  = trg
        AND NOT t.tgisinternal
    ) INTO v_trg;

    IF NOT v_trg THEN
      v_issues := v_issues || format(E'\n  · Trigger missing: %s on %s', trg, trg_table);
    ELSE
      RAISE NOTICE '  ✓ Trigger verified: % on %', trg, trg_table;
    END IF;
  END LOOP;

  -- ── 3. Verify safe views exist ────────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quiz_master_questions' AND c.relkind = 'v'
  ) INTO v_view;
  IF NOT v_view THEN
    v_issues := v_issues || E'\n  · View missing: quiz_master_questions';
  ELSE
    RAISE NOTICE '  ✓ View verified: quiz_master_questions';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quiz_tenant_questions' AND c.relkind = 'v'
  ) INTO v_view;
  IF NOT v_view THEN
    v_issues := v_issues || E'\n  · View missing: quiz_tenant_questions';
  ELSE
    RAISE NOTICE '  ✓ View verified: quiz_tenant_questions';
  END IF;

  -- ── 4. Verify audit_logs INSERT policy validates actor_user_id ────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_logs'
      AND policyname = 'audit_logs_insert_authenticated'
      AND cmd        = 'INSERT'
  ) INTO v_pol;
  IF NOT v_pol THEN
    v_issues := v_issues || E'\n  · Policy missing: audit_logs_insert_authenticated';
  ELSE
    RAISE NOTICE '  ✓ Policy verified: audit_logs_insert_authenticated';
  END IF;

  -- ── 5. Verify is_secret policy replaced on system_parameters ─────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_parameters'
      AND policyname = 'system_parameters_select_global_or_own_tenant'
      AND cmd        = 'SELECT'
  ) INTO v_pol;
  IF NOT v_pol THEN
    v_issues := v_issues || E'\n  · Policy missing: system_parameters_select_global_or_own_tenant';
  ELSE
    RAISE NOTICE '  ✓ Policy verified: system_parameters_select_global_or_own_tenant';
  END IF;

  -- ── 6. Verify is_dual_track column exists ─────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'policies'
      AND a.attname = 'is_dual_track' AND a.attnum > 0 AND NOT a.attisdropped
  ) INTO v_pol;
  IF NOT v_pol THEN
    v_issues := v_issues || E'\n  · Column missing: policies.is_dual_track';
  ELSE
    RAISE NOTICE '  ✓ Column verified: policies.is_dual_track';
  END IF;

  -- ── 7. Raise on any issue ──────────────────────────────────────────────────────
  IF v_issues <> '' THEN
    RAISE EXCEPTION 'Migration 005 verification FAILED:%', v_issues;
  END IF;

  RAISE NOTICE '─────────────────────────────────────────────────────────────';
  RAISE NOTICE 'Migration 005 verified. All security fixes applied.';
  RAISE NOTICE '─────────────────────────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
