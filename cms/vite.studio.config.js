import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'
import cmsFileApi from './vite-plugin-cms-api.js'

/**
 * The Studio (`npm run studio`): Recolor and Animation on their own port, beside the CMS. It shares
 * the CMS's file API in Studio mode, which refuses every game-data route.
 */

/** Serve the Studio's page at `/`: the default `index.html` is the whole CMS. */
const studioPage = {
  name: 'studio-page',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/' || req.url === '/index.html') req.url = '/studio.html'
      next()
    })
  },
}

export default defineConfig({
  plugins: [studioPage, react(), tailwindcss(), cmsFileApi({ studio: true, palettesDir: process.env.STUDIO_PALETTES_DIR })],
  cacheDir: 'node_modules/.vite-studio',
  server: {
    port: Number(process.env.STUDIO_PORT) || 5175,
    strictPort: true,
  },
  build: {
    outDir: 'dist-studio',
    rollupOptions: { input: 'studio.html' },
  },
})
