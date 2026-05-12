/**
 * src/routes/api/auth/verify-reset-otp/+server.ts
 *
 * POST /api/auth/verify-reset-otp
 *
 * Step 2 of the forgot-password flow: validate the OTP and issue a short-lived
 * reset token the client must pass to /api/auth/reset-password.
 *
 * PUBLIC ENDPOINT — no session required.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUEST BODY (JSON)
 *   { email: string, otp: string }
 *
 * RESPONSES
 *   200  { ok: true,  data: { resetToken: string, expiresAt: string } }
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   401  { ok: false, error: { code, message, attemptsRemaining? } }
 *         codes: INVALID_OR_EXPIRED | EXPIRED | MAX_ATTEMPTS
 *   500  { ok: false, error: { code: 'INTERNAL', message } }
 *
 * SECURITY
 *   · resetToken is a 32-byte random hex string (64 chars), stored as SHA-256
 *     in the DB. The raw token is returned once and never persisted.
 *   · Token expires after password_reset_token_expiry_minutes (default: 15 min).
 *   · Anti-enumeration: NOT_FOUND is collapsed into INVALID_OR_EXPIRED so the
 *     visible message does not confirm whether the email has a pending reset.
 */

import { json }                              from '@sveltejs/kit'
import type { RequestEvent, RequestHandler } from './$types'
import { getAdminClient }                    from '$lib/server/auth/supabase-admin.js'
import { verifyPasswordResetOtp }            from '$lib/server/auth/password-reset.js'

function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const POST: RequestHandler = async (event: RequestEvent) => {
  const { request } = event

  // ── 1. Parse + validate ───────────────────────────────────────────────────
  let body: { email?: unknown; otp?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } }, { status: 400 })
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is required.' } }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'email is not a valid email address.' } }, { status: 400 })
  }
  if (!body.otp || typeof body.otp !== 'string') {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'otp is required.' } }, { status: 400 })
  }
  if (!/^\d{6}$/.test(body.otp.trim())) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'otp must be exactly 6 digits.' } }, { status: 400 })
  }

  const email   = body.email.toLowerCase().trim()
  const rawCode = body.otp.trim()

  // ── 2. Verify OTP ─────────────────────────────────────────────────────────
  const admin  = getAdminClient()
  const result = await verifyPasswordResetOtp(admin, email, rawCode)

  if (!result.ok) {
    const { code, message } = result.error

    // Extract remaining attempts for UX (INVALID_CODE only)
    let attemptsRemaining: number | undefined
    if (code === 'INVALID_CODE') {
      const match = message.match(/(\d+) attempt/)
      attemptsRemaining = match ? parseInt(match[1], 10) : undefined
    }

    void writeAuditLog(admin, event, {
      action:   code === 'MAX_ATTEMPTS' ? 'auth.reset_otp_locked'
              : code === 'EXPIRED'      ? 'auth.reset_otp_expired'
              : code === 'ALREADY_USED' ? 'auth.reset_otp_reused'
              : code === 'NOT_FOUND'    ? 'auth.reset_otp_not_found'
              :                          'auth.reset_otp_failed',
      metadata: { email, error_code: code },
    })

    // Collapse NOT_FOUND + INVALID_CODE into one visible message (anti-enumeration)
    const visibleMessage =
      code === 'MAX_ATTEMPTS'
        ? 'Too many incorrect attempts. Please request a new reset code.'
        : 'The code is incorrect or has expired. Please check your email and try again.'

    return json(
      { ok: false, error: { code: code === 'NOT_FOUND' ? 'INVALID_OR_EXPIRED' : code, message: visibleMessage,
          ...(attemptsRemaining !== undefined ? { attemptsRemaining } : {}) } },
      { status: 401 }
    )
  }

  // ── 3. Audit log — success ────────────────────────────────────────────────
  void writeAuditLog(admin, event, {
    action:   'auth.reset_otp_verified',
    metadata: { email },
  })

  // ── 4. Return reset token ─────────────────────────────────────────────────
  //    Client stores this in memory and passes it to /api/auth/reset-password.
  //    It must NOT be stored in localStorage (short-lived, single-use).
  return json(
    {
      ok:   true,
      data: {
        resetToken: result.data.rawToken,
        expiresAt:  result.data.expiresAt.toISOString(),
      },
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
    console.error('[verify-reset-otp] Audit log write failed:', toMessage(err))
  }
}
