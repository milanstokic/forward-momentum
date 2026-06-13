import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

import {
  FM_CHANNELS,
  type AgentRunResult,
  type Intent,
  type MutationResult,
  type Snapshot,
  type WireStageName
} from '../shared/contract'
import { isEngagementRoot, loadEngagement } from './domain-host'
import { applyMutation } from './mutations'
import { claudeCodeRunner } from './agent-runner'

let mainWindow: BrowserWindow | null = null

/**
 * Ensure common CLI bin dirs are on PATH. A macOS/Linux app launched from
 * Finder/the dock inherits a minimal PATH that omits ~/.local/bin, Homebrew,
 * etc. — so spawning `claude` would ENOENT. Prepend the usual locations (idempotent)
 * so the AgentRunner can find the Claude Code binary in a packaged build.
 */
function fixPath(): void {
  if (process.platform === 'win32') return
  const home = process.env.HOME ?? ''
  const extras = [
    join(home, '.local', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin'
  ]
  const current = (process.env.PATH ?? '').split(':').filter(Boolean)
  const merged = [...extras.filter((p) => p && !current.includes(p)), ...current]
  process.env.PATH = merged.join(':')
}

/**
 * Locate the brand app-icon PNG. Tries the built layout (out/main -> desktop)
 * and the dev cwd, returning the first that exists. Used for the window icon
 * (Windows/Linux) and the macOS dock icon.
 */
function brandIconPath(): string | null {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.cwd(), 'resources', 'icon.png')
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

/** The engagement currently open in the host (single-engagement for now). */
let currentRoot: string | null = null

/**
 * Locate the bundled sample engagement. Tries the built layout
 * (desktop/out/main -> repo root) and the dev cwd variants, picking the first
 * that actually looks like an engagement.
 */
function defaultEngagementRoot(): string | null {
  const candidates = [
    // packaged: electron-builder copies it to <app>/Contents/Resources/sample-engagement
    join(process.resourcesPath ?? '', 'sample-engagement'),
    join(__dirname, '../../..', 'examples', 'sample-engagement'),
    join(process.cwd(), 'examples', 'sample-engagement'),
    join(process.cwd(), '..', 'examples', 'sample-engagement')
  ]
  return candidates.find((c) => existsSync(c) && isEngagementRoot(c)) ?? null
}

function snapshotFor(root: string): Snapshot {
  const snap = loadEngagement(root)
  currentRoot = root
  return snap
}

function registerIpc(): void {
  // renderer -> main: load/refresh the current (or default) engagement
  ipcMain.handle(FM_CHANNELS.requestSnapshot, () => {
    const root = currentRoot ?? defaultEngagementRoot()
    if (!root) return null
    return snapshotFor(root)
  })

  // renderer -> main: pick a new engagement folder
  ipcMain.handle(FM_CHANNELS.openEngagement, async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open engagement',
      properties: ['openDirectory'],
      defaultPath: currentRoot ?? defaultEngagementRoot() ?? app.getPath('home')
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const root = result.filePaths[0]
    if (!isEngagementRoot(root)) {
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        message: 'Not an engagement folder',
        detail: `${root}\n\nExpected an analysis/gaps.json inside the selected folder.`
      })
      return null
    }
    return snapshotFor(root)
  })

  // renderer -> main: apply a mutation to the engagement files via the core
  ipcMain.handle(FM_CHANNELS.mutate, (_e, intent: Intent): MutationResult => {
    const root = currentRoot ?? defaultEngagementRoot()
    if (!root) return { ok: false, error: 'No engagement is open.', snapshot: null }
    try {
      return applyMutation(root, intent)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message, snapshot: loadEngagement(root) }
    }
  })

  // renderer -> main: run a stage's agent via Claude Code (the `claude` CLI)
  ipcMain.handle(
    FM_CHANNELS.runStage,
    (_e, stage: WireStageName): Promise<AgentRunResult> => {
      const root = currentRoot ?? defaultEngagementRoot()
      if (!root) {
        return Promise.resolve({
          ok: false,
          stage,
          command: '',
          exitCode: null,
          stdout: '',
          stderr: '',
          error: 'No engagement is open.',
          snapshot: null
        })
      }
      return claudeCodeRunner.runStage(root, stage)
    }
  )
}

function createWindow(): void {
  const iconPath = brandIconPath()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: 'Forward-Momentum',
    backgroundColor: '#141414',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Make `claude` reachable when launched outside a shell (packaged app).
  fixPath()

  // macOS: show the brand mark in the dock (dev + unpackaged runs).
  const iconPath = brandIconPath()
  if (process.platform === 'darwin' && iconPath && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
