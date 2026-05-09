-- =============================================================================
-- 001_initial_schema.sql
-- Multi-tenant SaaS Compliance Quiz Platform — Initial Schema
--
-- Execution order (required):
--   1. Extensions
--   2. Helper functions
--   3. All table definitions  (FK dependency order)
--   4. updated_at triggers    (after ALL tables exist)
--   5. Indexes
--   6. Append-only rules      (audit_logs)
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. HELPER FUNCTIONS
-- =============================================================================

-- Trigger body: stamps updated_at = NOW() on every UPDATE.
-- SECURITY DEFINER + SET search_path = '' prevents search-path injection
-- (this function fires on every UPDATE of every mutable table).
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
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

-- Attaches set_updated_at trigger to a named table.
-- public.%I and public.trigger_set_updated_at are fully schema-qualified
-- because SET search_path = '' means no implicit schema resolution.
CREATE OR REPLACE FUNCTION create_updated_at_trigger(tbl TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON public.%I
     FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at()',
    tbl
  );
END;
$$;

-- =============================================================================
-- 3. TABLE DEFINITIONS
--    Order respects FK dependencies:
--      tenants → branches → users
--      policies → sub_headings → master_questions
--                              → tenant_questions (also → tenants)
--      tenants + users + policies → user_question_history
--      tenants + users + branches + policies → test_sessions
--      test_sessions → test_responses
--      test_sessions → certificates
--      tenants → system_parameters
--      tenants + users → audit_logs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1  TENANTS
-- Top-level organisations (companies) using the platform.
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,               -- URL-safe identifier
  domain      TEXT,                                      -- optional SSO domain
  logo_url    TEXT,
  plan        TEXT        NOT NULL DEFAULT 'starter'
                          CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'cancelled')),
  max_users   INT         NOT NULL DEFAULT 100,
  settings    JSONB       NOT NULL DEFAULT '{}'::JSONB,  -- tenant-level config blob
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3.2  BRANCHES
-- Physical or logical branches within a tenant (offices, departments, etc.).
-- ---------------------------------------------------------------------------

CREATE TABLE branches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  code        TEXT,                                      -- short branch code
  location    TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, code)
);

-- ---------------------------------------------------------------------------
-- 3.3  USERS
-- Application users. id matches auth.users.id (Supabase Auth).
--
-- Role values MUST match the JWT 'user_role' custom claim used by every
-- RLS helper function (auth_user_role, is_client_admin, is_individual_role).
--   super_admin  — Tari platform staff; uses service_role key, bypasses RLS
--   client_admin — Tenant administrator; full CRUD within their tenant
--   cxo          — Executive viewer; read-only analytics + own sessions
--   employee     — Standard user; own sessions and quiz data only
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                UUID        PRIMARY KEY,             -- matches auth.users.id
  tenant_id         UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  branch_id         UUID                 REFERENCES branches (id) ON DELETE SET NULL,
  email             TEXT        NOT NULL,
  full_name         TEXT        NOT NULL,
  employee_id       TEXT,                                -- HR system reference
  employee_category TEXT        NOT NULL DEFAULT 'general'
                                CHECK (employee_category IN (
                                  'general', 'manager', 'executive',
                                  'teller', 'compliance_officer', 'it', 'other'
                                )),
  role              TEXT        NOT NULL DEFAULT 'employee'
                                CHECK (role IN (
                                  'super_admin',
                                  'client_admin',
                                  'cxo',
                                  'employee'
                                )),
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at     TIMESTAMPTZ,
  metadata          JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, employee_id)
);

-- ---------------------------------------------------------------------------
-- 3.4  POLICIES
-- Compliance policy areas (AML, KYC, COC, …). Shared platform-wide.
-- is_dual_track = TRUE → questions drawn from both master AND tenant banks.
-- ---------------------------------------------------------------------------

CREATE TABLE policies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL UNIQUE,             -- e.g. 'AML', 'KYC'
  title         TEXT        NOT NULL,
  description   TEXT,
  version       TEXT        NOT NULL DEFAULT '1.0',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  is_dual_track BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3.5  SUB_HEADINGS
-- Topic sections within a policy (e.g. 'Customer Due Diligence' under KYC).
-- ---------------------------------------------------------------------------

CREATE TABLE sub_headings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID        NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  code          TEXT        NOT NULL,                    -- e.g. 'KYC-CDD'
  title         TEXT        NOT NULL,
  description   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (policy_id, code)
);

-- ---------------------------------------------------------------------------
-- 3.6  MASTER_QUESTIONS
-- Platform-owned shared question bank. Deliberately has NO tenant_id.
-- Written by super admins via import scripts (service_role only).
-- ---------------------------------------------------------------------------

CREATE TABLE master_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id         UUID        NOT NULL REFERENCES policies     (id) ON DELETE RESTRICT,
  sub_heading_id    UUID                 REFERENCES sub_headings (id) ON DELETE SET NULL,
  employee_category TEXT        NOT NULL DEFAULT 'general'
                                CHECK (employee_category IN (
                                  'general', 'manager', 'executive',
                                  'teller', 'compliance_officer', 'it', 'other', 'all'
                                )),
  question_text     TEXT        NOT NULL,
  option_a          TEXT        NOT NULL,
  option_b          TEXT        NOT NULL,
  option_c          TEXT        NOT NULL,
  option_d          TEXT        NOT NULL,
  correct_option    CHAR(1)     NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  explanation       TEXT,
  difficulty        TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source_file       TEXT,
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3.7  TENANT_QUESTIONS
-- Client-specific private question bank. MUST have tenant_id NOT NULL.
-- Written by tenant admins via import scripts (service_role).
-- ---------------------------------------------------------------------------

CREATE TABLE tenant_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants      (id) ON DELETE CASCADE,
  policy_id         UUID        NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  sub_heading_id    UUID                 REFERENCES sub_headings  (id) ON DELETE SET NULL,
  employee_category TEXT        NOT NULL DEFAULT 'general'
                                CHECK (employee_category IN (
                                  'general', 'manager', 'executive',
                                  'teller', 'compliance_officer', 'it', 'other', 'all'
                                )),
  question_text     TEXT        NOT NULL,
  option_a          TEXT        NOT NULL,
  option_b          TEXT        NOT NULL,
  option_c          TEXT        NOT NULL,
  option_d          TEXT        NOT NULL,
  correct_option    CHAR(1)     NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  explanation       TEXT,
  difficulty        TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source_file       TEXT,
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3.8  USER_QUESTION_HISTORY
-- Records every question a user has seen per policy to prevent repetition.
-- question_id is NOT a traditional FK because it may point to either
-- master_questions or tenant_questions — enforced at the application layer.
-- ---------------------------------------------------------------------------

CREATE TABLE user_question_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  policy_id       UUID        NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  question_source TEXT        NOT NULL CHECK (question_source IN ('master', 'tenant')),
  question_id     UUID        NOT NULL,
  seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_correct     BOOLEAN,
  attempt_count   INT         NOT NULL DEFAULT 1,

  CONSTRAINT uq_user_question_history
    UNIQUE (tenant_id, user_id, policy_id, question_source, question_id)
);

-- ---------------------------------------------------------------------------
-- 3.9  TEST_SESSIONS
-- One quiz attempt by a user for one policy.
-- Status FSM (enforced by trigger in 005):
--   client:       in_progress ↔ paused, in_progress → abandoned
--   service_role: → completed | expired | cancelled
-- ---------------------------------------------------------------------------

CREATE TABLE test_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  branch_id           UUID                 REFERENCES branches (id) ON DELETE SET NULL,
  policy_id           UUID        NOT NULL REFERENCES policies (id) ON DELETE RESTRICT,
  status              TEXT        NOT NULL DEFAULT 'in_progress'
                                  CHECK (status IN (
                                    'in_progress',
                                    'paused',
                                    'completed',
                                    'expired',
                                    'abandoned',
                                    'cancelled'
                                  )),
  total_questions     INT         NOT NULL DEFAULT 0,
  answered_questions  INT         NOT NULL DEFAULT 0,
  correct_answers     INT         NOT NULL DEFAULT 0,
  score_percentage    NUMERIC(5,2)         CHECK (score_percentage BETWEEN 0 AND 100),
  pass_threshold      NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  passed              BOOLEAN,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  time_taken_seconds  INT,
  metadata            JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (answered_questions <= total_questions),
  CHECK (correct_answers    <= answered_questions),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

-- ---------------------------------------------------------------------------
-- 3.10  TEST_RESPONSES
-- Individual question answers within a session.
-- Immutable once written (no updated_at; UPDATE blocked by RLS in 002).
-- correct_option stored as snapshot at quiz time (question text may later change).
-- ---------------------------------------------------------------------------

CREATE TABLE test_responses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants       (id) ON DELETE CASCADE,
  session_id         UUID        NOT NULL REFERENCES test_sessions (id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
  policy_id          UUID        NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  question_source    TEXT        NOT NULL CHECK (question_source IN ('master', 'tenant')),
  question_id        UUID        NOT NULL,
  question_text      TEXT        NOT NULL,
  correct_option     CHAR(1)     NOT NULL CHECK (correct_option    IN ('a','b','c','d')),
  selected_option    CHAR(1)              CHECK (selected_option   IN ('a','b','c','d')),
  is_correct         BOOLEAN,
  time_taken_seconds INT,
  answered_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3.11  CERTIFICATES
-- Issued when a user passes a test session.
-- certificate_no auto-generated by trigger in 005 (CERT-YYYYMM-XXXXXXXX).
-- ---------------------------------------------------------------------------

CREATE TABLE certificates (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants       (id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
  session_id       UUID         NOT NULL REFERENCES test_sessions (id) ON DELETE CASCADE,
  policy_id        UUID         NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  certificate_no   TEXT         NOT NULL UNIQUE,
  score_percentage NUMERIC(5,2) NOT NULL,
  issued_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revoked_reason   TEXT,
  pdf_url          TEXT,
  metadata         JSONB        NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CHECK (revoked_at  IS NULL OR revoked_at  > issued_at),
  CHECK (valid_until IS NULL OR valid_until > issued_at)
);

-- ---------------------------------------------------------------------------
-- 3.12  SYSTEM_PARAMETERS
-- Key-value config store.
--   tenant_id IS NULL  →  platform-wide default
--   tenant_id IS NOT NULL  →  per-tenant override
-- UNIQUE NULLS NOT DISTINCT requires PostgreSQL 15+.
-- ---------------------------------------------------------------------------

CREATE TABLE system_parameters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID                 REFERENCES tenants (id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  value_type  TEXT        NOT NULL DEFAULT 'string'
                          CHECK (value_type IN ('string','integer','boolean','json')),
  description TEXT,
  is_secret   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);

-- ---------------------------------------------------------------------------
-- 3.13  AUDIT_LOGS
-- Immutable append-only compliance log.
-- No updated_at (rows never change). UPDATE + DELETE blocked by SQL rules below.
-- tenant_id / actor_user_id use ON DELETE SET NULL so logs survive entity deletion.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID                 REFERENCES tenants (id) ON DELETE SET NULL,
  actor_user_id UUID                 REFERENCES users   (id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     UUID,
  metadata      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. UPDATED_AT TRIGGERS
--    Called only AFTER all tables are created so the dynamic SQL inside
--    create_updated_at_trigger can always resolve public.<table>.
--    Tables without updated_at (test_responses, audit_logs) are omitted.
-- =============================================================================

SELECT create_updated_at_trigger('tenants');
SELECT create_updated_at_trigger('branches');
SELECT create_updated_at_trigger('users');
SELECT create_updated_at_trigger('policies');
SELECT create_updated_at_trigger('sub_headings');
SELECT create_updated_at_trigger('master_questions');
SELECT create_updated_at_trigger('tenant_questions');
SELECT create_updated_at_trigger('test_sessions');
SELECT create_updated_at_trigger('certificates');
SELECT create_updated_at_trigger('system_parameters');

-- =============================================================================
-- 5. INDEXES
-- =============================================================================

-- tenants
CREATE INDEX idx_tenants_slug   ON tenants (slug);
CREATE INDEX idx_tenants_status ON tenants (status);

-- branches
CREATE INDEX idx_branches_tenant_id ON branches (tenant_id);

-- users
CREATE INDEX idx_users_tenant_id         ON users (tenant_id);
CREATE INDEX idx_users_branch_id         ON users (branch_id);
CREATE INDEX idx_users_employee_category ON users (employee_category);
CREATE INDEX idx_users_role              ON users (role);
CREATE INDEX idx_users_status            ON users (status);

-- policies
CREATE INDEX idx_policies_code      ON policies (code);
CREATE INDEX idx_policies_is_active ON policies (is_active);

-- sub_headings
CREATE INDEX idx_sub_headings_policy_id ON sub_headings (policy_id);

-- master_questions
CREATE INDEX idx_master_questions_policy_id         ON master_questions (policy_id);
CREATE INDEX idx_master_questions_sub_heading_id    ON master_questions (sub_heading_id);
CREATE INDEX idx_master_questions_employee_category ON master_questions (employee_category);
CREATE INDEX idx_master_questions_difficulty        ON master_questions (difficulty);
CREATE INDEX idx_master_questions_is_active         ON master_questions (is_active);

-- tenant_questions
CREATE INDEX idx_tenant_questions_tenant_id         ON tenant_questions (tenant_id);
CREATE INDEX idx_tenant_questions_policy_id         ON tenant_questions (policy_id);
CREATE INDEX idx_tenant_questions_sub_heading_id    ON tenant_questions (sub_heading_id);
CREATE INDEX idx_tenant_questions_employee_category ON tenant_questions (employee_category);
CREATE INDEX idx_tenant_questions_difficulty        ON tenant_questions (difficulty);
CREATE INDEX idx_tenant_questions_is_active         ON tenant_questions (is_active);
CREATE INDEX idx_tenant_questions_tenant_policy_active
  ON tenant_questions (tenant_id, policy_id, is_active);

-- user_question_history
CREATE INDEX idx_uqh_tenant_user_policy
  ON user_question_history (tenant_id, user_id, policy_id);
CREATE INDEX idx_uqh_question_source_id
  ON user_question_history (question_source, question_id);
CREATE INDEX idx_uqh_seen_at
  ON user_question_history (seen_at);

-- test_sessions
CREATE INDEX idx_test_sessions_tenant_id   ON test_sessions (tenant_id);
CREATE INDEX idx_test_sessions_user_id     ON test_sessions (user_id);
CREATE INDEX idx_test_sessions_policy_id   ON test_sessions (policy_id);
CREATE INDEX idx_test_sessions_status      ON test_sessions (status);
CREATE INDEX idx_test_sessions_started_at  ON test_sessions (started_at);
CREATE INDEX idx_test_sessions_tenant_policy_status
  ON test_sessions (tenant_id, policy_id, status);

-- test_responses
CREATE INDEX idx_test_responses_tenant_id  ON test_responses (tenant_id);
CREATE INDEX idx_test_responses_session_id ON test_responses (session_id);
CREATE INDEX idx_test_responses_user_id    ON test_responses (user_id);
CREATE INDEX idx_test_responses_question   ON test_responses (question_source, question_id);

-- certificates
CREATE INDEX idx_certificates_tenant_id  ON certificates (tenant_id);
CREATE INDEX idx_certificates_user_id    ON certificates (user_id);
CREATE INDEX idx_certificates_policy_id  ON certificates (policy_id);
CREATE INDEX idx_certificates_session_id ON certificates (session_id);
CREATE INDEX idx_certificates_issued_at  ON certificates (issued_at);

-- system_parameters
CREATE INDEX idx_system_parameters_tenant_id ON system_parameters (tenant_id);
CREATE INDEX idx_system_parameters_key       ON system_parameters (key);

-- audit_logs
CREATE INDEX idx_audit_logs_tenant_id     ON audit_logs (tenant_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_action        ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity        ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at    ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_metadata      ON audit_logs USING GIN (metadata);

-- =============================================================================
-- 6. APPEND-ONLY RULES — audit_logs
-- Double-lock with RLS policies in 002. SQL rules run before RLS so they
-- block UPDATE/DELETE at the rewrite stage before rows are evaluated.
-- =============================================================================

CREATE OR REPLACE RULE audit_logs_no_update AS
  ON UPDATE TO audit_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_logs_no_delete AS
  ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
