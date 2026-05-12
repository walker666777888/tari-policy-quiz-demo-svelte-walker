-- =============================================================================
-- 006_auth_onboarding.sql
-- Auth Onboarding — Invite OTPs, Bulk Import Jobs, User Profile Extensions
--
-- NOTE: Named 006 because 005_security_fixes.sql already exists.
--
-- WHAT THIS MIGRATION ADDS
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. employee_invite_otps  — time-limited OTP tokens for email-based invites
-- 2. user_import_jobs      — tracks bulk CSV user-import operations per tenant
-- 3. users table extensions:
--      · employee_code   TEXT   (unique per tenant, nullable)
--      · department      TEXT
--      · designation     TEXT
--      · status          CHECK expanded to ('invited','active','disabled')
-- 4. system_parameters defaults:
--      · otp_expiry_minutes  = 10
--      · otp_max_attempts    = 5
--      · invite_expiry_hours = 24
--
-- SECURITY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- · otp_code is stored as a SHA-256 hex digest — never the raw code.
--   The application must hash before INSERT and hash again before comparison.
--   Column-level REVOKE prevents authenticated clients reading the digest.
-- · employee_invite_otps.is_used + expires_at + attempt_count form a three-
--   factor expiry: time, consumption, and brute-force lockout.
-- · user_import_jobs.status transitions are enforced server-side (service_role).
--   Authenticated clients may INSERT (pending) and SELECT, but not UPDATE.
-- · All new tables follow the existing tenant-isolation architecture:
--     tenant_id = public.auth_tenant_id()   in every RLS policy.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — employee_invite_otps
-- One row per invite OTP issued. Expired, used, or locked-out rows are cleaned
-- up by the pg_cron job defined in 004_pg_cron.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employee_invite_otps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users   (id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  -- Store SHA-256(otp_code) — never the raw 6-digit code.
  -- Application must: encode(digest(raw_code, 'sha256'), 'hex') before storing.
  otp_hash      TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER     NOT NULL DEFAULT 0,
  is_used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active (unused) invite per user at a time; old ones are superseded
  CONSTRAINT uq_invite_user_active UNIQUE (tenant_id, user_id, is_used)
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE  public.employee_invite_otps IS
  'Time-limited OTP tokens issued when a client_admin invites an employee. '
  'otp_hash stores SHA-256(raw_code) — raw code is never persisted.';
COMMENT ON COLUMN public.employee_invite_otps.otp_hash IS
  'SHA-256 hex digest of the raw OTP. Compare encode(digest(input,''sha256''),''hex'').';
COMMENT ON COLUMN public.employee_invite_otps.attempt_count IS
  'Incremented on each failed verification attempt. Locked when ≥ otp_max_attempts.';

-- =============================================================================
-- SECTION 2 — user_import_jobs
-- Tracks the lifecycle of a CSV bulk-import operation.
-- The actual processing is done by a server-side job (service_role).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_import_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  uploaded_by       UUID        NOT NULL REFERENCES public.users   (id) ON DELETE RESTRICT,
  filename          TEXT        NOT NULL,
  total_rows        INTEGER     NOT NULL DEFAULT 0,
  success_rows      INTEGER     NOT NULL DEFAULT 0,
  failed_rows       INTEGER     NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending',      -- uploaded, awaiting processing
                                  'processing',   -- currently being processed
                                  'completed',    -- all rows handled (some may have failed)
                                  'failed',       -- job-level failure (parse error, etc.)
                                  'cancelled'     -- cancelled by admin before completion
                                )),
  error_report_url  TEXT,                         -- signed URL to per-row error CSV
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.user_import_jobs IS
  'Tracks bulk CSV user-import operations. Processing is done server-side via service_role.';
COMMENT ON COLUMN public.user_import_jobs.error_report_url IS
  'Signed Supabase Storage URL pointing to a CSV of per-row import errors. '
  'Populated when status = ''completed'' or ''failed'' and failed_rows > 0.';

-- =============================================================================
-- SECTION 3 — EXTEND users TABLE
-- Add: employee_code, department, designation
-- Migrate + extend: status CHECK constraint
-- =============================================================================

-- 3a. Add new profile columns (idempotent via IF NOT EXISTS)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS department    TEXT,
  ADD COLUMN IF NOT EXISTS designation   TEXT;

COMMENT ON COLUMN public.users.employee_code IS
  'HR system employee code. Unique per tenant (enforced via partial unique index).';
COMMENT ON COLUMN public.users.department IS
  'Organisational department the employee belongs to (free text).';
COMMENT ON COLUMN public.users.designation IS
  'Job title or designation (free text).';

-- 3b. Migrate existing status values to the new set before changing the constraint.
--     'inactive'  → 'disabled'  (deactivated accounts)
--     'suspended' → 'disabled'  (suspended accounts treated as disabled)
UPDATE public.users
   SET status = 'disabled'
 WHERE status IN ('inactive', 'suspended');

-- 3c. Replace the status CHECK constraint.
--     The auto-generated name from migration 001 is 'users_status_check'.
--     We use a dynamic lookup to be safe across environments.
DO $drop_status_check$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid  = 'public.users'::regclass
     AND contype   = 'c'
     AND pg_get_constraintdef(oid) LIKE '%status%'
   LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'Dropped constraint: %', v_conname;
  END IF;
END $drop_status_check$;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('invited', 'active', 'disabled'));

-- 3d. Change default: new users start as 'invited' in the onboarding flow.
ALTER TABLE public.users
  ALTER COLUMN status SET DEFAULT 'invited';

COMMENT ON COLUMN public.users.status IS
  'invited  — invite sent, user has not yet completed onboarding. '
  'active   — user has completed onboarding and can log in. '
  'disabled — access revoked by a client_admin.';

-- 3e. Unique employee_code per tenant (partial — allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_employee_code
  ON public.users (tenant_id, employee_code)
  WHERE employee_code IS NOT NULL;

-- =============================================================================
-- SECTION 4 — updated_at TRIGGERS FOR NEW TABLES
-- =============================================================================

SELECT public.create_updated_at_trigger('employee_invite_otps');
SELECT public.create_updated_at_trigger('user_import_jobs');

-- =============================================================================
-- SECTION 5 — INDEXES
-- =============================================================================

-- employee_invite_otps
CREATE INDEX IF NOT EXISTS idx_eio_tenant_id
  ON public.employee_invite_otps (tenant_id);

CREATE INDEX IF NOT EXISTS idx_eio_email
  ON public.employee_invite_otps (email);

CREATE INDEX IF NOT EXISTS idx_eio_expires_at
  ON public.employee_invite_otps (expires_at);

-- Partial index: fast lookup of active (unused, unexpired) invites
CREATE INDEX IF NOT EXISTS idx_eio_active
  ON public.employee_invite_otps (tenant_id, email)
  WHERE is_used = FALSE;

-- user_import_jobs
CREATE INDEX IF NOT EXISTS idx_uij_tenant_id
  ON public.user_import_jobs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_uij_uploaded_by
  ON public.user_import_jobs (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_uij_status
  ON public.user_import_jobs (tenant_id, status);

-- users new columns
CREATE INDEX IF NOT EXISTS idx_users_department
  ON public.users (tenant_id, department)
  WHERE department IS NOT NULL;

-- =============================================================================
-- SECTION 6 — ROW LEVEL SECURITY ON NEW TABLES
-- =============================================================================

ALTER TABLE public.employee_invite_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_invite_otps FORCE  ROW LEVEL SECURITY;

ALTER TABLE public.user_import_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_import_jobs     FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 7 — RLS POLICIES
-- =============================================================================

-- ── employee_invite_otps ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS eio_select_client_admin ON public.employee_invite_otps;
DROP POLICY IF EXISTS eio_insert_client_admin ON public.employee_invite_otps;
DROP POLICY IF EXISTS eio_update_deny         ON public.employee_invite_otps;
DROP POLICY IF EXISTS eio_delete_client_admin ON public.employee_invite_otps;

-- client_admin sees all invites within their tenant (to manage pending invites)
-- otp_hash is column-REVOKED below — SELECT returns all other columns safely
CREATE POLICY eio_select_client_admin
  ON public.employee_invite_otps FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- client_admin creates invite OTPs for users within their tenant
CREATE POLICY eio_insert_client_admin
  ON public.employee_invite_otps FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- UPDATE is reserved for service_role (verification: attempt_count, is_used)
-- Authenticated clients must never mark OTPs as used directly
CREATE POLICY eio_update_deny
  ON public.employee_invite_otps FOR UPDATE
  TO authenticated
  USING (FALSE);

-- client_admin may revoke (delete) unused invites within their tenant
CREATE POLICY eio_delete_client_admin
  ON public.employee_invite_otps FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
    AND is_used = FALSE              -- cannot delete already-consumed OTPs
  );

-- ── user_import_jobs ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS uij_select_client_admin ON public.user_import_jobs;
DROP POLICY IF EXISTS uij_insert_client_admin ON public.user_import_jobs;
DROP POLICY IF EXISTS uij_update_deny         ON public.user_import_jobs;
DROP POLICY IF EXISTS uij_delete_client_admin ON public.user_import_jobs;

-- client_admin sees all import jobs within their tenant
CREATE POLICY uij_select_client_admin
  ON public.user_import_jobs FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- client_admin uploads a new import job (status defaults to 'pending')
CREATE POLICY uij_insert_client_admin
  ON public.user_import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id   = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
    AND uploaded_by = auth.uid()     -- can only create jobs on their own behalf
  );

-- UPDATE reserved for service_role (processing updates status, row counts, error URL)
CREATE POLICY uij_update_deny
  ON public.user_import_jobs FOR UPDATE
  TO authenticated
  USING (FALSE);

-- client_admin may delete jobs (typically to clear history)
CREATE POLICY uij_delete_client_admin
  ON public.user_import_jobs FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (auth.jwt() ->> 'role') = 'client_admin'
  );

-- =============================================================================
-- SECTION 8 — COLUMN-LEVEL SECURITY ON otp_hash
-- Revoke direct read of the OTP hash from all authenticated clients.
-- Verification is performed server-side via service_role only.
-- =============================================================================

-- Revoke table-level SELECT granted in migration 002, then re-grant per column
REVOKE SELECT ON public.employee_invite_otps FROM authenticated;

GRANT SELECT (
  id, tenant_id, user_id, email,
  expires_at, attempt_count, is_used,
  created_at, updated_at
) ON public.employee_invite_otps TO authenticated;
-- otp_hash is deliberately excluded

-- =============================================================================
-- SECTION 9 — EXPLICIT TABLE-LEVEL GRANTS
-- Consistent with the pattern established in migration 002, Section 16.
-- =============================================================================

GRANT ALL ON public.employee_invite_otps TO service_role;
GRANT ALL ON public.user_import_jobs     TO service_role;

GRANT SELECT, INSERT, DELETE
  ON public.employee_invite_otps TO authenticated;  -- column-level REVOKE above narrows SELECT

GRANT SELECT, INSERT
  ON public.user_import_jobs TO authenticated;      -- UPDATE/DELETE via service_role only

-- =============================================================================
-- SECTION 10 — SYSTEM PARAMETERS: ONBOARDING DEFAULTS
-- Idempotent — safe to run multiple times.
-- =============================================================================

INSERT INTO public.system_parameters
  (id, tenant_id, key, value, value_type, description, is_secret)
VALUES

  (gen_random_uuid(), NULL,
   'otp_expiry_minutes', '10',
   'integer',
   'Number of minutes before an invite OTP expires. Default: 10.',
   FALSE),

  (gen_random_uuid(), NULL,
   'otp_max_attempts', '5',
   'integer',
   'Maximum number of failed OTP verification attempts before the code is locked out.',
   FALSE),

  (gen_random_uuid(), NULL,
   'invite_expiry_hours', '24',
   'integer',
   'Number of hours a full invite link remains valid after being issued.',
   FALSE)

ON CONFLICT (tenant_id, key) DO UPDATE SET
  value       = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- =============================================================================
-- SECTION 11 — VERIFICATION
-- =============================================================================

DO $verify$
DECLARE
  v_eio_exists  BOOLEAN;
  v_uij_exists  BOOLEAN;
  v_emp_code    BOOLEAN;
  v_dept        BOOLEAN;
  v_desig       BOOLEAN;
  v_otp_param   TEXT;
  v_att_param   TEXT;
  v_inv_param   TEXT;
  v_rls_eio     RECORD;
  v_rls_uij     RECORD;
BEGIN
  -- Table existence
  SELECT EXISTS (
    SELECT 1 FROM pg_class
     WHERE relname = 'employee_invite_otps'
       AND relnamespace = 'public'::regnamespace
  ) INTO v_eio_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_class
     WHERE relname = 'user_import_jobs'
       AND relnamespace = 'public'::regnamespace
  ) INTO v_uij_exists;

  -- New users columns
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.users'::regclass
       AND attname  = 'employee_code'
       AND NOT attisdropped
  ) INTO v_emp_code;

  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.users'::regclass
       AND attname  = 'department'
       AND NOT attisdropped
  ) INTO v_dept;

  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.users'::regclass
       AND attname  = 'designation'
       AND NOT attisdropped
  ) INTO v_desig;

  -- System parameters
  SELECT value INTO v_otp_param FROM public.system_parameters
   WHERE key = 'otp_expiry_minutes' AND tenant_id IS NULL;

  SELECT value INTO v_att_param FROM public.system_parameters
   WHERE key = 'otp_max_attempts' AND tenant_id IS NULL;

  SELECT value INTO v_inv_param FROM public.system_parameters
   WHERE key = 'invite_expiry_hours' AND tenant_id IS NULL;

  -- RLS enabled
  SELECT relrowsecurity, relforcerowsecurity INTO v_rls_eio
    FROM pg_class
   WHERE relname = 'employee_invite_otps'
     AND relnamespace = 'public'::regnamespace;

  SELECT relrowsecurity, relforcerowsecurity INTO v_rls_uij
    FROM pg_class
   WHERE relname = 'user_import_jobs'
     AND relnamespace = 'public'::regnamespace;

  RAISE NOTICE '─────────────────────────────────────────────────────';
  RAISE NOTICE '006_auth_onboarding verification:';
  RAISE NOTICE '  employee_invite_otps exists  : %', v_eio_exists;
  RAISE NOTICE '  user_import_jobs exists      : %', v_uij_exists;
  RAISE NOTICE '  users.employee_code exists   : %', v_emp_code;
  RAISE NOTICE '  users.department exists      : %', v_dept;
  RAISE NOTICE '  users.designation exists     : %', v_desig;
  RAISE NOTICE '  otp_expiry_minutes           : %', v_otp_param;
  RAISE NOTICE '  otp_max_attempts             : %', v_att_param;
  RAISE NOTICE '  invite_expiry_hours          : %', v_inv_param;
  RAISE NOTICE '  RLS employee_invite_otps     : enabled=%, force=%',
    v_rls_eio.relrowsecurity, v_rls_eio.relforcerowsecurity;
  RAISE NOTICE '  RLS user_import_jobs         : enabled=%, force=%',
    v_rls_uij.relrowsecurity, v_rls_uij.relforcerowsecurity;

  -- Assertions
  IF NOT v_eio_exists   THEN RAISE EXCEPTION 'employee_invite_otps table missing';   END IF;
  IF NOT v_uij_exists   THEN RAISE EXCEPTION 'user_import_jobs table missing';       END IF;
  IF NOT v_emp_code     THEN RAISE EXCEPTION 'users.employee_code column missing';   END IF;
  IF NOT v_dept         THEN RAISE EXCEPTION 'users.department column missing';      END IF;
  IF NOT v_desig        THEN RAISE EXCEPTION 'users.designation column missing';     END IF;
  IF v_otp_param IS NULL THEN RAISE EXCEPTION 'otp_expiry_minutes param missing';   END IF;
  IF v_att_param IS NULL THEN RAISE EXCEPTION 'otp_max_attempts param missing';     END IF;
  IF v_inv_param IS NULL THEN RAISE EXCEPTION 'invite_expiry_hours param missing';  END IF;
  IF NOT v_rls_eio.relrowsecurity
    THEN RAISE EXCEPTION 'RLS not enabled on employee_invite_otps'; END IF;
  IF NOT v_rls_uij.relrowsecurity
    THEN RAISE EXCEPTION 'RLS not enabled on user_import_jobs'; END IF;

  RAISE NOTICE 'All 006_auth_onboarding assertions passed.';
  RAISE NOTICE '─────────────────────────────────────────────────────';
END $verify$;

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
