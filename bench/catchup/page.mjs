// Fantasy Guild bench — a long catch-up timed in the REAL page (offline progress, brief 40 O1).
//
// The perf build (production React + the perf harness) in headless Chrome, the S2 stress board,
// the whole UI mounted and listening. After the bench's 20 s settle it stops the live loop, puts a
// virtual wall clock in place (Date.now() moves with game time, as in bench/lib/prelude.mjs) and
// times N game-hours of `GameLoop.runHandlers(step)` run synchronously in the page.
//
// Modes, alternated on fresh tabs so they are measured back to back:
//   ui     every listener the page has (the UI's included);
//   muted  an ESTIMATE of a catch-up with the UI's listeners muted: each event keeps only as many
//          listeners as the engine alone registers headless (`time.mjs --listeners`), the first
//          ones in subscription order (engine modules subscribe before React mounts). It may keep
//          or drop the wrong one on a few events, so its work is not proven identical. Replace it
//          with the engine's own mute once offline progress has one.
//
//   node bench/catchup/page.mjs                       1 game-hour at 1000 ms, ui/muted × 3
//   node bench/catchup/page.mjs --hours=24 --modes=muted,ui --no-build
//   node bench/catchup/page.mjs --step=100 --hours=1
//
// Builds dist-perf/ first unless --no-build. Chrome, the server and the profile are cleaned up on
// every way out (bench/browser/cdp.mjs).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, runCleanups } from '../browser/cdp.mjs';
import { buildPerf, startPerfServer } from '../browser/servers.mjs';
import { openBoard, sceneUrl, SCENES } from '../browser/scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
}));
const hours = Number(args.hours) || 1;
const step = Number(args.step) || 1000;
const modes = String(args.modes || 'ui,muted,ui,muted,ui,muted').split(',');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function engineListeners() {
    const res = spawnSync(process.execPath, [path.join(here, 'time.mjs'), '--listeners'], { cwd: root, encoding: 'utf8', windowsHide: true });
    const line = (res.stdout || '').trim().split('\n').pop();
    if (res.status !== 0 || !line?.startsWith('{')) throw new Error(`time.mjs --listeners failed: ${res.stderr || res.stdout}`);
    return JSON.parse(line);
}

const inPage = (mode, keep) => `(() => {
    window.__perf.stop();                 // unwrap runHandlers: no per-tick timing probe
    const g = window.__perf.game;
    g.GameLoop.stop();                    // no wall-clock ticks in between
    if (${JSON.stringify(mode)} === 'muted') {
        const keep = ${JSON.stringify(keep)};
        for (const [name, set] of [...g.EventBus.subscribers]) {
            g.EventBus.subscribers.set(name, new Set([...set].slice(0, keep[name] || 0)));
        }
    }
    let listeners = 0;
    for (const set of g.EventBus.subscribers.values()) listeners += set.size;
    const tokens = g.BoardState.tokens().length;
    const steps = Math.round(${hours} * 3600000 / ${step});
    const realNow = Date.now; let vNow = realNow(); Date.now = () => vNow;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) { vNow += ${step}; g.GameLoop.runHandlers(${step}); }
    const ms = performance.now() - t0;
    Date.now = realNow;
    return { mode: ${JSON.stringify(mode)}, steps, seconds: ms / 1000, msPerStep: ms / steps, tokens, listeners };
})()`;

let server;
let chrome;
let code = 0;
try {
    const keep = modes.includes('muted') ? engineListeners() : {};
    if (!args['no-build']) { console.log('Building the perf build…'); buildPerf(); }
    server = await startPerfServer({});
    chrome = await launchChrome({ width: 1600, height: 1000 });
    console.log(`Chrome ${chrome.info.product} · S2 · ${hours} game-hour(s) at ${step} ms steps`);
    for (const mode of modes) {
        const page = await openBoard(chrome, sceneUrl(server.url, SCENES.S2), { stress: 'realistic' });
        await sleep(20_000);   // the draw bench's settle: heroes walk to their work
        const r = await page.evaluate(inPage(mode, keep), { timeoutMs: 900_000 });
        console.log(`  ${r.mode.padEnd(5)}  ${r.seconds.toFixed(2).padStart(7)} s  ${r.msPerStep.toFixed(3)} ms/step  ${r.steps} steps  ${r.tokens} Tokens  ${r.listeners} listeners`);
        await page.close();
    }
} catch (err) {
    console.error(`✗ ${err?.stack || err}`);
    code = 3;
} finally {
    try { await chrome?.close(); } catch { /* cleaned below */ }
    try { await server?.close(); } catch { /* cleaned below */ }
    runCleanups();
}
process.exit(code);
