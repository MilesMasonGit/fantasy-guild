// Fantasy Guild bench — how long a long catch-up takes (offline progress, brief 40 O1).
//
// Builds S2 (bench/scenarios/realistic.mjs) and drives the real engine through
// `GameLoop.runHandlers(step)` for N game-hours, headless, with the bench's seeded randomness
// and virtual wall clock. Prints the wall time at each checkpoint and the readable fingerprint
// totals, so two step sizes can be compared for speed AND for what the board produced.
//
//   node --expose-gc bench/catchup/time.mjs                      24 h at 1000 ms steps
//   node --expose-gc bench/catchup/time.mjs --step=100           today's tick
//   node --expose-gc bench/catchup/time.mjs --hours=1,6,24 --step=500 --out=run.json
//   node --expose-gc --cpu-prof --cpu-prof-dir=prof bench/catchup/time.mjs --hours=6
//   node bench/catchup/time.mjs --listeners                     the engine's listeners per event
//
// ⚠️ Node runs the engine through Vite's SSR loader, about twice as slow as the shipped build in
// a page (measured 2026-10-08): use `page.mjs` for "is it under 30 s", this for comparisons.
// ⚠️ For --cpu-prof, leave --cpu-prof-name unset: Node 24 profiles the module-loader thread too,
// and a fixed name lets that idle profile overwrite the main thread's. Read the `.0.` file.

import '../lib/prelude.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
}));
const opts = {
    stepMs: Number(args.step) || 1000,
    checkpointsMin: String(args.hours || '1,6,24').split(',').map(h => Math.round(Number(h) * 60)),
    seed: Number(args.seed) || 1,
    warmupTicks: Number(args.warmup) || 0
};

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
    resolve: { alias: { '@': path.join(root, 'src') } }
});

let code = 0;
try {
    const harness = await server.ssrLoadModule('/bench/catchup/harness.mjs');
    if (args.listeners) {
        // For page.mjs: the engine's own listener count per event, as JSON on one line.
        process.stdout.write(`${JSON.stringify(harness.engineListenerCounts(opts.seed))}\n`);
        await server.close().catch(() => {});
        process.exit(0);
    }
    const result = await harness.run(opts);
    // The harness silences console.* (engine noise), so the report goes straight to stdout.
    const say = (line) => process.stdout.write(`${line}\n`);
    say(`S2 · step ${opts.stepMs} ms · seed ${opts.seed} · Node ${process.version} · build ${result.buildMs.toFixed(0)} ms`);
    say('game h   steps      wall s   ms/step   tokens   bank items   hero XP   cycles   random draws');
    for (const c of result.checkpoints) {
        say([
            String(c.gameMin / 60).padStart(6), String(c.steps).padStart(8), c.wallS.toFixed(1).padStart(10),
            c.msPerStep.toFixed(3).padStart(8), String(c.fingerprint.tokens).padStart(8),
            String(c.fingerprint.bankItems).padStart(12), String(c.fingerprint.heroXp).padStart(9),
            String(c.cycles).padStart(8), String(c.fingerprint.randomDraws).padStart(14)
        ].join(' '));
    }
    if (args.out) fs.writeFileSync(String(args.out), JSON.stringify({ opts, ...result }, null, 2));
} catch (err) {
    process.stderr.write(`[catchup] failed: ${err?.stack || err}\n`);
    code = 1;
}
await server.close().catch(() => {});
process.exit(code);
