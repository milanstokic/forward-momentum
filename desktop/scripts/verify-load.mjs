/**
 * Checkpoint-G verification: exercise the Domain Host read path against the REAL
 * examples/sample-engagement WITHOUT launching Electron. domain-host.ts has no
 * electron dependency, so we esbuild-bundle it (resolving the @core/@shared
 * aliases and the core's `.js`->`.ts` specifiers) and run loadEngagement.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync } from 'fs'

const here = dirname(fileURLToPath(import.meta.url))
const desktop = resolve(here, '..')
const core = resolve(desktop, '..', 'src')

// esbuild plugin: alias @core/@shared and rewrite core's `.js` specifiers to `.ts`.
const aliasAndTs = {
  name: 'alias-and-ts',
  setup(b) {
    b.onResolve({ filter: /^@core\// }, (a) => ({
      path: resolveTs(a.path.replace(/^@core\//, core + '/'))
    }))
    b.onResolve({ filter: /^@shared\// }, (a) => ({
      path: resolveTs(a.path.replace(/^@shared\//, join(desktop, 'src/shared') + '/'))
    }))
    // relative `.js` specifiers inside the core point at `.ts` sources
    b.onResolve({ filter: /\.js$/ }, (a) => {
      if (a.kind === 'entry-point') return null
      const abs = resolve(a.resolveDir, a.path)
      const ts = abs.replace(/\.js$/, '.ts')
      return existsSync(ts) ? { path: ts } : null
    })
  }
}

function resolveTs(p) {
  if (existsSync(p)) return p
  if (existsSync(p + '.ts')) return p + '.ts'
  if (existsSync(join(p, 'index.ts'))) return join(p, 'index.ts')
  return p
}

const out = join(here, '.verify-load.mjs')
await build({
  entryPoints: [join(desktop, 'src/main/domain-host.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [aliasAndTs],
  logLevel: 'error'
})

const { loadEngagement } = await import(pathToFileURL(out).href)
const root = resolve(desktop, '..', 'examples', 'sample-engagement')
const snap = loadEngagement(root)

console.log('slug:           ', snap.slug)
console.log('claims:         ', snap.claims.length)
console.log('gaps:           ', snap.gaps.length)
console.log('flow.stage:     ', snap.flow.currentStage)
console.log('gate.ok:        ', snap.resolutionGate.ok)
console.log('gate.reason:    ', snap.resolutionGate.reason)
console.log('blockingIds:    ', snap.resolutionGate.blockingIds.join(', '))
console.log('first gap id:   ', snap.gaps[0]?.id, '-', snap.gaps[0]?.kind, snap.gaps[0]?.severity)
