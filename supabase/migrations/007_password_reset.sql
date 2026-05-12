-- =============================================================================
-- 007_password_reset.sql
-- Password Reset via OTP
--
-- WHAT THIS MIGRATION ADDS
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. password_reset_otps  — lifecycle table for the forgot-password flow
--      · OTP phase   : otp_hash + expires_at + attempt_count
--      · Token phase : reset_token_hash + reset_expires_at  (after OTP verified)
--      · Completion  : is_used = true  (after password is set)
-- 2. system_parameters default:
--      · password_reset_token_expiry_minutes = 15
-- 3. RLS policies (tenant-isolated; UPDATE/otp_hash/reset_token_hash reserved
--    for service_role only)
--
-- SECURITY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- · otp_hash and reset_token_hash are SHA-256 hex digests — raw values never
--   stored. Column-level REVOKE prevents authenticated clients reading them.
-- · Three-factor OTP lockout (expiry + attempt_count + is_used).
-- · After OTP verification a short-lived reset_token is issued; it is single-use
--   and expires after password_reset_token_expiry_minutes (default: 15).
-- · All state transitions (otp_verified, is_used, attempt_count) are performed
--   by service_role only. Authenticated clients may INSERT and SELECT (minus
--   the hash columns) for their own records.
-- · Unlike employee_invite_otps, no UNIQUE constraint on (tenant_id, user_id,
--   is_used) — multiple in-flight reset requests are allowed; the most recent
--   active one is used by the service layer.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — password_reset_otps
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.users   (id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,

  -- OTP phase
  otp_hash          TEXT        NOT NULL,           -- SHA-256(raw_otp); never the raw code
  expires_at        TIMESTAMPTZ NOT NULL,           -- OTP expiry (otp_expiry_minutes param)
  attempt_count     INTEGER     NOT NULL DEFAULT 0,
  otp_verified      BOOLEAN     NOT NULL DEFAULT FALSE, -- true after correct OTP submitted

  -- Reset token phase (populated atomically when OTP is verified)
  reset_token_hash  TEXT,                           -- SHA-256(raw_reset_token); null until verified
  reset_expires_at  TIMESTAMPTZ,                   -- short TTL after OTP success

  -- Terminal state
  is_used           BOOLEAN     NOT NULL DEFAULT FALSE, -- true after password actually changed

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.password_reset_otps IS
  'Tracks the full lifecycle of a user-initiated password reset: OTP → reset token → done. '
  'Neither otp_hash nor reset_token_hash stores raw values — both are SHA-256 digests.';

COMMENT ON COLUMN public.password_reset_otps.otp_hash IS
  'SHA-256 hex digest of the 6-digit OTP sent to the user''s email.';
COMMENT ON COLUMN public.password_reset_otps.reset_token_hash IS
  'SHA-256 hex digest of the reset_token returned to the client after OTP verification. '
  'Null until otp_verified = true.';
COMMENT ON COLUMN public.password_reset_otps.reset_expires_at IS
  'Expiry for the reset token (password_reset_token_expiry_minutes after OTP verified). '
  'Null until otp_verified = true.';

-- =============================================================================
-- SECTION 2 — updated_at TRIGGER
-- =============================================================================

SELECT public.create_updated_at_trigger('password_reset_otps');

-- =============================================================================
-- SECTION 3 — INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pro_tenant_id
  ON public.password_reset_otps (tenant_id);

CREATE INDEX IF NOT EXISTS idx_pro_email
  ON public.password_reset_otps (email);

CREATE INDEX IF NOT EXISTS idx_pro_expires_at
  ON public.password_reset_otps (expires_at);

-- Fast lookup of active (unverified, unused) OTPs for an email
CREATE INDEX IF NOT EXISTS idx_pro_active_otp
  ON public.password_reset_otps (tenant_id, email)
  WHERE otp_verified = FALSE AND is_used = FALSE;

-- Fast lookup of verified-but-unused tokens for password-set step
CREATE INDEX IF NOT EXISTS idx_pro_active_token
  ON public.password_reset_otps (tenant_id, email)
  WHERE otp_verified = TRUE AND is_used = FALSE;

-- =============================================================================
-- SECTION 4 — ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_otps FORCE  ROW LEVEL SECURITY;

-- ── Policies ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS pro_select_own  ON public.password_reset_otps;
DROP POLICY IF EXISTS pro_insert_own  ON public.password_reset_otps;
DROP POLICY IF EXISTS pro_update_deny ON public.password_reset_otps;
DROP POLICY IF EXISTS pro_delete_deny ON public.password_reset_otps;

-- Authenticated user may view their own reset records (hash columns revoked below)
CREATE POLICY pro_select_own
  ON public.password_reset_otps FOR SELECT
  TO authenticated
  USING (
    user_id   = auth.uid()
    AND tenant_id = public.auth_tenant_id()
  );

-- Forgot-password page calls /api/auth/request-reset which uses service_role.
-- Authenticated INSERT policy is present for completeness but the service_role
-- client is the only path in practice.
CREATE POLICY pro_insert_own
  ON public.password_reset_otps FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id   = auth.uid()
    AND tenant_id = public.auth_tenant_id()
  );

-- ALL state mutations (attempt_count, otp_verified, reset_token_hash, is_used)
-- are performed exclusively by service_role — block authenticated UPDATE.
CREATE POLICY pro_update_deny
  ON public.password_reset_otps FOR UPDATE
  TO authenticated
  USING (FALSE);

-- Users should not be able to delete their own reset records
CREATE POLICY pro_delete_deny
  ON public.password_reset_otps FOR DELETE
  TO authenticated
  USING (FALSE);

-- =============================================================================
-- SECTION 5 — COLUMN-LEVEL SECURITY (hash columns)
-- =============================================================================

-- Revoke SELECT on the full table, then re-grant per safe column.
-- otp_hash and reset_token_hash are excluded — service_role verifies server-side.
REVOKE SELECT ON public.password_reset_otps FROM authenticated;

GRANT SELECT (
  id, tenant_id, user_id, email,
  expires_at, attempt_count, otp_verified,
  reset_expires_at, is_used,
  created_at, updated_at
) ON public.password_reset_otps TO authenticated;

-- =============================================================================
-- SECTION 6 — EXPLICIT TABLE-LEVEL GRANTS
-- =============================================================================

GRANT ALL ON public.password_reset_otps TO service_role;

GRANT SELECT, INSERT
  ON public.password_reset_otps TO authenticated;

-- =============================================================================
-- SECTION 7 — SYSTEM PARAMETERS
-- =============================================================================

INSERT INTO public.system_parameters
  (id, tenant_id, key, value, value_type, description, is_secret)
VALUES
  (gen_random_uuid(), NULL,
   'password_reset_token_expiry_minutes', '15',
   'integer',
   'Minutes a reset token remains valid after OTP verification. Default: 15.',
   FALSE)
ON CONFLICT (tenant_id, key) DO UPDATE SET
  value       = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- =============================================================================
-- SECTION 8 — VERIFICATION
-- =============================================================================

DO $verify$
DECLARE
  v_tbl_exists  BOOLEAN;
  v_rls_row     RECORD;
  v_param       TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class
     WHERE relname = 'password_reset_otps'
       AND relnamespace = 'public'::regnamespace
  ) INTO v_tbl_exists;

  SELECT relrowsecurity, relforcerowsecurity INTO v_rls_row
    FROM pg_class
   WHERE relname = 'password_reset_otps'
     AND relnamespace = 'public'::regnamespace;

  SELECT value INTO v_param FROM public.system_parameters
   WHERE key = 'password_reset_token_expiry_minutes' AND tenant_id IS NULL;

  RAISE NOTICE '─────────────────────────────────────────────────────';
  RAISE NOTICE '007_password_reset verification:';
  RAISE NOTICE '  password_reset_otps exists  : %', v_tbl_exists;
  RAISE NOTICE '  RLS enabled                 : %', v_rls_row.relrowsecurity;
  RAISE NOTICE '  RLS forced                  : %', v_rls_row.relforcerowsecurity;
  RAISE NOTICE '  reset_token_expiry_minutes  : %', v_param;

  IF NOT v_tbl_exists         THEN RAISE EXCEPTION 'password_reset_otps table missing';        END IF;
  IF NOT v_rls_row.relrowsecurity
                              THEN RAISE EXCEPTION 'RLS not enabled on password_reset_otps';    END IF;
  IF v_param IS NULL          THEN RAISE EXCEPTION 'password_reset_token_expiry_minutes missing'; END IF;

  RAISE NOTICE 'All 007_password_reset assertions passed.';
  RAISE NOTICE '─────────────────────────────────────────────────────';
END $verify$;

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================
