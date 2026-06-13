import { contextBridge } from 'electron'

// Minimal, safe surface. Extend when the renderer needs OS/file access
// (e.g. loading a real engagement's analysis/gaps.json from disk).
const api = {
  platform: process.platform
}

try {
  contextBridge.exposeInMainWorld('fm', api)
} catch {
  // contextIsolation disabled — fall back to global
  // @ts-ignore
  window.fm = api
}

export type FmApi = typeof api
