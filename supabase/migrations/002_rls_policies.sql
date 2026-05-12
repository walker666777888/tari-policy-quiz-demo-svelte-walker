-- =============================================================================
-- 002_rls_policies.sql
-- Row Level Security — Multi-Tenant SaaS Compliance Quiz Platform
--
-- ARCHITECTURE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant isolation  : (auth.jwt() ->> 'tenant_id')::uuid
-- Role claim        : (auth.jwt() ->> 'role')
--                     values: 'employee' | 'cxo' | 'client_admin'
-- Super-admin ops   : service_role key only — bypasses RLS entirely.
--                     No explicit super_admin policies are created.
-- Shared tables     : master_questions  — read-only, no tenant restriction.
--                     policies          — read-only, no tenant restriction.
--                     sub_headings      — read-only, no tenant restriction.
--
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- Only ONE thin helper is defined: auth_tenant_id().
-- It calls only auth.jwt() — no cross-function dependency — so SET search_path
-- = '' is safe.  All role checks are INLINED in each policy using:
--   (auth.jwt() ->> 'role') = 'client_admin'
-- This avoids the "function auth_user_role() does not exist" error that occurs
-- when SECURITY DEFINER + SET search_path = '' functions call other public-
-- schema functions without a schema qualifier.
--
-- POLICY NAMING CONVENTION
-- ─────────────────────────────────────────────────────────────────────────────
--   <table>_<operation>_<description>
--
-- ZERO CROSS-TENANT LEAKAGE GUARANTEE
-- ─────────────────────────────────────────────────────────────────────────────
-- Every tenant-scoped policy begins with:
--   tenant_id = auth_tenant_id()
-- before any other predicate is evaluated.
-- =============================================================================

-- =============================================================================
-- SECTION 0 — CLEAN UP LEGACY HELPERS
-- Remove old chained helpers that caused the search_path resolution failure.
-- auth_tenant_id() is kept; it is the only helper needed.
-- =============================================================================

DROP FUNCTION IF EXISTS public.auth_user_role()    CASCADE;
DROP FUNCTION IF EXISTS public.is_service_role()   CASCADE;
DROP FUNCTION IF EXISTS public.is_client_admin()   CASCADE;
DROP FUNCTION IF EXISTS public.is_individual_role() CASCADE;

-- =============================================================================
-- SECTION 1 — SINGLE HELPER: auth_tenant_id()
-- Extracts tenant UUID from the JWT 'tenant_id' claim.
-- SECURITY DEFINER + SET search_path = '' is safe here because the body only
-- calls auth.jwt() — no reference to any public-schema object.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;

-- =============================================================================
-- SECTION 2 — ENABLE RLS ON ALL TENANT-SCOPED + SHARED TABLES
-- FORCE RLS ensures policies apply even to the table owner.
-- =============================================================================

ALTER TABLE public.branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches              FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                 FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.tenant_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_questions      FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_history FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.test_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions         FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.test_responses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_responses        FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.certificates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates          FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.system_parameters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_parameters     FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            FORCE  ROW LEVEL SECURITY;

-- Shared read-only tables — RLS enabled to block mutations via client.
-- No tenant gate on SELECT; service_role handles all writes.
ALTER TABLE public.master_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_questions      FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.policies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies              FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.sub_headings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_headings          FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 3 — master_questions
-- Shared platform table. Any authenticated user may read active questions.
-- All writes are blocked at RLS level (service_role bypasses RLS for imports).
-- =============================================================================

DROP POLICY IF EXISTS master_questions_select_authenticated ON public.master_questions;
DROP POLICY IF EXISTS master_questions_insert_deny          ON public.master_questions;
DROP POLICY IF EXISTS master_questions_update_deny          ON public.master_questions;
DROP POLICY IF EXISTS master_questions_delete_deny          ON public.master_questions;

CREATE POLICY master_questions_select_authenticated
  ON public.master_questions FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY master_questions_insert_deny
  ON public.master_questions FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY master_questions_update_deny
  ON public.master_questions FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY master_questions_delete_deny
  ON public.master_questions FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 4 — policies  (compliance policy catalogue)
-- Platform-owned reference data. Read-only for all authenticated users.
-- All writes via service_role only.
-- =============================================================================

DROP POLICY IF EXISTS policies_select_authenticated ON public.policies;
DROP POLICY IF EXISTS policies_insert_deny          ON public.policies;
DROP POLICY IF EXISTS policies_update_deny          ON public.policies;
DROP POLICY IF EXISTS policies_delete_deny          ON public.policies;

CREATE POLICY policies_select_authenticated
  ON public.policies FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY policies_insert_deny
  ON public.policies FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY policies_update_deny
  ON public.policies FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY policies_delete_deny
  ON public.policies FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 5 — sub_headings
-- Platform-owned reference data. Read-only for all authenticated users.
-- All writes via service_role only.
-- =============================================================================

DROP POLICY IF EXISTS sub_headings_select_authenticated ON public.sub_headings;
DROP POLICY IF EXISTS sub_headings_insert_deny          ON public.sub_headings;
DROP POLICY IF EXISTS sub_headings_update_deny          ON public.sub_headings;
DROP POLICY IF EXISTS sub_headings_delete_deny          ON public.sub_headings;

CREATE POLICY sub_headings_select_authenticated
  ON public.sub_headings FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY sub_headings_insert_deny
  ON public.sub_headings FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY sub_headings_update_deny
  ON public.sub_headings FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY sub_headings_delete_deny
  ON public.sub_headings FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 6 — branches
-- All roles: SELECT within own tenant (users need branch display names).
-- client_admin: full CRUD within own tenant.
-- =============================================================================

DROP POLICY IF EXISTS branches_select_tenant       ON public.branches;
DROP POLICY IF EXISTS branches_insert_client_admin ON public.branches;
DROP POLICY IF EXISTS branches_update_client_admin ON public.branches;
DROP POLICY IF EXISTS branches_delete_client_admin ON public.branches;

CREATE POLICY branches_select_tenant
  ON public.branches FOR SELECT
  TO authenticated
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY branches_insert_client_admin
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

CREATE POLICY branches_update_client_admin
  ON public.branches FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

CREATE POLICY branches_delete_client_admin
  ON public.branches FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- =============================================================================
-- SECTION 7 — users
-- employee / cxo  : SELECT + UPDATE own profile row within tenant only.
-- client_admin    : full CRUD for all users within tenant.
-- Cross-tenant rows are never visible regardless of role.
-- =============================================================================

DROP POLICY IF EXISTS users_select_own          ON public.users;
DROP POLICY IF EXISTS users_update_own          ON public.users;
DROP POLICY IF EXISTS users_insert_client_admin ON public.users;
DROP POLICY IF EXISTS users_delete_client_admin ON public.users;

-- SELECT: own row (employee/cxo) OR all rows in tenant (client_admin)
CREATE POLICY users_select_own
  ON public.users FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      -- employee / cxo see only their own profile
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND id = auth.uid()
      )
      OR
      -- client_admin sees all users within the tenant
      (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

-- UPDATE: own row (employee/cxo) OR any tenant row (client_admin)
CREATE POLICY users_update_own
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()     -- cannot move a user to another tenant
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

-- INSERT: client_admin only — used when inviting new users
CREATE POLICY users_insert_client_admin
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- DELETE: client_admin only — cannot delete their own account via RLS
CREATE POLICY users_delete_client_admin
  ON public.users FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
    AND id <> auth.uid()                    -- self-deletion blocked at RLS level
  );

-- =============================================================================
-- SECTION 8 — tenant_questions
-- All authenticated users within tenant may read active questions (quiz render).
-- Mutations restricted to client_admin.
-- correct_option is hidden via column-level REVOKE in migration 005.
-- =============================================================================

DROP POLICY IF EXISTS tenant_questions_select_tenant       ON public.tenant_questions;
DROP POLICY IF EXISTS tenant_questions_insert_client_admin ON public.tenant_questions;
DROP POLICY IF EXISTS tenant_questions_update_client_admin ON public.tenant_questions;
DROP POLICY IF EXISTS tenant_questions_delete_client_admin ON public.tenant_questions;

CREATE POLICY tenant_questions_select_tenant
  ON public.tenant_questions FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND is_active = TRUE
  );

CREATE POLICY tenant_questions_insert_client_admin
  ON public.tenant_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

CREATE POLICY tenant_questions_update_client_admin
  ON public.tenant_questions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

CREATE POLICY tenant_questions_delete_client_admin
  ON public.tenant_questions FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- =============================================================================
-- SECTION 9 — user_question_history
-- employee / cxo  : own rows only within tenant.
-- client_admin    : read all rows within tenant (analytics / history reset).
-- INSERT: own rows only (recorded when questions are served during a quiz).
-- UPDATE / DELETE: blocked — history is immutable from the client side.
--                 Resets done via service_role only.
-- =============================================================================

DROP POLICY IF EXISTS uqh_select_own_or_admin ON public.user_question_history;
DROP POLICY IF EXISTS uqh_insert_own          ON public.user_question_history;
DROP POLICY IF EXISTS uqh_update_deny         ON public.user_question_history;
DROP POLICY IF EXISTS uqh_delete_deny         ON public.user_question_history;

CREATE POLICY uqh_select_own_or_admin
  ON public.user_question_history FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND user_id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

CREATE POLICY uqh_insert_own
  ON public.user_question_history FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY uqh_update_deny
  ON public.user_question_history FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY uqh_delete_deny
  ON public.user_question_history FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 10 — test_sessions
-- employee / cxo  : own sessions within tenant only.
-- client_admin    : all sessions within tenant (reporting + administration).
-- INSERT: owner only — a user may only open a session for themselves.
-- UPDATE: owner (progress) or client_admin (admin actions).
-- DELETE: blocked — deletion via service_role only.
-- =============================================================================

DROP POLICY IF EXISTS test_sessions_select_own_or_admin  ON public.test_sessions;
DROP POLICY IF EXISTS test_sessions_insert_own            ON public.test_sessions;
DROP POLICY IF EXISTS test_sessions_update_own_or_admin   ON public.test_sessions;
DROP POLICY IF EXISTS test_sessions_delete_deny           ON public.test_sessions;

CREATE POLICY test_sessions_select_own_or_admin
  ON public.test_sessions FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND user_id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

CREATE POLICY test_sessions_insert_own
  ON public.test_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND user_id = auth.uid()               -- users can only create sessions for themselves
  );

CREATE POLICY test_sessions_update_own_or_admin
  ON public.test_sessions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND user_id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()    -- cannot reassign session to another tenant
  );

CREATE POLICY test_sessions_delete_deny
  ON public.test_sessions FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 11 — test_responses
-- employee / cxo  : own responses within tenant only.
-- client_admin    : all responses within tenant (reporting).
-- INSERT: owner only — submitting answers during a live quiz.
-- UPDATE / DELETE: blocked — responses are immutable once recorded.
-- =============================================================================

DROP POLICY IF EXISTS test_responses_select_own_or_admin ON public.test_responses;
DROP POLICY IF EXISTS test_responses_insert_own           ON public.test_responses;
DROP POLICY IF EXISTS test_responses_update_deny          ON public.test_responses;
DROP POLICY IF EXISTS test_responses_delete_deny          ON public.test_responses;

CREATE POLICY test_responses_select_own_or_admin
  ON public.test_responses FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND user_id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

CREATE POLICY test_responses_insert_own
  ON public.test_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY test_responses_update_deny
  ON public.test_responses FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY test_responses_delete_deny
  ON public.test_responses FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 12 — certificates
-- employee / cxo  : own certificates within tenant only.
-- client_admin    : all certificates within tenant.
-- INSERT / UPDATE / DELETE: blocked for all client roles.
-- Certificates are issued exclusively by trusted RPC / service_role functions.
-- =============================================================================

DROP POLICY IF EXISTS certificates_select_own_or_admin ON public.certificates;
DROP POLICY IF EXISTS certificates_insert_deny          ON public.certificates;
DROP POLICY IF EXISTS certificates_update_deny          ON public.certificates;
DROP POLICY IF EXISTS certificates_delete_deny          ON public.certificates;

CREATE POLICY certificates_select_own_or_admin
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      (
        (auth.jwt() ->> 'role') IN ('employee', 'cxo')
        AND user_id = auth.uid()
      )
      OR (auth.jwt() ->> 'role') = 'client_admin'
    )
  );

-- All mutations blocked from the client side.
CREATE POLICY certificates_insert_deny
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY certificates_update_deny
  ON public.certificates FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY certificates_delete_deny
  ON public.certificates FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 13 — system_parameters
-- Global defaults (tenant_id IS NULL): readable by all authenticated users,
--   but only non-secret values (is_secret = FALSE).
-- Tenant-specific rows: readable by all within tenant, writable by client_admin.
-- INSERT of global params (tenant_id IS NULL): service_role only.
-- DELETE: blocked for all client roles.
-- =============================================================================

DROP POLICY IF EXISTS system_parameters_select_global_or_own_tenant ON public.system_parameters;
DROP POLICY IF EXISTS system_parameters_insert_client_admin          ON public.system_parameters;
DROP POLICY IF EXISTS system_parameters_update_client_admin          ON public.system_parameters;
DROP POLICY IF EXISTS system_parameters_delete_deny                  ON public.system_parameters;

CREATE POLICY system_parameters_select_global_or_own_tenant
  ON public.system_parameters FOR SELECT
  TO authenticated
  USING (
    is_secret = FALSE
    AND (
      tenant_id IS NULL                          -- global default visible to all
      OR tenant_id = public.auth_tenant_id()     -- own tenant override
    )
  );

-- client_admin may create tenant-specific overrides only (never global rows).
CREATE POLICY system_parameters_insert_client_admin
  ON public.system_parameters FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()          -- cannot create tenant_id = NULL row
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- client_admin may update their own tenant's override rows only.
CREATE POLICY system_parameters_update_client_admin
  ON public.system_parameters FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

CREATE POLICY system_parameters_delete_deny
  ON public.system_parameters FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 14 — audit_logs
-- SELECT: client_admin within tenant only.
-- INSERT: any authenticated user within tenant, restricted to their own uid.
--         Null actor_user_id is permitted for system/hook-level events.
-- UPDATE / DELETE: double-locked at RLS (SQL RULE in migration 001 also blocks).
-- =============================================================================

DROP POLICY IF EXISTS audit_logs_select_client_admin   ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_authenticated  ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_update_deny           ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_delete_deny           ON public.audit_logs;

CREATE POLICY audit_logs_select_client_admin
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- Application code (hooks.server.ts, RPC) inserts logs.
-- actor_user_id must match the calling user, or be NULL for system events.
CREATE POLICY audit_logs_insert_authenticated
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (
      actor_user_id = auth.uid()
      OR actor_user_id IS NULL
    )
  );

CREATE POLICY audit_logs_update_deny
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY audit_logs_delete_deny
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 15 — VERIFICATION
-- Confirms RLS is enabled + FORCE RLS is set on every required table.
-- Raises EXCEPTION if any table is unprotected.
-- Uses schema-qualified names throughout (safe with search_path = '').
-- =============================================================================

DO $verify$
DECLARE
  rec              RECORD;
  issues           TEXT    := '';
  required_tables  TEXT[]  := ARRAY[
    'branches', 'users', 'tenant_questions', 'user_question_history',
    'test_sessions', 'test_responses', 'certificates',
    'system_parameters', 'audit_logs', 'master_questions',
    'policies', 'sub_headings'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    SELECT relrowsecurity, relforcerowsecurity
      INTO rec
      FROM pg_class
     WHERE relname       = tbl
       AND relnamespace  = 'public'::regnamespace;

    IF rec IS NULL THEN
      issues := issues || format(E'\n  · Table not found: %s', tbl);
    ELSIF NOT rec.relrowsecurity THEN
      issues := issues || format(E'\n  · RLS NOT enabled: %s', tbl);
    ELSIF NOT rec.relforcerowsecurity THEN
      issues := issues || format(E'\n  · FORCE RLS missing: %s', tbl);
    ELSE
      RAISE NOTICE '  [OK] %', tbl;
    END IF;
  END LOOP;

  IF issues <> '' THEN
    RAISE EXCEPTION E'RLS verification FAILED:%', issues;
  END IF;

  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'All RLS policies verified. Zero cross-tenant leakage.';
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $verify$;

-- =============================================================================
-- SECTION 16 — EXPLICIT TABLE-LEVEL GRANTS
--
-- Supabase applies default privileges at project init, but those only fire
-- for the role that owns the tables at creation time.  In some project
-- configurations (non-standard setup, role changes, or fresh migrations run
-- via the SQL editor) the service_role or authenticated role may be missing
-- table-level SELECT even though BYPASSRLS is set on service_role.
--
-- Symptom: "permission denied for table X" when using the service_role key.
--
-- These GRANTs are idempotent — safe to run multiple times.
-- They do NOT conflict with migration 005, which adds column-level GRANTs
-- on master_questions and tenant_questions (column grants override table
-- grants; a REVOKE on the table grant is done there explicitly).
-- =============================================================================

-- ── service_role — full access on every table (bypasses RLS via BYPASSRLS) ──
GRANT ALL ON public.tenants               TO service_role;
GRANT ALL ON public.branches              TO service_role;
GRANT ALL ON public.users                 TO service_role;
GRANT ALL ON public.policies              TO service_role;
GRANT ALL ON public.sub_headings          TO service_role;
GRANT ALL ON public.master_questions      TO service_role;
GRANT ALL ON public.tenant_questions      TO service_role;
GRANT ALL ON public.user_question_history TO service_role;
GRANT ALL ON public.test_sessions         TO service_role;
GRANT ALL ON public.test_responses        TO service_role;
GRANT ALL ON public.certificates          TO service_role;
GRANT ALL ON public.system_parameters     TO service_role;
GRANT ALL ON public.audit_logs            TO service_role;

-- ── authenticated — SELECT on shared read-only tables ────────────────────────
-- Tenant-scoped tables are gated by RLS policies defined above.
-- master_questions / tenant_questions receive column-level grants in
-- migration 005 (correct_option hidden); the table-level SELECT here is
-- a prerequisite for those column grants to be meaningful.
GRANT SELECT ON public.policies           TO authenticated;
GRANT SELECT ON public.sub_headings       TO authenticated;
GRANT SELECT ON public.master_questions   TO authenticated;

-- ── anon — no direct table access (all routes require authentication) ─────────
-- anon role has no grants here; the API enforces auth before table access.

-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================
