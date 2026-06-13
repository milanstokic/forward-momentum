/**
 * Checkpoint-J verification (T25): exercise ClaudeCodeRunner with an INJECTED
 * mock spawn — no real `claude` needed. Asserts it invokes `claude /fm-<stage>
 * --print` in the engagement cwd, maps exit codes to ok, handles spawn errors,
 * rejects stages with no agent command, and returns a fresh snapshot.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync, rmSync } from 'fs'
import { EventEmitter } from 'events'

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
function rt(p) {
  return existsSync(p) ? p : existsSync(p + '.ts') ? p + '.ts' : p
}

const out = join(here, '.va-agent.mjs')
await build({ entryPoints: [join(desktop, 'src/main/agent-runner.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', plugins: [plug], logLevel: 'error' })
const { ClaudeCodeRunner } = await import(pathToFileURL(out).href)

const SAMPLE = resolve(desktop, '..', 'examples', 'sample-engagement')
let pass = 0, failn = 0
const check = (l, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${l}`) } else { failn++; console.log(`  ✗ ${l} ${d}`) } }

// Build a mock spawn that records the call and emits a canned exit.
let captured = null
function mockSpawn({ exitCode = 0, stdout = '', stderr = '', throwOnSpawn = false }) {
  return (command, args, options) => {
    if (throwOnSpawn) throw new Error('ENOENT: claude not found')
    captured = { command, args, cwd: options.cwd }
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => {}
    setImmediate(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout))
      if (stderr) child.stderr.emit('data', Buffer.from(stderr))
      child.emit('close', exitCode)
    })
    return child
  }
}

const runner = new ClaudeCodeRunner()

console.log('Success path (exit 0)')
{
  captured = null
  const res = await runner.runStage(SAMPLE, 'GapAnalysis', { spawnFn: mockSpawn({ exitCode: 0, stdout: 'wrote analysis/gaps.json' }) })
  check('ok true', res.ok === true)
  check('command /fm-gaps', res.command === '/fm-gaps', `(${res.command})`)
  check('spawned claude', captured?.command === 'claude')
  check('args = /fm-gaps --print', JSON.stringify(captured?.args) === JSON.stringify(['/fm-gaps', '--print']), `(${JSON.stringify(captured?.args)})`)
  check('cwd = engagement root', captured?.cwd === SAMPLE)
  check('stdout captured', res.stdout.includes('gaps.json'))
  check('fresh snapshot returned (6 gaps)', res.snapshot?.gaps.length === 6, `(${res.snapshot?.gaps?.length})`)
}

console.log('Stage → command mapping')
{
  for (const [stage, cmd] of [['Extraction', '/fm-extract'], ['PRDDraft', '/fm-prd'], ['Review', '/fm-review']]) {
    captured = null
    await runner.runStage(SAMPLE, stage, { spawnFn: mockSpawn({ exitCode: 0 }) })
    check(`${stage} → ${cmd}`, JSON.stringify(captured?.args) === JSON.stringify([cmd, '--print']), `(${JSON.stringify(captured?.args)})`)
  }
}

console.log('Failure path (exit 2 + stderr)')
{
  const res = await runner.runStage(SAMPLE, 'Review', { spawnFn: mockSpawn({ exitCode: 2, stderr: 'boom' }) })
  check('ok false', res.ok === false)
  check('exitCode 2', res.exitCode === 2)
  check('stderr captured', res.stderr.includes('boom'))
}

console.log('Spawn error path')
{
  const res = await runner.runStage(SAMPLE, 'GapAnalysis', { spawnFn: mockSpawn({ throwOnSpawn: true }) })
  check('ok false', res.ok === false)
  check('error surfaced', /ENOENT|spawn/i.test(res.error ?? ''), `(${res.error})`)
}

console.log('Stage with no agent command')
{
  const res = await runner.runStage(SAMPLE, 'Resolution', { spawnFn: mockSpawn({ exitCode: 0 }) })
  check('ok false', res.ok === false)
  check('error explains no command', /No agent command/.test(res.error ?? ''), `(${res.error})`)
}

rmSync(out, { force: true })
console.log(`\n${pass} passed, ${failn} failed`)
process.exit(failn === 0 ? 0 : 1)
