/**
 * Checkpoint-I verification: parse the REAL prd/PRD.md + spec/SPEC.md +
 * decisions/prd-review.md, and drive the full flow to Handoff (resolve →
 * advance → hand-to-review → sign-off) on a COPY — all without Electron.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync, cpSync, rmSync, readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'

/** Force a copied engagement to the canonical starting point so the suite is
 *  deterministic even if the working-tree fixture was mutated by a live demo. */
function normalize(root) {
  writeFileSync(
    join(root, '.flow/state.json'),
    JSON.stringify(
      { currentStage: 'Resolution', gates: { Extraction: 'passed', GapAnalysis: 'passed', Resolution: 'pending', Review: 'pending' }, updatedAt: '2026-06-13T00:00:00.000Z' },
      null,
      2
    )
  )
  const gaps = JSON.parse(readFileSync(join(root, 'analysis/gaps.json'), 'utf-8'))
  for (const g of gaps) {
    g.status = 'open'
    delete g.resolution
  }
  writeFileSync(join(root, 'analysis/gaps.json'), JSON.stringify(gaps, null, 2))
  for (const f of readdirSync(join(root, 'decisions'))) {
    if (/-gate-(Resolution|Review)\.md$/.test(f)) rmSync(join(root, 'decisions', f))
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const desktop = resolve(here, '..')
const core = resolve(desktop, '..', 'src')
const aliasAndTs = {
  name: 'alias-and-ts',
  setup(b) {
    b.onResolve({ filter: /^@core\// }, (a) => ({ path: resolveTs(a.path.replace(/^@core\//, core + '/')) }))
    b.onResolve({ filter: /^@shared\// }, (a) => ({ path: resolveTs(a.path.replace(/^@shared\//, join(desktop, 'src/shared') + '/')) }))
    b.onResolve({ filter: /\.js$/ }, (a) => {
      if (a.kind === 'entry-point') return null
      const ts = resolve(a.resolveDir, a.path).replace(/\.js$/, '.ts')
      return existsSync(ts) ? { path: ts } : null
    })
  }
}
function resolveTs(p) {
  if (existsSync(p)) return p
  if (existsSync(p + '.ts')) return p + '.ts'
  return p
}
async function bundle(entry, name) {
  const out = join(here, name)
  await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', plugins: [aliasAndTs], logLevel: 'error' })
  return (await import(pathToFileURL(out).href + `?t=${name}`))
}

const { loadEngagement } = await bundle(join(desktop, 'src/main/domain-host.ts'), '.va-load.mjs')
const { applyMutation } = await bundle(join(desktop, 'src/main/mutations.ts'), '.va-mut.mjs')

let pass = 0, failn = 0
const check = (l, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${l}`) } else { failn++; console.log(`  ✗ ${l} ${d}`) } }

const SAMPLE = resolve(desktop, '..', 'examples', 'sample-engagement')

// ── PRD / SPEC parsing ────────────────────────────────────────────────────────
console.log('PRD / SPEC parse')
{
  const snap = loadEngagement(SAMPLE)
  const prd = snap.prd
  check('prd parsed', !!prd)
  check('human sections present', prd.human.length >= 6, `(${prd.human.length})`)
  check('spec sections present', prd.spec.length >= 3, `(${prd.spec.length})`)
  check('contract groups = Order/Payment/Cart', prd.contracts.length === 3, `(${prd.contracts.map(g=>g.name).join(',')})`)

  const allAssertions = [...prd.human, ...prd.spec].flatMap((s) => s.assertions)
  const cited = allAssertions.filter((a) => a.citations.length > 0)
  check('every PRD/SPEC assertion is cited', cited.length === allAssertions.length, `(${cited.length}/${allAssertions.length})`)
  check('AC section is numbered', prd.spec.find((s) => /acceptance/i.test(s.title))?.numbered === true)

  // a decision citation resolves to a decisions/ file
  const decAssertion = prd.human.flatMap((s)=>s.assertions).find((a)=>a.citations.some((c)=>c.isDecision))
  check('decision citation flagged isDecision', !!decAssertion, '(Key Decisions)')
  check('decision cites conflict-001', decAssertion?.citations.some((c)=>c.decisionId === 'conflict-001'))

  // a claim citation resolves a verbatim quote from claims.json
  const claimCite = allAssertions.flatMap((a)=>a.citations).find((c)=>c.claimIds.includes('claim-001'))
  check('claim-001 quote resolved from claims.json', !!claimCite?.quote && claimCite.quote.length > 10, `(${claimCite?.quote?.slice(0,30)})`)

  // a contract field flagged gated (promoCode cites gap-004)
  const promo = prd.contracts.flatMap((g)=>g.fields).find((f)=>/promoCode/.test(f.field))
  check('promoCode contract field is gated', promo?.gated === true)
}

// ── Review parsing ──────────────────────────────────────────────────────────────
console.log('Review parse')
{
  const { review } = loadEngagement(SAMPLE)
  check('review parsed', !!review)
  check('verdict PASS', review.verdict === 'PASS')
  check('reviewer fm-reviewer', review.reviewer === 'fm-reviewer', `(${review.reviewer})`)
  check('reviewedAt present', /^2026-/.test(review.reviewedAt), `(${review.reviewedAt})`)
  check('3 axis results', review.axes.length === 3, `(${review.axes.map(a=>a.axis).join(',')})`)
  check('all axes pass', review.axes.every((a) => a.pass))
  check('2 warning findings, 0 blockers', review.findings.filter(f=>f.severity==='warning').length === 2 && review.findings.filter(f=>f.severity==='blocker').length === 0, `(${review.findings.length})`)
  check('summary non-empty', review.summary.length > 40)
}

// ── Full flow to Handoff on a copy ──────────────────────────────────────────────
console.log('Full flow: resolve → advance → review → sign-off')
{
  const root = mkdtempSync(join(tmpdir(), 'fm-va-'))
  cpSync(SAMPLE, root, { recursive: true })
  normalize(root)
  for (const id of ['conflict-001', 'gap-001', 'gap-002']) {
    applyMutation(root, { type: 'resolveGap', gapId: id, by: 'PM', reason: 'settled' })
  }
  check('advanceResolution ok', applyMutation(root, { type: 'advanceResolution', by: 'PM' }).ok)
  // cannot sign off before reaching Review
  check('sign-off rejected at PRDDraft', applyMutation(root, { type: 'signOffReview', by: 'PM' }).ok === false)
  check('handToReview ok', applyMutation(root, { type: 'handToReview', by: 'PM' }).ok)
  const signed = applyMutation(root, { type: 'signOffReview', by: 'PM' })
  check('signOffReview ok', signed.ok, `(${signed.error ?? ''})`)
  check('flow now at Handoff', signed.snapshot?.flow.currentStage === 'Handoff')
  const state = JSON.parse(readFileSync(join(root, '.flow/state.json'), 'utf-8'))
  check('state.json Review gate passed', state.gates.Review === 'passed')
  check('Review gate-record written', readdirSync(join(root, 'decisions')).some((f) => /gate-Review\.md$/.test(f)))
  rmSync(root, { recursive: true, force: true })
}

for (const f of ['.va-load.mjs', '.va-mut.mjs']) rmSync(join(here, f), { force: true })
console.log(`\n${pass} passed, ${failn} failed`)
process.exit(failn === 0 ? 0 : 1)
