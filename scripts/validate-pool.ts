#!/usr/bin/env npx tsx
/**
 * scripts/validate-pool.ts
 *
 * Validates the integrity and completeness of the entire question pool.
 * Runs against the live Supabase database using the service role key.
 *
 * Checks performed:
 *   1. Master question counts per policy and sub_heading
 *   2. Tenant question counts per tenant per policy and sub_heading
 *   3. Sub_heading coverage gaps (sub_headings with zero questions)
 *   4. Weak pools (below minimum question thresholds)
 *   5. Missing dual-track coverage (COC / COI / PIT must have both banks)
 *   6. Tenant isolation sanity (no orphaned rows, no cross-tenant leakage)
 *
 * Usage:
 *   npm run validate:pool
 *   npx tsx scripts/validate-pool.ts
 *   npx tsx scripts/validate-pool.ts --tenant-id <uuid>
 *   npx tsx scripts/validate-pool.ts --policy AML
 *   npx tsx scripts/validate-pool.ts --threshold 10
 *   npx tsx scripts/validate-pool.ts --json          (machine-readable output)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more CRITICAL or ERROR findings
 *   2 — warnings only
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// =============================================================================
// CONFIG & CLI FLAGS
// =============================================================================

const LOGS_DIR  = path.resolve(process.cwd(), 'logs')
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const LOG_FILE  = path.join(LOGS_DIR, `validate-pool-${TIMESTAMP}.log`)

const CLI_TENANT_ID = (() => {
  const i = process.argv.indexOf('--tenant-id')
  return i !== -1 ? process.argv[i + 1]?.trim() ?? null : null
})()

const CLI_POLICY = (() => {
  const i = process.argv.indexOf('--policy')
  return i !== -1 ? process.argv[i + 1]?.trim().toUpperCase() ?? null : null
})()

const THRESHOLD = (() => {
  const i = process.argv.indexOf('--threshold')
  const v = i !== -1 ? parseInt(process.argv[i + 1] ?? '', 10) : NaN
  return isNaN(v) ? 5 : v
})()

const JSON_OUTPUT = process.argv.includes('--json')

/** Minimum questions per sub_heading to be considered healthy */
const MIN_PER_SUBHEADING = THRESHOLD

/** Minimum questions per policy to serve a full 20-question quiz without repetition */
const MIN_PER_POLICY_WARN     = 20
const MIN_PER_POLICY_CRITICAL  = 10

// =============================================================================
// SEVERITY LEVELS
// =============================================================================

type Severity = 'PASS' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

const SEVERITY_ORDER: Record<Severity, number> = {
  PASS: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4
}

const SEVERITY_ICON: Record<Severity, string> = {
  PASS:     '✓',
  INFO:     '·',
  WARN:     '⚠',
  ERROR:    '✗',
  CRITICAL: '🔴',
}

// =============================================================================
// TYPES
// =============================================================================

interface Finding {
  severity:  Severity
  check:     string
  entity:    string
  message:   string
  detail?:   string
}

interface PolicyRow {
  id:           string
  code:         string
  title:        string
  is_dual_track: boolean
  is_active:    boolean
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
  slug:   string
  status: string
}

interface QuestionCountRow {
  policy_id:      string
  sub_heading_id: string | null
  count:          number
}

interface TenantQuestionCountRow {
  tenant_id:      string
  policy_id:      string
  sub_heading_id: string | null
  count:          number
}

interface ValidationReport {
  runAt:            string
  threshold:        number
  filters:          { tenantId: string | null; policy: string | null }
  findings:         Finding[]
  summary:          { pass: number; info: number; warn: number; error: number; critical: number }
  maxSeverity:      Severity
  durationMs:       number
}

// =============================================================================
// LOGGER
// =============================================================================

const logLines: string[] = []

function log (msg: string): void {
  if (!JSON_OUTPUT) console.log(msg)
  logLines.push(msg)
}

function flushLog (): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf-8')
  if (!JSON_OUTPUT) console.log(`\nLog saved: ${LOG_FILE}`)
}

// =============================================================================
// ENV LOADER
// =============================================================================

function loadEnv (): void {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.resolve(process.cwd(), name)
    if (!fs.existsSync(envPath)) continue
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      // .env.local always wins — do NOT guard with !process.env[k].
      // The guard silently swallows the service-role key when Vite or npm
      // has already injected PUBLIC_SUPABASE_ANON_KEY into process.env.
      if (k && v) process.env[k] = v
    }
    break
  }
}

// =============================================================================
// FINDINGS HELPERS
// =============================================================================

function finding (
  findings: Finding[],
  severity: Severity,
  check:    string,
  entity:   string,
  message:  string,
  detail?:  string
): void {
  findings.push({ severity, check, entity, message, detail })
}

function maxSeverity (findings: Finding[]): Severity {
  return findings.reduce<Severity>((max, f) => {
    return SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[max] ? f.severity : max
  }, 'PASS')
}

// =============================================================================
// SUPABASE DATA LOADERS
// =============================================================================

async function loadPolicies (
  supabase: SupabaseClient,
  code?:    string | null
): Promise<PolicyRow[]> {
  let q = supabase
    .from('policies')
    .select('id, code, title, is_dual_track, is_active')
    .eq('is_active', true)
    .order('code')

  if (code) q = q.eq('code', code)

  const { data, error } = await q
  if (error) throw new Error(`loadPolicies: ${error.message}`)
  return (data ?? []) as PolicyRow[]
}

async function loadSubHeadings (
  supabase:  SupabaseClient,
  policyIds: string[]
): Promise<SubHeadingRow[]> {
  if (!policyIds.length) return []
  const { data, error } = await supabase
    .from('sub_headings')
    .select('id, code, title, policy_id')
    .in('policy_id', policyIds)
    .eq('is_active', true)
    .order('code')
  if (error) throw new Error(`loadSubHeadings: ${error.message}`)
  return (data ?? []) as SubHeadingRow[]
}

async function loadTenants (
  supabase:  SupabaseClient,
  tenantId?: string | null
): Promise<TenantRow[]> {
  let q = supabase
    .from('tenants')
    .select('id, name, slug, status')
    .order('name')

  if (tenantId) q = q.eq('id', tenantId)

  const { data, error } = await q
  if (error) throw new Error(`loadTenants: ${error.message}`)
  return (data ?? []) as TenantRow[]
}

/** Aggregate master question counts per (policy_id, sub_heading_id) */
async function loadMasterCounts (
  supabase:  SupabaseClient,
  policyIds: string[]
): Promise<QuestionCountRow[]> {
  if (!policyIds.length) return []

  // Supabase JS doesn't support GROUP BY directly — use an RPC or manual approach
  // We fetch all active master questions for the relevant policies and aggregate in-memory
  const { data, error } = await supabase
    .from('master_questions')
    .select('policy_id, sub_heading_id')
    .in('policy_id', policyIds)
    .eq('is_active', true)

  if (error) throw new Error(`loadMasterCounts: ${error.message}`)
  if (!data?.length) return []

  // Aggregate in-memory
  const map = new Map<string, QuestionCountRow>()
  for (const row of data) {
    const key = `${row.policy_id}::${row.sub_heading_id ?? 'null'}`
    const existing = map.get(key)
    if (existing) {
      existing.count++
    } else {
      map.set(key, {
        policy_id:      row.policy_id,
        sub_heading_id: row.sub_heading_id ?? null,
        count:          1,
      })
    }
  }
  return Array.from(map.values())
}

/** Aggregate tenant question counts per (tenant_id, policy_id, sub_heading_id) */
async function loadTenantCounts (
  supabase:   SupabaseClient,
  policyIds:  string[],
  tenantIds:  string[]
): Promise<TenantQuestionCountRow[]> {
  if (!policyIds.length || !tenantIds.length) return []

  const { data, error } = await supabase
    .from('tenant_questions')
    .select('tenant_id, policy_id, sub_heading_id')
    .in('policy_id', policyIds)
    .in('tenant_id', tenantIds)
    .eq('is_active', true)

  if (error) throw new Error(`loadTenantCounts: ${error.message}`)
  if (!data?.length) return []

  const map = new Map<string, TenantQuestionCountRow>()
  for (const row of data) {
    const key = `${row.tenant_id}::${row.policy_id}::${row.sub_heading_id ?? 'null'}`
    const existing = map.get(key)
    if (existing) {
      existing.count++
    } else {
      map.set(key, {
        tenant_id:      row.tenant_id,
        policy_id:      row.policy_id,
        sub_heading_id: row.sub_heading_id ?? null,
        count:          1,
      })
    }
  }
  return Array.from(map.values())
}

// =============================================================================
// CHECK 1 — MASTER QUESTION COUNTS
// =============================================================================

function checkMasterCounts (
  findings:    Finding[],
  policies:    PolicyRow[],
  subHeadings: SubHeadingRow[],
  counts:      QuestionCountRow[]
): void {
  log('\n── Check 1: Master Question Counts')

  const policyMap = new Map(policies.map(p => [p.id, p]))
  const shByPolicy = new Map<string, SubHeadingRow[]>()
  for (const sh of subHeadings) {
    const arr = shByPolicy.get(sh.policy_id) ?? []
    arr.push(sh)
    shByPolicy.set(sh.policy_id, arr)
  }

  // Roll up total per policy
  const masterByPolicy = new Map<string, number>()
  const masterBySubH   = new Map<string, number>()  // key: sub_heading_id

  for (const c of counts) {
    masterByPolicy.set(c.policy_id, (masterByPolicy.get(c.policy_id) ?? 0) + c.count)
    if (c.sub_heading_id) {
      masterBySubH.set(c.sub_heading_id, (masterBySubH.get(c.sub_heading_id) ?? 0) + c.count)
    }
  }

  for (const policy of policies) {
    const total     = masterByPolicy.get(policy.id) ?? 0
    const policyRef = `${policy.code} (master)`

    if (total === 0) {
      finding(findings, 'CRITICAL', 'master_counts', policyRef,
        `No active master questions found`,
        `Policy "${policy.title}" has 0 questions in master_questions`)
    } else if (total < MIN_PER_POLICY_CRITICAL) {
      finding(findings, 'ERROR', 'master_counts', policyRef,
        `Only ${total} questions — below critical threshold (${MIN_PER_POLICY_CRITICAL})`,
        `Minimum ${MIN_PER_POLICY_CRITICAL} needed; have ${total}`)
    } else if (total < MIN_PER_POLICY_WARN) {
      finding(findings, 'WARN', 'master_counts', policyRef,
        `${total} questions — below recommended minimum (${MIN_PER_POLICY_WARN})`,
        `Recommend ≥${MIN_PER_POLICY_WARN} to avoid question repetition`)
    } else {
      finding(findings, 'PASS', 'master_counts', policyRef,
        `${total} questions — healthy`)
    }

    log(`  ${SEVERITY_ICON[findings.at(-1)!.severity]} ${policy.code} (master): ${total} total questions`)
  }
}

// =============================================================================
// CHECK 2 — SUB_HEADING COVERAGE GAPS
// =============================================================================

function checkSubHeadingCoverage (
  findings:    Finding[],
  policies:    PolicyRow[],
  subHeadings: SubHeadingRow[],
  masterCounts: QuestionCountRow[],
  tenantCounts: TenantQuestionCountRow[],
  tenants:     TenantRow[]
): void {
  log('\n── Check 2: Sub_heading Coverage Gaps')

  const policyMap = new Map(policies.map(p => [p.id, p]))

  // Master coverage
  const masterBySubH = new Map<string, number>()
  for (const c of masterCounts) {
    if (c.sub_heading_id) {
      masterBySubH.set(c.sub_heading_id, (masterBySubH.get(c.sub_heading_id) ?? 0) + c.count)
    }
  }

  let gapCount = 0
  let weakCount = 0

  for (const sh of subHeadings) {
    const policy = policyMap.get(sh.policy_id)
    const total  = masterBySubH.get(sh.id) ?? 0
    const ref    = `${policy?.code ?? '?'} › ${sh.code}`

    if (total === 0) {
      finding(findings, 'ERROR', 'subheading_coverage', ref,
        `Sub_heading has NO master questions`,
        `"${sh.title}" (${sh.code}) — add questions to master_questions`)
      log(`  ${SEVERITY_ICON['ERROR']} ${ref}: 0 questions (GAP)`)
      gapCount++
    } else if (total < MIN_PER_SUBHEADING) {
      finding(findings, 'WARN', 'subheading_coverage', ref,
        `Weak: only ${total} master questions (threshold: ${MIN_PER_SUBHEADING})`,
        `"${sh.title}" — recommend ≥${MIN_PER_SUBHEADING} for variety`)
      log(`  ${SEVERITY_ICON['WARN']} ${ref}: ${total} questions (weak)`)
      weakCount++
    } else {
      log(`  ${SEVERITY_ICON['PASS']} ${ref}: ${total} questions`)
    }
  }

  if (gapCount === 0 && weakCount === 0) {
    finding(findings, 'PASS', 'subheading_coverage', 'all sub_headings',
      `All ${subHeadings.length} sub_headings have ≥${MIN_PER_SUBHEADING} master questions`)
  } else {
    finding(findings, 'INFO', 'subheading_coverage', 'summary',
      `${gapCount} gap(s), ${weakCount} weak sub_heading(s) found`)
  }
}

// =============================================================================
// CHECK 3 — TENANT QUESTION COUNTS
// =============================================================================

function checkTenantCounts (
  findings:    Finding[],
  tenants:     TenantRow[],
  policies:    PolicyRow[],
  subHeadings: SubHeadingRow[],
  counts:      TenantQuestionCountRow[]
): void {
  log('\n── Check 3: Tenant Question Counts')

  const policyMap = new Map(policies.map(p => [p.id, p]))

  // Roll up per (tenant, policy)
  const byTenantPolicy = new Map<string, number>()
  for (const c of counts) {
    const key = `${c.tenant_id}::${c.policy_id}`
    byTenantPolicy.set(key, (byTenantPolicy.get(key) ?? 0) + c.count)
  }

  for (const tenant of tenants) {
    log(`\n  Tenant: ${tenant.name} (${tenant.id})`)

    if (tenant.status !== 'active') {
      finding(findings, 'INFO', 'tenant_counts', tenant.name,
        `Tenant status is "${tenant.status}" — skipping count checks`)
      log(`    · Skipped (status: ${tenant.status})`)
      continue
    }

    let tenantHasAnyQuestions = false

    for (const policy of policies) {
      const key   = `${tenant.id}::${policy.id}`
      const total = byTenantPolicy.get(key) ?? 0
      const ref   = `${tenant.name} › ${policy.code}`

      if (total > 0) tenantHasAnyQuestions = true

      if (total === 0) {
        finding(findings, 'WARN', 'tenant_counts', ref,
          `No tenant-specific questions for policy ${policy.code}`,
          `Tenant will rely entirely on master pool for ${policy.title}`)
        log(`    ${SEVERITY_ICON['WARN']} ${policy.code}: 0 tenant questions (master-only)`)
      } else if (total < MIN_PER_POLICY_CRITICAL) {
        finding(findings, 'WARN', 'tenant_counts', ref,
          `Only ${total} tenant questions for ${policy.code}`,
          `Consider adding more for better quiz variety`)
        log(`    ${SEVERITY_ICON['WARN']} ${policy.code}: ${total} (low)`)
      } else {
        finding(findings, 'PASS', 'tenant_counts', ref,
          `${total} tenant questions`)
        log(`    ${SEVERITY_ICON['PASS']} ${policy.code}: ${total}`)
      }
    }

    if (!tenantHasAnyQuestions) {
      finding(findings, 'ERROR', 'tenant_counts', tenant.name,
        `Tenant has ZERO questions across all policies`,
        `Run import-tenant-questions.ts to populate this tenant's bank`)
    }
  }
}

// =============================================================================
// CHECK 4 — WEAK POOLS
// Sub_headings with questions in tenant banks that fall below threshold
// =============================================================================

function checkWeakPools (
  findings:    Finding[],
  tenants:     TenantRow[],
  subHeadings: SubHeadingRow[],
  policies:    PolicyRow[],
  counts:      TenantQuestionCountRow[]
): void {
  log('\n── Check 4: Weak Tenant Pools (per sub_heading)')

  const policyMap = new Map(policies.map(p => [p.id, p]))
  const shMap     = new Map(subHeadings.map(s => [s.id, s]))
  const tenantMap = new Map(tenants.map(t => [t.id, t]))

  // Only check sub_headings that HAVE at least one tenant question
  const byTenantSubH = new Map<string, number>()
  for (const c of counts) {
    if (!c.sub_heading_id) continue
    const key = `${c.tenant_id}::${c.sub_heading_id}`
    byTenantSubH.set(key, (byTenantSubH.get(key) ?? 0) + c.count)
  }

  let weakFound = false
  for (const [key, total] of byTenantSubH) {
    if (total >= MIN_PER_SUBHEADING) continue
    const [tenantId, shId] = key.split('::')
    const tenant  = tenantMap.get(tenantId)
    const sh      = shMap.get(shId)
    const policy  = sh ? policyMap.get(sh.policy_id) : undefined
    const ref     = `${tenant?.name ?? tenantId} › ${policy?.code ?? '?'} › ${sh?.code ?? shId}`

    finding(findings, 'WARN', 'weak_pools', ref,
      `Only ${total} tenant questions for sub_heading (threshold: ${MIN_PER_SUBHEADING})`,
      `Sub_heading "${sh?.title ?? shId}" — add more tenant questions for variety`)
    log(`  ${SEVERITY_ICON['WARN']} ${ref}: ${total} questions`)
    weakFound = true
  }

  if (!weakFound) {
    finding(findings, 'PASS', 'weak_pools', 'all tenant sub_headings',
      `All populated tenant sub_headings meet the ≥${MIN_PER_SUBHEADING} threshold`)
    log(`  ${SEVERITY_ICON['PASS']} All tenant sub_headings meet threshold`)
  }
}

// =============================================================================
// CHECK 5 — DUAL-TRACK COVERAGE
// COC, COI, PIT must have questions in BOTH master + tenant banks per tenant
// =============================================================================

function checkDualTrackCoverage (
  findings:    Finding[],
  tenants:     TenantRow[],
  policies:    PolicyRow[],
  masterCounts: QuestionCountRow[],
  tenantCounts: TenantQuestionCountRow[]
): void {
  log('\n── Check 5: Dual-Track Policy Coverage')

  const dualTrack = policies.filter(p => p.is_dual_track)

  if (!dualTrack.length) {
    finding(findings, 'INFO', 'dual_track', 'policies',
      'No dual-track policies found — skipping (run seed/policies.sql first)')
    log(`  · No dual-track policies found`)
    return
  }

  log(`  Dual-track policies: ${dualTrack.map(p => p.code).join(', ')}`)

  // Master counts per dual-track policy
  const masterByPolicy = new Map<string, number>()
  for (const c of masterCounts) {
    masterByPolicy.set(c.policy_id, (masterByPolicy.get(c.policy_id) ?? 0) + c.count)
  }

  // Tenant counts per (tenant_id, policy_id)
  const tenantByKey = new Map<string, number>()
  for (const c of tenantCounts) {
    const key = `${c.tenant_id}::${c.policy_id}`
    tenantByKey.set(key, (tenantByKey.get(key) ?? 0) + c.count)
  }

  for (const policy of dualTrack) {
    const masterTotal = masterByPolicy.get(policy.id) ?? 0

    // 1. Master bank must have questions for this dual-track policy
    if (masterTotal === 0) {
      finding(findings, 'CRITICAL', 'dual_track', `${policy.code} (master)`,
        `Dual-track policy has NO master questions`,
        `"${policy.title}" must have questions in master_questions`)
      log(`  ${SEVERITY_ICON['CRITICAL']} ${policy.code}: no master questions`)
    } else {
      finding(findings, 'PASS', 'dual_track', `${policy.code} (master)`,
        `${masterTotal} master questions present`)
      log(`  ${SEVERITY_ICON['PASS']} ${policy.code} master: ${masterTotal} questions`)
    }

    // 2. Each active tenant must also have questions in their tenant bank
    for (const tenant of tenants.filter(t => t.status === 'active')) {
      const tenantTotal = tenantByKey.get(`${tenant.id}::${policy.id}`) ?? 0
      const ref         = `${policy.code} › ${tenant.name}`

      if (tenantTotal === 0) {
        finding(findings, 'ERROR', 'dual_track', ref,
          `Dual-track policy "${policy.code}" missing from tenant question bank`,
          `Tenant "${tenant.name}" has no tenant-specific questions for ${policy.title}. ` +
          `Dual-track requires questions in BOTH banks.`)
        log(`  ${SEVERITY_ICON['ERROR']} ${ref}: 0 tenant questions (dual-track gap)`)
      } else {
        finding(findings, 'PASS', 'dual_track', ref,
          `${tenantTotal} tenant questions — dual-track satisfied`)
        log(`  ${SEVERITY_ICON['PASS']} ${ref}: ${tenantTotal} tenant questions ✓`)
      }
    }
  }
}

// =============================================================================
// CHECK 6 — TENANT ISOLATION SANITY
// =============================================================================

async function checkTenantIsolation (
  findings: Finding[],
  supabase: SupabaseClient,
  tenants:  TenantRow[]
): Promise<void> {
  log('\n── Check 6: Tenant Isolation Sanity')

  const tenantIdSet = new Set(tenants.map(t => t.id))

  // 6a. Verify no tenant_questions rows have a NULL tenant_id
  {
    const { count, error } = await supabase
      .from('tenant_questions')
      .select('id', { count: 'exact', head: true })
      .is('tenant_id', null)

    if (error) {
      finding(findings, 'ERROR', 'isolation', 'tenant_questions.tenant_id',
        `Failed to check NULL tenant_ids: ${error.message}`)
    } else if ((count ?? 0) > 0) {
      finding(findings, 'CRITICAL', 'isolation', 'tenant_questions.tenant_id',
        `${count} rows in tenant_questions have NULL tenant_id`,
        'These rows are unscoped and will be invisible to all RLS policies. Delete or reassign.')
      log(`  ${SEVERITY_ICON['CRITICAL']} NULL tenant_id rows: ${count}`)
    } else {
      finding(findings, 'PASS', 'isolation', 'tenant_questions.tenant_id',
        'No NULL tenant_id rows in tenant_questions')
      log(`  ${SEVERITY_ICON['PASS']} No NULL tenant_id rows`)
    }
  }

  // 6b. Verify no tenant_questions rows reference a non-existent tenant
  {
    const { data, error } = await supabase
      .from('tenant_questions')
      .select('tenant_id')

    if (error) {
      finding(findings, 'ERROR', 'isolation', 'orphaned_tenant_questions',
        `Failed to load tenant_questions for orphan check: ${error.message}`)
    } else {
      const orphanSet = new Set<string>()
      for (const row of data ?? []) {
        if (row.tenant_id && !tenantIdSet.has(row.tenant_id)) {
          orphanSet.add(row.tenant_id)
        }
      }

      if (orphanSet.size > 0) {
        finding(findings, 'CRITICAL', 'isolation', 'orphaned_tenant_questions',
          `${orphanSet.size} orphaned tenant_id(s) found in tenant_questions`,
          `Unknown tenant IDs: ${Array.from(orphanSet).join(', ')}`)
        log(`  ${SEVERITY_ICON['CRITICAL']} Orphaned tenant_ids: ${Array.from(orphanSet).join(', ')}`)
      } else {
        finding(findings, 'PASS', 'isolation', 'orphaned_tenant_questions',
          'All tenant_questions rows reference valid tenants')
        log(`  ${SEVERITY_ICON['PASS']} No orphaned tenant_id references`)
      }
    }
  }

  // 6c. Per-tenant row count sanity — flag anomalously large or zero counts
  {
    const { data, error } = await supabase
      .from('tenant_questions')
      .select('tenant_id')

    if (!error && data) {
      const perTenant = new Map<string, number>()
      for (const row of data) {
        perTenant.set(row.tenant_id, (perTenant.get(row.tenant_id) ?? 0) + 1)
      }

      for (const tenant of tenants.filter(t => t.status === 'active')) {
        const count = perTenant.get(tenant.id) ?? 0
        if (count === 0) {
          finding(findings, 'WARN', 'isolation', tenant.name,
            `Active tenant has 0 rows in tenant_questions`,
            `Run import-tenant-questions.ts for "${tenant.name}"`)
          log(`  ${SEVERITY_ICON['WARN']} ${tenant.name}: 0 tenant_questions rows`)
        } else {
          log(`  ${SEVERITY_ICON['PASS']} ${tenant.name}: ${count} tenant_question rows`)
        }
      }
    }
  }

  // 6d. Duplicate question detection within same tenant + policy
  {
    const { data, error } = await supabase
      .from('tenant_questions')
      .select('tenant_id, policy_id, question_text')
      .eq('is_active', true)

    if (!error && data) {
      const seen   = new Map<string, number>()
      let dupCount = 0

      for (const row of data) {
        const key = `${row.tenant_id}::${row.policy_id}::${row.question_text.toLowerCase().trim()}`
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }

      for (const [key, count] of seen) {
        if (count > 1) {
          const [tenantId, policyId] = key.split('::')
          const tenant = tenants.find(t => t.id === tenantId)
          finding(findings, 'ERROR', 'isolation', `${tenant?.name ?? tenantId}`,
            `${count - 1} duplicate question(s) detected (same tenant + policy + text)`,
            `Run scripts/test-dedup.ts to identify and remove duplicates`)
          dupCount++
        }
      }

      if (dupCount === 0) {
        finding(findings, 'PASS', 'isolation', 'duplicate_detection',
          'No duplicate questions found within any tenant+policy combination')
        log(`  ${SEVERITY_ICON['PASS']} No duplicate questions detected`)
      } else {
        log(`  ${SEVERITY_ICON['ERROR']} ${dupCount} duplicate question group(s) found`)
      }
    }
  }
}

// =============================================================================
// REPORT PRINTER
// =============================================================================

function printReport (report: ValidationReport): void {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const D = '═'.repeat(62)
  const d = '─'.repeat(62)

  log(`\n${D}`)
  log('  QUESTION POOL VALIDATION REPORT')
  log(`  Run at  : ${report.runAt}`)
  log(`  Filter  : ${report.filters.tenantId ? `tenant=${report.filters.tenantId}` : 'all tenants'}, ${report.filters.policy ? `policy=${report.filters.policy}` : 'all policies'}`)
  log(`  Threshold: ${report.threshold} questions/sub_heading`)
  log(D)

  // Group by check category
  const byCheck = new Map<string, Finding[]>()
  for (const f of report.findings) {
    const arr = byCheck.get(f.check) ?? []
    arr.push(f)
    byCheck.set(f.check, arr)
  }

  const checkLabels: Record<string, string> = {
    master_counts:       'Master Question Counts',
    subheading_coverage: 'Sub_heading Coverage',
    tenant_counts:       'Tenant Question Counts',
    weak_pools:          'Weak Tenant Pools',
    dual_track:          'Dual-Track Coverage',
    isolation:           'Tenant Isolation Sanity',
  }

  for (const [check, fList] of byCheck) {
    log(`\n  ${checkLabels[check] ?? check}`)
    log(`  ${d.slice(0, 40)}`)
    for (const f of fList) {
      if (f.severity === 'PASS') continue  // suppress PASS lines in final report
      log(`  ${SEVERITY_ICON[f.severity]} [${f.severity}] ${f.entity}`)
      log(`    ${f.message}`)
      if (f.detail) log(`    ${f.detail}`)
    }
    const passCount = fList.filter(f => f.severity === 'PASS').length
    if (passCount > 0) log(`  ${SEVERITY_ICON['PASS']} ${passCount} check(s) passed`)
  }

  log(`\n${D}`)
  log('  SUMMARY')
  log(d)
  log(`  PASS     : ${report.summary.pass}`)
  log(`  INFO     : ${report.summary.info}`)
  log(`  WARN     : ${report.summary.warn}`)
  log(`  ERROR    : ${report.summary.error}`)
  log(`  CRITICAL : ${report.summary.critical}`)
  log(d)
  log(`  Overall  : ${report.maxSeverity}`)
  log(`  Duration : ${report.durationMs}ms`)
  log(D + '\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main (): Promise<void> {
  const startMs  = Date.now()
  const findings: Finding[] = []

  if (!JSON_OUTPUT) {
    log('validate-pool starting...')
    log(`Threshold : ${MIN_PER_SUBHEADING} questions/sub_heading`)
    if (CLI_TENANT_ID) log(`Filter    : tenant ${CLI_TENANT_ID}`)
    if (CLI_POLICY)    log(`Filter    : policy ${CLI_POLICY}`)
  }

  // ── Env + Supabase ───────────────────────────────────────────────────────────
  loadEnv()
  const url     = process.env.PUBLIC_SUPABASE_URL
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svcKey) {
    console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  // Explicitly pin the Authorization header so the service-role key is used
  // on every PostgREST request, regardless of @supabase/supabase-js v2's
  // async GoTrueClient initialisation race. Without this, requests fired
  // immediately after createClient() can send no Bearer token (or the anon
  // key), resulting in "permission denied for table <x>".
  const supabase = createClient(url, svcKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${svcKey}`,
      },
    },
  })

  // ── Load reference data ──────────────────────────────────────────────────────
  const policies    = await loadPolicies(supabase, CLI_POLICY)
  const policyIds   = policies.map(p => p.id)
  const subHeadings = await loadSubHeadings(supabase, policyIds)
  const tenants     = await loadTenants(supabase, CLI_TENANT_ID)
  const tenantIds   = tenants.map(t => t.id)

  if (!JSON_OUTPUT) {
    log(`\nLoaded: ${policies.length} policies | ${subHeadings.length} sub_headings | ${tenants.length} tenants`)
  }

  if (!policies.length) {
    console.error('No active policies found — run supabase/seed/policies.sql first')
    process.exit(1)
  }

  // ── Load question counts ─────────────────────────────────────────────────────
  const masterCounts = await loadMasterCounts(supabase, policyIds)
  const tenantCounts = await loadTenantCounts(supabase, policyIds, tenantIds)

  // ── Run all checks ───────────────────────────────────────────────────────────
  checkMasterCounts      (findings, policies, subHeadings, masterCounts)
  checkSubHeadingCoverage(findings, policies, subHeadings, masterCounts, tenantCounts, tenants)
  checkTenantCounts      (findings, tenants, policies, subHeadings, tenantCounts)
  checkWeakPools         (findings, tenants, subHeadings, policies, tenantCounts)
  checkDualTrackCoverage (findings, tenants, policies, masterCounts, tenantCounts)
  await checkTenantIsolation(findings, supabase, tenants)

  // ── Build report ─────────────────────────────────────────────────────────────
  const summary = { pass: 0, info: 0, warn: 0, error: 0, critical: 0 }
  for (const f of findings) {
    if (f.severity === 'PASS')     summary.pass++
    else if (f.severity === 'INFO') summary.info++
    else if (f.severity === 'WARN') summary.warn++
    else if (f.severity === 'ERROR') summary.error++
    else if (f.severity === 'CRITICAL') summary.critical++
  }

  const report: ValidationReport = {
    runAt:       new Date().toISOString(),
    threshold:   MIN_PER_SUBHEADING,
    filters:     { tenantId: CLI_TENANT_ID, policy: CLI_POLICY },
    findings,
    summary,
    maxSeverity: maxSeverity(findings),
    durationMs:  Date.now() - startMs,
  }

  printReport(report)
  flushLog()

  // Exit code based on max severity
  if (report.summary.critical > 0 || report.summary.error > 0) process.exit(1)
  if (report.summary.warn > 0)                                   process.exit(2)
  process.exit(0)
}

main().catch(err => {
  console.error(`Unhandled error: ${(err as Error).message}`)
  flushLog()
  process.exit(1)
})
