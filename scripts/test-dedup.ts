#!/usr/bin/env npx tsx
/**
 * scripts/test-dedup.ts
 *
 * Simulates quiz generation across N retakes for a given tenant + policy.
 * Validates that the deduplication, history, and tenant isolation logic
 * all work correctly before going live.
 *
 * What this simulates:
 *   · Combines master_questions + tenant_questions for the target tenant
 *   · Draws N questions per session using the configured master/tenant ratio
 *   · Tracks seen questions in an in-memory history (mirrors user_question_history)
 *   · On pool exhaustion, resets history and continues (mirrors history_reset_days)
 *   · Validates zero overlaps within sessions AND across sessions per cycle
 *   · Validates tenant isolation (no cross-tenant question leakage)
 *   · Optionally loads a real user's history from the DB as a starting point
 *
 * Usage:
 *   npm run test:dedup -- --tenant-id <uuid> --policy AML
 *   npx tsx scripts/test-dedup.ts --tenant-id <uuid> --policy AML
 *   npx tsx scripts/test-dedup.ts --tenant-id <uuid> --policy AML --retakes 10
 *   npx tsx scripts/test-dedup.ts --tenant-id <uuid> --policy AML --user-id <uuid>
 *   npx tsx scripts/test-dedup.ts --tenant-id <uuid> --policy AML --questions 10 --master-ratio 0.7
 *
 * Requires .env.local with:
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// =============================================================================
// CONFIG & CLI FLAGS
// =============================================================================

const LOGS_DIR  = path.resolve(process.cwd(), 'logs')
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const LOG_FILE  = path.join(LOGS_DIR, `test-dedup-${TIMESTAMP}.log`)

function arg (flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1]?.trim() ?? null : null
}

const CLI_TENANT_ID   = arg('--tenant-id')
const CLI_POLICY      = arg('--policy')?.toUpperCase() ?? null
const CLI_USER_ID     = arg('--user-id')            // optional: seed from real history
const QUESTIONS_PER   = parseInt(arg('--questions')     ?? '20', 10)
const TOTAL_RETAKES   = parseInt(arg('--retakes')       ?? '7',  10)
const MASTER_RATIO    = parseFloat(arg('--master-ratio') ?? '0.5')

// =============================================================================
// TYPES
// =============================================================================

type QuestionSource = 'master' | 'tenant'

interface PoolQuestion {
  id:               string
  source:           QuestionSource
  policy_id:        string
  policy_code:      string
  sub_heading_id:   string | null
  sub_heading_code: string | null
  employee_category: string
  question_text:    string
  correct_option:   string
  difficulty:       string
  /** Only set for tenant questions — used in isolation checks */
  tenant_id:        string | null
}

interface SessionResult {
  sessionNumber:    number
  cycleNumber:      number          // increments each time history resets
  historyReset:     boolean         // true if history was reset before this session
  questions:        PoolQuestion[]
  masterCount:      number
  tenantCount:      number
  poolSizeBefore:   { master: number; tenant: number; total: number }
  poolSizeAfter:    { master: number; tenant: number; total: number }
  shortfall:        number          // questions requested but not served (pool too small)
}

interface ValidationFinding {
  severity: 'PASS' | 'WARN' | 'FAIL'
  check:    string
  message:  string
  detail?:  string
}

interface DedupeReport {
  tenantId:          string
  tenantName:        string
  policyCode:        string
  questionsPerSession: number
  masterRatio:       number
  totalRetakes:      number
  masterPoolSize:    number
  tenantPoolSize:    number
  combinedPoolSize:  number
  sessions:          SessionResult[]
  findings:          ValidationFinding[]
  passed:            boolean
  durationMs:        number
}

// =============================================================================
// LOGGER
// =============================================================================

const logLines: string[] = []

function log (msg: string): void {
  console.log(msg)
  logLines.push(msg)
}

function logErr (msg: string): void {
  console.error(msg)
  logLines.push(msg)
}

function flushLog (): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf-8')
  log(`\nLog saved: ${LOG_FILE}`)
}

// =============================================================================
// ENV LOADER
// =============================================================================

function loadEnv (): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      if (k && v && !process.env[k]) process.env[k] = v
    }
    break
  }
}

// =============================================================================
// SEEDED SHUFFLE (deterministic for reproducible test runs)
// Uses a simple LCG so the same seed always produces the same order.
// =============================================================================

function seededShuffle<T> (arr: T[], seed: number): T[] {
  const out = [...arr]
  let s = seed
  const lcg = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// =============================================================================
// SUPABASE LOADERS
// =============================================================================

async function loadTenant (supabase: SupabaseClient, tenantId: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('tenants').select('id, name, status').eq('id', tenantId).single()
  if (error || !data) throw new Error(`Tenant not found: ${tenantId}`)
  if (data.status !== 'active') throw new Error(`Tenant "${data.name}" is not active (status: ${data.status})`)
  return data as { id: string; name: string }
}

async function loadPolicy (supabase: SupabaseClient, code: string): Promise<{ id: string; code: string; title: string }> {
  const { data, error } = await supabase
    .from('policies').select('id, code, title').eq('code', code).eq('is_active', true).single()
  if (error || !data) throw new Error(`Policy "${code}" not found or inactive`)
  return data as { id: string; code: string; title: string }
}

async function loadMasterPool (
  supabase:  SupabaseClient,
  policyId:  string,
  policyCode: string
): Promise<PoolQuestion[]> {
  // Load sub_headings for code lookup
  const { data: shData } = await supabase
    .from('sub_headings').select('id, code').eq('policy_id', policyId)
  const shMap = new Map((shData ?? []).map((s: { id: string; code: string }) => [s.id, s.code]))

  const { data, error } = await supabase
    .from('master_questions')
    .select('id, policy_id, sub_heading_id, employee_category, question_text, correct_option, difficulty')
    .eq('policy_id', policyId)
    .eq('is_active', true)

  if (error) throw new Error(`loadMasterPool: ${error.message}`)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:               r.id as string,
    source:           'master' as const,
    policy_id:        r.policy_id as string,
    policy_code:      policyCode,
    sub_heading_id:   r.sub_heading_id as string | null,
    sub_heading_code: r.sub_heading_id ? (shMap.get(r.sub_heading_id as string) ?? null) : null,
    employee_category: r.employee_category as string,
    question_text:    r.question_text as string,
    correct_option:   r.correct_option as string,
    difficulty:       r.difficulty as string,
    tenant_id:        null,
  }))
}

async function loadTenantPool (
  supabase:  SupabaseClient,
  tenantId:  string,
  policyId:  string,
  policyCode: string
): Promise<PoolQuestion[]> {
  const { data: shData } = await supabase
    .from('sub_headings').select('id, code').eq('policy_id', policyId)
  const shMap = new Map((shData ?? []).map((s: { id: string; code: string }) => [s.id, s.code]))

  const { data, error } = await supabase
    .from('tenant_questions')
    .select('id, tenant_id, policy_id, sub_heading_id, employee_category, question_text, correct_option, difficulty')
    .eq('tenant_id', tenantId)       // STRICT: scoped to this tenant only
    .eq('policy_id', policyId)
    .eq('is_active', true)

  if (error) throw new Error(`loadTenantPool: ${error.message}`)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:               r.id as string,
    source:           'tenant' as const,
    policy_id:        r.policy_id as string,
    policy_code:      policyCode,
    sub_heading_id:   r.sub_heading_id as string | null,
    sub_heading_code: r.sub_heading_id ? (shMap.get(r.sub_heading_id as string) ?? null) : null,
    employee_category: r.employee_category as string,
    question_text:    r.question_text as string,
    correct_option:   r.correct_option as string,
    difficulty:       r.difficulty as string,
    tenant_id:        r.tenant_id as string,
  }))
}

/** Load a real user's seen questions from user_question_history for seeding */
async function loadRealHistory (
  supabase:  SupabaseClient,
  tenantId:  string,
  userId:    string,
  policyId:  string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_question_history')
    .select('question_source, question_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('policy_id', policyId)

  if (error) throw new Error(`loadRealHistory: ${error.message}`)
  const set = new Set<string>()
  for (const row of data ?? []) {
    set.add(`${row.question_source}::${row.question_id}`)
  }
  log(`  Loaded ${set.size} real history entries for user ${userId}`)
  return set
}

// =============================================================================
// QUESTION SELECTION ENGINE
// Mirrors the production quiz generation algorithm.
//
// Algorithm:
//   1. Split combined pool into master_available and tenant_available
//      (excluding questions already in history)
//   2. Draw masterTarget = floor(N * masterRatio) from master_available
//   3. Draw tenantTarget = N - masterTarget from tenant_available
//   4. If one pool is short, compensate from the other
//   5. If combined pool is still short, serve what is available (shortfall reported)
// =============================================================================

function fingerprint (q: PoolQuestion): string {
  return `${q.source}::${q.id}`
}

function selectQuestions (
  masterPool:  PoolQuestion[],
  tenantPool:  PoolQuestion[],
  history:     Set<string>,
  n:           number,
  ratio:       number,
  seed:        number
): { selected: PoolQuestion[]; shortfall: number } {
  // Filter out seen questions
  const masterAvail = masterPool.filter(q => !history.has(fingerprint(q)))
  const tenantAvail = tenantPool.filter(q => !history.has(fingerprint(q)))

  // Shuffle deterministically
  const masterShuffled = seededShuffle(masterAvail, seed)
  const tenantShuffled = seededShuffle(tenantAvail, seed + 1)

  // Ideal targets
  let masterTarget = Math.floor(n * ratio)
  let tenantTarget = n - masterTarget

  // Take what we can
  let masterPick = masterShuffled.slice(0, masterTarget)
  let tenantPick = tenantShuffled.slice(0, tenantTarget)

  // Compensate shortfalls cross-pool
  const masterShortfall = masterTarget - masterPick.length
  const tenantShortfall = tenantTarget - tenantPick.length

  if (masterShortfall > 0) {
    // Master ran short — draw extra from tenant
    const extra = tenantShuffled.slice(tenantPick.length, tenantPick.length + masterShortfall)
    tenantPick = [...tenantPick, ...extra]
  }
  if (tenantShortfall > 0) {
    // Tenant ran short — draw extra from master
    const extra = masterShuffled.slice(masterPick.length, masterPick.length + tenantShortfall)
    masterPick = [...masterPick, ...extra]
  }

  const selected = [...masterPick, ...tenantPick]
  const shortfall = Math.max(0, n - selected.length)

  return { selected, shortfall }
}

// =============================================================================
// SIMULATION ENGINE
// Runs TOTAL_RETAKES sessions, tracking history in-memory.
// Resets history automatically when the combined pool is exhausted.
// =============================================================================

function simulate (
  masterPool:  PoolQuestion[],
  tenantPool:  PoolQuestion[],
  seedHistory: Set<string>,
  n:           number,
  ratio:       number,
  retakes:     number
): SessionResult[] {
  const history  = new Set<string>(seedHistory)
  const sessions: SessionResult[] = []
  let cycle = 1

  for (let i = 1; i <= retakes; i++) {
    const masterAvailCount = masterPool.filter(q => !history.has(fingerprint(q))).length
    const tenantAvailCount = tenantPool.filter(q => !history.has(fingerprint(q))).length
    const totalAvail       = masterAvailCount + tenantAvailCount

    // Auto-reset when pool is exhausted or would be unable to fill even one session
    let historyReset = false
    if (totalAvail < Math.min(n, 1)) {
      log(`\n  ⟳  Pool exhausted before session ${i} — resetting history (cycle ${cycle} → ${cycle + 1})`)
      history.clear()
      cycle++
      historyReset = true
    }

    const poolBefore = {
      master: masterPool.filter(q => !history.has(fingerprint(q))).length,
      tenant: tenantPool.filter(q => !history.has(fingerprint(q))).length,
      total:  masterPool.filter(q => !history.has(fingerprint(q))).length +
              tenantPool.filter(q => !history.has(fingerprint(q))).length,
    }

    const { selected, shortfall } = selectQuestions(masterPool, tenantPool, history, n, ratio, i * 31337)

    // Mark selected questions as seen
    for (const q of selected) history.add(fingerprint(q))

    const poolAfter = {
      master: masterPool.filter(q => !history.has(fingerprint(q))).length,
      tenant: tenantPool.filter(q => !history.has(fingerprint(q))).length,
      total:  masterPool.filter(q => !history.has(fingerprint(q))).length +
              tenantPool.filter(q => !history.has(fingerprint(q))).length,
    }

    sessions.push({
      sessionNumber:  i,
      cycleNumber:    cycle,
      historyReset,
      questions:      selected,
      masterCount:    selected.filter(q => q.source === 'master').length,
      tenantCount:    selected.filter(q => q.source === 'tenant').length,
      poolSizeBefore: poolBefore,
      poolSizeAfter:  poolAfter,
      shortfall,
    })
  }

  return sessions
}

// =============================================================================
// VALIDATION CHECKS
// =============================================================================

function validate (
  sessions:    SessionResult[],
  masterPool:  PoolQuestion[],
  tenantPool:  PoolQuestion[],
  tenantId:    string,
  findings:    ValidationFinding[]
): void {
  const pass = (check: string, msg: string) =>
    findings.push({ severity: 'PASS', check, message: msg })
  const warn = (check: string, msg: string, detail?: string) =>
    findings.push({ severity: 'WARN', check, message: msg, detail })
  const fail = (check: string, msg: string, detail?: string) =>
    findings.push({ severity: 'FAIL', check, message: msg, detail })

  // ── Check A: Zero overlaps within each session ─────────────────────────────
  log('\n── Check A: Zero overlaps within sessions')
  let withinFails = 0
  for (const session of sessions) {
    const ids = session.questions.map(fingerprint)
    const unique = new Set(ids)
    if (unique.size !== ids.length) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
      fail('within_session_overlap',
        `Session ${session.sessionNumber}: ${ids.length - unique.size} duplicate question(s)`,
        `Duplicate fingerprints: ${dupes.join(', ')}`)
      log(`  ✗ Session ${session.sessionNumber}: OVERLAP DETECTED (${ids.length - unique.size} dupes)`)
      withinFails++
    } else {
      log(`  ✓ Session ${session.sessionNumber}: ${ids.length} questions, zero overlaps`)
    }
  }
  if (withinFails === 0) {
    pass('within_session_overlap', `All ${sessions.length} sessions have zero within-session overlaps`)
  }

  // ── Check B: Zero overlaps across sessions within the same cycle ───────────
  log('\n── Check B: Zero overlaps across sessions (within cycle)')

  // Group sessions by cycle
  const byCycle = new Map<number, SessionResult[]>()
  for (const s of sessions) {
    const arr = byCycle.get(s.cycleNumber) ?? []
    arr.push(s)
    byCycle.set(s.cycleNumber, arr)
  }

  let crossFails = 0
  for (const [cycle, cycleSessions] of byCycle) {
    const seenInCycle = new Map<string, number>()
    for (const session of cycleSessions) {
      for (const q of session.questions) {
        const fp = fingerprint(q)
        if (seenInCycle.has(fp)) {
          fail('cross_session_overlap',
            `Cycle ${cycle}: question served in both session ${seenInCycle.get(fp)} and ${session.sessionNumber}`,
            `Question ID: ${q.id} (source: ${q.source}) — "${q.question_text.slice(0, 60)}…"`)
          log(`  ✗ Cycle ${cycle} cross-session overlap: ${q.source}::${q.id}`)
          crossFails++
        } else {
          seenInCycle.set(fp, session.sessionNumber)
        }
      }
    }
    if (crossFails === 0) {
      const totalServed = cycleSessions.reduce((n, s) => n + s.questions.length, 0)
      log(`  ✓ Cycle ${cycle} (${cycleSessions.length} sessions, ${totalServed} questions): zero cross-session overlaps`)
    }
  }
  if (crossFails === 0) {
    pass('cross_session_overlap',
      `Zero cross-session overlaps across ${byCycle.size} cycle(s)`)
  }

  // ── Check C: History resets are logical ────────────────────────────────────
  log('\n── Check C: History reset logic')
  const resetSessions = sessions.filter(s => s.historyReset)
  if (resetSessions.length === 0) {
    log(`  · No history resets occurred (pool was sufficient for all ${sessions.length} retakes)`)
    pass('history_reset', `Pool sufficient for ${sessions.length} sessions — no resets needed`)
  } else {
    log(`  ✓ ${resetSessions.length} history reset(s) triggered at pool exhaustion`)
    // Verify that each reset produced a fresh full pool
    let resetFails = 0
    for (const s of resetSessions) {
      if (s.poolSizeBefore.total < Math.min(QUESTIONS_PER, masterPool.length + tenantPool.length)) {
        fail('history_reset',
          `Session ${s.sessionNumber}: pool after reset (${s.poolSizeBefore.total}) smaller than expected`,
          `Master: ${s.poolSizeBefore.master}, Tenant: ${s.poolSizeBefore.tenant}`)
        resetFails++
      } else {
        log(`  ✓ Session ${s.sessionNumber} reset: pool restored to ${s.poolSizeBefore.total} questions`)
      }
    }
    if (resetFails === 0) {
      pass('history_reset', `All ${resetSessions.length} history reset(s) correctly restored the pool`)
    }
  }

  // ── Check D: Tenant isolation — no tenant questions from wrong tenant ───────
  log('\n── Check D: Tenant isolation')
  let isolationFails = 0
  for (const session of sessions) {
    for (const q of session.questions) {
      if (q.source === 'tenant' && q.tenant_id !== tenantId) {
        fail('tenant_isolation',
          `Session ${session.sessionNumber}: question from WRONG tenant in session`,
          `Expected tenant: ${tenantId}, got: ${q.tenant_id} (question: ${q.id})`)
        log(`  ✗ Session ${session.sessionNumber}: cross-tenant question detected! tenant=${q.tenant_id}`)
        isolationFails++
      }
    }
  }
  if (isolationFails === 0) {
    const tenantQuestions = sessions.flatMap(s => s.questions.filter(q => q.source === 'tenant'))
    log(`  ✓ All ${tenantQuestions.length} tenant questions served belong to tenant ${tenantId}`)
    pass('tenant_isolation', `Zero cross-tenant question leakage across all ${sessions.length} sessions`)
  }

  // ── Check E: Master questions have no tenant_id ─────────────────────────────
  log('\n── Check E: Master question purity')
  const dirtiedMaster = masterPool.filter(q => q.tenant_id !== null)
  if (dirtiedMaster.length > 0) {
    fail('master_purity',
      `${dirtiedMaster.length} master_questions row(s) have a non-null tenant_id`,
      `IDs: ${dirtiedMaster.map(q => q.id).slice(0, 5).join(', ')}`)
    log(`  ✗ ${dirtiedMaster.length} master questions have tenant_id set (should always be null)`)
  } else {
    pass('master_purity', `All ${masterPool.length} master questions have tenant_id = null`)
    log(`  ✓ All master questions have tenant_id = null`)
  }

  // ── Check F: Pool ratio adherence ──────────────────────────────────────────
  log('\n── Check F: Master/tenant ratio adherence')
  let ratioFails = 0
  for (const session of sessions) {
    if (session.questions.length === 0) continue
    const actualRatio = session.masterCount / session.questions.length
    const tolerance   = 0.25   // allow ±25% deviation (pools may not be balanced)
    const low  = Math.max(0, MASTER_RATIO - tolerance)
    const high = Math.min(1, MASTER_RATIO + tolerance)

    if (session.poolSizeBefore.master === 0 || session.poolSizeBefore.tenant === 0) {
      // One pool empty — ratio deviation is expected and acceptable
      log(`  · Session ${session.sessionNumber}: one pool empty, ratio ${actualRatio.toFixed(2)} (expected deviation)`)
    } else if (actualRatio < low || actualRatio > high) {
      warn('ratio_adherence',
        `Session ${session.sessionNumber}: master ratio ${actualRatio.toFixed(2)} outside tolerance (target: ${MASTER_RATIO} ±${tolerance})`,
        `Master: ${session.masterCount}, Tenant: ${session.tenantCount}`)
      log(`  ⚠ Session ${session.sessionNumber}: ratio ${actualRatio.toFixed(2)} (outside ±${tolerance} tolerance)`)
      ratioFails++
    } else {
      log(`  ✓ Session ${session.sessionNumber}: ratio ${actualRatio.toFixed(2)} (target ${MASTER_RATIO})`)
    }
  }
  if (ratioFails === 0) {
    pass('ratio_adherence', `All sessions within ±25% of target ratio ${MASTER_RATIO}`)
  }

  // ── Check G: No shortfalls when pool should be sufficient ──────────────────
  log('\n── Check G: Pool sufficiency')
  const shortfallSessions = sessions.filter(s => s.shortfall > 0)
  if (shortfallSessions.length > 0) {
    for (const s of shortfallSessions) {
      if (s.poolSizeBefore.total >= QUESTIONS_PER) {
        fail('pool_sufficiency',
          `Session ${s.sessionNumber}: shortfall of ${s.shortfall} despite pool having ${s.poolSizeBefore.total} questions`,
          `This indicates a bug in the selection algorithm`)
      } else {
        warn('pool_sufficiency',
          `Session ${s.sessionNumber}: shortfall of ${s.shortfall} — pool (${s.poolSizeBefore.total}) smaller than requested (${QUESTIONS_PER})`,
          `Add more questions or lower the per-session count`)
        log(`  ⚠ Session ${s.sessionNumber}: shortfall ${s.shortfall} (pool too small: ${s.poolSizeBefore.total} available)`)
      }
    }
  } else {
    pass('pool_sufficiency', `No shortfalls across all ${sessions.length} sessions`)
    log(`  ✓ All sessions fully served (no shortfalls)`)
  }
}

// =============================================================================
// REPORT PRINTER
// =============================================================================

function printReport (report: DedupeReport): void {
  const D = '═'.repeat(64)
  const d = '─'.repeat(64)

  log(`\n${D}`)
  log('  DEDUPLICATION TEST REPORT')
  log(D)
  log(`  Tenant         : ${report.tenantName} (${report.tenantId})`)
  log(`  Policy         : ${report.policyCode}`)
  log(`  Sessions       : ${report.totalRetakes}`)
  log(`  Questions/session : ${report.questionsPerSession}`)
  log(`  Master ratio   : ${report.masterRatio} (${Math.round(report.masterRatio * 100)}% master)`)
  log(d)
  log(`  Master pool    : ${report.masterPoolSize} questions`)
  log(`  Tenant pool    : ${report.tenantPoolSize} questions`)
  log(`  Combined pool  : ${report.combinedPoolSize} questions`)
  log(`  Pool covers    : ${Math.floor(report.combinedPoolSize / report.questionsPerSession)} full session(s) before reset`)
  log(d)

  log('\n  SESSION BREAKDOWN')
  log(d)
  log('  #   │ Cyc │ Reset │ Served │ Master │ Tenant │ Shortfall │ Pool left')
  log(`  ${'─'.repeat(58)}`)
  for (const s of report.sessions) {
    const reset   = s.historyReset ? ' ✓' : '  '
    const short   = s.shortfall > 0 ? `   ⚠ ${s.shortfall}` : '       —'
    log(
      `  ${String(s.sessionNumber).padStart(2)} │  ${s.cycleNumber}  │  ${reset} │` +
      `    ${String(s.questions.length).padStart(2)}  │    ${String(s.masterCount).padStart(2)}  │    ${String(s.tenantCount).padStart(2)}  │ ${short.padStart(9)} │ ${s.poolSizeAfter.total}`
    )
  }

  log(`\n${d}`)
  log('  VALIDATION RESULTS')
  log(d)

  let passCount = 0
  for (const f of report.findings) {
    const icon = f.severity === 'PASS' ? '✓' : f.severity === 'WARN' ? '⚠' : '✗'
    if (f.severity === 'PASS') { passCount++; continue }
    log(`  ${icon} [${f.severity}] ${f.check}: ${f.message}`)
    if (f.detail) log(`    ${f.detail}`)
  }
  log(`  ✓ ${passCount} check(s) passed`)

  log(`\n${D}`)
  log(`  RESULT : ${report.passed ? '✓  ALL CHECKS PASSED' : '✗  FAILURES DETECTED'}`)
  log(`  Duration: ${report.durationMs}ms`)
  log(D + '\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main (): Promise<void> {
  const startMs   = Date.now()
  const findings: ValidationFinding[] = []

  // ── Validate required args ─────────────────────────────────────────────────
  if (!CLI_TENANT_ID) {
    logErr('ERROR: --tenant-id <uuid> is required')
    logErr('Usage: npx tsx scripts/test-dedup.ts --tenant-id <uuid> --policy <code>')
    process.exit(1)
  }
  if (!CLI_POLICY) {
    logErr('ERROR: --policy <code> is required  (e.g. --policy AML)')
    process.exit(1)
  }
  if (MASTER_RATIO < 0 || MASTER_RATIO > 1) {
    logErr('ERROR: --master-ratio must be between 0 and 1')
    process.exit(1)
  }

  log('test-dedup starting')
  log(`Tenant   : ${CLI_TENANT_ID}`)
  log(`Policy   : ${CLI_POLICY}`)
  log(`Sessions : ${TOTAL_RETAKES}`)
  log(`Q/session: ${QUESTIONS_PER}`)
  log(`Ratio    : ${MASTER_RATIO} master / ${1 - MASTER_RATIO} tenant`)

  // ── Env + Supabase ─────────────────────────────────────────────────────────
  loadEnv()
  const url    = process.env.PUBLIC_SUPABASE_URL
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svcKey) {
    logErr('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // ── Load reference data ────────────────────────────────────────────────────
  log('\nLoading data from Supabase...')
  const tenant = await loadTenant(supabase, CLI_TENANT_ID)
  const policy = await loadPolicy(supabase, CLI_POLICY)
  log(`  Tenant : ${tenant.name}`)
  log(`  Policy : ${policy.title}`)

  const [masterPool, tenantPool] = await Promise.all([
    loadMasterPool(supabase, policy.id, policy.code),
    loadTenantPool(supabase, CLI_TENANT_ID, policy.id, policy.code),
  ])

  log(`  Master pool  : ${masterPool.length} questions`)
  log(`  Tenant pool  : ${tenantPool.length} questions`)
  log(`  Combined     : ${masterPool.length + tenantPool.length} questions`)

  // ── Seed history from real user (optional) ─────────────────────────────────
  let seedHistory = new Set<string>()
  if (CLI_USER_ID) {
    log(`\nLoading real history for user ${CLI_USER_ID}...`)
    seedHistory = await loadRealHistory(supabase, CLI_TENANT_ID, CLI_USER_ID, policy.id)
  }

  // ── Warn if combined pool is very small ────────────────────────────────────
  const combined = masterPool.length + tenantPool.length
  if (combined === 0) {
    logErr('\nERROR: No questions found for this policy + tenant combination.')
    logErr('Run import-master-questions.ts and import-tenant-questions.ts first.')
    process.exit(1)
  }
  if (combined < QUESTIONS_PER) {
    log(`\n⚠  Combined pool (${combined}) is smaller than one session (${QUESTIONS_PER}).`)
    log(`   Sessions will have shortfalls. Add more questions or lower --questions.`)
  }

  // ── Simulate ───────────────────────────────────────────────────────────────
  log(`\nSimulating ${TOTAL_RETAKES} session(s)...`)
  const sessions = simulate(masterPool, tenantPool, seedHistory, QUESTIONS_PER, MASTER_RATIO, TOTAL_RETAKES)

  // ── Validate ───────────────────────────────────────────────────────────────
  log('\nRunning validation checks...')
  validate(sessions, masterPool, tenantPool, CLI_TENANT_ID, findings)

  // ── Build + print report ───────────────────────────────────────────────────
  const passed = findings.every(f => f.severity !== 'FAIL')

  const report: DedupeReport = {
    tenantId:           CLI_TENANT_ID,
    tenantName:         tenant.name,
    policyCode:         policy.code,
    questionsPerSession: QUESTIONS_PER,
    masterRatio:        MASTER_RATIO,
    totalRetakes:       TOTAL_RETAKES,
    masterPoolSize:     masterPool.length,
    tenantPoolSize:     tenantPool.length,
    combinedPoolSize:   combined,
    sessions,
    findings,
    passed,
    durationMs:         Date.now() - startMs,
  }

  printReport(report)
  flushLog()

  process.exit(passed ? 0 : 1)
}

main().catch(err => {
  logErr(`Unhandled error: ${(err as Error).message}`)
  flushLog()
  process.exit(1)
})
