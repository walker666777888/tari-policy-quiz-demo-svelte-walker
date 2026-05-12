-- =============================================================================
-- 008_jwt_claims_hook.sql
-- Custom Access Token Hook — stamp role + tenant_id into every JWT
--
-- WHAT THIS MIGRATION ADDS
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. custom_access_token_hook()  — Postgres function called by Supabase Auth
--    whenever a JWT is issued (sign-in, refresh). Adds:
--      jwt.role        → user's app role  (employee | cxo | client_admin | super_admin)
--      jwt.tenant_id   → user's tenant UUID (as text, for JSON compat)
--
-- 2. Grants the supabase_auth_admin role EXECUTE privilege on the function.
--
-- REGISTRATION (manual step — cannot be done via SQL migration)
-- ─────────────────────────────────────────────────────────────────────────────
-- After applying this migration, register the hook in the Supabase dashboard:
--   Auth → Hooks → Custom Access Token → enable
--   Function:  public.custom_access_token_hook
--
-- SECURITY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- · SECURITY DEFINER + SET search_path = '' prevents search-path injection.
-- · The function is STABLE (reads DB, no writes).
-- · super_admin users typically operate via service_role and will have their
--   role in the JWT for audit purposes even though RLS is bypassed.
-- · If the user has no public.users row (e.g. service-role API keys), the
--   function returns the event unchanged — callers receive a JWT without
--   custom claims, which routes to the "unauthenticated" path in guards.
-- · hooks.server.ts falls back to a DB lookup when claims are absent so the
--   app works correctly before this hook is registered.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook (event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   UUID;
  v_role      TEXT;
  v_tenant_id UUID;
  claims      JSONB;
BEGIN
  -- Extract the auth user UUID from the hook event
  v_user_id := (event ->> 'user_id')::UUID;

  -- Read app role and tenant from public.users.
  -- Returns nothing if the user has no profile row (service keys, etc.)
  SELECT role, tenant_id
    INTO v_role, v_tenant_id
    FROM public.users
   WHERE id = v_user_id
   LIMIT 1;

  -- Nothing to stamp — return event unchanged
  IF v_role IS NULL THEN
    RETURN event;
  END IF;

  -- Clone existing claims and add custom fields
  claims := event -> 'claims';

  claims := jsonb_set(claims, '{role}',      to_jsonb(v_role));
  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::TEXT));

  RETURN jsonb_set(event, '{claims}', claims);

EXCEPTION
  -- Never let a hook failure block the sign-in flow
  WHEN OTHERS THEN
    RAISE WARNING '[custom_access_token_hook] error stamping claims for user %: %', v_user_id, SQLERRM;
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Supabase Custom Access Token Hook. '
  'Stamps jwt.role and jwt.tenant_id from public.users into every issued JWT. '
  'Must be registered in Auth → Hooks in the Supabase dashboard.';

-- =============================================================================
-- SECTION 2 — GRANTS
-- =============================================================================

-- supabase_auth_admin is the role Supabase Auth uses to invoke hooks.
-- This grant may produce a notice in local dev (role might not exist) — safe to ignore.
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_auth_admin role not found (local dev) — skipping GRANT.';
END;
$$;

-- Revoke from public: the function should only be called by the auth system
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- service_role needs EXECUTE so the function can SELECT from public.users
-- (SECURITY DEFINER runs as the function owner, so this is belt-and-suspenders)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;

-- =============================================================================
-- SECTION 3 — VERIFICATION
-- =============================================================================

DO $verify$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'custom_access_token_hook'
  ) INTO v_exists;

  RAISE NOTICE '─────────────────────────────────────────────────────';
  RAISE NOTICE '008_jwt_claims_hook verification:';
  RAISE NOTICE '  custom_access_token_hook exists : %', v_exists;
  RAISE NOTICE '  NEXT STEP: register in Auth → Hooks in Supabase dashboard';
  RAISE NOTICE '─────────────────────────────────────────────────────';

  IF NOT v_exists THEN
    RAISE EXCEPTION 'custom_access_token_hook function missing';
  END IF;
END $verify$;

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================
