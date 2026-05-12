/**
 * src/routes/api/auth/reset-password/+server.ts
 *
 * POST /api/auth/reset-password
 *
 * Step 3 of the forgot-password flow: consume the reset token and set the
 * new password on the Supabase Auth user.
 *
 * PUBLIC ENDPOINT — no session required.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUEST BODY (JSON)
 *   {
 *     email:      string   — the user's email
 *     resetToken: string   — 64-char hex token from /api/auth/verify-reset-otp
 *     password:   string   — new password (8–72 chars)
 *   }
 *
 * RESPONSES
 *   200  { ok: true,  data: { message: string } }   — password changed, redirect to /login
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   401  { ok: false, error: { code, message } }
 *         codes: INVALID_TOKEN | EXPIRED | NOT_FOUND | NOT_VERIFIED | ALREADY_USED
 *   500  { ok: false, error: { code: 'INTERNAL', message } }
 *
 * SECURITY
 *   · resetToken hash comparison uses SHA-256 via applyPasswordReset() — the raw
 *     token is never persisted. A wrong token returns 401 without incrementing any
 *     counter (the OTP phase already rate-limited the reset session).
 *   · email_confirm = true is set unconditionally on the Auth user.
 *   · On success, all prior password_reset_otps for this user are NOT deleted here —
 *     the record is marked is_used=true by applyPasswordReset(); expired records
 *     are cleaned up by the pg_cron job.
 *   · bcrypt limit (72 bytes) enforced server-side.
 */

import { json }                              from '@sveltejs/kit'
import type { RequestEvent, RequestHandler } from './$types'
import { getAdminClient }                    from '$lib/server/auth/supabase-admin.js'
import { applyPasswordReset }                from '$lib/server/auth/password-reset.js'

const PASSWORD_MIN_LEN = 8
const PASSWORD_MAX_LEN = 72   // bcrypt hard limit

function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const POST: RequestHandler = async (event: RequestEvent) => {
  const { request } = event

  // ── 1. Parse + validate ───────────────────────────────────────────────────
  let body: { email?: unknown; resetToken?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } }, { status: 400 })
  }

  // email
  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is required.' } }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((body.email as string).trim())) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is not a valid email address.' } }, { status: 400 })
  }

  // resetToken — 64-char hex string
  if (!body.resetToken || typeof body.resetToken !== 'string') {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'resetToken is required.' } }, { status: 400 })
  }
  if (!/^[0-9a-f]{64}$/i.test((body.resetToken as string).trim())) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'resetToken is invalid.' } }, { status: 400 })
  }

  // password
  if (!body.password || typeof body.password !== 'string') {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'password is required.' } }, { status: 400 })
  }
  if ((body.password as string).trim().length < PASSWORD_MIN_LEN) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: `password must be at least ${PASSWORD_MIN_LEN} characters.` } }, { status: 400 })
  }
  if ((body.password as string).length > PASSWORD_MAX_LEN) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: `password must be ${PASSWORD_MAX_LEN} characters or fewer.` } }, { status: 400 })
  }

  const email      = (body.email      as string).toLowerCase().trim()
  const resetToken = (body.resetToken as string).trim()
  const password   = body.password   as string

  // ── 2. Apply password reset ───────────────────────────────────────────────
  const admin  = getAdminClient()
  const result = await applyPasswordReset(admin, email, resetToken, password)

  if (!result.ok) {
    const { code, message } = result.error

    void writeAuditLog(admin, event, {
      action:   code === 'INVALID_TOKEN' ? 'auth.reset_token_invalid'
              : code === 'EXPIRED'       ? 'auth.reset_token_expired'
              : code === 'ALREADY_USED'  ? 'auth.reset_token_reused'
              : code === 'AUTH_ERROR'    ? 'auth.reset_password_auth_failed'
              :                           'auth.reset_password_failed',
      metadata: { email, error_code: code },
    })

    // Auth error (Supabase Auth updateUserById failed) → 500
    if (code === 'AUTH_ERROR' || code === 'DB_ERROR') {
      console.error('[reset-password] Internal error:', code, message)
      return json({ ok: false, error: { code: 'INTERNAL', message: 'An error occurred resetting your password. Please try again.' } }, { status: 500 })
    }

    // Token / session errors → 401
    return json({ ok: false, error: { code, message } }, { status: 401 })
  }

  // ── 3. Audit log — success ────────────────────────────────────────────────
  void writeAuditLog(admin, event, {
    action:   'auth.password_reset_completed',
    metadata: { email, user_id: result.data.userId },
  })

  // ── 4. Return success ─────────────────────────────────────────────────────
  //    The user must now log in with their new password at /login.
  //    We do NOT auto-sign-in here: the reset flow is unauthenticated,
  //    and signing in requires a deliberate step to confirm they have access.
  return json(
    {
      ok:   true,
      data: { message: 'Your password has been reset successfully. You can now sign in.' },
    },
    { status: 200 }
  )
}

// ---------------------------------------------------------------------------
// Audit log helper
// ---------------------------------------------------------------------------

async function writeAuditLog (
  admin:   ReturnType<typeof getAdminClient>,
  event:   RequestEvent,
  payload: { action: string; metadata: Record<string, unknown> }
): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      tenant_id:     null,
      actor_user_id: null,
      action:        payload.action,
      entity_type:   'password_reset_otp',
      metadata:      payload.metadata,
      ip_address:    event.getClientAddress(),
      user_agent:    event.request.headers.get('user-agent') ?? null,
    })
  } catch (err) {
    console.error('[reset-password] Audit log write failed:', toMessage(err))
  }
}
