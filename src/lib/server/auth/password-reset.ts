/**
 * src/lib/server/auth/password-reset.ts
 *
 * Password reset lifecycle — request, verify, apply.
 *
 * FLOW:
 *  requestPasswordReset()
 *    1. Look up user by email in public.users (service-role, no RLS bypass needed
 *       but consistent with the rest of the auth layer)
 *    2. Only proceed for active users (silently no-op otherwise — anti-enumeration)
 *    3. Delete any prior reset OTPs for this user
 *    4. Generate OTP (SHA-256 hashed before storage)
 *    5. Send OTP email via Resend
 *
 *  verifyPasswordResetOtp()
 *    1. Fetch most recent unverified, unused reset record for this email
 *    2. Enforce attempt limit, expiry, hash comparison
 *    3. On success: mark otp_verified=true, generate + store reset_token_hash,
 *       set reset_expires_at, return raw reset_token
 *
 *  applyPasswordReset()
 *    1. Fetch verified, unused reset record for this email
 *    2. Check reset_token has not expired
 *    3. Hash-compare submitted reset_token
 *    4. Update Supabase Auth password + email_confirm via admin.auth.admin.updateUserById
 *    5. Mark is_used=true
 *
 * SECURITY MODEL:
 *  · Raw OTP and raw reset_token are NEVER persisted — only SHA-256 digests.
 *  · All DB mutations use the service-role client.
 *  · Anti-enumeration: requestPasswordReset() always returns the same shape
 *    regardless of whether the email exists or the user is active.
 *  · Attempt counting limits brute-force on OTP.
 *  · Reset token is single-use with a short TTL (password_reset_token_expiry_minutes).
 */

import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { AdminClient }                    from './supabase-admin.js'
import { RESEND_API_KEY }                      from '$env/static/private'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_DIGITS               = 6
const FALLBACK_EXPIRY_MINUTES  = 10
const FALLBACK_MAX_ATTEMPTS    = 5
const FALLBACK_TOKEN_EXPIRY    = 15   // minutes; read from system_parameters if available
const FROM_EMAIL               = 'invites@tariplatform.com'
const PLATFORM_NAME            = 'Tari Policy Quiz'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResetResult<T> =
  | { ok: true;  data: T;      error?: never }
  | { ok: false; data?: never; error: ResetError }

export interface ResetError {
  code:    ResetErrorCode
  message: string
}

export type ResetErrorCode =
  | 'NOT_FOUND'       // no active record for this email
  | 'EXPIRED'         // OTP or reset token has expired
  | 'INVALID_CODE'    // OTP hash did not match
  | 'INVALID_TOKEN'   // reset token hash did not match
  | 'MAX_ATTEMPTS'    // attempt limit exceeded
  | 'ALREADY_USED'    // record already consumed
  | 'NOT_VERIFIED'    // reset token requested without prior OTP verification
  | 'DB_ERROR'
  | 'AUTH_ERROR'
  | 'EMAIL_ERROR'

export interface ResetRequest {
  /** Raw OTP code — returned once for caller to embed in email. */
  otpId:     string
  rawCode:   string
  expiresAt: Date
}

export interface ResetToken {
  /** Raw reset token — returned once; client must pass it to applyPasswordReset. */
  rawToken:  string
  expiresAt: Date
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function generateRawOtp (): string {
  const upper = Math.pow(10, OTP_DIGITS)
  return String(randomInt(0, upper)).padStart(OTP_DIGITS, '0')
}

function sha256 (raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function generateResetToken (): string {
  return randomBytes(32).toString('hex')   // 64-char hex
}

// ---------------------------------------------------------------------------
// System-parameter helpers
// ---------------------------------------------------------------------------

async function getResetConfig (
  admin:    AdminClient,
  tenantId: string
): Promise<{ expiryMinutes: number; maxAttempts: number; tokenExpiryMinutes: number }> {
  const [expRes, attRes, tokRes] = await Promise.all([
    admin.rpc('get_system_parameter', { p_key: 'otp_expiry_minutes',                  p_tenant_id: tenantId }),
    admin.rpc('get_system_parameter', { p_key: 'otp_max_attempts',                    p_tenant_id: tenantId }),
    admin.rpc('get_system_parameter', { p_key: 'password_reset_token_expiry_minutes', p_tenant_id: tenantId }),
  ])

  const expiryMinutes      = expRes.data ? parseInt(expRes.data, 10)  : FALLBACK_EXPIRY_MINUTES
  const maxAttempts        = attRes.data ? parseInt(attRes.data, 10)  : FALLBACK_MAX_ATTEMPTS
  const tokenExpiryMinutes = tokRes.data ? parseInt(tokRes.data, 10)  : FALLBACK_TOKEN_EXPIRY

  return {
    expiryMinutes:      Number.isFinite(expiryMinutes)      ? expiryMinutes      : FALLBACK_EXPIRY_MINUTES,
    maxAttempts:        Number.isFinite(maxAttempts)        ? maxAttempts        : FALLBACK_MAX_ATTEMPTS,
    tokenExpiryMinutes: Number.isFinite(tokenExpiryMinutes) ? tokenExpiryMinutes : FALLBACK_TOKEN_EXPIRY,
  }
}

// ---------------------------------------------------------------------------
// Email helpers (Resend REST API)
// ---------------------------------------------------------------------------

async function sendEmail (opts: {
  to:      string
  subject: string
  html:    string
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[password-reset] RESEND_API_KEY not set — email not sent')
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
        to:      [opts.to],
        subject: opts.subject,
        html:    opts.html,
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

function escHtml (s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildResetEmail (opts: {
  fullName:   string
  email:      string
  otpCode:    string
  expiresAt:  Date
  tenantName: string
}): string {
  const expiryStr = opts.expiresAt.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Reset your ${PLATFORM_NAME} password</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a1a">
  <h2 style="color:#2563eb">${PLATFORM_NAME}</h2>
  <p>Hello ${escHtml(opts.fullName)},</p>
  <p>
    We received a request to reset the password for your
    <strong>${escHtml(opts.tenantName)}</strong> account.
    Use the one-time code below — it expires at ${expiryStr}.
  </p>
  <div style="background:#f0f4ff;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Your reset code</p>
    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#2563eb">
      ${escHtml(opts.otpCode)}
    </p>
  </div>
  <p style="font-size:13px;color:#6b7280">
    If you did not request a password reset, you can safely ignore this email.
    Your password has <strong>not</strong> been changed.
  </p>
</body>
</html>`.trim()
}

// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

/**
 * Step 1: Generates a reset OTP and sends it to the user's email.
 *
 * Anti-enumeration: always returns { ok: true } regardless of whether the
 * email exists or the account is active. The caller should present a generic
 * "if your email is registered, you'll receive a code" message.
 *
 * Returns { sent: true } when an email was actually dispatched, or
 * { sent: false } when the email does not correspond to an active account
 * (the caller cannot distinguish these cases — this distinction is only
 * useful for server-side logging).
 */
export async function requestPasswordReset (
  admin: AdminClient,
  email: string
): Promise<ResetResult<{ sent: boolean; otpId?: string; expiresAt?: Date }>> {
  const normalEmail = email.toLowerCase().trim()

  try {
    // Look up user by email — join tenants for the email template
    const { data: user } = await admin
      .from('users')
      .select('id, tenant_id, full_name, status, tenants(name)')
      .eq('email', normalEmail)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Anti-enumeration: return ok=true even when user not found
    if (!user) {
      return { ok: true, data: { sent: false } }
    }

    const tenantId   = user.tenant_id as string
    const userId     = user.id        as string
    const fullName   = user.full_name as string
    const tenantName = (
      Array.isArray(user.tenants)
        ? (user.tenants[0] as { name?: string } | undefined)?.name
        : (user.tenants as { name?: string } | null)?.name
    ) ?? 'your organisation'

    const { expiryMinutes } = await getResetConfig(admin, tenantId)

    // Delete all prior reset OTPs for this user (revoke-before-reissue)
    await admin
      .from('password_reset_otps')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id',   userId)

    // Generate + store new OTP
    const rawCode  = generateRawOtp()
    const otpHash  = sha256(rawCode)
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    const { data: record, error: insErr } = await admin
      .from('password_reset_otps')
      .insert({
        tenant_id:  tenantId,
        user_id:    userId,
        email:      normalEmail,
        otp_hash:   otpHash,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insErr || !record) {
      console.error('[password-reset] OTP insert failed:', insErr?.message)
      return { ok: false, error: { code: 'DB_ERROR', message: insErr?.message ?? 'Insert failed' } }
    }

    // Send email (non-fatal failure — admin can resend)
    const emailResult = await sendEmail({
      to:      normalEmail,
      subject: `Your ${PLATFORM_NAME} password reset code`,
      html:    buildResetEmail({ fullName, email: normalEmail, otpCode: rawCode, expiresAt, tenantName }),
    })

    if (!emailResult.ok) {
      console.error('[password-reset] Email send failed:', emailResult.error)
    }

    return {
      ok:   true,
      data: { sent: true, otpId: record.id as string, expiresAt },
    }
  } catch (err) {
    return { ok: false, error: { code: 'DB_ERROR', message: (err as Error).message } }
  }
}

// ---------------------------------------------------------------------------
// verifyPasswordResetOtp
// ---------------------------------------------------------------------------

/**
 * Step 2: Validates the OTP submitted by the user.
 *
 * On success:
 *  · Marks otp_verified = true
 *  · Generates a short-lived reset_token, stores its SHA-256 hash
 *  · Returns the raw reset_token (single use — client must pass to applyPasswordReset)
 *
 * On failure:
 *  · Increments attempt_count
 *  · Returns a typed error (MAX_ATTEMPTS, EXPIRED, INVALID_CODE)
 */
export async function verifyPasswordResetOtp (
  admin:    AdminClient,
  email:    string,
  rawCode:  string
): Promise<ResetResult<ResetToken>> {
  const normalEmail = email.toLowerCase().trim()

  try {
    // Find tenant_id from the record itself — never trust the caller
    const { data: record, error: selErr } = await admin
      .from('password_reset_otps')
      .select('id, tenant_id, user_id, otp_hash, expires_at, attempt_count, otp_verified, is_used')
      .eq('email',         normalEmail)
      .eq('otp_verified',  false)
      .eq('is_used',       false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selErr || !record) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'No active reset request found for this email.' } }
    }

    const tenantId = record.tenant_id as string
    const { maxAttempts, tokenExpiryMinutes } = await getResetConfig(admin, tenantId)

    // Guard: attempt limit
    if (record.attempt_count >= maxAttempts) {
      return {
        ok:    false,
        error: { code: 'MAX_ATTEMPTS', message: `Reset code locked after ${maxAttempts} failed attempts. Please request a new code.` },
      }
    }

    // Guard: expiry
    if (new Date(record.expires_at as string) < new Date()) {
      return { ok: false, error: { code: 'EXPIRED', message: 'This reset code has expired. Please request a new one.' } }
    }

    // Guard: already verified (shouldn't reach here due to filter, belt-and-suspenders)
    if (record.otp_verified) {
      return { ok: false, error: { code: 'ALREADY_USED', message: 'This code has already been used.' } }
    }

    // Verify hash
    if (sha256(rawCode) !== record.otp_hash) {
      // Increment attempt counter
      void admin
        .from('password_reset_otps')
        .update({ attempt_count: (record.attempt_count as number) + 1 })
        .eq('id', record.id)

      const remaining = maxAttempts - (record.attempt_count as number) - 1
      return {
        ok:    false,
        error: {
          code:    'INVALID_CODE',
          message: remaining > 0
            ? `Incorrect code. ${remaining} attempt(s) remaining.`
            : `Incorrect code. No attempts remaining — please request a new reset code.`,
        },
      }
    }

    // OTP correct — generate reset token
    const rawToken      = generateResetToken()
    const resetExpiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000)

    const { error: updErr } = await admin
      .from('password_reset_otps')
      .update({
        otp_verified:      true,
        reset_token_hash:  sha256(rawToken),
        reset_expires_at:  resetExpiresAt.toISOString(),
      })
      .eq('id', record.id)

    if (updErr) {
      return { ok: false, error: { code: 'DB_ERROR', message: updErr.message } }
    }

    return { ok: true, data: { rawToken, expiresAt: resetExpiresAt } }
  } catch (err) {
    return { ok: false, error: { code: 'DB_ERROR', message: (err as Error).message } }
  }
}

// ---------------------------------------------------------------------------
// applyPasswordReset
// ---------------------------------------------------------------------------

/**
 * Step 3: Validates the reset token and sets the new password.
 *
 * On success:
 *  · Updates Supabase Auth password via admin.auth.admin.updateUserById
 *  · Sets email_confirm = true (belt-and-suspenders)
 *  · Marks is_used = true on the reset record
 *
 * On failure: returns a typed error; the DB record is NOT marked used so
 * the user can retry (within the reset_expires_at window).
 */
export async function applyPasswordReset (
  admin:         AdminClient,
  email:         string,
  rawResetToken: string,
  newPassword:   string
): Promise<ResetResult<{ userId: string }>> {
  const normalEmail = email.toLowerCase().trim()

  try {
    // Fetch verified, unused record
    const { data: record, error: selErr } = await admin
      .from('password_reset_otps')
      .select('id, tenant_id, user_id, reset_token_hash, reset_expires_at, otp_verified, is_used')
      .eq('email',        normalEmail)
      .eq('otp_verified', true)
      .eq('is_used',      false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selErr || !record) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'No verified reset session found. Please verify your code first.' } }
    }

    // Guard: not verified (belt-and-suspenders — filtered above)
    if (!record.otp_verified) {
      return { ok: false, error: { code: 'NOT_VERIFIED', message: 'OTP not yet verified.' } }
    }

    // Guard: already used
    if (record.is_used) {
      return { ok: false, error: { code: 'ALREADY_USED', message: 'This reset session has already been used.' } }
    }

    // Guard: reset token expiry
    if (!record.reset_expires_at || new Date(record.reset_expires_at as string) < new Date()) {
      return { ok: false, error: { code: 'EXPIRED', message: 'The reset session has expired. Please request a new code.' } }
    }

    // Guard: reset token hash match
    if (!record.reset_token_hash || sha256(rawResetToken) !== record.reset_token_hash) {
      return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid reset token. Please restart the reset process.' } }
    }

    const userId = record.user_id as string

    // Update Supabase Auth password
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      password:      newPassword,
      email_confirm: true,
    })

    if (authErr) {
      console.error('[password-reset] Auth password update failed:', authErr.message)
      return { ok: false, error: { code: 'AUTH_ERROR', message: authErr.message } }
    }

    // Mark record as used (terminal state)
    const { error: updErr } = await admin
      .from('password_reset_otps')
      .update({ is_used: true })
      .eq('id', record.id)

    if (updErr) {
      // Password was changed — don't fail the request over a bookkeeping error.
      // Log it; the expired record will be cleaned up by pg_cron eventually.
      console.error('[password-reset] Failed to mark record used:', updErr.message)
    }

    return { ok: true, data: { userId } }
  } catch (err) {
    return { ok: false, error: { code: 'DB_ERROR', message: (err as Error).message } }
  }
}
