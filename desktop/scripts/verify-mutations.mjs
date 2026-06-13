/**
 * Checkpoint-H verification: exercise the Domain Host WRITE path (resolve / defer
 * / waive / advance) against a COPY of examples/sample-engagement, asserting the
 * real files change and the hard gate is enforced — all without Electron.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync, cpSync, rmSync, readFileSync, readdirSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'

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

const out = join(here, '.verify-mut.mjs')
await build({
  entryPoints: [join(desktop, 'src/main/mutations.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [aliasAndTs],
  logLevel: 'error'
})
// mutations.ts re-exports nothing of domain-host except via import; load both.
const mod = await import(pathToFileURL(out).href)
const { applyMutation } = mod

// loadEngagement is bundled in but not re-exported; rebuild a tiny loader export.
const outLoad = join(here, '.verify-load2.mjs')
await build({
  entryPoints: [join(desktop, 'src/main/domain-host.ts')],
  outfile: outLoad,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [aliasAndTs],
  logLevel: 'error'
})
const { loadEngagement } = await import(pathToFileURL(outLoad).href)

let pass = 0
let failn = 0
function check(label, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    failn++
    console.log(`  ✗ ${label} ${detail}`)
  }
}

function freshCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'fm-verify-'))
  cpSync(resolve(desktop, '..', 'examples', 'sample-engagement'), dir, { recursive: true })
  return dir
}

// ── 1. Enforcement: advancing while blockers are open must fail ───────────────
console.log('Negative: advance with gate closed')
{
  const root = freshCopy()
  const snap0 = loadEngagement(root)
  check('starts CLOSED with 3 blockers', !snap0.resolutionGate.ok && snap0.resolutionGate.blockingIds.length === 3)
  const res = applyMutation(root, { type: 'advanceResolution', by: 'test' })
  check('advance is REJECTED', res.ok === false, `(ok=${res.ok})`)
  const state = JSON.parse(readFileSync(join(root, '.flow/state.json'), 'utf-8'))
  check('flow stayed at Resolution', state.currentStage === 'Resolution', `(was ${state.currentStage})`)
  rmSync(root, { recursive: true, force: true })
}

// ── 2. Full loop: clear blockers (resolve+waive) → gate opens → advance ───────
console.log('Loop: resolve + waive → open → advance')
{
  const root = freshCopy()
  applyMutation(root, { type: 'resolveGap', gapId: 'conflict-001', by: 'PM', reason: 'Guest checkout wins; notes updated.' })
  applyMutation(root, { type: 'resolveGap', gapId: 'gap-001', by: 'PM', reason: 'Saved cards out of scope this release.' })

  // waive the last blocker — invalid first (missing acks), then valid
  const bad = applyMutation(root, {
    type: 'waiveGap',
    gapId: 'gap-002',
    by: 'PM',
    reason: '',
    acknowledgements: { communicatedToClient: false, riskAccepted: false, revisitScheduled: false }
  })
  check('invalid waiver REJECTED with reasons', bad.ok === false && (bad.validationErrors?.length ?? 0) >= 3, `(${bad.validationErrors?.length})`)

  const good = applyMutation(root, {
    type: 'waiveGap',
    gapId: 'gap-002',
    by: 'PM',
    reason: 'Decline error-state design fast-follows; ship happy path.',
    acknowledgements: { communicatedToClient: true, riskAccepted: true, revisitScheduled: true }
  })
  check('valid waiver ACCEPTED', good.ok === true)
  check('gate now OPEN', good.snapshot?.resolutionGate.ok === true)

  // files on disk reflect it
  const gaps = JSON.parse(readFileSync(join(root, 'analysis/gaps.json'), 'utf-8'))
  const byId = Object.fromEntries(gaps.map((g) => [g.id, g]))
  check('conflict-001 resolved on disk', byId['conflict-001'].status === 'resolved' && !!byId['conflict-001'].resolution)
  check('gap-002 waived on disk', byId['gap-002'].status === 'waived' && byId['gap-002'].resolution?.by === 'PM')
  const decisions = readdirSync(join(root, 'decisions'))
  check('waiver gate-record written', decisions.some((f) => /gate-Resolution\.md$/.test(f)), `(${decisions.join(', ')})`)

  // advance now succeeds and writes state + record
  const adv = applyMutation(root, { type: 'advanceResolution', by: 'PM' })
  check('advance ACCEPTED', adv.ok === true, `(${adv.error ?? ''})`)
  check('snapshot flow at PRDDraft', adv.snapshot?.flow.currentStage === 'PRDDraft')
  const state = JSON.parse(readFileSync(join(root, '.flow/state.json'), 'utf-8'))
  check('state.json currentStage=PRDDraft', state.currentStage === 'PRDDraft')
  rmSync(root, { recursive: true, force: true })
}

rmSync(out, { force: true })
rmSync(outLoad, { force: true })
console.log(`\n${pass} passed, ${failn} failed`)
process.exit(failn === 0 ? 0 : 1)
