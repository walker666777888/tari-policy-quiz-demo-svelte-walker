-- =============================================================================
-- 001_initial_schema.sql
-- Multi-tenant SaaS Compliance Quiz Platform — Initial Schema
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- UTILITY: auto-update updated_at timestamps
-- =============================================================================

-- SECURITY: SECURITY DEFINER + SET search_path = '' prevents search-path
-- injection attacks against this trigger function (runs on every mutable table).
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

-- Helper macro to attach the trigger to any table.
-- SET search_path = '' required because the function executes dynamic SQL
-- that references the target table by identifier — immune to schema injection.
CREATE OR REPLACE FUNCTION create_updated_at_trigger(tbl TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    tbl
  );
END;
$$;

-- =============================================================================
-- 1. TENANTS
-- Top-level organisations (companies) using the platform.
-- =============================================================================

CREATE TABLE tenants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  slug              TEXT        NOT NULL UNIQUE,               -- URL-safe identifier
  domain            TEXT,                                      -- optional SSO domain
  logo_url          TEXT,
  plan              TEXT        NOT NULL DEFAULT 'starter'
                                CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'cancelled')),
  max_users         INT         NOT NULL DEFAULT 100,
  settings          JSONB       NOT NULL DEFAULT '{}'::JSONB,  -- tenant-level config
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug   ON tenants (slug);
CREATE INDEX idx_tenants_status ON tenants (status);

SELECT create_updated_at_trigger('tenants');

-- =============================================================================
-- 2. BRANCHES
-- Physical or logical branches within a tenant (e.g. offices, departments).
-- =============================================================================

CREATE TABLE branches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  code        TEXT,                                            -- short branch code
  location    TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_branches_tenant_id ON branches (tenant_id);

SELECT create_updated_at_trigger('branches');

-- =============================================================================
-- 3. USERS
-- Platform users. Each user belongs to exactly one tenant.
-- auth.users (Supabase Auth) is the source of truth for credentials;
-- this table extends it with app-level profile data.
-- =============================================================================

CREATE TABLE users (
  id                UUID        PRIMARY KEY,                   -- matches auth.users.id
  tenant_id         UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  branch_id         UUID        REFERENCES branches (id) ON DELETE SET NULL,
  email             TEXT        NOT NULL,
  full_name         TEXT        NOT NULL,
  employee_id       TEXT,                                      -- HR reference
  employee_category TEXT        NOT NULL DEFAULT 'general'
                                CHECK (employee_category IN (
                                  'general', 'manager', 'executive',
                                  'teller', 'compliance_officer', 'it', 'other'
                                )),
  -- Role values MUST match the JWT 'user_role' custom claim used by all RLS
  -- helper functions (auth_user_role, is_client_admin, is_individual_role).
  -- Mismatched values would silently break all RLS policy checks.
  --
  --   super_admin  — Tari platform staff (service_role key only; bypasses RLS)
  --   client_admin — Tenant administrator (full CRUD within their tenant)
  --   cxo          — Executive viewer (read-only analytics, own sessions)
  --   employee     — Standard user (own sessions and quiz data only)
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

CREATE INDEX idx_users_tenant_id         ON users (tenant_id);
CREATE INDEX idx_users_branch_id         ON users (branch_id);
CREATE INDEX idx_users_employee_category ON users (employee_category);
CREATE INDEX idx_users_role              ON users (role);
CREATE INDEX idx_users_status            ON users (status);

SELECT create_updated_at_trigger('users');

-- =============================================================================
-- 4. POLICIES
-- Compliance policy areas (e.g. "AML", "KYC", "GDPR").
-- Shared across the platform; tenant visibility controlled via settings.
-- =============================================================================

CREATE TABLE policies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL UNIQUE,                    -- e.g. 'AML', 'KYC'
  title         TEXT        NOT NULL,
  description   TEXT,
  version       TEXT        NOT NULL DEFAULT '1.0',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  -- TRUE for policies that draw questions from both master AND tenant banks
  -- (COC, COI, PIT). FALSE = master bank only.
  is_dual_track BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_code      ON policies (code);
CREATE INDEX idx_policies_is_active ON policies (is_active);

SELECT create_updated_at_trigger('policies');

-- =============================================================================
-- 5. SUB_HEADINGS
-- Sub-sections within a policy (e.g. "Customer Due Diligence" under "KYC").
-- =============================================================================

CREATE TABLE sub_headings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID        NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  code          TEXT        NOT NULL,                          -- e.g. 'KYC-CDD'
  title         TEXT        NOT NULL,
  description   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (policy_id, code)
);

CREATE INDEX idx_sub_headings_policy_id ON sub_headings (policy_id);

SELECT create_updated_at_trigger('sub_headings');

-- =============================================================================
-- 6. MASTER_QUESTIONS
-- Platform-owned shared question bank. NO tenant_id.
-- Managed by super admins only.
-- =============================================================================

CREATE TABLE master_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id         UUID        NOT NULL REFERENCES policies     (id) ON DELETE RESTRICT,
  sub_heading_id    UUID        REFERENCES sub_headings (id) ON DELETE SET NULL,
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
  source_file       TEXT,                                      -- origin import file name
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_master_questions_policy_id         ON master_questions (policy_id);
CREATE INDEX idx_master_questions_sub_heading_id    ON master_questions (sub_heading_id);
CREATE INDEX idx_master_questions_employee_category ON master_questions (employee_category);
CREATE INDEX idx_master_questions_difficulty        ON master_questions (difficulty);
CREATE INDEX idx_master_questions_is_active         ON master_questions (is_active);

SELECT create_updated_at_trigger('master_questions');

-- =============================================================================
-- 7. TENANT_QUESTIONS
-- Client-specific question bank. MUST include tenant_id.
-- Managed by tenant admins.
-- =============================================================================

CREATE TABLE tenant_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants      (id) ON DELETE CASCADE,
  policy_id         UUID        NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  sub_heading_id    UUID        REFERENCES sub_headings (id) ON DELETE SET NULL,
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
  source_file       TEXT,                                      -- origin import file name
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_questions_tenant_id         ON tenant_questions (tenant_id);
CREATE INDEX idx_tenant_questions_policy_id         ON tenant_questions (policy_id);
CREATE INDEX idx_tenant_questions_sub_heading_id    ON tenant_questions (sub_heading_id);
CREATE INDEX idx_tenant_questions_employee_category ON tenant_questions (employee_category);
CREATE INDEX idx_tenant_questions_difficulty        ON tenant_questions (difficulty);
CREATE INDEX idx_tenant_questions_is_active         ON tenant_questions (is_active);
-- Composite: fetch active questions per tenant + policy in one scan
CREATE INDEX idx_tenant_questions_tenant_policy_active
  ON tenant_questions (tenant_id, policy_id, is_active);

SELECT create_updated_at_trigger('tenant_questions');

-- =============================================================================
-- 8. USER_QUESTION_HISTORY
-- Tracks which questions each user has already seen per policy,
-- across both question sources, to prevent repetition.
--
-- CRITICAL UNIQUE CONSTRAINT:
--   (tenant_id, user_id, policy_id, question_source, question_id)
-- =============================================================================

CREATE TABLE user_question_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  policy_id       UUID        NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  question_source TEXT        NOT NULL CHECK (question_source IN ('master', 'tenant')),
  question_id     UUID        NOT NULL,                        -- FK enforced at app level
                                                               -- (points to master_ or tenant_questions)
  seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_correct     BOOLEAN,                                     -- NULL = unanswered / skipped
  attempt_count   INT         NOT NULL DEFAULT 1,

  -- MANDATORY: prevents the same question appearing twice for the same
  -- user within the same policy cycle, regardless of source bank.
  CONSTRAINT uq_user_question_history
    UNIQUE (tenant_id, user_id, policy_id, question_source, question_id)
);

CREATE INDEX idx_uqh_tenant_user_policy
  ON user_question_history (tenant_id, user_id, policy_id);
CREATE INDEX idx_uqh_question_source_id
  ON user_question_history (question_source, question_id);
CREATE INDEX idx_uqh_seen_at
  ON user_question_history (seen_at);

-- =============================================================================
-- 9. TEST_SESSIONS
-- A single quiz attempt by a user for a specific policy.
-- Tenant-scoped.
-- =============================================================================

CREATE TABLE test_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants  (id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  branch_id           UUID        REFERENCES branches (id) ON DELETE SET NULL,
  policy_id           UUID        NOT NULL REFERENCES policies (id) ON DELETE RESTRICT,
  status              TEXT        NOT NULL DEFAULT 'in_progress'
                                  CHECK (status IN (
                                    'in_progress',
                                    'paused',       -- session temporarily suspended by user
                                    'completed',
                                    'expired',
                                    'abandoned',
                                    'cancelled'     -- set by cron when a paused session expires
                                  )),
  total_questions     INT         NOT NULL DEFAULT 0,
  answered_questions  INT         NOT NULL DEFAULT 0,
  correct_answers     INT         NOT NULL DEFAULT 0,
  score_percentage    NUMERIC(5,2)
                                  CHECK (score_percentage BETWEEN 0 AND 100),
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

CREATE INDEX idx_test_sessions_tenant_id   ON test_sessions (tenant_id);
CREATE INDEX idx_test_sessions_user_id     ON test_sessions (user_id);
CREATE INDEX idx_test_sessions_policy_id   ON test_sessions (policy_id);
CREATE INDEX idx_test_sessions_status      ON test_sessions (status);
CREATE INDEX idx_test_sessions_started_at  ON test_sessions (started_at);
-- Composite: dashboard queries per tenant
CREATE INDEX idx_test_sessions_tenant_policy_status
  ON test_sessions (tenant_id, policy_id, status);

SELECT create_updated_at_trigger('test_sessions');

-- =============================================================================
-- 10. TEST_RESPONSES
-- Individual question answers within a test session.
-- Tenant-scoped via session.
-- =============================================================================

CREATE TABLE test_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants       (id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES test_sessions (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
  policy_id       UUID        NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  question_source TEXT        NOT NULL CHECK (question_source IN ('master', 'tenant')),
  question_id     UUID        NOT NULL,
  question_text   TEXT        NOT NULL,                         -- snapshot at time of test
  correct_option  CHAR(1)     NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  selected_option CHAR(1)     CHECK (selected_option IN ('a','b','c','d')),
  is_correct      BOOLEAN,
  time_taken_seconds INT,
  answered_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_responses_tenant_id   ON test_responses (tenant_id);
CREATE INDEX idx_test_responses_session_id  ON test_responses (session_id);
CREATE INDEX idx_test_responses_user_id     ON test_responses (user_id);
CREATE INDEX idx_test_responses_question    ON test_responses (question_source, question_id);

-- =============================================================================
-- 11. CERTIFICATES
-- Issued when a user passes a test session.
-- Tenant-scoped.
-- =============================================================================

CREATE TABLE certificates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants       (id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
  session_id       UUID        NOT NULL REFERENCES test_sessions (id) ON DELETE CASCADE,
  policy_id        UUID        NOT NULL REFERENCES policies      (id) ON DELETE RESTRICT,
  certificate_no   TEXT        NOT NULL UNIQUE,                 -- human-readable serial
  score_percentage NUMERIC(5,2) NOT NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revoked_reason   TEXT,
  pdf_url          TEXT,                                        -- Supabase Storage path
  metadata         JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (revoked_at IS NULL OR revoked_at > issued_at),
  CHECK (valid_until IS NULL OR valid_until > issued_at)
);

CREATE INDEX idx_certificates_tenant_id  ON certificates (tenant_id);
CREATE INDEX idx_certificates_user_id    ON certificates (user_id);
CREATE INDEX idx_certificates_policy_id  ON certificates (policy_id);
CREATE INDEX idx_certificates_session_id ON certificates (session_id);
CREATE INDEX idx_certificates_issued_at  ON certificates (issued_at);

SELECT create_updated_at_trigger('certificates');

-- =============================================================================
-- 12. SYSTEM_PARAMETERS
-- Key-value config store. Tenant-scoped (tenant_id NULL = platform default).
-- =============================================================================

CREATE TABLE system_parameters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        REFERENCES tenants (id) ON DELETE CASCADE,  -- NULL = global
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  value_type  TEXT        NOT NULL DEFAULT 'string'
                          CHECK (value_type IN ('string','integer','boolean','json')),
  description TEXT,
  is_secret   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each key is unique per tenant (or globally when tenant_id IS NULL)
  UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);

CREATE INDEX idx_system_parameters_tenant_id ON system_parameters (tenant_id);
CREATE INDEX idx_system_parameters_key       ON system_parameters (key);

SELECT create_updated_at_trigger('system_parameters');

-- =============================================================================
-- 13. AUDIT_LOGS
-- Immutable append-only log of all significant actions.
-- Tenant-scoped. No updated_at — rows are never mutated.
-- =============================================================================

CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        REFERENCES tenants (id) ON DELETE SET NULL, -- keep log even if tenant deleted
  actor_user_id UUID        REFERENCES users   (id) ON DELETE SET NULL, -- keep log even if user deleted
  action        TEXT        NOT NULL,                           -- e.g. 'user.login', 'test.submitted'
  entity_type   TEXT        NOT NULL,                           -- e.g. 'user', 'test_session'
  entity_id     UUID,                                           -- PK of the affected row
  metadata      JSONB       NOT NULL DEFAULT '{}'::JSONB,       -- arbitrary context payload
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id     ON audit_logs (tenant_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_action        ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity        ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at    ON audit_logs (created_at);
-- GIN index for searching inside metadata JSONB
CREATE INDEX idx_audit_logs_metadata      ON audit_logs USING GIN (metadata);

-- Prevent any UPDATE or DELETE on audit_logs (append-only)
CREATE OR REPLACE RULE audit_logs_no_update AS
  ON UPDATE TO audit_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_logs_no_delete AS
  ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
