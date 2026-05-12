/**
 * src/routes/api/auth/request-reset/+server.ts
 *
 * POST /api/auth/request-reset
 *
 * Step 1 of the forgot-password flow: send a reset OTP to the user's email.
 *
 * PUBLIC ENDPOINT — no session required.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-ENUMERATION GUARANTEE
 * Always returns 200 { ok: true, data: { message } } regardless of whether the
 * email exists, the account is active, or the DB call succeeds.
 * The client MUST display a generic message like:
 *   "If this email is registered, you'll receive a reset code shortly."
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * REQUEST BODY (JSON)
 *   { email: string }
 *
 * RESPONSES
 *   200  { ok: true,  data: { message: string } }   — always, regardless of email state
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   500  { ok: false, error: { code: 'INTERNAL', message } }  — only for DB-level failures
 */

import { json }                     from '@sveltejs/kit'
import type { RequestEvent, RequestHandler } from './$types'
import { getAdminClient }           from '$lib/server/auth/supabase-admin.js'
import { requestPasswordReset }     from '$lib/server/auth/password-reset.js'

const GENERIC_MESSAGE =
  "If this email address is registered, you'll receive a reset code shortly. " +
  "Please check your inbox (and spam folder)."

function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const POST: RequestHandler = async (event: RequestEvent) => {
  const { request } = event

  // ── 1. Parse + validate ───────────────────────────────────────────────────
  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } }, { status: 400 })
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is required.' } }, { status: 400 })
  }

  const email = body.email.toLowerCase().trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is not a valid email address.' } }, { status: 400 })
  }

  // ── 2. Run request pipeline ───────────────────────────────────────────────
  const admin  = getAdminClient()
  const result = await requestPasswordReset(admin, email)

  if (!result.ok) {
    // DB-level error — safe to return 500 (no enumeration risk since the error
    // doesn't reveal whether the email is registered)
    console.error('[request-reset] pipeline error:', result.error)
    return json({ ok: false, error: { code: 'INTERNAL', message: 'An error occurred. Please try again.' } }, { status: 500 })
  }

  // ── 3. Audit log ──────────────────────────────────────────────────────────
  void writeAuditLog(admin, event, {
    action:    result.data.sent ? 'auth.password_reset_requested' : 'auth.password_reset_unknown_email',
    metadata:  { email, sent: result.data.sent },
  })

  // ── 4. Always return the same generic message ─────────────────────────────
  return json({ ok: true, data: { message: GENERIC_MESSAGE } }, { status: 200 })
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
      tenant_id:     null,  // unknown at this stage — no session
      actor_user_id: null,
      action:        payload.action,
      entity_type:   'password_reset_otp',
      metadata:      payload.metadata,
      ip_address:    event.getClientAddress(),
      user_agent:    event.request.headers.get('user-agent') ?? null,
    })
  } catch (err) {
    console.error('[request-reset] Audit log write failed:', toMessage(err))
  }
}
