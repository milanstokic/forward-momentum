/**
 * Intake verification: a sources-only folder is recognized + loads at Intake,
 * and the early-flow advance (after Extraction / GapAnalysis runs) walks the flow
 * Intake → Extraction → Resolution. All headless, no Electron / claude.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync, rmSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync } from 'fs'
import { tmpdir } from 'os'

/** Reset a copied engagement to the canonical Resolution starting point. */
function normalize(root) {
  writeFileSync(
    join(root, '.flow/state.json'),
    JSON.stringify({ currentStage: 'Resolution', gates: { Extraction: 'passed', GapAnalysis: 'passed', Resolution: 'pending', Review: 'pending' }, updatedAt: '2026-06-13T00:00:00.000Z' }, null, 2)
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
const plug = {
  name: 'a',
  setup(b) {
    b.onResolve({ filter: /^@core\// }, (a) => ({ path: rt(a.path.replace(/^@core\//, core + '/')) }))
    b.onResolve({ filter: /^@shared\// }, (a) => ({ path: rt(a.path.replace(/^@shared\//, join(desktop, 'src/shared') + '/')) }))
    b.onResolve({ filter: /\.js$/ }, (a) => {
      if (a.kind === 'entry-point') return null
      const t = resolve(a.resolveDir, a.path).replace(/\.js$/, '.ts')
      return existsSync(t) ? { path: t } : null
    })
  }
}
const rt = (p) => (existsSync(p) ? p : existsSync(p + '.ts') ? p + '.ts' : p)
async function bundle(entry, name) {
  const out = join(here, name)
  await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', plugins: [plug], logLevel: 'error' })
  return import(pathToFileURL(out).href)
}

const { loadEngagement, isEngagementRoot } = await bundle(join(desktop, 'src/main/domain-host.ts'), '.vi-load.mjs')
const { advanceFlowForStage } = await bundle(join(desktop, 'src/main/mutations.ts'), '.vi-mut.mjs')

let pass = 0, failn = 0
const check = (l, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${l}`) } else { failn++; console.log(`  ✗ ${l} ${d}`) } }

// ── Fresh, sources-only engagement ─────────────────────────────────────────────
console.log('Fresh engagement (sources only)')
{
  const root = mkdtempSync(join(tmpdir(), 'fm-vi-'))
  mkdirSync(join(root, 'sources'), { recursive: true })
  mkdirSync(join(root, '.claude'), { recursive: true })
  writeFileSync(join(root, 'sources', 'kickoff-call.md'), '# Kickoff\nSome notes.\n')
  writeFileSync(join(root, 'sources', 'product-notes.md'), '# Notes\nMore.\n')

  check('recognized as engagement (sources only)', isEngagementRoot(root) === true)
  const snap = loadEngagement(root)
  check('loads at Intake', snap.flow.currentStage === 'Intake', `(${snap.flow.currentStage})`)
  check('lists 2 sources', snap.sources.length === 2, `(${snap.sources.join(',')})`)
  check('no claims / gaps yet', snap.claims.length === 0 && snap.gaps.length === 0)
  check('resolution gate open (no blockers)', snap.resolutionGate.ok === true)

  // Extraction run → flow advances to Extraction
  advanceFlowForStage(root, 'Extraction')
  check('after Extraction run → Extraction', JSON.parse(readFileSync(join(root, '.flow/state.json'), 'utf-8')).currentStage === 'Extraction')

  // GapAnalysis run → flow walks to Resolution, early gates passed
  advanceFlowForStage(root, 'GapAnalysis')
  const state = JSON.parse(readFileSync(join(root, '.flow/state.json'), 'utf-8'))
  check('after GapAnalysis run → Resolution', state.currentStage === 'Resolution', `(${state.currentStage})`)
  check('Extraction + GapAnalysis gates passed', state.gates.Extraction === 'passed' && state.gates.GapAnalysis === 'passed')
  rmSync(root, { recursive: true, force: true })
}

// ── Already-analyzed sample is unaffected ──────────────────────────────────────
console.log('Analyzed sample (no regression)')
{
  const root = mkdtempSync(join(tmpdir(), 'fm-vi2-'))
  cpSync(resolve(desktop, '..', 'examples', 'sample-engagement'), root, { recursive: true })
  normalize(root)
  const before = loadEngagement(root)
  check('sample loads at Resolution', before.flow.currentStage === 'Resolution')
  check('sample lists sources', before.sources.length >= 3, `(${before.sources.length})`)
  advanceFlowForStage(root, 'GapAnalysis') // re-running gaps at Resolution must not regress
  check('still at Resolution after re-gaps', loadEngagement(root).flow.currentStage === 'Resolution')
  rmSync(root, { recursive: true, force: true })
}

for (const f of ['.vi-load.mjs', '.vi-mut.mjs']) rmSync(join(here, f), { force: true })
console.log(`\n${pass} passed, ${failn} failed`)
process.exit(failn === 0 ? 0 : 1)
