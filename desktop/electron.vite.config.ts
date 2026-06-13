import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// The VS Code-independent core lives at the repo root in `../src` (one level up
// from `desktop/`). The Electron main process imports it directly; vite bundles
// it in and resolves the core's `.js` import specifiers to their `.ts` sources.
const core = resolve('../src')
const shared = resolve('src/shared')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@core': core,
        '@shared': shared
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: {
        '@shared': shared
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react()]
  }
})
