import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cmsFileApi from './vite-plugin-cms-api.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), cmsFileApi()],
  server: {
    port: 5174,
  },
})
