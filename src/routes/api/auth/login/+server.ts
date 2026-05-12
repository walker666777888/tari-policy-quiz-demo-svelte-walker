/**
 * src/routes/api/auth/login/+server.ts
 *
 * POST /api/auth/login
 *
 * Email + password authentication.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FLOW
 *   1.  Validate input (email, password)
 *   2.  signInWithPassword() on locals.supabase (the @supabase/ssr server client)
 *         → Supabase Auth validates credentials
 *         → @supabase/ssr automatically sets session cookies on the response
 *   3.  Look up public.users via service-role client
 *         → get role, status, tenant_id
 *         → never trust JWT claims for role (Custom JWT Hook may not be live)
 *   4.  Status guard
 *         · invited  → sign back out, return ACCOUNT_NOT_ACTIVATED
 *         · disabled → sign back out, return ACCOUNT_DISABLED
 *   5.  Return { role, redirectTo }  →  client navigates
 *
 * RESPONSES
 *   200  { ok: true,  data: { role, redirectTo } }
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   401  { ok: false, error: { code: 'INVALID_CREDENTIALS', message } }
 *   403  { ok: false, error: { code: 'ACCOUNT_NOT_ACTIVATED' | 'ACCOUNT_DISABLED', message } }
 *   500  { ok: false, error: { code: 'INTERNAL', message } }
 *
 * SESSION COOKIES
 *   Set automatically by @supabase/ssr when signInWithPassword() is called on
 *   locals.supabase (which has the cookie handlers wired in hooks.server.ts).
 *   No manual cookie manipulation needed here.
 *
 * CSRF
 *   JSON Content-Type triggers a CORS preflight on cross-origin requests —
 *   only same-origin clients can call this endpoint without an explicit CORS
 *   Allow-Origin header (none is configured), providing CSRF protection.
 */

import { json }              from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAdminClient }    from '$lib/server/auth/supabase-admin.js'

// ---------------------------------------------------------------------------
// Role → redirect mapping
// ---------------------------------------------------------------------------

const ROLE_REDIRECTS: Record<string, string> = {
  super_admin:  '/platform',
  client_admin: '/admin',
  employee:     '/dashboard',
  cxo:          '/dashboard',
}

const DEFAULT_REDIRECT = '/dashboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse (status: number, code: string, message: string) {
  return json({ ok: false, error: { code, message } }, { status })
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ locals, request }) => {
  // ── 1. Parse + validate ───────────────────────────────────────────────────
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.')
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'email is required.')
  }
  if (!body.password || typeof body.password !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'password is required.')
  }

  const email    = body.email.toLowerCase().trim()
  const password = body.password as string

  // ── 2. Authenticate via Supabase Auth ─────────────────────────────────────
  //    Using locals.supabase (the @supabase/ssr server client) so cookies are
  //    set on the response automatically via the setAll handler in hooks.server.ts
  const { data: authData, error: authError } =
    await locals.supabase.auth.signInWithPassword({ email, password })

  if (authError || !authData?.user || !authData?.session) {
    // Supabase returns "Invalid login credentials" for both wrong email and
    // wrong password — preserve this anti-enumeration behaviour.
    return errorResponse(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
  }

  const authUserId = authData.user.id

  // ── 3. Load user profile (role, status) from public.users ─────────────────
  //    service-role client used to bypass RLS — JWT claims do not contain
  //    app role until Custom JWT Claims Hook is deployed, so reading from DB
  //    is the only reliable source of truth.
  const admin = getAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, role, status, tenant_id')
    .eq('id', authUserId)
    .single()

  if (profileError || !profile) {
    // Auth succeeded but no public.users row — data integrity issue.
    // Sign the user back out to avoid a dangling authenticated-but-profileless session.
    await locals.supabase.auth.signOut()
    console.error('[login] No public.users row for auth user:', authUserId, profileError?.message)
    return errorResponse(
      500, 'INTERNAL',
      'Your account profile could not be loaded. Please contact your administrator.'
    )
  }

  // ── 4. Status guard ───────────────────────────────────────────────────────
  //    Only 'active' users may log in.
  //    'invited'  → they received an email but haven't completed activation.
  //    'disabled' → an admin has revoked access.
  if (profile.status === 'invited') {
    await locals.supabase.auth.signOut()
    return errorResponse(
      403, 'ACCOUNT_NOT_ACTIVATED',
      'Your account has not been activated yet. ' +
      'Please check your invite email for an activation code.'
    )
  }

  if (profile.status === 'disabled') {
    await locals.supabase.auth.signOut()
    return errorResponse(
      403, 'ACCOUNT_DISABLED',
      'Your account has been disabled. Please contact your administrator.'
    )
  }

  // ── 5. Determine redirect destination ─────────────────────────────────────
  const role       = profile.role as string
  const redirectTo = ROLE_REDIRECTS[role] ?? DEFAULT_REDIRECT

  // ── 6. Return ─────────────────────────────────────────────────────────────
  //    The session is already set in cookies — client just needs to navigate.
  return json(
    {
      ok:   true,
      data: { role, redirectTo },
    },
    { status: 200 }
  )
}
