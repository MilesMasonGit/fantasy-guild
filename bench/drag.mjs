// Fantasy Guild drag-reliability bench (`npm run bench:drag`): N real drags of each kind on a busy
// S2 mat, in the installed Chrome, headless. The drags are REAL browser input
// (`Input.dispatchMouseEvent`: press, stepped moves, release), never JavaScript-made events, so
// the browser's own hit-testing decides what the press lands on; that is where "something is
// blocking the drag" bugs live.
//
//   npm run bench:drag                  perf build, 50 drags per kind, plain pass + overlay pass
//   npm run bench:drag -- --n=20        drags per kind and pass
//   npm run bench:drag -- --kinds=token,flag
//   npm run bench:drag -- --no-overlays skip the pass with speech bubbles showing
//   npm run bench:drag -- --dev         the dev build instead (React component names for blockers)
//   npm run bench:drag -- --no-build    reuse dist-perf/
//   npm run bench:drag -- --cpu=4       CPU slowdown
//
// Exit codes: 0 every kind 100 % · 1 any kind below 100 % · 3 the bench failed.
// It reports drag bugs; it does not fix them.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startDevServer, startPerfServer, buildPerf, perfBuildInfo } from './browser/servers.mjs';
import { SCENES, sceneUrl, openBoard, clickUntil, BANK_OPEN, SHOP_OPEN } from './browser/scenes.mjs';
import { installDragKit } from './browser/dragKit.mjs';
import { parseArgs, KINDS, summarise, exitCode, dragPath, EXIT } from './browser/dragLib.mjs';
import { table } from './browser/drawLib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const resultsDir = path.join(here, 'results', 'drag');

const STEP_MS = 16;          // one pointer move per frame, roughly
const HOVER_MS = 80;         // the pointer rests on the source before the press, as a hand does
const SETTLE_MS = 450;       // after the release: the drop handler, the state, the re-render

function gitInfo() {
    const run = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    try {
        return {
            commit: run('git rev-parse --short HEAD'),
            branch: run('git rev-parse --abbrev-ref HEAD'),
            dirty: { src: run('git status --porcelain -- src').length > 0, bench: run('git status --porcelain -- bench').length > 0 }
        };
    } catch { return { commit: 'unknown', branch: 'unknown', dirty: null }; }
}

/**
 * One real drag: hover, press, stepped moves past the activation distance, release. Returns what
 * the browser hit at the press (read after the hover, since hovering can change what is on top)
 * and what was in the hand just before the release.
 */
async function realDrag(page, from, to) {
    await page.mouse('mouseMoved', from.x, from.y);
    await sleep(HOVER_MS);
    const under = await page.evaluate(`window.__dragKit.describeAt(${from.x}, ${from.y})`);
    await page.evaluate('window.__dragKit.resetProbe()');
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(STEP_MS);
    for (const p of dragPath(from, to)) {
        await page.mouse('mouseMoved', p.x, p.y, { button: 'left', buttons: 1 });
        await sleep(STEP_MS);
    }
    await sleep(40);
    const inHand = await page.evaluate('window.__dragKit.inHand()');
    const underTarget = await page.evaluate(`({ ...window.__dragKit.describeAt(${to.x}, ${to.y}), droppables: window.__dragKit.droppablesAt(${to.x}, ${to.y}) })`);
    await page.mouse('mouseReleased', to.x, to.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(SETTLE_MS);
    return { under, inHand, underTarget };
}

/** Bring the UI a kind needs: everything closed (mat), the Shop open, or the Bank open. */
async function arrange(page, needs) {
    const isOpen = async (expr) => !!(await page.evaluate(expr));
    const closed = (expr) => `!(${expr})`;
    if (needs !== 'shop' && await isOpen(SHOP_OPEN)) await clickUntil(page, 'button[aria-label="Shop"]', closed(SHOP_OPEN), 'the Shop to close');
    if (needs !== 'bank' && await isOpen(BANK_OPEN)) await clickUntil(page, 'button[aria-label="Item Bank"]', closed(BANK_OPEN), 'the Bank to close');
    if (needs === 'shop' && !await isOpen(SHOP_OPEN)) await clickUntil(page, 'button[aria-label="Shop"]', SHOP_OPEN, 'the Shop to open');
    if (needs === 'bank' && !await isOpen(BANK_OPEN)) await clickUntil(page, 'button[aria-label="Item Bank"]', BANK_OPEN, 'the Bank to open');
    if (needs === 'shop') {
        await page.evaluate('window.__dragKit.ensureShopFunds()');
        await sleep(300);
    }
    if (needs === 'bank') {
        await page.waitFor(`!!document.querySelector('button[title*=" — drag to sort"]')`, { timeoutMs: 8000, what: 'the Bank to show items' });
    }
    // Close any hero sheet a previous kind opened (an equip drop opens the hero's sheet).
    await page.key('Escape', 'Escape', 27);
    await sleep(600);
}

async function attempt(page, kind) {
    const pick = await page.evaluate(`window.__dragKit.pick.${kind.id}()`);
    if (pick.skip) return { skipped: pick.skip };
    const { under, inHand, underTarget } = await realDrag(page, pick.source, pick.target);
    let probe = await page.evaluate('window.__dragKit.readProbe()');
    let stuck = false;
    if (probe.stillDragging) {
        // A drag that did not end: release again and wait, so it cannot spoil the next one.
        await page.mouse('mouseReleased', pick.target.x, pick.target.y, { button: 'left', buttons: 0, clickCount: 1 });
        await sleep(SETTLE_MS);
        stuck = true;
        probe = await page.evaluate('window.__dragKit.readProbe()');
    }
    const check = await page.evaluate(`window.__dragKit.check(${JSON.stringify(pick.expect)})`);
    return {
        source: pick.source, target: pick.target, under, inHand, wrongThing: !!inHand && inHand !== pick.source.hand,
        pickedUp: probe.pickedUp, pressToStartMs: probe.pressToStartMs, thresholdToStartMs: probe.thresholdToStartMs,
        notes: probe.notes, stuck, dropSound: probe.dropSound, underTarget, msSinceOverlayBurst: probe.msSinceOverlayBurst,
        ok: !!check.ok && probe.pickedUp && inHand === pick.source.hand, detail: check.detail
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const started = Date.now();
    const meta = { ...gitInfo(), date: new Date().toISOString(), node: process.version, machine: os.hostname(), cpu: os.cpus()[0]?.model?.trim(), args };
    const kinds = KINDS.filter(k => !args.kinds || args.kinds.includes(k.id));
    const passes = args.overlays ? ['plain', 'overlays'] : ['plain'];
    console.log(`Fantasy Guild drag bench — ${meta.commit} on ${meta.branch} · ${args.build} build · CPU ${args.cpu}× · ${args.n} drags per kind and pass · ${meta.machine}`);

    let server = null;
    let chrome = null;
    let failed = false;
    const results = {};      // pass → kind → attempts
    try {
        if (args.build === 'perf') {
            if (args.buildFirst) { console.log('Building the perf build (vite build --mode perf)…'); meta.perfBuildS = buildPerf(); }
            else meta.perfBuiltAt = perfBuildInfo()?.builtAt ?? null;
            server = await startPerfServer({ port: args.port });
        } else {
            server = await startDevServer({ port: args.port });
        }
        chrome = await launchChrome({ width: 1600, height: 1000 });
        meta.chrome = { product: chrome.info.product, gpu: chrome.info.gpu };
        const page = await openBoard(chrome, sceneUrl(server.url, SCENES.S2), { cpu: args.cpu, stress: 'realistic' });
        try {
            await sleep(5000);
            // The Perf HUD is the harness's own overlay (bottom left), not part of the game: it would
            // block presses on the Shop's lower rows.
            await page.evaluate('window.__perf.hideHud(), true');
            await page.evaluate(`(${installDragKit.toString()})()`);
            meta.equipStock = await page.evaluate('window.__dragKit.ensureEquipStock()');
            for (const pass of passes) {
                results[pass] = {};
                if (pass === 'overlays') {
                    const c = await page.evaluate('window.__dragKit.startOverlays()');
                    await sleep(800);
                    meta.overlays = { ...c, after: await page.evaluate('window.__dragKit.overlayCounts()') };
                    console.log(`\nPass: overlays (speech bubbles re-raised every 2.5 s on every hero; ${meta.overlays.after.alerts} callouts on the mat)`);
                } else {
                    console.log('\nPass: plain (S2 as it is)');
                }
                for (const kind of kinds) {
                    await arrange(page, kind.needs);
                    const list = [];
                    process.stdout.write(`  ${kind.label.padEnd(22)} `);
                    for (let i = 0; i < args.n; i++) {
                        let a;
                        try {
                            a = await attempt(page, kind);
                        } catch (err) {
                            a = { error: err.message.split('\n')[0] };
                        }
                        list.push(a);
                        process.stdout.write(a.skipped ? 's' : a.error ? 'E' : a.ok ? '.' : 'x');
                    }
                    const s = summarise(list);
                    console.log(` ${s.successes}/${s.attempts}${s.skipped ? ` (${s.skipped} skipped)` : ''}`);
                    results[pass][kind.id] = list;
                }
                if (pass === 'overlays') await page.evaluate('window.__dragKit.stopOverlays()');
            }
            meta.pageErrors = page.consoleErrors.slice(0, 10);
            if (page.navigations > 1) { console.log(`⚠ the page reloaded during the run (${page.navigations} loads)`); failed = true; }
        } finally {
            await page.close();
        }
    } catch (err) {
        console.error(`\n✗ The bench failed: ${err?.stack || err}`);
        failed = true;
    } finally {
        if (chrome) {
            const c = await chrome.close();
            meta.chromeClosed = c;
            if (!c.exited || !c.profileRemoved) console.log(`⚠ Chrome cleanup: exited ${c.exited}, profile removed ${c.profileRemoved} (${c.profileDir})`);
        }
        if (server) await server.close();
    }

    // ---- Report ----
    const summaries = {};
    const ms = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
    for (const [pass, byKind] of Object.entries(results)) {
        const lines = [];
        for (const kind of kinds) {
            if (!byKind[kind.id]) continue;
            const s = summarise(byKind[kind.id]);
            summaries[`${pass}/${kind.id}`] = s;
            lines.push([kind.label, s.attempts, s.successes, s.successPct === null ? '—' : `${s.successPct.toFixed(1)} %`,
                `${ms(s.pickupP50)} / ${ms(s.pickupP95)}`, `${ms(s.thresholdP50)} / ${ms(s.thresholdP95)}`, s.skipped || '']);
        }
        console.log(`\n${pass}\n${table(['kind', 'attempts', 'ok', 'success', 'press→start p50/p95 ms', '8px move→start p50/p95 ms', 'skipped'], lines)}`);
        for (const kind of kinds) {
            const s = summaries[`${pass}/${kind.id}`];
            if (!s?.failures.length) continue;
            console.log(`  ${kind.label}:`);
            for (const f of s.failures) {
                const ex = f.example;
                const where = ex?.source ? ` (e.g. ${ex.source.what} pressed at ${ex.source.x},${ex.source.y}${ex.inHand ? `; in hand: ${ex.inHand}` : ''}${ex.under?.react?.length ? `; React: ${ex.under.react.join(' < ')}` : ''})` : '';
                console.log(`    ${String(f.count).padStart(3)} × ${f.cause}${where}`);
            }
        }
    }
    console.log(`\npress→start includes the bench's own ${STEP_MS} ms wait and two pointer moves before the 8 px threshold is crossed; 8px move→start is the game's own pickup delay after it is crossed.`);

    const elapsedS = (Date.now() - started) / 1000;
    fs.mkdirSync(resultsDir, { recursive: true });
    const file = path.join(resultsDir, `drag-${meta.date.replace(/[:.]/g, '-')}-${meta.commit}.json`);
    fs.writeFileSync(file, JSON.stringify({ meta: { ...meta, elapsedS }, summaries, attempts: results }, null, 2));
    console.log(`\nWrote ${path.relative(root, file)} (${elapsedS.toFixed(0)} s).`);
    process.exit(exitCode(summaries, failed || !Object.keys(summaries).length));
}

main().catch(err => {
    console.error(err?.stack || err);
    runCleanups();
    process.exit(EXIT.BENCH_FAILED);
});
