/**
 * src/lib/server/auth/invite.ts
 *
 * Employee invite lifecycle — create, send, resend.
 *
 * FLOW:
 *  createInvitedUser()
 *    1. Create / reuse a Supabase Auth user (email_confirm: true, random pw)
 *    2. Upsert a public.users row with status = 'invited'
 *    3. Generate an OTP via otp.ts
 *    4. Send the activation email via Resend
 *
 *  resendInvite()
 *    1. Look up the existing user
 *    2. Generate a fresh OTP (old ones are auto-revoked by createOtp)
 *    3. Re-send the activation email
 *
 *  activateUser()
 *    Called after OTP is successfully verified.
 *    1. Flips users.status → 'active'
 *    2. Generates a Supabase magic-link so the user can set up their session
 */

import { randomBytes }          from 'node:crypto'
import type { AdminClient }     from './supabase-admin.js'
import { createOtp }            from './otp.js'
import { RESEND_API_KEY }       from '$env/static/private'
import { PUBLIC_SUPABASE_URL }  from '$env/static/public'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvitePayload {
  email:           string
  fullName:        string
  role?:           'employee' | 'cxo' | 'client_admin'
  employeeCode?:   string
  department?:     string
  designation?:    string
  employeeCategory?: string
  branchId?:       string
}

export interface InvitedUser {
  userId:   string
  email:    string
  status:   'invited'
  otpId:    string
  expiresAt: Date
}

export type InviteResult<T> =
  | { ok: true;  data: T;      error?: never }
  | { ok: false; data?: never; error: InviteError }

export interface InviteError {
  code:    InviteErrorCode
  message: string
}

export type InviteErrorCode =
  | 'USER_EXISTS'        // email already has an active / invited account
  | 'AUTH_CREATE_FAILED' // Supabase Auth refused to create the user
  | 'DB_ERROR'           // public.users insert/update failed
  | 'OTP_ERROR'          // OTP generation failed
  | 'EMAIL_ERROR'        // Resend API call failed
  | 'NOT_FOUND'          // user not found for resend / activate

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FROM_EMAIL    = 'invites@tariplatform.com'
const PLATFORM_NAME = 'Tari Policy Quiz'

/** App base URL — used to build the OTP verification deep-link */
function appBaseUrl (): string {
  // PUBLIC_SUPABASE_URL gives us the project ref; the actual app URL comes
  // from the SvelteKit origin which isn't available here. Fall back to env.
  return process.env.PUBLIC_APP_URL ?? 'https://app.tariplatform.com'
}

// ---------------------------------------------------------------------------
// Email helper (Resend REST API)
// ---------------------------------------------------------------------------

interface EmailPayload {
  to:      string
  subject: string
  html:    string
}

async function sendEmail (payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[invite] RESEND_API_KEY not set — email not sent')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [payload.to],
        subject: payload.subject,
        html:    payload.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Resend ${res.status}: ${body}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildInviteEmail (opts: {
  fullName:   string
  email:      string
  otpCode:    string
  expiresAt:  Date
  tenantName: string
}): string {
  const expiryStr = opts.expiresAt.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
  const verifyUrl = `${appBaseUrl()}/auth/verify-otp?email=${encodeURIComponent(opts.email)}`

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your ${PLATFORM_NAME} Invitation</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a1a">
  <h2 style="color:#2563eb">${PLATFORM_NAME}</h2>
  <p>Hello ${escHtml(opts.fullName)},</p>
  <p>
    You have been invited to join <strong>${escHtml(opts.tenantName)}</strong>
    on ${PLATFORM_NAME}. Use the one-time code below to activate your account.
  </p>
  <div style="background:#f0f4ff;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Your one-time code (expires at ${expiryStr})</p>
    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#2563eb">
      ${escHtml(opts.otpCode)}
    </p>
  </div>
  <p>
    <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;
      padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      Verify &amp; Activate Account
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280">
    This code expires in 10 minutes. If you did not expect this invitation,
    you can safely ignore this email.
  </p>
</body>
</html>`.trim()
}

function escHtml (s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
}

// ---------------------------------------------------------------------------
// createInvitedUser
// ---------------------------------------------------------------------------

/**
 * Full invite flow for a single employee.
 *
 * Idempotent: if the Auth user already exists but is still 'invited',
 * a fresh OTP is issued and the email is re-sent.
 *
 * @param admin      Service-role Supabase client
 * @param tenantId   UUID of the tenant the user belongs to
 * @param tenantName Human-readable name shown in the email
 * @param payload    User profile data from the invite form or CSV
 */
export async function createInvitedUser (
  admin:      AdminClient,
  tenantId:   string,
  tenantName: string,
  payload:    InvitePayload
): Promise<InviteResult<InvitedUser>> {
  const email = payload.email.toLowerCase().trim()

  // ── 1. Check for existing active user ─────────────────────────────────────
  const { data: existing } = await admin
    .from('users')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('email',     email)
    .maybeSingle()

  if (existing && existing.status === 'active') {
    return {
      ok:    false,
      error: { code: 'USER_EXISTS', message: `${email} already has an active account.` },
    }
  }

  // ── 2. Create or retrieve Supabase Auth user ───────────────────────────────
  let authUserId: string

  if (existing) {
    // User record already exists (status = 'invited') — reuse the auth ID
    authUserId = existing.id
  } else {
    // New user — create in Supabase Auth with a random password.
    // email_confirm: true skips the Supabase confirmation email (we send our own OTP).
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password:      randomBytes(24).toString('base64'),
      email_confirm: true,
    })

    if (authErr || !authData?.user) {
      return {
        ok:    false,
        error: { code: 'AUTH_CREATE_FAILED', message: authErr?.message ?? 'Auth user creation failed.' },
      }
    }

    authUserId = authData.user.id
  }

  // ── 3. Upsert public.users ─────────────────────────────────────────────────
  const { error: dbErr } = await admin
    .from('users')
    .upsert(
      {
        id:                authUserId,
        tenant_id:         tenantId,
        email,
        full_name:         payload.fullName.trim(),
        role:              payload.role             ?? 'employee',
        employee_category: payload.employeeCategory ?? 'general',
        employee_code:     payload.employeeCode     ?? null,
        department:        payload.department       ?? null,
        designation:       payload.designation      ?? null,
        branch_id:         payload.branchId         ?? null,
        status:            'invited',
      },
      { onConflict: 'id' }
    )

  if (dbErr) {
    // Roll back the Auth user we just created to avoid orphaned auth records
    if (!existing) {
      void admin.auth.admin.deleteUser(authUserId)
    }
    return { ok: false, error: { code: 'DB_ERROR', message: dbErr.message } }
  }

  // ── 4. Generate OTP ────────────────────────────────────────────────────────
  const otpResult = await createOtp(admin, tenantId, authUserId, email)

  if (!otpResult.ok) {
    return {
      ok:    false,
      error: { code: 'OTP_ERROR', message: otpResult.error.message },
    }
  }

  const { otpId, rawCode, expiresAt } = otpResult.data

  // ── 5. Send activation email ───────────────────────────────────────────────
  const emailResult = await sendEmail({
    to:      email,
    subject: `Your ${PLATFORM_NAME} invitation`,
    html:    buildInviteEmail({
      fullName:   payload.fullName,
      email,
      otpCode:    rawCode,
      expiresAt,
      tenantName,
    }),
  })

  if (!emailResult.ok) {
    // Email failure is non-fatal — OTP exists, admin can resend manually.
    // Log the error but don't roll back the user record.
    console.error('[invite] Email send failed:', emailResult.error)
  }

  return {
    ok:   true,
    data: { userId: authUserId, email, status: 'invited', otpId, expiresAt },
  }
}

// ---------------------------------------------------------------------------
// resendInvite
// ---------------------------------------------------------------------------

/**
 * Generates a fresh OTP and resends the activation email to an existing
 * invited user. The previous OTP is revoked automatically by createOtp().
 */
export async function resendInvite (
  admin:      AdminClient,
  tenantId:   string,
  tenantName: string,
  userId:     string
): Promise<InviteResult<{ otpId: string; expiresAt: Date }>> {
  // Fetch current user record
  const { data: user, error: userErr } = await admin
    .from('users')
    .select('id, email, full_name, status')
    .eq('tenant_id', tenantId)
    .eq('id',        userId)
    .single()

  if (userErr || !user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found in this tenant.' } }
  }

  if (user.status === 'active') {
    return {
      ok:    false,
      error: { code: 'USER_EXISTS', message: 'User is already active — no invite needed.' },
    }
  }

  if (user.status === 'disabled') {
    return {
      ok:    false,
      error: { code: 'USER_EXISTS', message: 'User is disabled. Re-enable the account first.' },
    }
  }

  // Generate fresh OTP (revokes prior OTPs automatically)
  const otpResult = await createOtp(admin, tenantId, userId, user.email)

  if (!otpResult.ok) {
    return { ok: false, error: { code: 'OTP_ERROR', message: otpResult.error.message } }
  }

  const { otpId, rawCode, expiresAt } = otpResult.data

  const emailResult = await sendEmail({
    to:      user.email,
    subject: `Your ${PLATFORM_NAME} invitation (resent)`,
    html:    buildInviteEmail({
      fullName:   user.full_name,
      email:      user.email,
      otpCode:    rawCode,
      expiresAt,
      tenantName,
    }),
  })

  if (!emailResult.ok) {
    console.error('[invite] Resend email failed:', emailResult.error)
  }

  return { ok: true, data: { otpId, expiresAt } }
}

// ---------------------------------------------------------------------------
// activateUser
// ---------------------------------------------------------------------------

/**
 * Called after successful OTP verification.
 *  1. Flips users.status → 'active'.
 *  2. Returns a Supabase magic-link so the client can establish a session
 *     without requiring a separate login step.
 */
export async function activateUser (
  admin:    AdminClient,
  tenantId: string,
  userId:   string
): Promise<InviteResult<{ magicLink: string }>> {
  // Flip status
  const { data: updated, error: dbErr } = await admin
    .from('users')
    .update({ status: 'active' })
    .eq('tenant_id', tenantId)
    .eq('id',        userId)
    .eq('status',    'invited')           // guard: only transition from invited
    .select('email')
    .single()

  if (dbErr || !updated) {
    return {
      ok:    false,
      error: { code: 'DB_ERROR', message: dbErr?.message ?? 'User not found or already active.' },
    }
  }

  // Generate a one-time magic link — valid for 60 seconds by default in Supabase
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: updated.email,
  })

  if (linkErr || !linkData?.properties?.action_link) {
    // Activation succeeded in DB — don't roll it back; client can log in manually
    console.error('[invite] Magic link generation failed:', linkErr?.message)
    return {
      ok:    false,
      error: { code: 'AUTH_CREATE_FAILED', message: 'Account activated but session link failed. Please log in.' },
    }
  }

  return { ok: true, data: { magicLink: linkData.properties.action_link } }
}

// Re-export for convenience
export type { InvitePayload as default }
export { PUBLIC_SUPABASE_URL }
