/**
 * src/lib/server/auth/csv-import.ts
 *
 * Bulk employee provisioning from CSV upload.
 *
 * PIPELINE:
 *  parseCsv()          → raw string → CsvRow[]
 *  validateRows()      → CsvRow[]  → { valid: ValidatedRow[], invalid: RowError[] }
 *  lookupBranches()    → resolves branch_code → branch_id per tenant
 *  checkDuplicates()   → removes rows whose email already has an active account
 *  runImport()         → provisions each valid row via invite.ts, tracks results
 *  processImportJob()  → orchestrates full pipeline, updates user_import_jobs record
 *
 * CSV SCHEMA (case-insensitive headers):
 *  Required: email, full_name
 *  Optional: role, employee_code, employee_category, department, designation, branch_code
 *
 * SUPPORTED ROLE VALUES:
 *  employee (default), cxo, client_admin
 *
 * ERROR HANDLING:
 *  Per-row errors are collected rather than aborting the batch.
 *  The import job record is updated throughout so admins can track progress.
 *  An error report CSV is generated for rows that failed.
 */

import type { AdminClient }                     from './supabase-admin.js'
import { createInvitedUser, type InvitePayload } from './invite.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvRow {
  /** 1-based row number in the original file (including header) */
  rowNumber:         number
  email:             string
  fullName:          string
  role:              string
  employeeCode:      string
  employeeCategory:  string
  department:        string
  designation:       string
  branchCode:        string
  /** Raw values for error reporting */
  raw:               Record<string, string>
}

export interface ValidatedRow extends CsvRow {
  branchId: string | null       // resolved from branchCode; null if blank / not found
}

export interface RowError {
  rowNumber: number
  email:     string
  errors:    string[]
  raw:       Record<string, string>
}

export interface ImportSummary {
  totalRows:    number
  successRows:  number
  failedRows:   number
  skippedRows:  number    // already-active duplicates
  errors:       RowError[]
}

export type ImportResult<T> =
  | { ok: true;  data: T;      error?: never }
  | { ok: false; data?: never; error: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ROLES             = new Set(['employee', 'cxo', 'client_admin'])
const VALID_EMPLOYEE_CATS     = new Set([
  'general', 'manager', 'executive', 'teller', 'compliance_officer', 'it', 'other',
])
const EMAIL_RE                = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ROWS_PER_IMPORT     = 500
const IMPORT_BATCH_SIZE       = 20     // rows processed concurrently per batch

// ---------------------------------------------------------------------------
// CSV PARSER
// Handles: quoted fields, commas inside quotes, escaped quotes (""),
// Windows (\r\n) and Unix (\n) line endings.
// Does NOT support multi-line field values (newlines inside quotes).
// ---------------------------------------------------------------------------

/**
 * Splits a raw CSV string into header + rows.
 * Returns field values as trimmed strings; preserves empty strings.
 */
export function parseCsv (raw: string): {
  headers: string[]
  rows:    Record<string, string>[]
} {
  // Normalise line endings
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const nonEmpty = lines.filter(l => l.trim() !== '')
  if (nonEmpty.length < 2) return { headers: [], rows: [] }

  const headers = splitCsvLine(nonEmpty[0]).map(h => h.toLowerCase().trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = splitCsvLine(nonEmpty[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}

/** Splits one CSV line into fields, respecting double-quoted values. */
function splitCsvLine (line: string): string[] {
  const fields: string[] = []
  let current   = ''
  let inQuotes  = false

  for (let i = 0; i < line.length; i++) {
    const ch   = line[i]
    const next = line[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote inside a quoted field
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  fields.push(current)
  return fields
}

// ---------------------------------------------------------------------------
// HEADER VALIDATION
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = ['email', 'full_name']
const OPTIONAL_HEADERS = [
  'role', 'employee_code', 'employee_category',
  'department', 'designation', 'branch_code',
]

export interface HeaderCheckResult {
  ok:       boolean
  missing:  string[]
  unknown:  string[]
}

export function checkHeaders (headers: string[]): HeaderCheckResult {
  const headerSet = new Set(headers)
  const missing   = REQUIRED_HEADERS.filter(h => !headerSet.has(h))
  const known     = new Set([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS])
  const unknown   = headers.filter(h => !known.has(h))
  return { ok: missing.length === 0, missing, unknown }
}

// ---------------------------------------------------------------------------
// ROW MAPPING
// ---------------------------------------------------------------------------

function mapRow (raw: Record<string, string>, rowNumber: number): CsvRow {
  return {
    rowNumber,
    email:            (raw['email']             ?? '').toLowerCase().trim(),
    fullName:         (raw['full_name']          ?? '').trim(),
    role:             (raw['role']               ?? 'employee').toLowerCase().trim() || 'employee',
    employeeCode:     (raw['employee_code']      ?? '').trim(),
    employeeCategory: (raw['employee_category']  ?? 'general').toLowerCase().trim() || 'general',
    department:       (raw['department']         ?? '').trim(),
    designation:      (raw['designation']        ?? '').trim(),
    branchCode:       (raw['branch_code']        ?? '').trim(),
    raw,
  }
}

// ---------------------------------------------------------------------------
// ROW VALIDATION
// ---------------------------------------------------------------------------

function validateRow (row: CsvRow): string[] {
  const errors: string[] = []

  if (!row.email) {
    errors.push('email is required')
  } else if (!EMAIL_RE.test(row.email)) {
    errors.push(`"${row.email}" is not a valid email address`)
  }

  if (!row.fullName) {
    errors.push('full_name is required')
  } else if (row.fullName.length > 200) {
    errors.push('full_name must be 200 characters or fewer')
  }

  if (!VALID_ROLES.has(row.role)) {
    errors.push(`role "${row.role}" is invalid — must be one of: ${[...VALID_ROLES].join(', ')}`)
  }

  if (row.employeeCategory && !VALID_EMPLOYEE_CATS.has(row.employeeCategory)) {
    errors.push(
      `employee_category "${row.employeeCategory}" is invalid — ` +
      `must be one of: ${[...VALID_EMPLOYEE_CATS].join(', ')}`
    )
  }

  if (row.employeeCode && row.employeeCode.length > 50) {
    errors.push('employee_code must be 50 characters or fewer')
  }

  return errors
}

// ---------------------------------------------------------------------------
// BRANCH LOOKUP
// Resolves all unique branch_codes in the batch to branch UUIDs in one query.
// ---------------------------------------------------------------------------

async function lookupBranches (
  admin:    AdminClient,
  tenantId: string,
  codes:    string[]
): Promise<Map<string, string>> {
  const uniqueCodes = [...new Set(codes.filter(Boolean))]
  if (uniqueCodes.length === 0) return new Map()

  const { data, error } = await admin
    .from('branches')
    .select('id, code')
    .eq('tenant_id', tenantId)
    .in('code',      uniqueCodes)
    .eq('is_active', true)

  if (error || !data) {
    console.warn('[csv-import] Branch lookup failed:', error?.message)
    return new Map()
  }

  return new Map(data.map((b: { id: string; code: string }) => [b.code.toLowerCase(), b.id]))
}

// ---------------------------------------------------------------------------
// DUPLICATE CHECK
// Emails that already have any account (invited OR active) are marked as dupes.
// ---------------------------------------------------------------------------

async function findExistingEmails (
  admin:    AdminClient,
  tenantId: string,
  emails:   string[]
): Promise<Set<string>> {
  if (emails.length === 0) return new Set()

  const { data, error } = await admin
    .from('users')
    .select('email, status')
    .eq('tenant_id', tenantId)
    .in('email',     emails)

  if (error || !data) return new Set()

  // Only flag emails that are ACTIVE — invited users can be re-invited (resend)
  return new Set(
    (data as { email: string; status: string }[])
      .filter(u => u.status === 'active')
      .map(u => u.email)
  )
}

// ---------------------------------------------------------------------------
// VALIDATE ALL ROWS
// Returns split arrays of valid and invalid rows.
// ---------------------------------------------------------------------------

async function validateRows (
  admin:    AdminClient,
  tenantId: string,
  rawRows:  Record<string, string>[]
): Promise<{ valid: ValidatedRow[]; errors: RowError[]; skipped: number }> {
  // Map raw CSV rows to typed CsvRows (row 1 = header, so data starts at row 2)
  const mapped = rawRows.map((r, i) => mapRow(r, i + 2))

  // Field-level validation
  const validSyntax: CsvRow[]  = []
  const errors:      RowError[] = []

  for (const row of mapped) {
    const rowErrors = validateRow(row)
    if (rowErrors.length > 0) {
      errors.push({ rowNumber: row.rowNumber, email: row.email, errors: rowErrors, raw: row.raw })
    } else {
      validSyntax.push(row)
    }
  }

  // Duplicate check within the batch itself (same email appears twice)
  const batchEmails  = new Map<string, number>()   // email → first rowNumber
  const batchDupRows = new Set<number>()

  for (const row of validSyntax) {
    if (batchEmails.has(row.email)) {
      errors.push({
        rowNumber: row.rowNumber,
        email:     row.email,
        errors:    [`Duplicate email in this file (first seen at row ${batchEmails.get(row.email)})`],
        raw:       row.raw,
      })
      batchDupRows.add(row.rowNumber)
    } else {
      batchEmails.set(row.email, row.rowNumber)
    }
  }

  const deduped = validSyntax.filter(r => !batchDupRows.has(r.rowNumber))

  // DB duplicate check — skip rows whose email already has an ACTIVE account
  const existingActiveEmails = await findExistingEmails(
    admin, tenantId, deduped.map(r => r.email)
  )
  let skipped = 0
  const newRows = deduped.filter(r => {
    if (existingActiveEmails.has(r.email)) {
      skipped++
      return false
    }
    return true
  })

  // Branch resolution
  const branchMap   = await lookupBranches(admin, tenantId, newRows.map(r => r.branchCode))
  const validatedRows: ValidatedRow[] = newRows.map(row => {
    const branchId = row.branchCode
      ? (branchMap.get(row.branchCode.toLowerCase()) ?? null)
      : null

    // Warn if a branch_code was provided but not found — surface as a validation error
    if (row.branchCode && !branchId) {
      errors.push({
        rowNumber: row.rowNumber,
        email:     row.email,
        errors:    [`branch_code "${row.branchCode}" not found or inactive in this tenant`],
        raw:       row.raw,
      })
      return null
    }

    return { ...row, branchId }
  }).filter((r): r is ValidatedRow => r !== null)

  return { valid: validatedRows, errors, skipped }
}

// ---------------------------------------------------------------------------
// ERROR REPORT CSV BUILDER
// ---------------------------------------------------------------------------

function buildErrorReportCsv (errors: RowError[]): string {
  const header = 'row_number,email,errors'
  const lines  = errors.map(e =>
    `${e.rowNumber},${quoteCsvField(e.email)},${quoteCsvField(e.errors.join('; '))}`
  )
  return [header, ...lines].join('\n')
}

function quoteCsvField (value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// ---------------------------------------------------------------------------
// BULK PROVISIONING
// Processes validated rows in small concurrent batches to avoid overwhelming
// the Auth API or Resend rate limits.
// ---------------------------------------------------------------------------

async function provisionBatch (
  admin:      AdminClient,
  tenantId:   string,
  tenantName: string,
  rows:       ValidatedRow[]
): Promise<{ success: number; failed: number; errors: RowError[] }> {
  let success = 0
  let failed  = 0
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(i, i + IMPORT_BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(row =>
        createInvitedUser(admin, tenantId, tenantName, {
          email:           row.email,
          fullName:        row.fullName,
          role:            row.role as InvitePayload['role'],
          employeeCode:    row.employeeCode  || undefined,
          employeeCategory: row.employeeCategory || undefined,
          department:      row.department   || undefined,
          designation:     row.designation  || undefined,
          branchId:        row.branchId     ?? undefined,
        })
      )
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const row    = batch[j]

      if (result.status === 'fulfilled' && result.value.ok) {
        success++
      } else {
        failed++
        const message = result.status === 'rejected'
          ? String(result.reason)
          : result.value.error?.message ?? 'Unknown error'

        errors.push({
          rowNumber: row.rowNumber,
          email:     row.email,
          errors:    [message],
          raw:       row.raw,
        })
      }
    }
  }

  return { success, failed, errors }
}

// ---------------------------------------------------------------------------
// processImportJob  (main entry point)
// ---------------------------------------------------------------------------

/**
 * Full pipeline: parse → validate → provision → update job record.
 *
 * Updates the user_import_jobs row throughout so the admin can poll status.
 * Never throws — all errors are surfaced in ImportSummary.
 *
 * @param admin       Service-role client
 * @param jobId       UUID of the user_import_jobs row (already created by caller)
 * @param tenantId    UUID of the owning tenant
 * @param tenantName  Human-readable name for invite emails
 * @param csvContent  Raw file content as UTF-8 string
 */
export async function processImportJob (
  admin:      AdminClient,
  jobId:      string,
  tenantId:   string,
  tenantName: string,
  csvContent: string
): Promise<ImportResult<ImportSummary>> {
  const patchJob = async (patch: Record<string, unknown>) =>
    admin.from('user_import_jobs').update(patch).eq('id', jobId)

  try {
    // Mark job as processing
    await patchJob({ status: 'processing' })

    // ── Parse ────────────────────────────────────────────────────────────────
    const { headers, rows: rawRows } = parseCsv(csvContent)

    const headerCheck = checkHeaders(headers)
    if (!headerCheck.ok) {
      const msg = `Missing required columns: ${headerCheck.missing.join(', ')}`
      await patchJob({ status: 'failed', total_rows: 0 })
      return { ok: false, error: msg }
    }

    if (rawRows.length === 0) {
      await patchJob({ status: 'failed', total_rows: 0 })
      return { ok: false, error: 'CSV file contains no data rows.' }
    }

    if (rawRows.length > MAX_ROWS_PER_IMPORT) {
      await patchJob({ status: 'failed', total_rows: rawRows.length })
      return {
        ok:    false,
        error: `CSV contains ${rawRows.length} rows — maximum is ${MAX_ROWS_PER_IMPORT} per import.`,
      }
    }

    await patchJob({ total_rows: rawRows.length })

    // ── Validate + de-duplicate ───────────────────────────────────────────────
    const { valid, errors: validationErrors, skipped } = await validateRows(admin, tenantId, rawRows)

    // ── Provision ─────────────────────────────────────────────────────────────
    const { success, failed, errors: provisionErrors } =
      await provisionBatch(admin, tenantId, tenantName, valid)

    const allErrors: RowError[] = [...validationErrors, ...provisionErrors]

    // ── Build error report CSV ────────────────────────────────────────────────
    // In production, upload this to Supabase Storage and store the signed URL.
    // For now, log the report — the caller may handle storage as needed.
    let errorReportUrl: string | null = null

    if (allErrors.length > 0) {
      const reportCsv = buildErrorReportCsv(allErrors)
      // Attempt to store in Supabase Storage bucket 'import-error-reports'
      const fileName  = `${tenantId}/${jobId}-errors.csv`
      const { data: uploadData, error: uploadErr } = await admin
        .storage
        .from('import-error-reports')
        .upload(fileName, reportCsv, { contentType: 'text/csv', upsert: true })

      if (uploadErr) {
        console.warn('[csv-import] Error report upload failed:', uploadErr.message)
      } else if (uploadData) {
        const { data: urlData } = admin
          .storage
          .from('import-error-reports')
          .getPublicUrl(fileName)
        errorReportUrl = urlData.publicUrl ?? null
      }
    }

    // ── Final job update ──────────────────────────────────────────────────────
    const finalStatus = failed === rawRows.length && success === 0 ? 'failed' : 'completed'

    await patchJob({
      status:           finalStatus,
      success_rows:     success,
      failed_rows:      allErrors.length,
      error_report_url: errorReportUrl,
    })

    const summary: ImportSummary = {
      totalRows:   rawRows.length,
      successRows: success,
      failedRows:  allErrors.length,
      skippedRows: skipped,
      errors:      allErrors,
    }

    return { ok: true, data: summary }

  } catch (err) {
    const message = (err as Error).message
    console.error('[csv-import] Unhandled error:', message)
    await patchJob({ status: 'failed' }).catch(() => undefined)
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// createImportJob  — helper to create the job record before starting
// ---------------------------------------------------------------------------

/**
 * Creates a user_import_jobs row in 'pending' state.
 * Returns the job ID to pass into processImportJob().
 */
export async function createImportJob (
  admin:      AdminClient,
  tenantId:   string,
  uploadedBy: string,
  filename:   string
): Promise<ImportResult<{ jobId: string }>> {
  const { data, error } = await admin
    .from('user_import_jobs')
    .insert({
      tenant_id:   tenantId,
      uploaded_by: uploadedBy,
      filename:    filename.slice(0, 255),   // guard against excessively long names
      status:      'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to create import job.' }
  }

  return { ok: true, data: { jobId: data.id as string } }
}
