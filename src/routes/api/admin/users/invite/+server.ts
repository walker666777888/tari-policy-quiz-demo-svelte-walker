/**
 * src/routes/api/admin/users/invite/+server.ts
 *
 * POST /api/admin/users/invite
 *
 * Manual employee onboarding endpoint — client_admin only.
 *
 * REQUEST BODY (JSON):
 *  {
 *    email:              string   (required)
 *    fullName:           string   (required)
 *    role?:              'employee' | 'cxo'   (default: 'employee')
 *    employeeCode?:      string
 *    department?:        string
 *    designation?:       string
 *    employeeCategory?:  string
 *    branchId?:          string   (UUID)
 *  }
 *
 * RESPONSES:
 *  201  { ok: true,  data: { userId, email, otpId, expiresAt } }
 *  400  { ok: false, error: { code, message } }
 *  401  { ok: false, error: { code: 'UNAUTHORIZED', message } }
 *  403  { ok: false, error: { code: 'FORBIDDEN',    message } }
 *  409  { ok: false, error: { code: 'USER_EXISTS',  message } }
 *  500  { ok: false, error: { code: 'INTERNAL',     message } }
 *
 * SECURITY:
 *  · Caller identity is verified via locals.user (set by hooks.server.ts).
 *  · Role + tenant_id are read from public.users via the service-role client —
 *    never trusted from the JWT payload directly to prevent privilege escalation.
 *  · All invite operations are scoped to the caller's tenant_id; cross-tenant
 *    access is structurally impossible.
 *  · Audit log written for every successful invite, plus failed auth attempts.
 */

import { json }               from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAdminClient }     from '$lib/server/auth/supabase-admin.js'
import { createInvitedUser }  from '$lib/server/auth/invite.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteRequestBody {
  email:             string
  fullName:          string
  role?:             string
  employeeCode?:     string
  department?:       string
  designation?:      string
  employeeCategory?: string
  branchId?:         string
}

interface ApiError {
  code:    string
  message: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse (status: number, code: string, message: string) {
  return json({ ok: false, error: { code, message } satisfies ApiError }, { status })
}

/** Coerce an unknown thrown value to an Error message string. */
function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Basic UUID v4 format check (sufficient for branch_id validation). */
function isUuid (s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ locals, request }) => {
  // ── 1. Require authenticated session ─────────────────────────────────────
  if (!locals.user) {
    return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in to use this endpoint.')
  }

  const callerId = locals.user.id

  // ── 2. Look up caller in public.users ─────────────────────────────────────
  //    We deliberately do NOT trust the JWT payload for role/tenant — the
  //    custom JWT claims hook may not be deployed yet, and JWT claims are
  //    signed at login time so could be stale.
  const admin = getAdminClient()

  const { data: caller, error: callerErr } = await admin
    .from('users')
    .select('id, tenant_id, role, status, tenants(name)')
    .eq('id', callerId)
    .single()

  if (callerErr || !caller) {
    // Authenticated but no public.users row — shouldn't happen in normal flow
    return errorResponse(403, 'FORBIDDEN', 'Your account profile was not found.')
  }

  if (caller.status !== 'active') {
    return errorResponse(403, 'FORBIDDEN', 'Your account is not active.')
  }

  // ── 3. Require client_admin role ─────────────────────────────────────────
  if (caller.role !== 'client_admin') {
    void writeAuditLog(admin, callerId, caller.tenant_id, 'user.invite_forbidden', {
      reason: `caller role is '${caller.role}', not 'client_admin'`,
    })
    return errorResponse(403, 'FORBIDDEN', 'Only client administrators can invite users.')
  }

  const tenantId   = caller.tenant_id as string
  // tenants is a joined row; handle both array and object shapes from PostgREST
  const tenantName = (
    Array.isArray(caller.tenants)
      ? (caller.tenants[0] as { name?: string } | undefined)?.name
      : (caller.tenants as { name?: string } | null)?.name
  ) ?? 'your organisation'

  // ── 4. Parse + validate request body ─────────────────────────────────────
  let body: InviteRequestBody
  try {
    body = await request.json() as InviteRequestBody
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }

  const validationError = validateBody(body)
  if (validationError) {
    return errorResponse(400, 'VALIDATION_ERROR', validationError)
  }

  // Normalise role: only employee and cxo are invitable via this endpoint
  const role = body.role === 'cxo' ? 'cxo' : 'employee'

  // ── 5. Call invite service ────────────────────────────────────────────────
  const result = await createInvitedUser(admin, tenantId, tenantName, {
    email:             body.email.toLowerCase().trim(),
    fullName:          body.fullName.trim(),
    role,
    employeeCode:      body.employeeCode?.trim()     || undefined,
    department:        body.department?.trim()        || undefined,
    designation:       body.designation?.trim()       || undefined,
    employeeCategory:  body.employeeCategory?.trim()  || undefined,
    branchId:          body.branchId                  || undefined,
  })

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  if (result.ok) {
    void writeAuditLog(admin, callerId, tenantId, 'user.invite_sent', {
      invited_user_id: result.data.userId,
      invited_email:   result.data.email,
      role,
    })
    return json(
      {
        ok:   true,
        data: {
          userId:    result.data.userId,
          email:     result.data.email,
          otpId:     result.data.otpId,
          expiresAt: result.data.expiresAt.toISOString(),
        },
      },
      { status: 201 }
    )
  }

  // Map invite error codes to HTTP status codes
  const { code, message } = result.error

  if (code === 'USER_EXISTS') {
    void writeAuditLog(admin, callerId, tenantId, 'user.invite_duplicate', {
      attempted_email: body.email,
    })
    return errorResponse(409, code, message)
  }

  if (code === 'DB_ERROR' || code === 'AUTH_CREATE_FAILED') {
    console.error('[POST /api/admin/users/invite] Internal error:', code, message)
    return errorResponse(500, 'INTERNAL', 'An internal error occurred. Please try again.')
  }

  // OTP_ERROR / EMAIL_ERROR — partial success; user was created but email may not have arrived
  if (code === 'EMAIL_ERROR' || code === 'OTP_ERROR') {
    console.error('[POST /api/admin/users/invite] Non-fatal error:', code, message)
    return errorResponse(500, 'INTERNAL', message)
  }

  return errorResponse(500, 'INTERNAL', message)
}

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

function validateBody (body: InviteRequestBody): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.'
  }

  // email
  if (!body.email || typeof body.email !== 'string') {
    return 'email is required.'
  }
  const emailTrimmed = body.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return 'email is not a valid email address.'
  }
  if (emailTrimmed.length > 254) {
    return 'email must be 254 characters or fewer.'
  }

  // fullName
  if (!body.fullName || typeof body.fullName !== 'string') {
    return 'fullName is required.'
  }
  if (body.fullName.trim().length < 2) {
    return 'fullName must be at least 2 characters.'
  }
  if (body.fullName.trim().length > 255) {
    return 'fullName must be 255 characters or fewer.'
  }

  // role (optional — defaults to 'employee')
  if (body.role !== undefined && !['employee', 'cxo'].includes(body.role)) {
    return "role must be 'employee' or 'cxo'."
  }

  // branchId (optional — must be UUID if present)
  if (body.branchId !== undefined && body.branchId !== '' && !isUuid(body.branchId)) {
    return 'branchId must be a valid UUID.'
  }

  // Optional string fields — length guards
  const optionalStrings: Array<[keyof InviteRequestBody, number]> = [
    ['employeeCode',    64],
    ['department',     128],
    ['designation',    128],
    ['employeeCategory', 64],
  ]
  for (const [field, maxLen] of optionalStrings) {
    const val = body[field]
    if (val !== undefined && typeof val === 'string' && val.trim().length > maxLen) {
      return `${field} must be ${maxLen} characters or fewer.`
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Audit log helper
// ---------------------------------------------------------------------------

async function writeAuditLog (
  admin:    ReturnType<typeof getAdminClient>,
  actorId:  string,
  tenantId: string,
  action:   string,
  meta:     Record<string, unknown>
): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      tenant_id:     tenantId,
      actor_user_id: actorId,
      action,
      entity_type:   'user',
      metadata:      meta,
    })
  } catch (err) {
    // Audit log failures are non-fatal — log and continue
    console.error('[invite] Audit log write failed:', toMessage(err))
  }
}
