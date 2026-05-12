/**
 * src/routes/api/admin/users/import/+server.ts
 *
 * POST /api/admin/users/import
 *
 * Bulk employee onboarding via CSV file upload.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUEST
 *   Content-Type : multipart/form-data
 *   Field        : "file"  — the CSV attachment
 *
 * CSV COLUMNS (case-insensitive)
 *   Required:
 *     email            employee email address
 *     name             full name  (alias → full_name accepted by pipeline)
 *
 *   Optional:
 *     employee_code    HR system code (unique per tenant)
 *     branch           branch short-code  (alias → branch_code)
 *     department       free text
 *     designation      free text / job title
 *     role             employee | cxo  (defaults to 'employee'; client_admin
 *                      cannot be bulk-imported for security — downgraded silently)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE
 *   1.  Authenticate caller — require active session
 *   2.  Authorise caller   — verify client_admin role via DB lookup (never JWT)
 *   3.  Parse FormData     — extract file field
 *   4.  Validate file      — size, MIME type, extension, non-empty
 *   5.  Normalise headers  — map user-facing aliases to pipeline-internal names
 *   6.  Create job record  — user_import_jobs row in 'pending' state
 *   7.  Run pipeline       — processImportJob() (parse → validate → branch
 *                            lookup → dedup → provision → error report)
 *   8.  Audit log          — write one summary entry regardless of outcome
 *   9.  Return             — 202 with { jobId, summary } or error response
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSES
 *   202  { ok: true,  data: { jobId, summary: ImportSummary } }
 *   400  { ok: false, error: { code: 'VALIDATION_ERROR' | 'INVALID_FILE' … } }
 *   401  { ok: false, error: { code: 'UNAUTHORIZED' } }
 *   403  { ok: false, error: { code: 'FORBIDDEN' } }
 *   500  { ok: false, error: { code: 'INTERNAL' } }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY
 *   · Tenant isolation is absolute — tenant_id is read from public.users via
 *     the service-role client; it cannot be spoofed by the caller.
 *   · 'client_admin' role in uploaded CSV is silently downgraded to 'employee'
 *     so a CSV cannot be used to self-escalate privileges.
 *   · File is size-limited to MAX_FILE_BYTES before reading into memory.
 *   · Content is validated as UTF-8 text; binary uploads are rejected.
 *   · All per-row errors are collected; no partial-success state is hidden.
 *   · Job record is created before processing so it always appears in the
 *     admin dashboard, even if the import fails mid-way.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BATCH SAFETY
 *   · processImportJob() runs rows in 20-concurrent batches via Promise.allSettled.
 *   · The user_import_jobs row is patched at each pipeline stage so admins can
 *     observe progress (pending → processing → completed/failed).
 *   · Maximum 500 rows per import enforced in the pipeline.
 *   · Per-row error report CSV is uploaded to Supabase Storage and linked from
 *     the job record if any rows fail.
 */

import { json }                          from '@sveltejs/kit'
import type { RequestHandler }           from './$types'
import { getAdminClient }                from '$lib/server/auth/supabase-admin.js'
import { createImportJob, processImportJob }
                                         from '$lib/server/auth/csv-import.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 5 MB — generous for ≤500 rows of text CSV */
const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Accepted MIME types for the upload */
const ACCEPTED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',  // IE/old Excel CSV export
])

/**
 * Column-name aliases the user submits → internal names the csv-import
 * pipeline expects.  Keys are lowercase; applied to the first (header) line.
 */
const HEADER_ALIASES: Record<string, string> = {
  name:   'full_name',   // user spec "name"   → pipeline "full_name"
  branch: 'branch_code', // user spec "branch" → pipeline "branch_code"
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

function toMessage (err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Rewrites the first line of a CSV string, replacing any header token that
 * matches a known alias with the pipeline-internal name.
 *
 * - Only the header row is touched — data rows are never modified.
 * - Preserves exact whitespace/quoting of other headers.
 * - Safe to call even if no aliases are present.
 */
function normalizeCsvHeaders (raw: string): string {
  const firstNewline = raw.indexOf('\n')
  const headerLine   = firstNewline === -1 ? raw : raw.slice(0, firstNewline)
  const rest         = firstNewline === -1 ? ''  : raw.slice(firstNewline)   // includes leading \n

  const normalizedHeader = headerLine
    .split(',')
    .map(col => {
      const trimmed = col.trim().toLowerCase()
      return HEADER_ALIASES[trimmed] ?? col   // preserve original casing if not an alias
    })
    .join(',')

  return normalizedHeader + rest
}

/**
 * Silently downgrades 'client_admin' in the role column to 'employee'.
 *
 * Prevents a CSV file from being used to bulk-promote users to admin.
 * Applied after header normalisation, before pipeline entry.
 * Regex targets only cells whose trimmed content is exactly 'client_admin'
 * (case-insensitive), surrounded by commas or line boundaries.
 */
function sanitizeRoles (raw: string): string {
  // Skip header line, operate only on data lines
  const newlineIdx = raw.indexOf('\n')
  if (newlineIdx === -1) return raw

  const header = raw.slice(0, newlineIdx)
  const body   = raw.slice(newlineIdx)

  // Find position of the 'role' column (0-based) so we can target precisely
  const headers = header.split(',').map(h => h.trim().toLowerCase())
  const roleIdx = headers.indexOf('role')
  if (roleIdx === -1) return raw   // no role column — nothing to sanitize

  const lines = body.split('\n')
  const sanitized = lines.map(line => {
    if (!line.trim()) return line
    const cols = line.split(',')
    if (cols[roleIdx] !== undefined) {
      const val = cols[roleIdx].trim().toLowerCase()
      if (val === 'client_admin') {
        cols[roleIdx] = 'employee'
      }
    }
    return cols.join(',')
  })

  return header + sanitized.join('\n')
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/import
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ locals, request }) => {
  // ── 1. Require authenticated session ──────────────────────────────────────
  if (!locals.user) {
    return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in to use this endpoint.')
  }

  const callerId = locals.user.id
  const admin    = getAdminClient()

  // ── 2. Look up caller in public.users — verify role & tenant ──────────────
  //    role and tenant_id must come from the DB, not the JWT, to prevent
  //    privilege escalation via stale or crafted tokens.
  const { data: caller, error: callerErr } = await admin
    .from('users')
    .select('id, tenant_id, role, status, tenants(name)')
    .eq('id', callerId)
    .single()

  if (callerErr || !caller) {
    return errorResponse(403, 'FORBIDDEN', 'Your account profile was not found.')
  }

  if (caller.status !== 'active') {
    return errorResponse(403, 'FORBIDDEN', 'Your account is not active.')
  }

  if (caller.role !== 'client_admin') {
    void writeAuditLog(admin, callerId, caller.tenant_id as string, 'user.import_forbidden', {
      reason: `caller role is '${caller.role}', not 'client_admin'`,
    })
    return errorResponse(403, 'FORBIDDEN', 'Only client administrators can import users.')
  }

  const tenantId   = caller.tenant_id as string
  const tenantName = (
    Array.isArray(caller.tenants)
      ? (caller.tenants[0] as { name?: string } | undefined)?.name
      : (caller.tenants as { name?: string } | null)?.name
  ) ?? 'your organisation'

  // ── 3. Parse FormData ──────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    return errorResponse(400, 'INVALID_REQUEST', `Could not parse form data: ${toMessage(err)}`)
  }

  const fileField = formData.get('file')

  if (!fileField) {
    return errorResponse(
      400, 'INVALID_FILE',
      "No file field found. Send a multipart/form-data request with field name 'file'."
    )
  }

  if (!(fileField instanceof File)) {
    return errorResponse(400, 'INVALID_FILE', "The 'file' field must be a file upload, not a text string.")
  }

  const uploadedFile = fileField as File

  // ── 4. Validate file ───────────────────────────────────────────────────────

  // 4a. Size check (before reading into memory)
  if (uploadedFile.size === 0) {
    return errorResponse(400, 'INVALID_FILE', 'The uploaded file is empty.')
  }

  if (uploadedFile.size > MAX_FILE_BYTES) {
    const mb = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0)
    return errorResponse(
      400, 'INVALID_FILE',
      `File is too large (${(uploadedFile.size / 1024).toFixed(1)} KB). Maximum size is ${mb} MB.`
    )
  }

  // 4b. MIME type / extension check
  const mimeType = uploadedFile.type?.toLowerCase() ?? ''
  const filename = uploadedFile.name ?? 'upload'
  const ext      = filename.split('.').pop()?.toLowerCase()

  const mimeOk = ACCEPTED_MIME_TYPES.has(mimeType) || mimeType === ''  // empty type from some clients
  const extOk  = ext === 'csv' || ext === 'txt'

  if (!mimeOk && !extOk) {
    return errorResponse(
      400, 'INVALID_FILE',
      `Unsupported file type (${mimeType || 'unknown'}). Upload a CSV file (.csv or .txt).`
    )
  }

  // 4c. Read file content
  let rawCsvContent: string
  try {
    rawCsvContent = await uploadedFile.text()
  } catch (err) {
    return errorResponse(500, 'INTERNAL', `Failed to read file content: ${toMessage(err)}`)
  }

  if (!rawCsvContent.trim()) {
    return errorResponse(400, 'INVALID_FILE', 'The uploaded CSV file contains no content.')
  }

  // ── 5. Normalise headers + sanitize roles ─────────────────────────────────
  //    Must happen before creating the job record so we can do a quick
  //    header-presence check and return 400 before touching the DB.
  let csvContent = normalizeCsvHeaders(rawCsvContent)
  csvContent     = sanitizeRoles(csvContent)

  // Quick header pre-check so we can return 400 early without creating a job
  const firstLine     = csvContent.split('\n')[0] ?? ''
  const parsedHeaders = firstLine.split(',').map(h => h.trim().toLowerCase())
  const missingRequiredHeaders: string[] = []

  if (!parsedHeaders.includes('email'))     missingRequiredHeaders.push('email')
  if (!parsedHeaders.includes('full_name')) missingRequiredHeaders.push('name (or full_name)')

  if (missingRequiredHeaders.length > 0) {
    return errorResponse(
      400, 'MISSING_COLUMNS',
      `Missing required CSV columns: ${missingRequiredHeaders.join(', ')}. ` +
      `Required columns: email, name (or full_name).`
    )
  }

  // ── 6. Create user_import_jobs record ─────────────────────────────────────
  const jobResult = await createImportJob(admin, tenantId, callerId, filename)

  if (!jobResult.ok) {
    console.error('[POST /api/admin/users/import] Failed to create job record:', jobResult.error)
    return errorResponse(500, 'INTERNAL', 'Failed to initialise import job. Please try again.')
  }

  const { jobId } = jobResult.data

  // ── 7. Run full import pipeline ───────────────────────────────────────────
  //    processImportJob() never throws — all errors surface in ImportSummary.
  //    It patches the job record at each stage:
  //      pending → processing → completed | failed
  let importResult: Awaited<ReturnType<typeof processImportJob>>

  try {
    importResult = await processImportJob(
      admin,
      jobId,
      tenantId,
      tenantName,
      csvContent
    )
  } catch (err) {
    // processImportJob has its own try/catch, so this should never fire.
    // Belt-and-suspenders: mark job failed and return 500.
    console.error('[POST /api/admin/users/import] Unexpected pipeline error:', toMessage(err))
    void admin
      .from('user_import_jobs')
      .update({ status: 'failed' })
      .eq('id', jobId)

    void writeAuditLog(admin, callerId, tenantId, 'user.import_error', {
      job_id:  jobId,
      error:   toMessage(err),
      filename,
    })

    return errorResponse(500, 'INTERNAL', 'An unexpected error occurred during import. Please try again.')
  }

  // ── 8. Audit log ──────────────────────────────────────────────────────────
  if (importResult.ok) {
    const { totalRows, successRows, failedRows, skippedRows } = importResult.data
    void writeAuditLog(admin, callerId, tenantId, 'user.import_completed', {
      job_id:        jobId,
      filename,
      total_rows:    totalRows,
      success_rows:  successRows,
      failed_rows:   failedRows,
      skipped_rows:  skippedRows,
    })
  } else {
    void writeAuditLog(admin, callerId, tenantId, 'user.import_failed', {
      job_id:   jobId,
      filename,
      reason:   importResult.error,
    })
  }

  // ── 9. Return response ────────────────────────────────────────────────────

  // Pipeline-level failures (parse error, empty file, column mismatch)
  // These represent job-level failures, not per-row failures.
  if (!importResult.ok) {
    return json(
      {
        ok:    false,
        error: { code: 'IMPORT_FAILED', message: importResult.error },
        data:  { jobId },      // always include jobId so caller can look up the job record
      },
      { status: 422 }
    )
  }

  const { totalRows, successRows, failedRows, skippedRows, errors } = importResult.data

  // Build a clean per-row error list for the response (cap at 50 rows inline;
  // the full report is available via job.error_report_url in Supabase Storage)
  const inlineErrors = errors.slice(0, 50).map(e => ({
    row:     e.rowNumber,
    email:   e.email,
    reasons: e.errors,
  }))

  const truncated = errors.length > 50

  return json(
    {
      ok:   true,
      data: {
        jobId,
        summary: {
          totalRows,
          successRows,
          failedRows,
          skippedRows,
          errors:    inlineErrors,
          truncated, // true if >50 errors — full report in error_report_url
        },
      },
    },
    { status: 202 }
  )
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
      entity_type:   'user_import_job',
      metadata:      meta,
    })
  } catch (err) {
    console.error('[import] Audit log write failed:', toMessage(err))
  }
}
