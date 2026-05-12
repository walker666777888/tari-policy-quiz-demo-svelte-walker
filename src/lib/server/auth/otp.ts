/**
 * src/lib/server/auth/otp.ts
 *
 * Secure 6-digit OTP lifecycle — generation, validation, invalidation.
 *
 * SECURITY MODEL:
 *  · Raw OTP codes are NEVER persisted. Only SHA-256(raw) is stored.
 *  · Attempt counting + expiry + consumed flag = three-factor lockout.
 *  · All DB writes go through the service-role client (bypasses RLS).
 *  · Max-attempt and expiry limits are read from system_parameters so
 *    they can be overridden per tenant without a code deploy.
 *
 * FLOW:
 *  1. createOtp()     — caller gets raw code once (to embed in email).
 *  2. verifyOtp()     — validates hash + expiry + attempt limit.
 *  3. invalidateOtp() — explicit revocation (e.g. resend cancels prior OTP).
 */

import { createHash, randomInt } from 'node:crypto'
import type { AdminClient }      from './supabase-admin.js'

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

const OTP_DIGITS = 6
const FALLBACK_EXPIRY_MINUTES = 10
const FALLBACK_MAX_ATTEMPTS   = 5

export interface OtpRecord {
  id:            string
  tenant_id:     string
  user_id:       string
  email:         string
  expires_at:    string        // ISO string
  attempt_count: number
  is_used:       boolean
  created_at:    string
}

export type OtpResult<T> =
  | { ok: true;  data: T;      error?: never }
  | { ok: false; data?: never; error: OtpError }

export interface OtpError {
  code:    OtpErrorCode
  message: string
}

export type OtpErrorCode =
  | 'NOT_FOUND'        // no active OTP exists for this email + tenant
  | 'EXPIRED'          // OTP has passed its expires_at timestamp
  | 'INVALID_CODE'     // hash did not match
  | 'MAX_ATTEMPTS'     // attempt_count reached the configured limit
  | 'ALREADY_USED'     // OTP was already consumed
  | 'DB_ERROR'         // unexpected Supabase / Postgres error

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure 6-digit OTP string, zero-padded.
 * Uses Node.js crypto.randomInt which is backed by the OS CSPRNG.
 * Returns the RAW code — callers must not persist this directly.
 */
export function generateRawOtp (): string {
  const upper = Math.pow(10, OTP_DIGITS)   // 1_000_000
  return String(randomInt(0, upper)).padStart(OTP_DIGITS, '0')
}

/**
 * SHA-256 hex digest of the raw OTP string.
 * This is the value stored in employee_invite_otps.otp_hash.
 */
export function hashOtp (raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// System-parameter helpers
// ---------------------------------------------------------------------------

async function getOtpConfig (
  admin:    AdminClient,
  tenantId: string
): Promise<{ expiryMinutes: number; maxAttempts: number }> {
  // get_system_parameter() already applies tenant-override → global-default fallback
  const [expRes, attRes] = await Promise.all([
    admin.rpc('get_system_parameter', { p_key: 'otp_expiry_minutes',  p_tenant_id: tenantId }),
    admin.rpc('get_system_parameter', { p_key: 'otp_max_attempts',    p_tenant_id: tenantId }),
  ])

  const expiryMinutes = expRes.data  ? parseInt(expRes.data,  10) : FALLBACK_EXPIRY_MINUTES
  const maxAttempts   = attRes.data  ? parseInt(attRes.data,  10) : FALLBACK_MAX_ATTEMPTS

  return {
    expiryMinutes: Number.isFinite(expiryMinutes) ? expiryMinutes : FALLBACK_EXPIRY_MINUTES,
    maxAttempts:   Number.isFinite(maxAttempts)   ? maxAttempts   : FALLBACK_MAX_ATTEMPTS,
  }
}

// ---------------------------------------------------------------------------
// createOtp
// ---------------------------------------------------------------------------

/**
 * Creates an OTP record for the given user + tenant, deleting any prior
 * active OTPs for the same user first (revoke-before-reissue).
 *
 * Returns the RAW code so the caller can embed it in an email.
 * The raw code is never stored — only its SHA-256 hash is persisted.
 */
export async function createOtp (
  admin:    AdminClient,
  tenantId: string,
  userId:   string,
  email:    string
): Promise<OtpResult<{ otpId: string; rawCode: string; expiresAt: Date }>> {
  try {
    const { expiryMinutes } = await getOtpConfig(admin, tenantId)

    // Revoke any existing OTPs for this user (used or unused) before issuing
    // a new one. This keeps the unique-active constraint clean and invalidates
    // stale codes immediately.
    const { error: delErr } = await admin
      .from('employee_invite_otps')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id',   userId)

    if (delErr) {
      return { ok: false, error: { code: 'DB_ERROR', message: delErr.message } }
    }

    const rawCode  = generateRawOtp()
    const otpHash  = hashOtp(rawCode)
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    const { data, error: insErr } = await admin
      .from('employee_invite_otps')
      .insert({
        tenant_id:  tenantId,
        user_id:    userId,
        email:      email.toLowerCase().trim(),
        otp_hash:   otpHash,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insErr || !data) {
      return {
        ok:    false,
        error: { code: 'DB_ERROR', message: insErr?.message ?? 'Insert returned no data' },
      }
    }

    return { ok: true, data: { otpId: data.id as string, rawCode, expiresAt } }
  } catch (err) {
    return {
      ok:    false,
      error: { code: 'DB_ERROR', message: (err as Error).message },
    }
  }
}

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

/**
 * Verifies a raw OTP code submitted by the user.
 *
 * Checks (in order):
 *  1. Active, unconsumed record exists for this email + tenant.
 *  2. Attempt limit not exceeded.
 *  3. Code has not expired.
 *  4. SHA-256 hash matches.
 *
 * On success:  marks is_used = true, returns the OTP record.
 * On failure:  increments attempt_count (unless already locked/expired),
 *              returns a typed error.
 */
export async function verifyOtp (
  admin:    AdminClient,
  tenantId: string,
  email:    string,
  rawCode:  string
): Promise<OtpResult<{ otpRecord: OtpRecord }>> {
  try {
    const { maxAttempts } = await getOtpConfig(admin, tenantId)

    // Fetch the most recent unconsumed OTP for this email + tenant
    const { data: record, error: selErr } = await admin
      .from('employee_invite_otps')
      .select('id, tenant_id, user_id, email, expires_at, attempt_count, is_used, created_at, otp_hash')
      .eq('tenant_id', tenantId)
      .eq('email',     email.toLowerCase().trim())
      .eq('is_used',   false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selErr || !record) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'No active OTP found for this email.' } }
    }

    // Guard: already used (should not reach here due to is_used=false filter, but belt-and-suspenders)
    if (record.is_used) {
      return { ok: false, error: { code: 'ALREADY_USED', message: 'This OTP has already been used.' } }
    }

    // Guard: attempt limit
    if (record.attempt_count >= maxAttempts) {
      return {
        ok:    false,
        error: { code: 'MAX_ATTEMPTS', message: `OTP locked after ${maxAttempts} failed attempts. Request a new invite.` },
      }
    }

    // Guard: expiry
    if (new Date(record.expires_at) < new Date()) {
      return { ok: false, error: { code: 'EXPIRED', message: 'This OTP has expired. Request a new invite.' } }
    }

    // Verify hash
    const providedHash = hashOtp(rawCode)
    if (providedHash !== record.otp_hash) {
      // Increment attempt counter — fire-and-forget (failure here is non-critical)
      void admin
        .from('employee_invite_otps')
        .update({ attempt_count: record.attempt_count + 1 })
        .eq('id', record.id)

      const remaining = maxAttempts - record.attempt_count - 1
      return {
        ok:    false,
        error: {
          code:    'INVALID_CODE',
          message: remaining > 0
            ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
            : `Incorrect OTP. No attempts remaining — request a new invite.`,
        },
      }
    }

    // Success — mark as consumed
    const { error: updErr } = await admin
      .from('employee_invite_otps')
      .update({ is_used: true })
      .eq('id', record.id)

    if (updErr) {
      return { ok: false, error: { code: 'DB_ERROR', message: updErr.message } }
    }

    // Strip otp_hash from the returned record — callers have no need for it
    const { otp_hash: _stripped, ...safeRecord } = record as typeof record & { otp_hash: string }
    void _stripped

    return { ok: true, data: { otpRecord: safeRecord as OtpRecord } }
  } catch (err) {
    return {
      ok:    false,
      error: { code: 'DB_ERROR', message: (err as Error).message },
    }
  }
}

// ---------------------------------------------------------------------------
// invalidateOtp
// ---------------------------------------------------------------------------

/**
 * Explicitly revokes all active OTPs for a user (e.g. admin cancels invite).
 * Silent no-op if no active OTPs exist.
 */
export async function invalidateOtp (
  admin:    AdminClient,
  tenantId: string,
  userId:   string
): Promise<OtpResult<{ revoked: number }>> {
  try {
    const { data, error } = await admin
      .from('employee_invite_otps')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id',   userId)
      .eq('is_used',   false)
      .select('id')

    if (error) {
      return { ok: false, error: { code: 'DB_ERROR', message: error.message } }
    }

    return { ok: true, data: { revoked: (data ?? []).length } }
  } catch (err) {
    return {
      ok:    false,
      error: { code: 'DB_ERROR', message: (err as Error).message },
    }
  }
}
