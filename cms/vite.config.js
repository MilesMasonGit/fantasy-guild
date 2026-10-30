import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cmsFileApi from './vite-plugin-cms-api.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), cmsFileApi({ dataDir: process.env.CMS_DATA_DIR })],
  // The ledger's Worker (src/engine/ledgerWorker.js) is a module, like the page.
  worker: { format: 'es' },
  server: {
    port: Number(process.env.PORT) || 5174,
  },
})
