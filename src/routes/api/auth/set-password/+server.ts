/**
 * src/routes/api/auth/set-password/+server.ts
 *
 * POST /api/auth/set-password
 *
 * Complete employee activation by setting a permanent password.
 * An alternative completion path to the magic-link flow in /api/auth/verify-otp.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC ENDPOINT — no session required.
 * Called by an invited employee who submits: email + OTP + chosen password.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ FLOW RELATIONSHIP ────────────────────────────────────────────────────────
 * │  Two mutually exclusive completion paths exist for invited users:
 * │
 * │  Path A — Magic link  : POST /api/auth/verify-otp  (email + otp)
 * │                          → consumes OTP → activates account → returns magic link
 * │
 * │  Path B — Set password: POST /api/auth/set-password (email + otp + password)
 * │                          → consumes OTP → sets password → activates account
 * │
 * │  Both paths consume the OTP on success.
 * │  Using Path A makes Path B unusable, and vice versa.
 * └────────────────────────────────────────────────────────────────────────────
 *
 * REQUEST BODY (JSON)
 *   {
 *     email:    string   — invited employee's email address
 *     otp:      string   — 6-digit code from invite email
 *     password: string   — chosen password (8–72 chars)
 *   }
 *
 * PIPELINE
 *   1.  Parse + validate input     — email format, 6-digit OTP, password length
 *   2.  Resolve tenant             — look up active OTP by email via admin client;
 *                                    extract tenant_id + user_id from record
 *                                    (never accepted from the caller)
 *   3.  Verify OTP                 — verifyOtp() enforces all four guards:
 *                                    a. record exists + is_used = false
 *                                    b. attempt_count < otp_max_attempts
 *                                    c. expires_at > now()
 *                                    d. SHA-256(submitted_otp) === stored otp_hash
 *                                    ✓ Marks is_used = true on success
 *   4.  Set Auth password          — admin.auth.admin.updateUserById(userId, {
 *                                      password,
 *                                      email_confirm: true   ← ensures confirmed
 *                                    })
 *   5.  Activate public profile    — UPDATE users SET status = 'active'
 *                                    WHERE id = userId AND status = 'invited'
 *                                    (guard prevents double-activation)
 *   6.  Audit log                  — written for every outcome with ip + user_agent
 *   7.  Return                     — 200 { ok: true, data: { activated: true } }
 *
 * OPERATION ORDER — critical for replay safety
 *   OTP is consumed (step 3) BEFORE the password is set (step 4).
 *   If step 4 or 5 fails after the OTP is consumed, the admin must resend the
 *   invite — there is no safe way to "un-consume" an OTP after verification.
 *   This ordering prevents replay attacks where an adversary captures the OTP
 *   and races the legitimate user.
 *
 * RESPONSES
 *   200  { ok: true,  data: { activated: true } }
 *          — account is active; user can log in at /login with email + password
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   401  { ok: false, error: { code, message, attemptsRemaining? } }
 *          — OTP wrong / expired / locked / not found
 *   500  { ok: false, error: { code: 'ACTIVATION_FAILED', message } }
 *          — OTP consumed but Auth or DB step failed; admin must resend invite
 *
 * SECURITY
 *   · Backend-only: all Supabase calls use the service-role client (bypasses RLS).
 *   · tenant_id is resolved from our DB; never trusted from the client.
 *   · Password is never logged, never stored in plain text.
 *   · Supabase stores passwords as bcrypt hashes (max 72 chars — enforced here).
 *   · Anti-enumeration: NOT_FOUND and INVALID_CODE share the same visible message.
 *   · email_confirm = true is set unconditionally on the Auth user to cover any
 *     edge-case where the flag was cleared (e.g. manual DB intervention).
 *   · The status guard (.eq('status', 'invited')) makes activation idempotent
 *     from Postgres's perspective — a second call is a silent no-op.
 */

import { json }                             from '@sveltejs/kit'
import type { RequestEvent, RequestHandler } from './$types'
import { getAdminClient }                   from '$lib/server/auth/supabase-admin.js'
import { verifyOtp }                        from '$lib/server/auth/otp.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** bcrypt processes only the first 72 bytes; enforce on input to avoid silent truncation. */
const PASSWORD_MAX_LEN = 72
const PASSWORD_MIN_LEN = 8

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetPasswordBody {
  email:    string
  otp:      string
  password: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse (
  status:  number,
  code:    string,
  message: string,
  extra?:  Record<string, unknown>
) {
  return json({ ok: false, error: { code, message, ...extra } }, { status })
}

function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async (event: RequestEvent) => {
  const { request } = event

  // ── 1. Parse + validate body ───────────────────────────────────────────────
  let body: SetPasswordBody
  try {
    body = await request.json() as SetPasswordBody
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.')
  }

  const validationError = validateBody(body)
  if (validationError) {
    return errorResponse(400, 'VALIDATION_ERROR', validationError)
  }

  const email    = body.email.toLowerCase().trim()
  const rawCode  = body.otp.trim()
  // Password kept as-is — no trim, preserving intentional leading/trailing spaces.
  // Length was already validated against the trimmed value below.
  const password = body.password

  const admin = getAdminClient()

  // ── 2. Resolve tenant — look up active OTP record by email ────────────────
  //    tenant_id and user_id are extracted from our DB; never from the request.
  const { data: pendingOtp, error: lookupErr } = await admin
    .from('employee_invite_otps')
    .select('id, tenant_id, user_id, attempt_count, expires_at')
    .eq('email',   email)
    .eq('is_used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupErr) {
    console.error('[set-password] OTP lookup error:', lookupErr.message)
    return errorResponse(500, 'INTERNAL', 'An error occurred. Please try again.')
  }

  // Anti-enumeration: absent record is indistinguishable from wrong code
  if (!pendingOtp) {
    void writeAuditLog(admin, event, {
      tenant_id:     null,
      actor_user_id: null,
      action:        'auth.set_password_otp_not_found',
      entity_type:   'employee_invite_otp',
      entity_id:     null,
      metadata:      { email },
    })
    return errorResponse(
      401, 'INVALID_OR_EXPIRED',
      'The code is incorrect or has expired. Please check your email and try again.'
    )
  }

  const tenantId = pendingOtp.tenant_id as string
  const userId   = pendingOtp.user_id   as string

  // ── 3. Verify OTP — full four-factor check ────────────────────────────────
  //    verifyOtp() checks: is_used, attempt_count, expiry, hash.
  //    On success: marks is_used = true in the same DB call.
  //    On failure: increments attempt_count (fire-and-forget inside otp.ts).
  //
  //    The OTP is consumed HERE — before the password is set — to prevent
  //    replay attacks. Any failure after this point requires an admin resend.
  const otpResult = await verifyOtp(admin, tenantId, email, rawCode)

  if (!otpResult.ok) {
    const { code, message } = otpResult.error

    let attemptsRemaining: number | undefined
    if (code === 'INVALID_CODE') {
      const match = message.match(/(\d+) attempt/)
      attemptsRemaining = match ? parseInt(match[1], 10) : undefined
    }

    const auditAction =
      code === 'MAX_ATTEMPTS' ? 'auth.set_password_otp_locked'  :
      code === 'EXPIRED'      ? 'auth.set_password_otp_expired' :
      code === 'ALREADY_USED' ? 'auth.set_password_otp_reused'  :
                                'auth.set_password_otp_failed'

    void writeAuditLog(admin, event, {
      tenant_id:     tenantId,
      actor_user_id: null,
      action:        auditAction,
      entity_type:   'employee_invite_otp',
      entity_id:     pendingOtp.id as string,
      metadata:      { email, error_code: code },
    })

    const visibleMessage =
      code === 'MAX_ATTEMPTS'
        ? 'Too many incorrect attempts. Please request a new invite from your administrator.'
        : 'The code is incorrect or has expired. Please check your email and try again.'

    return errorResponse(
      401, code, visibleMessage,
      attemptsRemaining !== undefined ? { attemptsRemaining } : undefined
    )
  }

  // ── 4. Update Supabase Auth — set password + confirm email ────────────────
  //    updateUserById uses the service-role client and bypasses all client-side
  //    auth flows. email_confirm: true is set unconditionally as a guard.
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  })

  if (authErr) {
    console.error('[set-password] Auth password update failed:', authErr.message)

    void writeAuditLog(admin, event, {
      tenant_id:     tenantId,
      actor_user_id: null,
      action:        'auth.set_password_auth_update_failed',
      entity_type:   'user',
      entity_id:     userId,
      // Never log the password — log only the error
      metadata:      { email, error: authErr.message },
    })

    return errorResponse(
      500, 'ACTIVATION_FAILED',
      'We verified your code but could not set your password. ' +
      'Please contact your administrator to resend your invite.'
    )
  }

  // ── 5. Activate public profile — flip users.status = 'invited' → 'active' ─
  //    The .eq('status', 'invited') guard makes this idempotent:
  //    if the row is already 'active', the UPDATE matches 0 rows (silent no-op).
  //    We check for an actual update to detect unexpected state.
  const { data: activated, error: dbErr } = await admin
    .from('users')
    .update({ status: 'active' })
    .eq('tenant_id', tenantId)
    .eq('id',        userId)
    .eq('status',    'invited')
    .select('id, email')
    .maybeSingle()

  if (dbErr) {
    console.error('[set-password] users.status update failed:', dbErr.message)

    void writeAuditLog(admin, event, {
      tenant_id:     tenantId,
      actor_user_id: userId,
      action:        'auth.set_password_status_update_failed',
      entity_type:   'user',
      entity_id:     userId,
      metadata:      { email, error: dbErr.message },
    })

    // Auth password was set successfully. The user technically has credentials
    // but their profile status is still 'invited'. Log the discrepancy clearly
    // so an admin can manually flip the status if needed.
    return errorResponse(
      500, 'ACTIVATION_FAILED',
      'Your password was set but account activation could not be completed. ' +
      'Please contact your administrator.'
    )
  }

  // activated === null means the row existed but status was not 'invited'
  // (e.g. already 'active' from a prior call). Treat as success — idempotent.
  if (!activated) {
    console.warn('[set-password] No row updated for userId:', userId, '— may already be active')
  }

  // ── 6. Audit log — success ────────────────────────────────────────────────
  void writeAuditLog(admin, event, {
    tenant_id:     tenantId,
    actor_user_id: userId,
    action:        'auth.set_password_completed',
    entity_type:   'user',
    entity_id:     userId,
    metadata:      { email },
  })

  // ── 7. Return success ─────────────────────────────────────────────────────
  //    Account is now active. The user can log in at /login with email + password.
  //    No magic link is returned — this flow uses credentials, not tokens.
  return json(
    {
      ok:   true,
      data: { activated: true },
    },
    { status: 200 }
  )
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateBody (body: SetPasswordBody): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.'
  }

  // email
  if (!body.email || typeof body.email !== 'string') {
    return 'email is required.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'email is not a valid email address.'
  }

  // otp
  if (!body.otp || typeof body.otp !== 'string') {
    return 'otp is required.'
  }
  if (!/^\d{6}$/.test(body.otp.trim())) {
    return 'otp must be exactly 6 digits.'
  }

  // password
  if (!body.password || typeof body.password !== 'string') {
    return 'password is required.'
  }
  // Validate trimmed length to catch all-whitespace passwords
  if (body.password.trim().length < PASSWORD_MIN_LEN) {
    return `password must be at least ${PASSWORD_MIN_LEN} characters.`
  }
  // Validate raw length against bcrypt limit
  if (body.password.length > PASSWORD_MAX_LEN) {
    return `password must be ${PASSWORD_MAX_LEN} characters or fewer.`
  }

  return null
}

// ---------------------------------------------------------------------------
// Audit log helper
// ---------------------------------------------------------------------------

async function writeAuditLog (
  admin:   ReturnType<typeof getAdminClient>,
  event:   RequestEvent,
  payload: {
    tenant_id:     string | null
    actor_user_id: string | null
    action:        string
    entity_type:   string
    entity_id:     string | null
    metadata:      Record<string, unknown>
  }
): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      tenant_id:     payload.tenant_id,
      actor_user_id: payload.actor_user_id,
      action:        payload.action,
      entity_type:   payload.entity_type,
      entity_id:     payload.entity_id ?? null,
      metadata:      payload.metadata,
      ip_address:    event.getClientAddress(),
      user_agent:    event.request.headers.get('user-agent') ?? null,
    })
  } catch (err) {
    console.error('[set-password] Audit log write failed:', toMessage(err))
  }
}
