#!/usr/bin/env npx tsx
/**
 * scripts/import-tenant-questions.ts
 *
 * Imports client-specific private question banks from JSON files in
 * data/tenant_questions/ into the tenant_questions table.
 *
 * TENANT-ID RESOLUTION (priority order):
 *   1. --tenant-id <uuid>  CLI flag (explicit override — highest priority)
 *   2. Folder name         data/tenant_questions/<uuid>/*.json
 *   3. JSON file field     top-level "tenant_id" key in the JSON file
 *
 * Usage:
 *   npm run import:tenant -- --tenant-id <uuid>
 *   npm run import:tenant:dry -- --tenant-id <uuid>
 *   npx tsx scripts/import-tenant-questions.ts --tenant-id <uuid>
 *   npx tsx scripts/import-tenant-questions.ts --tenant-id <uuid> --dry-run
 *   npx tsx scripts/import-tenant-questions.ts --tenant-id <uuid> --file data/tenant_questions/<uuid>/aml.json
 *   npx tsx scripts/import-tenant-questions.ts  # auto-discovers all <uuid>/ subfolders
 *
 * Data directory layout (folder-based multi-tenant):
 *   data/tenant_questions/
 *     <tenant-uuid>/
 *       aml.json
 *       kyc.json
 *     <another-tenant-uuid>/
 *       code-of-conduct.json
 *
 * JSON file format (array of question objects):
 *   [
 *     {
 *       "topic":             "Customer Due Diligence",
 *       "question":          "What does CDD stand for?",
 *       "option_a":          "...",
 *       "option_b":          "...",
 *       "option_c":          "...",
 *       "option_d":          "...",
 *       "correct_answer":    "a",
 *       "explanation":       "...",   (optional)
 *       "difficulty":        "easy",  (optional, default: medium)
 *       "employee_category": "general" (optional, default: general)
 *     }
 *   ]
 *
 *   OR a JSON object with a top-level tenant_id + questions array:
 *   {
 *     "tenant_id": "<uuid>",
 *     "questions": [ ... ]
 *   }
 *
 * Requires .env.local with:
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// =============================================================================
// CONFIG
// =============================================================================

const CHUNK_SIZE = 100
const DATA_DIR   = path.resolve(process.cwd(), 'data', 'tenant_questions')
const LOGS_DIR   = path.resolve(process.cwd(), 'logs')
const TIMESTAMP  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const LOG_FILE   = path.join(LOGS_DIR, `import-tenant-${TIMESTAMP}.log`)
const DRY_RUN    = process.argv.includes('--dry-run')

/** UUID regex for folder-name and tenant-id validation */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// CLI args
const CLI_TENANT_ID = (() => {
  const idx = process.argv.indexOf('--tenant-id')
  return idx !== -1 ? process.argv[idx + 1]?.trim() : null
})()

const SINGLE_FILE = (() => {
  const idx = process.argv.indexOf('--file')
  return idx !== -1 ? process.argv[idx + 1] : null
})()

// employee_category values allowed by the DB CHECK constraint
const VALID_CATEGORIES = [
  'general', 'manager', 'executive',
  'teller', 'compliance_officer', 'it', 'other', 'all'
] as const

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'] as const

// =============================================================================
// TYPES
// =============================================================================

/** Shape of each record in the source JSON files */
interface RawQuestion {
  topic:             string
  question:          string
  option_a:          string
  option_b:          string
  option_c:          string
  option_d:          string
  correct_answer:    string
  explanation?:      string
  difficulty?:       string
  employee_category?: string
  source_file?:      string
}

/** JSON file may be an array or an object wrapper with tenant_id */
interface JsonFileObject {
  tenant_id?: string
  questions:  RawQuestion[]
}

/** Validated record ready for insertion into tenant_questions */
interface TenantQuestionRow {
  tenant_id:         string
  policy_id:         string
  sub_heading_id:    string | null
  employee_category: string
  question_text:     string
  option_a:          string
  option_b:          string
  option_c:          string
  option_d:          string
  correct_option:    'a' | 'b' | 'c' | 'd'
  explanation:       string | null
  difficulty:        string
  source_file:       string | null
  is_active:         boolean
}

interface SubHeadingRow {
  id:        string
  code:      string
  title:     string
  policy_id: string
}

interface TenantRow {
  id:     string
  name:   string
  status: string
}

interface ValidationError {
  tenantId: string
  file:     string
  index:    number
  field:    string
  message:  string
  raw:      unknown
}

interface TenantSummary {
  tenantId:        string
  tenantName:      string
  filesProcessed:  number
  totalRecords:    number
  validRecords:    number
  insertedRecords: number
  skippedDupes:    number
  errorCount:      number
  errors:          ValidationError[]
}

interface ImportSummary {
  tenantsProcessed: number
  tenantSummaries:  TenantSummary[]
  totalInserted:    number
  totalErrors:      number
  durationMs:       number
}

// =============================================================================
// ENV LOADER
// =============================================================================

function loadEnv (): void {
  const candidates = ['.env.local', '.env']
  for (const name of candidates) {
    const envPath = path.resolve(process.cwd(), name)
    if (!fs.existsSync(envPath)) continue
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (key && val && !process.env[key]) process.env[key] = val
    }
    log(`Loaded env from ${name}`)
    break
  }
}

// =============================================================================
// LOGGER
// =============================================================================

const logLines: string[] = []

function log (msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  logLines.push(line)
}

function logError (msg: string): void {
  const line = `[${new Date().toISOString()}] ERROR: ${msg}`
  console.error(line)
  logLines.push(line)
}

function logWarn (msg: string): void {
  const line = `[${new Date().toISOString()}] WARN: ${msg}`
  console.warn(line)
  logLines.push(line)
}

function flushLog (): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf-8')
  console.log(`\nLog written to: ${LOG_FILE}`)
}

// =============================================================================
// UTILITIES
// =============================================================================

function chunk<T> (arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function isValidUuid (val: string): boolean {
  return UUID_RE.test(val)
}

function normalizeCorrectAnswer (raw: string): 'a' | 'b' | 'c' | 'd' | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
    .replace(/^option[_\s]?/, '')
    .replace(/[.):\s]/g, '')
  const map: Record<string, 'a' | 'b' | 'c' | 'd'> = {
    a: 'a', '1': 'a',
    b: 'b', '2': 'b',
    c: 'c', '3': 'c',
    d: 'd', '4': 'd',
  }
  return map[cleaned] ?? null
}

function normalizeCategory (raw?: string): string {
  if (!raw) return 'general'
  const cleaned = raw.trim().toLowerCase().replace(/[_\s-]/g, '')
  const aliasMap: Record<string, string> = {
    employee:          'general',
    staff:             'general',
    allstaff:          'all',
    everyone:          'all',
    complianceofficer: 'compliance_officer',
  }
  const direct = VALID_CATEGORIES.find(c => c.replace(/_/g, '') === cleaned)
  if (direct) return direct
  return aliasMap[cleaned] ?? 'general'
}

function normalizeDifficulty (raw?: string): string {
  if (!raw) return 'medium'
  const cleaned = raw.trim().toLowerCase()
  return (VALID_DIFFICULTIES as readonly string[]).includes(cleaned) ? cleaned : 'medium'
}

/** Fingerprint includes tenant_id to guarantee per-tenant dedup */
function questionFingerprint (tenantId: string, policyId: string, questionText: string): string {
  return `${tenantId}::${policyId}::${questionText.toLowerCase().replace(/\s+/g, ' ').trim()}`
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateRecord (
  raw:      unknown,
  index:    number,
  fileName: string,
  tenantId: string
): { error: ValidationError } | { record: RawQuestion } {
  const err = (field: string, message: string): { error: ValidationError } => ({
    error: { tenantId, file: fileName, index, field, message, raw }
  })

  if (typeof raw !== 'object' || raw === null) {
    return err('root', 'Record is not an object')
  }

  const r = raw as Record<string, unknown>

  if (!r.topic || typeof r.topic !== 'string' || !r.topic.trim()) {
    return err('topic', 'Missing or empty topic')
  }
  if (!r.question || typeof r.question !== 'string' || !r.question.trim()) {
    return err('question', 'Missing or empty question text')
  }
  for (const opt of ['option_a', 'option_b', 'option_c', 'option_d'] as const) {
    if (!r[opt] || typeof r[opt] !== 'string' || !(r[opt] as string).trim()) {
      return err(opt, `Missing or empty ${opt}`)
    }
  }
  if (!r.correct_answer || typeof r.correct_answer !== 'string') {
    return err('correct_answer', 'Missing correct_answer')
  }
  if (normalizeCorrectAnswer(r.correct_answer as string) === null) {
    return err('correct_answer', `Cannot resolve correct_answer: "${r.correct_answer}"`)
  }

  return {
    record: {
      topic:             (r.topic as string).trim(),
      question:          (r.question as string).trim(),
      option_a:          (r.option_a as string).trim(),
      option_b:          (r.option_b as string).trim(),
      option_c:          (r.option_c as string).trim(),
      option_d:          (r.option_d as string).trim(),
      correct_answer:    (r.correct_answer as string).trim(),
      explanation:       typeof r.explanation === 'string' ? r.explanation.trim() : undefined,
      difficulty:        typeof r.difficulty  === 'string' ? r.difficulty         : undefined,
      employee_category: typeof r.employee_category === 'string' ? r.employee_category : undefined,
      source_file:       typeof r.source_file === 'string' ? r.source_file        : undefined,
    }
  }
}

// =============================================================================
// SUPABASE LOOKUPS
// =============================================================================

/**
 * Verify that a tenant exists and is active.
 * Returns the tenant row on success, throws on failure.
 * STRICT: rejects non-UUID, missing, suspended, and cancelled tenants.
 */
async function verifyTenant (
  supabase:  SupabaseClient,
  tenantId:  string
): Promise<TenantRow> {
  if (!isValidUuid(tenantId)) {
    throw new Error(
      `Invalid tenant_id format: "${tenantId}". Must be a valid UUID.`
    )
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, status')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    throw new Error(
      `Tenant not found: ${tenantId}. ` +
      `Verify the UUID exists in the tenants table.`
    )
  }

  const tenant = data as TenantRow

  if (tenant.status !== 'active') {
    throw new Error(
      `Tenant "${tenant.name}" (${tenantId}) has status="${tenant.status}". ` +
      `Only active tenants may receive question imports.`
    )
  }

  return tenant
}

/** Load all sub_headings once and build lookup maps */
async function loadSubHeadings (supabase: SupabaseClient): Promise<{
  byTitle: Map<string, SubHeadingRow>
  byCode:  Map<string, SubHeadingRow>
}> {
  const { data, error } = await supabase
    .from('sub_headings')
    .select('id, code, title, policy_id')

  if (error) throw new Error(`Failed to load sub_headings: ${error.message}`)
  if (!data?.length) throw new Error('No sub_headings found — run seed first')

  const byTitle = new Map<string, SubHeadingRow>()
  const byCode  = new Map<string, SubHeadingRow>()
  for (const row of data as SubHeadingRow[]) {
    byTitle.set(row.title.toLowerCase().trim(), row)
    byCode.set(row.code.toLowerCase().trim(), row)
  }

  log(`Loaded ${data.length} sub_headings into lookup maps`)
  return { byTitle, byCode }
}

function resolveSubHeading (
  topic:   string,
  byTitle: Map<string, SubHeadingRow>,
  byCode:  Map<string, SubHeadingRow>
): SubHeadingRow | null {
  const key = topic.toLowerCase().trim()
  return byTitle.get(key) ?? byCode.get(key) ?? null
}

/**
 * Load existing fingerprints for ONE specific tenant only.
 * Never loads cross-tenant data.
 */
async function loadTenantFingerprints (
  supabase:  SupabaseClient,
  tenantId:  string
): Promise<Set<string>> {
  const set      = new Set<string>()
  let   page     = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('tenant_questions')
      .select('policy_id, question_text')
      .eq('tenant_id', tenantId)                 // STRICT: scoped to this tenant only
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw new Error(`Failed to load tenant fingerprints: ${error.message}`)
    if (!data?.length) break

    for (const row of data) {
      set.add(questionFingerprint(tenantId, row.policy_id, row.question_text))
    }
    if (data.length < pageSize) break
    page++
  }

  log(`  Loaded ${set.size} existing fingerprints for tenant ${tenantId}`)
  return set
}

// =============================================================================
// PARSE JSON FILE
// Supports both array format and { tenant_id?, questions: [] } object format.
// Returns { tenantIdFromFile, records }
// =============================================================================

function parseJsonFile (filePath: string): {
  tenantIdFromFile: string | null
  records:          unknown[]
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const parsed  = JSON.parse(content)

  if (Array.isArray(parsed)) {
    return { tenantIdFromFile: null, records: parsed }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>

    // Reject if it looks like a single question record instead of a wrapper
    if ('question' in obj && !('questions' in obj)) {
      return { tenantIdFromFile: null, records: [obj] }
    }

    const tenantIdFromFile =
      typeof obj.tenant_id === 'string' && obj.tenant_id.trim()
        ? obj.tenant_id.trim()
        : null

    const questions = Array.isArray(obj.questions)
      ? obj.questions
      : Array.isArray(obj.records)
        ? obj.records
        : [obj]

    return { tenantIdFromFile, records: questions }
  }

  throw new Error('JSON root must be an array or an object')
}

// =============================================================================
// RESOLVE TENANT ID FOR A FILE
// Priority: CLI flag > folder name (UUID subfolder) > JSON file field
// =============================================================================

function resolveTenantIdForFile (
  filePath:         string,
  tenantIdFromFile: string | null
): string | null {
  // 1. CLI flag — highest priority, always wins
  if (CLI_TENANT_ID) return CLI_TENANT_ID

  // 2. Parent folder name — if it is a valid UUID use it
  const parentFolder = path.basename(path.dirname(filePath))
  if (isValidUuid(parentFolder)) return parentFolder

  // 3. JSON-embedded tenant_id
  if (tenantIdFromFile && isValidUuid(tenantIdFromFile)) return tenantIdFromFile

  return null
}

// =============================================================================
// CORE: IMPORT ONE FILE FOR A SPECIFIC TENANT
// =============================================================================

async function importFile (
  filePath:    string,
  tenantRow:   TenantRow,
  supabase:    SupabaseClient,
  byTitle:     Map<string, SubHeadingRow>,
  byCode:      Map<string, SubHeadingRow>,
  existingFPs: Set<string>,
  summary:     TenantSummary,
  dryRun:      boolean
): Promise<void> {
  const fileName = path.basename(filePath)
  log(`\n  ── File: ${fileName}`)

  // ── Parse ────────────────────────────────────────────────────────────────────
  let records: unknown[]
  try {
    const { records: parsed } = parseJsonFile(filePath)
    records = parsed
  } catch (e) {
    logError(`  Cannot parse ${fileName}: ${(e as Error).message}`)
    summary.errors.push({
      tenantId: tenantRow.id, file: fileName, index: -1,
      field: 'file', message: `JSON parse error: ${(e as Error).message}`, raw: null
    })
    summary.errorCount++
    return
  }

  summary.filesProcessed++
  summary.totalRecords += records.length
  log(`  Records found: ${records.length}`)

  // ── Validate + resolve ────────────────────────────────────────────────────────
  const readyRows: TenantQuestionRow[] = []

  for (let i = 0; i < records.length; i++) {
    const result = validateRecord(records[i], i, fileName, tenantRow.id)

    if ('error' in result) {
      logError(`  [${i}] ${result.error.field}: ${result.error.message}`)
      summary.errors.push(result.error)
      summary.errorCount++
      continue
    }

    const raw = result.record

    // ── Resolve sub_heading → policy ─────────────────────────────────────────
    const subHeading = resolveSubHeading(raw.topic, byTitle, byCode)
    if (!subHeading) {
      const msg = `Topic "${raw.topic}" did not match any sub_heading title or code`
      logError(`  [${i}] ${msg}`)
      summary.errors.push({
        tenantId: tenantRow.id, file: fileName, index: i,
        field: 'topic', message: msg, raw: records[i]
      })
      summary.errorCount++
      continue
    }

    // ── Normalise ─────────────────────────────────────────────────────────────
    const correctOption = normalizeCorrectAnswer(raw.correct_answer)!
    const category      = normalizeCategory(raw.employee_category)
    const difficulty    = normalizeDifficulty(raw.difficulty)
    const sourceFile    = raw.source_file ?? fileName

    // ── Dedup check (tenant-scoped fingerprint) ───────────────────────────────
    const fp = questionFingerprint(tenantRow.id, subHeading.policy_id, raw.question)
    if (existingFPs.has(fp)) {
      log(`  [${i}] SKIP duplicate: "${raw.question.slice(0, 55)}…"`)
      summary.skippedDupes++
      summary.validRecords++
      continue
    }

    // Mark in-memory so duplicates within the same run are also caught
    existingFPs.add(fp)
    summary.validRecords++

    readyRows.push({
      tenant_id:         tenantRow.id,             // STRICT: always the verified tenant
      policy_id:         subHeading.policy_id,
      sub_heading_id:    subHeading.id,
      employee_category: category,
      question_text:     raw.question,
      option_a:          raw.option_a,
      option_b:          raw.option_b,
      option_c:          raw.option_c,
      option_d:          raw.option_d,
      correct_option:    correctOption,
      explanation:       raw.explanation ?? null,
      difficulty,
      source_file:       sourceFile,
      is_active:         true,
    })
  }

  log(`  Valid + resolved: ${readyRows.length} | Skipped dupes: ${summary.skippedDupes}`)

  if (!readyRows.length) {
    log(`  Nothing to insert for ${fileName}`)
    return
  }

  if (dryRun) {
    log(`  [DRY RUN] Would insert ${readyRows.length} rows for tenant "${tenantRow.name}"`)
    summary.insertedRecords += readyRows.length
    return
  }

  // ── Batch insert in chunks of CHUNK_SIZE ─────────────────────────────────────
  const batches = chunk(readyRows, CHUNK_SIZE)
  log(`  Inserting ${readyRows.length} rows in ${batches.length} batch(es) of ≤${CHUNK_SIZE}...`)

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]

    // Safety: verify every row in the batch has the correct tenant_id before sending
    const rogue = batch.find(r => r.tenant_id !== tenantRow.id)
    if (rogue) {
      logError(`  ABORT batch ${b + 1}: row has mismatched tenant_id "${rogue.tenant_id}" — expected "${tenantRow.id}"`)
      summary.errorCount += batch.length
      continue
    }

    const { error } = await supabase
      .from('tenant_questions')
      .insert(batch)

    if (error) {
      logError(`  Batch ${b + 1}/${batches.length} FAILED: ${error.message}`)
      summary.errors.push({
        tenantId: tenantRow.id, file: fileName, index: b * CHUNK_SIZE,
        field: 'batch_insert', message: error.message, raw: null
      })
      summary.errorCount += batch.length
    } else {
      summary.insertedRecords += batch.length
      log(`  Batch ${b + 1}/${batches.length}: inserted ${batch.length} rows ✓`)
    }
  }
}

// =============================================================================
// PROCESS ONE TENANT — discovers files, verifies tenant, runs imports
// =============================================================================

async function processTenant (
  tenantId:  string,
  files:     string[],
  supabase:  SupabaseClient,
  byTitle:   Map<string, SubHeadingRow>,
  byCode:    Map<string, SubHeadingRow>,
  dryRun:    boolean
): Promise<TenantSummary> {
  log(`\n${'─'.repeat(60)}`)
  log(`Tenant: ${tenantId}`)

  // ── Verify tenant exists and is active — HARD STOP if not ─────────────────
  let tenantRow: TenantRow
  try {
    tenantRow = await verifyTenant(supabase, tenantId)
    log(`Tenant verified: "${tenantRow.name}" (status: ${tenantRow.status})`)
  } catch (e) {
    logError(`${(e as Error).message}`)
    logError('Skipping all files for this tenant.')
    return {
      tenantId, tenantName: tenantId,
      filesProcessed: 0, totalRecords: 0, validRecords: 0,
      insertedRecords: 0, skippedDupes: 0,
      errorCount: 1,
      errors: [{
        tenantId, file: '—', index: -1,
        field: 'tenant_id', message: (e as Error).message, raw: tenantId
      }]
    }
  }

  const summary: TenantSummary = {
    tenantId,
    tenantName:      tenantRow.name,
    filesProcessed:  0,
    totalRecords:    0,
    validRecords:    0,
    insertedRecords: 0,
    skippedDupes:    0,
    errorCount:      0,
    errors:          [],
  }

  // ── Load existing fingerprints scoped to this tenant only ──────────────────
  const existingFPs = await loadTenantFingerprints(supabase, tenantId)

  // ── Process each file ──────────────────────────────────────────────────────
  for (const file of files) {
    await importFile(file, tenantRow, supabase, byTitle, byCode, existingFPs, summary, dryRun)
  }

  return summary
}

// =============================================================================
// SUMMARY REPORT
// =============================================================================

function printSummary (overall: ImportSummary): void {
  const divider = '═'.repeat(60)
  log(`\n${divider}`)
  log('  IMPORT TENANT QUESTIONS — SUMMARY REPORT')
  log(divider)
  log(`  Tenants processed : ${overall.tenantsProcessed}`)
  log(`  Total inserted    : ${overall.totalInserted}`)
  log(`  Total errors      : ${overall.totalErrors}`)
  log(`  Duration          : ${overall.durationMs}ms`)
  log(divider)

  for (const ts of overall.tenantSummaries) {
    log(`\n  ┌ Tenant: ${ts.tenantName} (${ts.tenantId})`)
    log(`  │  Files processed   : ${ts.filesProcessed}`)
    log(`  │  Total records     : ${ts.totalRecords}`)
    log(`  │  Valid records     : ${ts.validRecords}`)
    log(`  │  Inserted          : ${ts.insertedRecords}`)
    log(`  │  Skipped (dupes)   : ${ts.skippedDupes}`)
    log(`  └  Errors            : ${ts.errorCount}`)

    if (ts.errors.length) {
      log(`\n  ERROR DETAILS for ${ts.tenantName}:`)
      for (const e of ts.errors) {
        log(`  · [${e.file}:${e.index}] ${e.field} — ${e.message}`)
      }
    }
  }

  log(`\n${divider}`)
  if (DRY_RUN) log('  ⚠  DRY RUN — no rows were written to the database.')
  log(`${divider}\n`)
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main (): Promise<void> {
  const startMs = Date.now()

  log('import-tenant-questions starting')
  if (DRY_RUN)       log('MODE: DRY RUN')
  if (CLI_TENANT_ID) log(`CLI tenant override: ${CLI_TENANT_ID}`)

  // ── Load env ────────────────────────────────────────────────────────────────
  loadEnv()

  const supabaseUrl    = process.env.PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    logError('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  // ── Init Supabase with service role ─────────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  log(`Connected to Supabase: ${supabaseUrl}`)

  // ── Pre-load sub_headings lookup ─────────────────────────────────────────────
  const { byTitle, byCode } = await loadSubHeadings(supabase)

  // ── Collect files grouped by tenant_id ─────────────────────────────────────
  // Map<tenantId, string[]>
  const tenantFileMap = new Map<string, string[]>()

  if (SINGLE_FILE) {
    // Single-file mode — tenant_id must come from CLI or JSON
    const absPath = path.resolve(process.cwd(), SINGLE_FILE)
    if (!fs.existsSync(absPath)) {
      logError(`File not found: ${absPath}`)
      process.exit(1)
    }

    let tenantIdFromFile: string | null = null
    try {
      const parsed = parseJsonFile(absPath)
      tenantIdFromFile = parsed.tenantIdFromFile
    } catch { /* handled below */ }

    const resolvedTenantId = resolveTenantIdForFile(absPath, tenantIdFromFile)
    if (!resolvedTenantId) {
      logError(
        'Cannot resolve tenant_id for the file. ' +
        'Pass --tenant-id <uuid>, place the file in data/tenant_questions/<uuid>/, ' +
        'or add "tenant_id" as a top-level field in the JSON.'
      )
      process.exit(1)
    }

    tenantFileMap.set(resolvedTenantId, [absPath])

  } else if (CLI_TENANT_ID) {
    // Tenant-id provided — scan for JSON files in the matching subfolder OR root
    if (!isValidUuid(CLI_TENANT_ID)) {
      logError(`--tenant-id must be a valid UUID. Got: "${CLI_TENANT_ID}"`)
      process.exit(1)
    }

    // Look in data/tenant_questions/<tenant-uuid>/ first, then root data dir
    const tenantSubDir = path.join(DATA_DIR, CLI_TENANT_ID)
    const scanDir      = fs.existsSync(tenantSubDir) ? tenantSubDir : DATA_DIR

    if (!fs.existsSync(scanDir)) {
      logError(`Data directory not found: ${scanDir}`)
      process.exit(1)
    }

    const files = fs.readdirSync(scanDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(scanDir, f))
      .sort()

    if (!files.length) {
      log(`No JSON files found in ${scanDir} — nothing to import.`)
      process.exit(0)
    }

    tenantFileMap.set(CLI_TENANT_ID, files)

  } else {
    // Auto-discover mode — scan all UUID-named subfolders
    if (!fs.existsSync(DATA_DIR)) {
      logError(`Data directory not found: ${DATA_DIR}`)
      log('Create data/tenant_questions/<tenant-uuid>/ and add JSON files, then re-run.')
      process.exit(1)
    }

    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    const uuidFolders = entries
      .filter(e => e.isDirectory() && isValidUuid(e.name))
      .map(e => e.name)

    if (!uuidFolders.length) {
      log('No UUID-named subdirectories found in data/tenant_questions/ — nothing to import.')
      log('Expected structure: data/tenant_questions/<tenant-uuid>/*.json')
      process.exit(0)
    }

    for (const folderName of uuidFolders) {
      const folderPath = path.join(DATA_DIR, folderName)
      const files = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(folderPath, f))
        .sort()
      if (files.length) tenantFileMap.set(folderName, files)
    }
  }

  log(`\nTenants to process: ${tenantFileMap.size}`)
  for (const [tid, files] of tenantFileMap) {
    log(`  ${tid}: ${files.length} file(s)`)
  }

  // ── Process each tenant ──────────────────────────────────────────────────────
  const overallSummary: ImportSummary = {
    tenantsProcessed: 0,
    tenantSummaries:  [],
    totalInserted:    0,
    totalErrors:      0,
    durationMs:       0,
  }

  for (const [tenantId, files] of tenantFileMap) {
    const ts = await processTenant(tenantId, files, supabase, byTitle, byCode, DRY_RUN)
    overallSummary.tenantSummaries.push(ts)
    overallSummary.tenantsProcessed++
    overallSummary.totalInserted += ts.insertedRecords
    overallSummary.totalErrors   += ts.errorCount
  }

  overallSummary.durationMs = Date.now() - startMs
  printSummary(overallSummary)
  flushLog()

  process.exit(overallSummary.totalErrors > 0 ? 1 : 0)
}

main().catch(err => {
  logError(`Unhandled error: ${(err as Error).message}`)
  flushLog()
  process.exit(1)
})
