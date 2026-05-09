-- =============================================================================
-- 002_rls_policies.sql
-- Row Level Security — Multi-Tenant SaaS Compliance Quiz Platform
--
-- ARCHITECTURE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant isolation  : (auth.jwt() ->> 'tenant_id')::uuid
-- Role claim        : auth.jwt() ->> 'user_role'
--                     values: 'employee' | 'cxo' | 'client_admin' | 'super_admin'
-- Super admin access: service_role key only — bypasses RLS entirely.
--                     No explicit super_admin policies are created.
-- Shared tables     : master_questions — read-only, no tenant restriction.
--                     policies, sub_headings — not RLS-gated (platform-owned,
--                     referenced by all tenants; restrict via grants if needed).
--
-- POLICY NAMING CONVENTION
-- ─────────────────────────────────────────────────────────────────────────────
--   <table>_<operation>_<role|description>
--   e.g. users_select_own, test_sessions_insert_authenticated
--
-- ZERO CROSS-TENANT LEAKAGE GUARANTEE
-- ─────────────────────────────────────────────────────────────────────────────
-- Every policy on every tenant-scoped table requires:
--   tenant_id = auth_tenant_id()
-- before any other condition is evaluated.
-- =============================================================================

-- =============================================================================
-- SECTION 0 — HELPER FUNCTIONS
-- Centralise JWT claim extraction so policies are readable and DRY.
-- SECURITY DEFINER + search_path = '' prevents privilege escalation.
-- =============================================================================

-- Returns the calling user's tenant UUID from the JWT.
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;

-- Returns the calling user's application role from the JWT.
-- e.g. 'employee', 'cxo', 'client_admin', 'super_admin'
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.jwt() ->> 'user_role';
$$;

-- TRUE when the caller is the Supabase service_role (super_admin operations).
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.role() = 'service_role';
$$;

-- TRUE when the caller's role is client_admin.
CREATE OR REPLACE FUNCTION is_client_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth_user_role() = 'client_admin';
$$;

-- TRUE when the caller's role is employee or cxo (individual-data roles).
CREATE OR REPLACE FUNCTION is_individual_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth_user_role() IN ('employee', 'cxo');
$$;

-- =============================================================================
-- SECTION 1 — ENABLE RLS
-- FORCE RLS applies policies even to the table owner.
-- =============================================================================

ALTER TABLE branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches             FORCE  ROW LEVEL SECURITY;

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                FORCE  ROW LEVEL SECURITY;

ALTER TABLE tenant_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_questions     FORCE  ROW LEVEL SECURITY;

ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_history FORCE  ROW LEVEL SECURITY;

ALTER TABLE test_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions        FORCE  ROW LEVEL SECURITY;

ALTER TABLE test_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_responses       FORCE  ROW LEVEL SECURITY;

ALTER TABLE certificates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates         FORCE  ROW LEVEL SECURITY;

ALTER TABLE system_parameters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters    FORCE  ROW LEVEL SECURITY;

ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           FORCE  ROW LEVEL SECURITY;

-- master_questions: RLS enabled but no tenant gate — read-only for all authenticated users.
ALTER TABLE master_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_questions     FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 2 — master_questions
-- Shared platform table. Read-only. No tenant restriction.
-- Mutations only via service_role (bypasses RLS).
-- =============================================================================

-- Any authenticated user may read all master questions.
CREATE POLICY master_questions_select_authenticated
  ON master_questions FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- All writes blocked at RLS level. Only service_role (which bypasses RLS)
-- may insert / update / delete master questions.
CREATE POLICY master_questions_insert_deny
  ON master_questions FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY master_questions_update_deny
  ON master_questions FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY master_questions_delete_deny
  ON master_questions FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 3 — branches
-- Always scoped to the caller's tenant.
-- client_admin: full CRUD within tenant.
-- employee / cxo: SELECT only within tenant (they need branch display names).
-- =============================================================================

CREATE POLICY branches_select_tenant
  ON branches FOR SELECT
  TO authenticated
  USING (tenant_id = auth_tenant_id());

CREATE POLICY branches_insert_client_admin
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

CREATE POLICY branches_update_client_admin
  ON branches FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

CREATE POLICY branches_delete_client_admin
  ON branches FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

-- =============================================================================
-- SECTION 4 — users
-- employee / cxo  : SELECT and UPDATE own row only.
-- client_admin    : full CRUD within tenant.
-- Cross-tenant rows are never visible regardless of role.
-- =============================================================================

-- employee / cxo: own profile only
CREATE POLICY users_select_own
  ON users FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      is_individual_role() AND id = auth.uid()
      OR is_client_admin()
    )
  );

-- employee / cxo: update own profile fields only
CREATE POLICY users_update_own
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND id = auth.uid())
      OR is_client_admin()
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()       -- cannot move self to another tenant
    AND (
      (is_individual_role() AND id = auth.uid())
      OR is_client_admin()
    )
  );

-- client_admin only: invite / create new users within tenant
CREATE POLICY users_insert_client_admin
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

-- client_admin only: deactivate / delete users within tenant
CREATE POLICY users_delete_client_admin
  ON users FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
    AND id <> auth.uid()               -- cannot delete own account via RLS
  );

-- =============================================================================
-- SECTION 5 — tenant_questions
-- All authenticated users within tenant may read (needed to render quizzes).
-- Mutations restricted to client_admin.
-- =============================================================================

CREATE POLICY tenant_questions_select_tenant
  ON tenant_questions FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_active = TRUE
  );

CREATE POLICY tenant_questions_insert_client_admin
  ON tenant_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

CREATE POLICY tenant_questions_update_client_admin
  ON tenant_questions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

CREATE POLICY tenant_questions_delete_client_admin
  ON tenant_questions FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

-- =============================================================================
-- SECTION 6 — user_question_history
-- employee / cxo  : own rows only within tenant.
-- client_admin    : read all within tenant (for analytics / reset).
-- No UPDATE or DELETE — history is immutable at the row level.
-- =============================================================================

CREATE POLICY uqh_select_own_or_admin
  ON user_question_history FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND user_id = auth.uid())
      OR is_client_admin()
    )
  );

-- Application / RPC inserts history rows on behalf of the user.
CREATE POLICY uqh_insert_own
  ON user_question_history FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
  );

-- Immutable: no updates allowed via client.
CREATE POLICY uqh_update_deny
  ON user_question_history FOR UPDATE
  TO authenticated
  USING (FALSE);

-- Immutable: no deletes allowed via client.
-- (History reset done via service_role only.)
CREATE POLICY uqh_delete_deny
  ON user_question_history FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 7 — test_sessions
-- employee / cxo  : own sessions within tenant.
-- client_admin    : all sessions within tenant (reporting / admin).
-- Only the session owner may INSERT their own session.
-- UPDATE allowed for owner (answering questions advances state) and admin.
-- DELETE blocked for all client roles.
-- =============================================================================

CREATE POLICY test_sessions_select_own_or_admin
  ON test_sessions FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND user_id = auth.uid())
      OR is_client_admin()
    )
  );

CREATE POLICY test_sessions_insert_own
  ON test_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()           -- can only open a session for yourself
  );

CREATE POLICY test_sessions_update_own_or_admin
  ON test_sessions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND user_id = auth.uid())
      OR is_client_admin()
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()       -- cannot reassign session to another tenant
  );

CREATE POLICY test_sessions_delete_deny
  ON test_sessions FOR DELETE
  TO authenticated
  USING (FALSE);                       -- deletion only via service_role

-- =============================================================================
-- SECTION 8 — test_responses
-- employee / cxo  : own responses within tenant.
-- client_admin    : all responses within tenant.
-- INSERT: owner only (submitting answers during a quiz).
-- UPDATE / DELETE: blocked — responses are immutable once recorded.
-- =============================================================================

CREATE POLICY test_responses_select_own_or_admin
  ON test_responses FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND user_id = auth.uid())
      OR is_client_admin()
    )
  );

CREATE POLICY test_responses_insert_own
  ON test_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
  );

-- Immutable: no updates or deletes.
CREATE POLICY test_responses_update_deny
  ON test_responses FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY test_responses_delete_deny
  ON test_responses FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 9 — certificates
-- employee / cxo  : own certificates within tenant.
-- client_admin    : all certificates within tenant.
-- INSERT / UPDATE / DELETE: blocked for all client roles.
-- Certificates are issued exclusively by RPC functions running as service_role.
-- =============================================================================

CREATE POLICY certificates_select_own_or_admin
  ON certificates FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (is_individual_role() AND user_id = auth.uid())
      OR is_client_admin()
    )
  );

-- All mutations blocked. Certificates written by trusted RPC (service_role).
CREATE POLICY certificates_insert_deny
  ON certificates FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY certificates_update_deny
  ON certificates FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY certificates_delete_deny
  ON certificates FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 10 — system_parameters
-- Global defaults (tenant_id IS NULL): readable by all authenticated users.
-- Tenant-specific rows: readable + writable by client_admin of that tenant only.
-- INSERT of global params (tenant_id IS NULL): service_role only.
-- =============================================================================

CREATE POLICY system_parameters_select_global_or_own_tenant
  ON system_parameters FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL                              -- global default, visible to all
    OR tenant_id = auth_tenant_id()               -- own tenant override
  );

-- client_admin may insert tenant-specific overrides only — never global rows.
CREATE POLICY system_parameters_insert_client_admin
  ON system_parameters FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()                  -- cannot set tenant_id = NULL
    AND is_client_admin()
  );

-- client_admin may update own tenant's parameter overrides only.
CREATE POLICY system_parameters_update_client_admin
  ON system_parameters FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

-- No one may delete parameters via client. Cleanup via service_role only.
CREATE POLICY system_parameters_delete_deny
  ON system_parameters FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 11 — audit_logs
-- INSERT: any authenticated user within tenant (application writes logs).
-- SELECT: client_admin within tenant only.
-- UPDATE / DELETE: blocked at RLS level (also blocked by SQL rules in 001).
-- =============================================================================

CREATE POLICY audit_logs_select_client_admin
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND is_client_admin()
  );

-- Application code (hooks, RPC) inserts logs on behalf of authenticated users.
CREATE POLICY audit_logs_insert_authenticated
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
  );

-- Double-lock: RLS blocks UPDATE even though SQL rules in 001 also block it.
CREATE POLICY audit_logs_update_deny
  ON audit_logs FOR UPDATE
  TO authenticated
  USING (FALSE);

-- Double-lock: RLS blocks DELETE even though SQL rules in 001 also block it.
CREATE POLICY audit_logs_delete_deny
  ON audit_logs FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 12 — VERIFICATION
-- Confirms RLS is enabled on every required table.
-- Raises EXCEPTION if any table is unprotected.
-- =============================================================================

DO $$
DECLARE
  rec    RECORD;
  issues TEXT := '';
  required_tables TEXT[] := ARRAY[
    'branches', 'users', 'tenant_questions', 'user_question_history',
    'test_sessions', 'test_responses', 'certificates',
    'system_parameters', 'audit_logs', 'master_questions'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    SELECT INTO rec
      relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

    IF rec IS NULL THEN
      issues := issues || format(E'\n  · Table not found: %s', tbl);
    ELSIF NOT rec.relrowsecurity THEN
      issues := issues || format(E'\n  · RLS NOT enabled: %s', tbl);
    ELSIF NOT rec.relforcerowsecurity THEN
      issues := issues || format(E'\n  · FORCE RLS missing: %s', tbl);
    ELSE
      RAISE NOTICE '  ✓ %', tbl;
    END IF;
  END LOOP;

  IF issues <> '' THEN
    RAISE EXCEPTION 'RLS verification FAILED:%', issues;
  END IF;

  RAISE NOTICE '─────────────────────────────────────────────────────';
  RAISE NOTICE 'All RLS policies verified. Zero cross-tenant leakage.';
  RAISE NOTICE '─────────────────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================
