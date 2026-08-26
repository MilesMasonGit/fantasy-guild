import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The app version, taken from package.json at build time and injected as
// `__APP_VERSION__` (CR2-145).
//
// ⚠️ CLAUDE.md requires the version to be bumped in five files together. The
// Settings screen used to print a *sixth* copy, typed by hand, and it had
// drifted to "v0.9.0" while the five real files all said 0.6.0. Reading it
// from here means there is no sixth copy to forget.
//
// ⚠️ This is the APP version. It is NOT `GAME_VERSION` in `state/StateSchema.js`,
// which is the *save format* version and moves on its own schedule — they are
// deliberately different numbers and must not be reconciled.
const packageVersion = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
).version;

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
    define: {
        __APP_VERSION__: JSON.stringify(packageVersion)
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
