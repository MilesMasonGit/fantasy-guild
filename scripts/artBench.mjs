/**
 * The art bench: a dev-only page for judging brightness presets, ground,
 * scatter and tint on real game art (`npm run art:bench`).
 *
 * ⚠️ Never part of the game build. The page lives in `tools/art-bench/`, not
 * in `public/` (Vite copies all of `public/` into `dist/`), the server half is
 * `apply: 'serve'`, and the build half deletes `dist/_gen/art-bench/` because
 * the brightness script's previews are written under `public/_gen/` and would
 * otherwise be copied into the build. `src/tests/artBench.test.js` guards all
 * three.
 *
 * Previews: the brightness script writes `public/_gen/art-bench/<preset id>/<path
 * under public/assets>` and may write `public/_gen/art-bench/presets.json`
 * (`[{ id, label, brightness, saturation, threshold }]`). The page uses a
 * preview file where one exists and a live CSS filter otherwise.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BENCH_URL = '/art-bench/';
export const LIST_URL = '/__art-bench/list';
export const PREVIEW_DIR = ['public', '_gen', 'art-bench'];
export const PAGE_FILE = ['tools', 'art-bench', 'index.html'];

function walkPngs(dir) {
    const out = [];
    const walk = (d) => {
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.png$/i.test(e.name)) out.push(path.relative(dir, full).split(path.sep).join('/'));
        }
    };
    walk(dir);
    return out.sort();
}

/** What the page needs: every PNG under public/assets, the previews, and the script's presets. */
export function listArtBench(root = DEFAULT_ROOT) {
    const previewDir = path.join(root, ...PREVIEW_DIR);
    let presets = null;
    try {
        presets = JSON.parse(fs.readFileSync(path.join(previewDir, 'presets.json'), 'utf-8'));
    } catch { /* no presets file yet: the page uses its built-in four */ }
    return {
        assets: walkPngs(path.join(root, 'public', 'assets')),
        previews: walkPngs(previewDir),
        presets
    };
}

/** Removes the bench's previews from a finished build. */
export function stripPreviewsFromBuild(outDir) {
    const dir = path.join(outDir, ...PREVIEW_DIR.slice(1));
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function artBenchPlugin({ root = DEFAULT_ROOT } = {}) {
    let outDir = path.join(root, 'dist');
    return [
        {
            name: 'art-bench',
            apply: 'serve',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const url = (req.url || '').split('?')[0];
                    if (url === BENCH_URL || url === '/art-bench' || url === '/art-bench/index.html') {
                        if (url === '/art-bench') {
                            res.statusCode = 302;
                            res.setHeader('Location', BENCH_URL);
                            res.end();
                            return;
                        }
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-store');
                        res.end(fs.readFileSync(path.join(root, ...PAGE_FILE), 'utf-8'));
                    } else if (url === LIST_URL) {
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('Cache-Control', 'no-store');
                        res.end(JSON.stringify(listArtBench(root)));
                    } else {
                        next();
                    }
                });
            }
        },
        {
            name: 'art-bench-build-guard',
            apply: 'build',
            configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
            closeBundle() { stripPreviewsFromBuild(outDir); }
        }
    ];
}

// `npm run art:bench`: a small server of its own (own port and cache folder, so
// it runs beside `npm run dev`), serving only public/ and the bench.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const { createServer } = await import('vite');
    const server = await createServer({
        configFile: false,
        root: DEFAULT_ROOT,
        publicDir: 'public',
        cacheDir: 'node_modules/.vite-art-bench',
        appType: 'custom',
        plugins: [artBenchPlugin({ root: DEFAULT_ROOT })],
        optimizeDeps: { noDiscovery: true, include: [], entries: [] },
        server: { port: Number(process.env.PORT) || 5190, open: process.env.ART_BENCH_NO_OPEN ? false : BENCH_URL }
    });
    await server.listen();
    const addr = server.resolvedUrls?.local?.[0] || 'http://localhost:5190/';
    console.log(`\n  Art bench: ${addr.replace(/\/$/, '')}${BENCH_URL}\n  (Ctrl+C to stop)\n`);
}
