// Fantasy Guild bench — one scenario run, in its own Node process.
//
// Spawned by `bench/run.mjs`. A fresh process per run means fresh module state
// (the engine keeps runtime maps at module level), a clean heap to measure, and
// JIT warmth that comes only from the scenario's own warm-up.
//
// The engine uses Vite-only features (`import.meta.glob` in DatabaseManager), so
// it cannot be imported by plain Node. This process starts a Vite server in
// middleware mode — no HTTP, no watcher — and loads the harness through Vite's
// SSR module loader, which is the same transform Vitest uses, in plain Node
// (never jsdom).
//
// Usage (normally via run.mjs):
//   node --expose-gc bench/worker.mjs '<json options>' <out.json>

import './lib/prelude.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { instrumentPlugin } from './lib/instrument-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const opts = JSON.parse(process.argv[2] || '{}');
const outFile = process.argv[3];

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    clearScreen: false,
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    resolve: { alias: { '@': path.join(root, 'src') } },
    plugins: opts.mode === 'profile' ? [instrumentPlugin(root)] : []
});

let exitCode = 0;
try {
    const harness = await server.ssrLoadModule('/bench/lib/harness.mjs');
    const scenario = (await server.ssrLoadModule(`/bench/scenarios/${opts.file}`)).default;
    const result = await harness.run({ ...opts, scenario });
    fs.writeFileSync(outFile, JSON.stringify(result));
} catch (err) {
    process.stderr.write(`[bench worker] ${opts.file} failed: ${err?.stack || err}\n`);
    exitCode = 1;
}
await server.close().catch(() => {});
// Exit explicitly: engine timers (notifications, anything scheduled) must not
// keep a finished run alive.
process.exit(exitCode);
