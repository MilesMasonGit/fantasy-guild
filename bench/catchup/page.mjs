// Fantasy Guild bench — a long catch-up timed in the REAL page (offline progress, brief 40 O1).
//
// The perf build (production React + the perf harness) in headless Chrome, the S2 stress board,
// the whole UI mounted and listening. After the bench's 20 s settle it stops the live loop, puts a
// virtual wall clock in place (Date.now() moves with game time, as in bench/lib/prelude.mjs) and
// times N game-hours of `GameLoop.runHandlers(step)` run synchronously in the page.
//
// Modes, alternated on fresh tabs so they are measured back to back:
//   ui     every listener the page has (the UI's included);
//   muted  the bus quiet (`EventBus.setQuiet`): every listener tagged `UI_LISTENER` is skipped,
//          the engine's own still run.
//
//   node bench/catchup/page.mjs                       1 game-hour at 1000 ms, ui/muted × 3
//   node bench/catchup/page.mjs --hours=24 --modes=muted,ui --no-build
//   node bench/catchup/page.mjs --step=100 --hours=1
//
// Builds dist-perf/ first unless --no-build. Chrome, the server and the profile are cleaned up on
// every way out (bench/browser/cdp.mjs).

import { launchChrome, runCleanups } from '../browser/cdp.mjs';
import { buildPerf, startPerfServer } from '../browser/servers.mjs';
import { openBoard, sceneUrl, SCENES } from '../browser/scenes.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
}));
const hours = Number(args.hours) || 1;
const step = Number(args.step) || 1000;
const modes = String(args.modes || 'ui,muted,ui,muted,ui,muted').split(',');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const inPage = (mode) => `(() => {
    window.__perf.stop();                 // unwrap runHandlers: no per-tick timing probe
    const g = window.__perf.game;
    g.GameLoop.stop();                    // no wall-clock ticks in between
    const muted = ${JSON.stringify(mode)} === 'muted';
    g.EventBus.setQuiet(muted);
    let listeners = 0;
    for (const set of (muted ? g.EventBus.engineSubscribers : g.EventBus.subscribers).values()) listeners += set.size;
    const tokens = g.BoardState.tokens().length;
    const steps = Math.round(${hours} * 3600000 / ${step});
    const realNow = Date.now; let vNow = realNow(); Date.now = () => vNow;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) { vNow += ${step}; g.GameLoop.runHandlers(${step}); }
    const ms = performance.now() - t0;
    Date.now = realNow;
    g.EventBus.setQuiet(false);
    return { mode: ${JSON.stringify(mode)}, steps, seconds: ms / 1000, msPerStep: ms / steps, tokens, listeners };
})()`;

let server;
let chrome;
let code = 0;
try {
    if (!args['no-build']) { console.log('Building the perf build…'); buildPerf(); }
    server = await startPerfServer({});
    chrome = await launchChrome({ width: 1600, height: 1000 });
    console.log(`Chrome ${chrome.info.product} · S2 · ${hours} game-hour(s) at ${step} ms steps`);
    for (const mode of modes) {
        const page = await openBoard(chrome, sceneUrl(server.url, SCENES.S2), { stress: 'realistic' });
        await sleep(20_000);   // the draw bench's settle: heroes walk to their work
        const r = await page.evaluate(inPage(mode), { timeoutMs: 900_000 });
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
