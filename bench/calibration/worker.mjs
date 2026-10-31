// One calibration setup in its own Node process (spawned by `bench/calibrate.mjs`), loaded through
// Vite as the bench's worker loads a scenario (`bench/worker.mjs`): the engine needs Vite's
// `import.meta.glob`, and a fresh process means fresh module state.
//
//   node bench/calibration/worker.mjs '<json options>' <out.json>

import '../lib/prelude.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const opts = JSON.parse(process.argv[2] || '{}');
const outFile = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    clearScreen: false,
    // Its own cache, in the git-ignored results folder, so a dev server or the bench keeps theirs.
    cacheDir: path.join(root, 'bench', 'results', '.vite-calibration'),
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    resolve: { alias: { '@': path.join(root, 'src') } }
});

let exitCode = 0;
try {
    const engine = await server.ssrLoadModule('/bench/calibration/engine.mjs');
    const result = await engine.runSetup({ ...opts, root });
    fs.writeFileSync(outFile, JSON.stringify(result));
} catch (err) {
    process.stderr.write(`[calibration worker] ${opts.id} failed: ${err?.stack || err}\n`);
    exitCode = 1;
}
await server.close().catch(() => {});
process.exit(exitCode);
