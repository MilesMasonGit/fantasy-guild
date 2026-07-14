import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMAGE_RE = /\.(png|webp|jpe?g|gif|svg)$/i;

// Walk public/assets and list every image as a web path ("assets/heroes/hm_fighter.png").
// The AssetPreloader fetches this list at boot to warm the browser cache before first render.
function scanAssetImages() {
    const publicRoot = path.resolve(__dirname, 'public');
    const assetsDir = path.join(publicRoot, 'assets');
    const results = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (IMAGE_RE.test(entry.name)) {
                results.push(path.relative(publicRoot, full).split(path.sep).join('/'));
            }
        }
    };
    if (fs.existsSync(assetsDir)) walk(assetsDir);
    return results;
}

function assetManifestPlugin() {
    return {
        name: 'asset-image-manifest',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url && req.url.split('?')[0] === '/asset-manifest.json') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(scanAssetImages()));
                } else {
                    next();
                }
            });
        },
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'asset-manifest.json',
                source: JSON.stringify(scanAssetImages())
            });
        }
    };
}

export default defineConfig({
    // Honor an externally assigned port (e.g. tooling that sets PORT) so two
    // dev servers can run side-by-side; falls back to Vite's default 5173.
    server: {
        port: Number(process.env.PORT) || 5173
    },
    plugins: [react(), assetManifestPlugin()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    esbuild: {
        loader: "jsx",
        include: /src\/.*\.jsx?$/,
        exclude: []
    }
});
