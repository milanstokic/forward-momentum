import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

import { FM_CHANNELS, type Intent, type MutationResult, type Snapshot } from '../shared/contract'
import { isEngagementRoot, loadEngagement } from './domain-host'
import { applyMutation } from './mutations'

let mainWindow: BrowserWindow | null = null

/** The engagement currently open in the host (single-engagement for now). */
let currentRoot: string | null = null

/**
 * Locate the bundled sample engagement. Tries the built layout
 * (desktop/out/main -> repo root) and the dev cwd variants, picking the first
 * that actually looks like an engagement.
 */
function defaultEngagementRoot(): string | null {
  const candidates = [
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
}

function createWindow(): void {
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
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
