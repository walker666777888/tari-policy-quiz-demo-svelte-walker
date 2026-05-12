/**
 * src/routes/api/auth/verify-otp/+server.ts
 *
 * POST /api/auth/verify-otp
 *
 * OTP verification for invited employees completing onboarding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC ENDPOINT — no session required.
 * Called by an employee who received an invite email containing a 6-digit OTP.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * REQUEST BODY (JSON)
 *   { email: string, otp: string }
 *
 * FLOW
 *   1.  Parse + validate input (email format, OTP 6-digit format)
 *   2.  Resolve tenant   — look up active OTP record by email via admin client;
 *                          extract tenant_id from the record itself (never from
 *                          the client payload — prevents cross-tenant hijack)
 *   3.  Verify OTP       — verifyOtp() enforces all four guards in order:
 *                            a. record exists + is_used = false
 *                            b. attempt_count < otp_max_attempts
 *                            c. expires_at > now()
 *                            d. SHA-256(submitted_otp) === stored otp_hash
 *                          On failure: increments attempt_count; returns typed error
 *                          On success: marks is_used = true
 *   4.  Activate account — activateUser() flips users.status → 'active'
 *                          and generates a Supabase magic link
 *   5.  Audit log        — written for success, failure, and lockout events
 *   6.  Return response  — see RESPONSES below
 *
 * RESPONSES
 *   200  Verified + activated:
 *          { ok: true, data: { activated: true, magicLink: string } }
 *        Verified + activated but magic-link generation failed:
 *          { ok: true, data: { activated: true, magicLink: null,
 *                              message: "Account activated. Please log in." } }
 *   400  Malformed input:
 *          { ok: false, error: { code: 'VALIDATION_ERROR', message } }
 *   401  OTP wrong / expired / locked / not found:
 *          { ok: false, error: { code, message, attemptsRemaining? } }
 *   500  Activation DB error (OTP already consumed — no retry possible):
 *          { ok: false, error: { code: 'ACTIVATION_FAILED', message } }
 *
 * SECURITY
 *   · tenant_id is resolved from our DB only — not accepted from the caller.
 *   · Anti-enumeration: NOT_FOUND and INVALID_CODE return 401 with a generic
 *     outer message. The typed error code is present for UI branching, but the
 *     visible message does not confirm whether the email exists.
 *   · attempt_count is the rate-limit mechanism. The OTP is locked after
 *     otp_max_attempts (default 5) failures, requiring a fresh invite.
 *   · The OTP hash is never returned to the caller. The plain code is hashed
 *     in verifyOtp() before DB comparison (SHA-256 via otp.ts).
 *   · Magic link is a one-time Supabase URL — single use, expires in 60 s.
 *   · ip_address + user_agent are captured in audit_logs for forensics.
 */

import { json }                                  from '@sveltejs/kit'
import type { RequestEvent, RequestHandler }      from './$types'
import { getAdminClient }                         from '$lib/server/auth/supabase-admin.js'
import { verifyOtp }                              from '$lib/server/auth/otp.js'
import { activateUser }                           from '$lib/server/auth/invite.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyOtpBody {
  email: string
  otp:   string
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
  let body: VerifyOtpBody
  try {
    body = await request.json() as VerifyOtpBody
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.')
  }

  const validationError = validateBody(body)
  if (validationError) {
    return errorResponse(400, 'VALIDATION_ERROR', validationError)
  }

  const email   = body.email.toLowerCase().trim()
  const rawCode = body.otp.trim()

  const admin = getAdminClient()

  // ── 2. Resolve tenant — find active OTP record by email ───────────────────
  //    We do NOT accept tenant_id from the client. The tenant_id is extracted
  //    from the OTP record itself so the caller cannot target another tenant.
  //
  //    This is a read of the encrypted (hashed) record — no sensitive data
  //    leaves the server at this stage.
  const { data: pendingOtp, error: lookupErr } = await admin
    .from('employee_invite_otps')
    .select('id, tenant_id, user_id, attempt_count, expires_at, is_used')
    .eq('email',   email)
    .eq('is_used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupErr) {
    console.error('[verify-otp] OTP lookup error:', lookupErr.message)
    return errorResponse(500, 'INTERNAL', 'An error occurred. Please try again.')
  }

  // Anti-enumeration: if no active OTP exists for this email, return the same
  // 401 shape as an invalid code so the error reveals nothing about the email.
  if (!pendingOtp) {
    void writeAuditLog(admin, event, {
      tenant_id:     null,
      actor_user_id: null,
      action:        'auth.otp_not_found',
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

  // ── 3. Verify OTP — full four-factor check via otp.ts ────────────────────
  //    verifyOtp() handles:
  //      · is_used guard        (ALREADY_USED — belt-and-suspenders, filtered above)
  //      · attempt_count guard  (MAX_ATTEMPTS — locks the code)
  //      · expiry guard         (EXPIRED)
  //      · hash comparison      (INVALID_CODE — increments attempt_count on failure)
  //    On success: marks is_used = true in the same call
  const otpResult = await verifyOtp(admin, tenantId, email, rawCode)

  if (!otpResult.ok) {
    const { code, message } = otpResult.error

    // Determine remaining attempts to surface in the response (UX only —
    // the DB is the authoritative lock regardless of what we return here)
    let attemptsRemaining: number | undefined

    if (code === 'INVALID_CODE') {
      // message from verifyOtp already contains remaining count, but we also
      // include it as a typed field for programmatic use
      const match = message.match(/(\d+) attempt/)
      attemptsRemaining = match ? parseInt(match[1], 10) : undefined
    }

    // Audit — distinguish lockout from normal failure
    const auditAction =
      code === 'MAX_ATTEMPTS' ? 'auth.otp_locked'   :
      code === 'EXPIRED'      ? 'auth.otp_expired'   :
      code === 'ALREADY_USED' ? 'auth.otp_reused'    :
                                'auth.otp_failed'

    void writeAuditLog(admin, event, {
      tenant_id:     tenantId,
      actor_user_id: null,   // not yet authenticated
      action:        auditAction,
      entity_type:   'employee_invite_otp',
      entity_id:     pendingOtp.id as string,
      metadata:      { email, error_code: code },
    })

    // Collapse NOT_FOUND / ALREADY_USED / EXPIRED / INVALID_CODE into one
    // visible message to prevent enumeration of OTP state.
    const visibleMessage =
      code === 'MAX_ATTEMPTS'
        ? 'Too many incorrect attempts. Please request a new invite from your administrator.'
        : 'The code is incorrect or has expired. Please check your email and try again.'

    return errorResponse(
      401, code, visibleMessage,
      attemptsRemaining !== undefined ? { attemptsRemaining } : undefined
    )
  }

  // ── 4. Activate account ───────────────────────────────────────────────────
  //    OTP is now consumed (is_used = true). Flip users.status → 'active'
  //    and generate a Supabase magic link for the first session.
  const activateResult = await activateUser(admin, tenantId, userId)

  if (!activateResult.ok) {
    // Distinguish: activation DB failure vs. magic-link-only failure
    // activateUser returns AUTH_CREATE_FAILED when the DB update succeeded
    // but Supabase link generation failed.
    if (activateResult.error.code === 'AUTH_CREATE_FAILED') {
      // Account IS active — OTP consumed — just the session link that failed.
      // Return 200 partial success so the UI can redirect to /login.
      void writeAuditLog(admin, event, {
        tenant_id:     tenantId,
        actor_user_id: userId,
        action:        'auth.otp_verified_no_link',
        entity_type:   'user',
        entity_id:     userId,
        metadata:      { email, reason: activateResult.error.message },
      })

      return json(
        {
          ok:   true,
          data: {
            activated:  true,
            magicLink:  null,
            message:    'Your account has been activated. Please log in to continue.',
          },
        },
        { status: 200 }
      )
    }

    // DB_ERROR — status was NOT flipped. OTP is consumed but activation failed.
    // The admin must resend the invite for the user to try again.
    console.error('[verify-otp] activateUser DB error:', activateResult.error.message)

    void writeAuditLog(admin, event, {
      tenant_id:     tenantId,
      actor_user_id: null,
      action:        'auth.activation_failed',
      entity_type:   'user',
      entity_id:     userId,
      metadata:      { email, error: activateResult.error.message },
    })

    return errorResponse(
      500, 'ACTIVATION_FAILED',
      'We verified your code but could not activate your account. ' +
      'Please contact your administrator to resend your invite.'
    )
  }

  // ── 5. Audit — success ────────────────────────────────────────────────────
  void writeAuditLog(admin, event, {
    tenant_id:     tenantId,
    actor_user_id: userId,
    action:        'auth.otp_verified',
    entity_type:   'user',
    entity_id:     userId,
    metadata:      { email },
  })

  // ── 6. Return magic link ──────────────────────────────────────────────────
  //    The client should do: window.location.href = magicLink
  //    Supabase exchanges the token → sets session cookies → redirects to app.
  return json(
    {
      ok:   true,
      data: {
        activated:  true,
        magicLink:  activateResult.data.magicLink,
      },
    },
    { status: 200 }
  )
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateBody (body: VerifyOtpBody): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.'
  }

  if (!body.email || typeof body.email !== 'string') {
    return 'email is required.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'email is not a valid email address.'
  }

  if (!body.otp || typeof body.otp !== 'string') {
    return 'otp is required.'
  }
  if (!/^\d{6}$/.test(body.otp.trim())) {
    return 'otp must be exactly 6 digits.'
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
    console.error('[verify-otp] Audit log write failed:', toMessage(err))
  }
}
