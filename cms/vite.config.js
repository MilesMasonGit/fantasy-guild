import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'
import cmsFileApi from './vite-plugin-cms-api.js'

// CMS_SANDBOX_DIR runs this server on a throwaway folder (data, plan, workspace, backups, inbox); see cms/README.md.
export default defineConfig({
  plugins: [react(), tailwindcss(), cmsFileApi({ dataDir: process.env.CMS_DATA_DIR, sandboxDir: process.env.CMS_SANDBOX_DIR })],
  // The ledger's Worker (src/engine/ledgerWorker.js) is a module, like the page.
  worker: { format: 'es' },
  // A second CMS server beside the owner's needs its own cache folder.
  ...(process.env.CMS_CACHE_DIR ? { cacheDir: process.env.CMS_CACHE_DIR } : {}),
  server: {
    port: Number(process.env.PORT) || 5174,
  },
})
