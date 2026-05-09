#!/usr/bin/env npx tsx
/**
 * scripts/import-master-questions.ts
 *
 * Imports platform-wide shared questions from JSON files in
 * data/master_questions/ into the master_questions table.
 *
 * Usage:
 *   npm run import:master
 *   npx tsx scripts/import-master-questions.ts
 *   npx tsx scripts/import-master-questions.ts --dry-run
 *   npx tsx scripts/import-master-questions.ts --file data/master_questions/aml.json
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

const CHUNK_SIZE    = 100
const DATA_DIR      = path.resolve(process.cwd(), 'data', 'master_questions')
const LOGS_DIR      = path.resolve(process.cwd(), 'logs')
const TIMESTAMP     = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const LOG_FILE      = path.join(LOGS_DIR, `import-master-${TIMESTAMP}.log`)
const DRY_RUN       = process.argv.includes('--dry-run')
const SINGLE_FILE   = (() => {
  const idx = process.argv.indexOf('--file')
  return idx !== -1 ? process.argv[idx + 1] : null
})()

// employee_category values allowed by the DB CHECK constraint on master_questions
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
  topic:          string   // maps to sub_heading title or code
  question:       string   // question_text
  option_a:       string
  option_b:       string
  option_c:       string
  option_d:       string
  correct_answer: string   // normalised to 'a'|'b'|'c'|'d'
  explanation?:   string
  difficulty?:    string
  employee_category?: string
  source_file?:   string
}

/** Validated record ready for insertion into master_questions */
interface MasterQuestionRow {
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

interface ValidationError {
  file:    string
  index:   number
  field:   string
  message: string
  raw:     unknown
}

interface ImportSummary {
  filesProcessed:  number
  totalRecords:    number
  validRecords:    number
  insertedRecords: number
  skippedDupes:    number
  errorCount:      number
  errors:          ValidationError[]
  durationMs:      number
}

// =============================================================================
// ENV LOADER
// Reads .env.local from project root — no dotenv dependency needed.
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
      if (key && val && !process.env[key]) {
        process.env[key] = val
      }
    }
    log(`Loaded env from ${name}`)
    break
  }
}

// =============================================================================
// LOGGER
// Writes to stdout AND the log file simultaneously.
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

function flushLog (): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf-8')
  console.log(`\nLog written to: ${LOG_FILE}`)
}

// =============================================================================
// SECURITY: PATH TRAVERSAL GUARD                                 (MEDIUM-3)
// Rejects any resolved path that escapes the project root.
// Prevents --file ../../../../etc/passwd style attacks in CI environments.
// =============================================================================

const PROJECT_ROOT = process.cwd()

function assertSafePath (resolved: string, label: string): void {
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) {
    logError(`Path traversal rejected for ${label}: "${resolved}" is outside project root`)
    process.exit(1)
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function chunk<T> (arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * Normalise correct_answer from a variety of common formats:
 *   'A' | 'a' | 'Option A' | 'option_a' | '1' | 'a)' | 'A.' → 'a'
 * Returns null if the value cannot be resolved.
 */
function normalizeCorrectAnswer (raw: string): 'a' | 'b' | 'c' | 'd' | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
    .replace(/^option[_\s]?/, '')  // strip 'option ', 'option_'
    .replace(/[.):\s]/g, '')       // strip trailing punctuation
  const map: Record<string, 'a' | 'b' | 'c' | 'd'> = {
    a: 'a', '1': 'a',
    b: 'b', '2': 'b',
    c: 'c', '3': 'c',
    d: 'd', '4': 'd',
  }
  return map[cleaned] ?? null
}

/**
 * Normalise employee_category against the DB CHECK constraint values.
 * Maps common aliases ('employee' → 'general', 'all staff' → 'all', etc.)
 * Falls back to 'general' (schema default) if unrecognised.
 */
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

/**
 * Normalise difficulty — falls back to 'medium' if unrecognised.
 */
function normalizeDifficulty (raw?: string): string {
  if (!raw) return 'medium'
  const cleaned = raw.trim().toLowerCase()
  return (VALID_DIFFICULTIES as readonly string[]).includes(cleaned) ? cleaned : 'medium'
}

/** Stable fingerprint for duplicate detection — policy + normalised question text. */
function questionFingerprint (policyId: string, questionText: string): string {
  return `${policyId}::${questionText.toLowerCase().replace(/\s+/g, ' ').trim()}`
}

// =============================================================================
// VALIDATION
// Returns null on success, or an error descriptor on failure.
// =============================================================================

function validateRecord (
  raw:      unknown,
  index:    number,
  fileName: string
): { error: ValidationError } | { record: RawQuestion } {
  const err = (field: string, message: string): { error: ValidationError } => ({
    error: { file: fileName, index, field, message, raw }
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
      difficulty:        typeof r.difficulty === 'string'  ? r.difficulty         : undefined,
      employee_category: typeof r.employee_category === 'string' ? r.employee_category : undefined,
      source_file:       typeof r.source_file === 'string' ? r.source_file        : undefined,
    }
  }
}

// =============================================================================
// SUPABASE LOOKUPS
// =============================================================================

/** Load all sub_headings once and build lookup maps for fast resolution. */
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

/** Resolve topic string → sub_heading row (or null if not found). */
function resolveSubHeading (
  topic:   string,
  byTitle: Map<string, SubHeadingRow>,
  byCode:  Map<string, SubHeadingRow>
): SubHeadingRow | null {
  const key = topic.toLowerCase().trim()
  return byTitle.get(key) ?? byCode.get(key) ?? null
}

/** Build a Set of fingerprints for all existing master_questions (dedup guard). */
async function loadExistingFingerprints (supabase: SupabaseClient): Promise<Set<string>> {
  const set = new Set<string>()
  let page  = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('master_questions')
      .select('policy_id, question_text')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw new Error(`Failed to load existing questions: ${error.message}`)
    if (!data?.length) break

    for (const row of data) {
      set.add(questionFingerprint(row.policy_id, row.question_text))
    }
    if (data.length < pageSize) break
    page++
  }

  log(`Loaded ${set.size} existing master_question fingerprints for dedup`)
  return set
}

// =============================================================================
// CORE IMPORT
// =============================================================================

async function importFile (
  filePath:     string,
  supabase:     SupabaseClient,
  byTitle:      Map<string, SubHeadingRow>,
  byCode:       Map<string, SubHeadingRow>,
  existingFPs:  Set<string>,
  summary:      ImportSummary,
  dryRun:       boolean
): Promise<void> {
  const fileName = path.basename(filePath)
  log(`\n── Processing: ${fileName}`)

  // ── Parse JSON ──────────────────────────────────────────────────────────────
  let rawRecords: unknown[]
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed  = JSON.parse(content)
    rawRecords    = Array.isArray(parsed) ? parsed : [parsed]
  } catch (e) {
    logError(`Cannot parse ${fileName}: ${(e as Error).message}`)
    summary.errors.push({ file: fileName, index: -1, field: 'file', message: `JSON parse error: ${(e as Error).message}`, raw: null })
    summary.errorCount++
    return
  }

  summary.filesProcessed++
  summary.totalRecords += rawRecords.length
  log(`  Records found: ${rawRecords.length}`)

  // ── Validate + resolve ───────────────────────────────────────────────────────
  const readyRows: MasterQuestionRow[] = []

  for (let i = 0; i < rawRecords.length; i++) {
    const result = validateRecord(rawRecords[i], i, fileName)

    if ('error' in result) {
      logError(`  [${i}] ${result.error.field}: ${result.error.message}`)
      summary.errors.push(result.error)
      summary.errorCount++
      continue
    }

    const raw = result.record

    // ── Resolve sub_heading + policy ─────────────────────────────────────────
    const subHeading = resolveSubHeading(raw.topic, byTitle, byCode)

    if (!subHeading) {
      const msg = `Topic "${raw.topic}" did not match any sub_heading title or code`
      logError(`  [${i}] ${msg}`)
      summary.errors.push({ file: fileName, index: i, field: 'topic', message: msg, raw: rawRecords[i] })
      summary.errorCount++
      continue
    }

    // ── Normalise fields ─────────────────────────────────────────────────────
    const correctOption = normalizeCorrectAnswer(raw.correct_answer)!
    const category      = normalizeCategory(raw.employee_category)
    const difficulty    = normalizeDifficulty(raw.difficulty)
    const sourceFile    = raw.source_file ?? fileName

    // ── Dedup check ──────────────────────────────────────────────────────────
    const fp = questionFingerprint(subHeading.policy_id, raw.question)
    if (existingFPs.has(fp)) {
      log(`  [${i}] SKIP duplicate: "${raw.question.slice(0, 60)}…"`)
      summary.skippedDupes++
      summary.validRecords++
      continue
    }

    // Mark as seen so duplicates within the same file are also caught
    existingFPs.add(fp)
    summary.validRecords++

    readyRows.push({
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
    log(`  [DRY RUN] Would insert ${readyRows.length} rows (skipping actual write)`)
    summary.insertedRecords += readyRows.length
    return
  }

  // ── Batch insert in chunks of CHUNK_SIZE ─────────────────────────────────────
  const batches = chunk(readyRows, CHUNK_SIZE)
  log(`  Inserting ${readyRows.length} rows in ${batches.length} batch(es) of ≤${CHUNK_SIZE}...`)

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    const { error } = await supabase
      .from('master_questions')
      .insert(batch)

    if (error) {
      logError(`  Batch ${b + 1}/${batches.length} FAILED: ${error.message}`)
      summary.errors.push({
        file: fileName, index: b * CHUNK_SIZE, field: 'batch_insert',
        message: error.message, raw: null
      })
      summary.errorCount += batch.length
    } else {
      summary.insertedRecords += batch.length
      log(`  Batch ${b + 1}/${batches.length}: inserted ${batch.length} rows ✓`)
    }
  }
}

// =============================================================================
// SUMMARY REPORT
// =============================================================================

function printSummary (summary: ImportSummary): void {
  const divider = '═'.repeat(58)
  log(`\n${divider}`)
  log('  IMPORT MASTER QUESTIONS — SUMMARY REPORT')
  log(divider)
  log(`  Files processed   : ${summary.filesProcessed}`)
  log(`  Total records     : ${summary.totalRecords}`)
  log(`  Valid records     : ${summary.validRecords}`)
  log(`  Inserted          : ${summary.insertedRecords}`)
  log(`  Skipped (dupes)   : ${summary.skippedDupes}`)
  log(`  Errors            : ${summary.errorCount}`)
  log(`  Duration          : ${summary.durationMs}ms`)
  log(divider)

  if (summary.errors.length) {
    log('\n  ERROR DETAILS:')
    for (const e of summary.errors) {
      log(`  · [${e.file}:${e.index}] ${e.field} — ${e.message}`)
    }
  }

  log(divider)

  if (DRY_RUN) log('  ⚠  DRY RUN — no rows were written to the database.')

  log(divider + '\n')
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main (): Promise<void> {
  const startMs = Date.now()

  log('import-master-questions starting')
  if (DRY_RUN) log('MODE: DRY RUN')

  // ── Load env ────────────────────────────────────────────────────────────────
  loadEnv()

  const supabaseUrl     = process.env.PUBLIC_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    logError('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  // ── Init Supabase with service role (bypasses RLS) ─────────────────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  log(`Connected to Supabase: ${supabaseUrl}`)

  // ── Pre-load lookup data ────────────────────────────────────────────────────
  const { byTitle, byCode } = await loadSubHeadings(supabase)
  const existingFPs         = await loadExistingFingerprints(supabase)

  // ── Collect files to process ────────────────────────────────────────────────
  let files: string[]

  if (SINGLE_FILE) {
    const resolved = path.resolve(process.cwd(), SINGLE_FILE)
    assertSafePath(resolved, '--file')               // MEDIUM-3: path traversal guard
    if (!fs.existsSync(resolved)) {
      logError(`File not found: ${resolved}`)
      process.exit(1)
    }
    files = [resolved]
  } else {
    if (!fs.existsSync(DATA_DIR)) {
      logError(`Data directory not found: ${DATA_DIR}`)
      log('Create data/master_questions/ and add JSON files, then re-run.')
      process.exit(1)
    }
    files = fs
      .readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(DATA_DIR, f))
      .sort()

    if (!files.length) {
      log('No JSON files found in data/master_questions/ — nothing to import.')
      process.exit(0)
    }
  }

  log(`Files to process: ${files.length}`)

  // ── Import each file ────────────────────────────────────────────────────────
  const summary: ImportSummary = {
    filesProcessed:  0,
    totalRecords:    0,
    validRecords:    0,
    insertedRecords: 0,
    skippedDupes:    0,
    errorCount:      0,
    errors:          [],
    durationMs:      0,
  }

  for (const file of files) {
    await importFile(file, supabase, byTitle, byCode, existingFPs, summary, DRY_RUN)
  }

  summary.durationMs = Date.now() - startMs
  printSummary(summary)
  flushLog()

  // Exit with non-zero code if any errors occurred (useful for CI pipelines)
  process.exit(summary.errorCount > 0 ? 1 : 0)
}

main().catch(err => {
  logError(`Unhandled error: ${(err as Error).message}`)
  flushLog()
  process.exit(1)
})
