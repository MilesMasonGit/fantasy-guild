// Fantasy Guild memory soak (`npm run bench:soak`): does the real page (React, the DOM, listeners,
// canvases) grow while the game idles for a long time, and does it stop drawing while hidden?
// The engine bench's S6 says the engine alone keeps a steady heap; this is the whole page, in the
// installed Chrome, headless, real GPU, on the perf build (as `bench:draw`).
//
//   npm run bench:soak                               cap128, 30 min, a sample a minute, hidden 5 min in the middle
//   npm run bench:soak -- --minutes=60 --hidden=10   longer
//   npm run bench:soak -- --scene=S2                 another board (any bench:draw scene)
//   npm run bench:soak -- --every=30                 seconds between samples (at least 10)
//   npm run bench:soak -- --hidden=0                 no hidden phase
//   npm run bench:soak -- --warmup=3                 minutes left out of the fit (default a tenth of the run, at most 5)
//   npm run bench:soak -- --snapshot                 heap snapshots at the start and end of the fit, diffed by class
//   npm run bench:soak -- --compare                  compare with bench/soak-baseline.json
//   npm run bench:soak -- --save-baseline            write this run as bench/soak-baseline.json
//   npm run bench:soak -- --no-build --settle=60     reuse dist-perf/; seconds before the first sample
//
// Each sample forces two full garbage collections (`HeapProfiler.collectGarbage`), then reads
// Chrome's counters (`Performance.getMetrics`), the game's own counts (through `window.__perf`) and
// the renderer's memory. The hidden phase minimises the browser window (`Browser.setWindowBounds`),
// which in headless Chrome makes the document hidden and stops animation frames; timers keep their
// rate (the benches' Chrome runs without background throttling), as the desktop app's do.
// The thresholds and why: CONFIG at the top of bench/browser/soakLib.mjs.
//
// Exit codes: 0 ok · 1 a metric FAILED or REGRESSED, or the hidden page misbehaved · 3 the bench failed.
// ⚠️ Machine-specific, like every browser number. Never beside another bench.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startPerfServer, buildPerf, perfBuildInfo } from './browser/servers.mjs';
import { sceneFor, sceneUrl, openBoard } from './browser/scenes.mjs';
import {
    CONFIG, CDP_METRICS, EXIT, parseArgs, soakPlan, analyse, intervalsOf, hiddenCheck, compareToBaseline,
    baselineOf, baselineRefusal, settingsOf, sampleHeader, sampleRow, slopesTable, hiddenText, table, fmt, round
} from './browser/soakLib.mjs';
import { classSummary, diffClasses } from './browser/heapSnapshot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const resultsDir = path.join(here, 'results');
const baselineFile = path.join(here, 'soak-baseline.json');

function gitInfo() {
    const run = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    try {
        const dirtyIn = (p) => run(`git status --porcelain -- ${p}`).length > 0;
        return {
            commit: run('git rev-parse --short HEAD'),
            branch: run('git rev-parse --abbrev-ref HEAD'),
            dirty: { src: dirtyIn('src'), data: dirtyIn('data'), bench: dirtyIn('bench'), public: dirtyIn('public') }
        };
    } catch {
        return { commit: 'unknown', branch: 'unknown', dirty: null };
    }
}

// ---------------------------------------------------------------------------
// The page's own counts
// ---------------------------------------------------------------------------

// Read in the page at every sample, before the forced GC (so what it allocates is collected).
// The Perf HUD's window is reset here, so its frames and ticks are the interval's since the last
// sample. ⚠️ An envelope scene's sampler keeps every 500 ms reading in page arrays; they are
// emptied here, or the soak would measure its own bookkeeping.
const PAGE_PROBE = `(() => {
    const P = window.__perf;
    const G = P && P.game;
    const out = {
        visibility: document.visibilityState,
        drawingPaused: P && 'drawingPaused' in P ? P.drawingPaused : null,
        elements: document.getElementsByTagName('*').length,
        viewport: innerWidth + 'x' + innerHeight
    };
    const tryN = (f) => { try { const v = f(); return Number.isFinite(v) ? v : null; } catch { return null; } };
    if (G) {
        out.tokens = tryN(() => G.BoardState.tokens().length);
        out.heroes = tryN(() => (G.GameState.heroes || []).length);
        out.sprites = tryN(() => G.SpriteLayer.getSprites().length);
        out.notifications = tryN(() => G.NotificationSystem.getQueue().length);
        out.stubs = tryN(() => G.ItemStubs.getStubs().length);
        out.banners = tryN(() => G.Banners.getView().shown.length);
        try {
            const subs = G.EventBus.subscribers, engine = G.EventBus.engineSubscribers;
            let total = 0, events = 0, engineTotal = 0;
            const top = [];
            for (const [name, set] of subs) if (set.size) { total += set.size; events++; top.push([name, set.size]); }
            for (const set of (engine ? engine.values() : [])) engineTotal += set.size;
            top.sort((a, b) => b[1] - a[1]);
            out.bus = { total, events, engine: engineTotal, top: top.slice(0, 12) };
        } catch { out.bus = null; }
    }
    if (P && P.running) {
        try {
            const r = P.report();
            out.interval = {
                seconds: r.window.seconds, frames: r.frames.count, workP50: r.frameWork.p50, workP99: r.frameWork.p99,
                ticksPerS: r.tick.perSecond, hiddenS: r.window.hiddenSeconds, eventsPerS: r.events.perSecond
            };
        } catch { out.interval = null; }
        P.reset();
    }
    for (const k of ['__envSamples', '__envFlows', '__envBanners']) if (Array.isArray(window[k])) window[k].length = 0;
    return out;
})()`;

// ---------------------------------------------------------------------------
// Process memory (Windows): the page's renderer and the GPU process
// ---------------------------------------------------------------------------

async function processIds(cdp) {
    try {
        const { processInfo } = await cdp.send('SystemInfo.getProcessInfo', {}, undefined, 15000);
        return processInfo.map((p) => ({ type: p.type, pid: p.id }));
    } catch {
        return [];
    }
}

/** Private and working-set memory of `pids`, in KB, by pid. Null where it cannot be read. */
function processMemory(pids) {
    if (process.platform !== 'win32' || !pids.length) return null;
    const cmd = `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { '{0} {1} {2}' -f $_.Id, $_.PrivateMemorySize64, $_.WorkingSet64 }`;
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    // ⚠️ Not the exit status: PowerShell exits 1 when any one id is gone, errors silenced or not.
    if (!r.stdout) return null;
    const out = {};
    for (const line of r.stdout.split(/\r?\n/)) {
        const [pid, priv, ws] = line.trim().split(/\s+/).map(Number);
        if (Number.isFinite(pid) && Number.isFinite(priv)) out[pid] = { privateKb: Math.round(priv / 1024), workingSetKb: Math.round(ws / 1024) };
    }
    return out;
}

function procSample(procs) {
    const pids = [...procs.renderer, ...procs.gpu];
    const mem = processMemory(pids);
    if (!mem) return null;
    const sum = (list) => {
        const got = list.map((pid) => mem[pid]).filter(Boolean);
        return got.length ? { privateKb: got.reduce((s, m) => s + m.privateKb, 0), workingSetKb: got.reduce((s, m) => s + m.workingSetKb, 0), pids: list } : null;
    };
    return { renderer: sum(procs.renderer), gpu: sum(procs.gpu) };
}

// ---------------------------------------------------------------------------

async function collectGarbage(page) {
    // Twice: the first collection's finalisers (Blink's DOM objects among them) let go of more,
    // and the DOM counters drop only once their objects are swept.
    await page.send('HeapProfiler.collectGarbage', {}, 120000);
    await page.send('HeapProfiler.collectGarbage', {}, 120000);
}

async function heapSnapshot(page, file) {
    const out = fs.createWriteStream(file);
    let bytes = 0;
    const off = page.on('HeapProfiler.addHeapSnapshotChunk', (p) => { out.write(p.chunk); bytes += p.chunk.length; });
    const t0 = Date.now();
    try {
        await page.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }, 600000);
    } finally {
        off();
        await new Promise((r) => out.end(r));
    }
    return { file, bytes, seconds: (Date.now() - t0) / 1000 };
}

async function setMinimised(chrome, windowId, page, minimised) {
    // The Perf HUD's window restarts at the switch, so the hidden interval's frames are the hidden
    // page's own, not those drawn between the sample and the switch (a heap snapshot can sit there).
    await page.evaluate('window.__perf?.running && window.__perf.reset(), true');
    await chrome.cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: minimised ? 'minimized' : 'normal' } });
    const want = minimised ? 'hidden' : 'visible';
    try {
        await page.waitFor(`document.visibilityState === ${JSON.stringify(want)}`, { timeoutMs: 10000, intervalMs: 100, what: `the page to read ${want}` });
    } catch {
        throw new Error(`headless Chrome did not make the page ${want} (Browser.setWindowBounds ${minimised ? 'minimized' : 'normal'})`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const plan = soakPlan(args);
    const scene = sceneFor(args.scene);
    const started = Date.now();
    const meta = {
        ...gitInfo(),
        date: new Date().toISOString(),
        node: process.version,
        machine: os.hostname(),
        cpu: os.cpus()[0]?.model?.trim(),
        cores: os.cpus().length,
        platform: `${os.platform()} ${os.release()}`,
        args,
        scene: { id: scene.id, name: scene.name },
        plan: { totalS: plan.totalS, hiddenStartS: plan.hiddenStartS, hiddenEndS: plan.hiddenEndS, warmupS: plan.warmupS, samples: plan.steps.length },
        thresholds: JSON.parse(JSON.stringify(CONFIG))
    };
    const stamp = `${meta.date.replace(/[:.]/g, '-')}-${meta.commit}`;
    const file = path.join(resultsDir, `soak-${stamp}.json`);
    fs.mkdirSync(resultsDir, { recursive: true });

    console.log(`Fantasy Guild memory soak — ${meta.commit} on ${meta.branch}${meta.dirty && Object.values(meta.dirty).some(Boolean) ? ` (uncommitted: ${Object.entries(meta.dirty).filter(([, v]) => v).map(([k]) => k).join(', ')})` : ''} · ${meta.machine} · ${meta.cpu}`);
    const hiddenNote = plan.hiddenStartS === null ? 'no hidden phase' : `hidden ${fmt(plan.hiddenStartS / 60, 1)}–${fmt(plan.hiddenEndS / 60, 1)} min`;
    console.log(`${scene.name} · ${args.minutes} min, a sample every ${args.every} s (${plan.steps.length} samples) · ${hiddenNote} · fit from ${fmt(args.warmup, 1)} min · settle ${args.settle} s${args.snapshot ? ' · heap snapshots' : ''}`);

    let server = null;
    let chrome = null;
    let failed = null;
    const samples = [];
    const snapshots = {};
    const writePartial = () => fs.writeFileSync(file, JSON.stringify({ partial: true, meta, samples, snapshots }, null, 1));
    try {
        if (args.build) {
            process.stdout.write('Building the perf build (vite build --mode perf)…\n');
            meta.perfBuildS = buildPerf();
        } else {
            meta.perfBuiltAt = perfBuildInfo()?.builtAt ?? null;
            console.log(`--no-build: using dist-perf/ built ${meta.perfBuiltAt?.toISOString?.() ?? '(missing)'}`);
        }
        server = await startPerfServer({ port: args.port });
        chrome = await launchChrome({ width: 1600, height: 1000 });
        meta.chrome = { product: chrome.info.product, gpu: chrome.info.gpu };
        console.log(`Chrome ${chrome.info.product} headless · GPU ${chrome.info.gpu?.device ?? '?'} · 1600×1000 at DPR 1`);

        // The page's renderer is the one that appears with it.
        const before = new Set((await processIds(chrome.cdp)).filter((p) => p.type === 'renderer').map((p) => p.pid));
        const page = await openBoard(chrome, sceneUrl(server.url, scene), { cpu: 1, stress: scene.stress, stressId: scene.stressId });
        const after = await processIds(chrome.cdp);
        const procs = {
            renderer: after.filter((p) => p.type === 'renderer' && !before.has(p.pid)).map((p) => p.pid),
            gpu: after.filter((p) => /gpu/i.test(p.type)).map((p) => p.pid)
        };
        meta.processes = procs;
        const how = scene.ui ? await scene.ui(page) : null;
        if (how) console.log(`  ${how}`);
        await page.send('Performance.enable', { timeDomain: 'timeTicks' });
        await page.send('HeapProfiler.enable');
        const { windowId } = await chrome.cdp.send('Browser.getWindowForTarget', { targetId: page.targetId });
        process.stdout.write(`Settling ${args.settle} s…\n`);
        await sleep(args.settle * 1000);
        const hasPauseGetter = await page.evaluate(`'drawingPaused' in (window.__perf || {})`);
        if (!hasPauseGetter) console.log('⚠ This build has no __perf.drawingPaused: the hidden phase cannot read the drawing clocks.');

        console.log(`\n${sampleHeader()}`);
        const t0 = Date.now();
        for (const step of plan.steps) {
            const wait = t0 + step.atS * 1000 - Date.now();
            if (wait > 0) await sleep(wait);
            if (page.navigations > 1) throw new Error(`the page reloaded during the run (${page.navigations} loads)`);
            const tS = (Date.now() - t0) / 1000;
            const probe = await page.evaluate(PAGE_PROBE);
            await collectGarbage(page);
            const { metrics } = await page.send('Performance.getMetrics');
            const all = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
            const cdp = Object.fromEntries(CDP_METRICS.map((k) => [k, all[k] ?? null]));
            const sample = { i: samples.length, plannedS: step.atS, tS, phase: step.phase, fit: step.fit, at: new Date().toISOString(), cdp, page: probe, proc: procSample(procs) };
            samples.push(sample);
            const iv = samples.length > 1 ? intervalsOf(samples.slice(-2))[0] : null;
            console.log(sampleRow(sample, iv));
            if (step.snapshot && args.snapshot) {
                const f = path.join(resultsDir, `soak-${stamp}-${step.snapshot}.heapsnapshot`);
                process.stdout.write(`  heap snapshot (${step.snapshot})…`);
                snapshots[step.snapshot] = { ...(await heapSnapshot(page, f)), atSample: sample.i };
                console.log(` ${fmt(snapshots[step.snapshot].bytes / 1048576, 0)} MB in ${fmt(snapshots[step.snapshot].seconds, 1)} s`);
            }
            if (step.then === 'hide') {
                await setMinimised(chrome, windowId, page, true);
                console.log('  — window minimised: the page is hidden —');
            } else if (step.then === 'show') {
                await setMinimised(chrome, windowId, page, false);
                console.log('  — window restored: the page is visible —');
            }
            writePartial();
        }
        meta.pageErrors = page.consoleErrors.slice(0, 10);
        meta.pageErrorCount = page.consoleErrors.length;
        await page.close();
    } catch (err) {
        console.error(`\n✗ The soak failed: ${err?.stack || err}`);
        failed = err?.message || String(err);
    } finally {
        if (chrome) {
            const c = await chrome.close();
            meta.chromeClosed = c;
            if (!c.exited || !c.profileRemoved) console.log(`⚠ Chrome cleanup: exited ${c.exited}, profile removed ${c.profileRemoved} (${c.profileDir})`);
        }
        if (server) await server.close();
    }

    // ---- Report ----
    const analysis = analyse(samples);
    const intervals = intervalsOf(samples);
    const hidden = hiddenCheck(samples, intervals);
    if (hidden.failed && !failed) failed = hidden.failed;

    console.log(`\nSlopes over the visible samples from ${fmt(args.warmup, 1)} min (judged from ${CONFIG.minFitSamples} samples over ${CONFIG.minFitMinutes} min; "hidden slope" is the hidden phase's own, not judged):`);
    console.log(slopesTable(analysis));
    console.log(`\n${hiddenText(hidden)}`);
    if (meta.pageErrorCount) console.log(`\n⚠ ${meta.pageErrorCount} page error(s), first: ${meta.pageErrors.slice(0, 3).join(' | ')}`);
    const busTop = samples.at(-1)?.page?.bus?.top;
    if (busTop?.length) console.log(`\nEventBus subscribers at the end: ${samples.at(-1).page.bus.total} on ${samples.at(-1).page.bus.events} events (engine ${samples.at(-1).page.bus.engine}); most: ${busTop.slice(0, 6).map(([n, c]) => `${n} ${c}`).join(', ')}`);

    let snapshotDiff = null;
    if (snapshots.start && snapshots.end) {
        try {
            process.stdout.write('\nReading the heap snapshots…');
            const t = Date.now();
            const a = classSummary(JSON.parse(fs.readFileSync(snapshots.start.file, 'utf8')));
            const b = classSummary(JSON.parse(fs.readFileSync(snapshots.end.file, 'utf8')));
            const rows = diffClasses(a, b, 15);
            console.log(` ${fmt((Date.now() - t) / 1000, 1)} s. Reachable objects ${a.reachable} → ${b.reachable}, ${fmt(a.totalSelf / 1048576, 2)} → ${fmt(b.totalSelf / 1048576, 2)} MB.`);
            console.log(`Top 15 classes by retained-size growth, sample ${snapshots.start.atSample} → ${snapshots.end.atSample}:`);
            console.log(table(['class', 'count', 'Δ count', 'Δ self KB', 'Δ retained KB', 'retained KB at end'],
                rows.map((r) => [r.name.length > 60 ? r.name.slice(0, 57) + '…' : r.name, `${r.countA} → ${r.countB}`, r.dCount, fmt(r.dSelf / 1024, 1), fmt(r.dRetained / 1024, 1), fmt(r.retainedB / 1024, 1)])));
            console.log(`Snapshots (open in DevTools → Memory): ${path.relative(root, snapshots.start.file)}, ${path.relative(root, snapshots.end.file)}`);
            snapshotDiff = { start: { reachable: a.reachable, totalSelf: a.totalSelf }, end: { reachable: b.reachable, totalSelf: b.totalSelf }, top: rows };
        } catch (err) {
            console.log(`\n⚠ Could not read the heap snapshots: ${err.message}`);
        }
    }

    let comparison = null;
    if (args.compare) {
        if (!fs.existsSync(baselineFile)) {
            console.log('\n--compare: there is no bench/soak-baseline.json yet (the director takes it with --save-baseline on a quiet machine).');
            failed ||= 'no baseline';
        } else {
            const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
            comparison = compareToBaseline(analysis, args, baseline);
            if (!comparison.comparable) {
                console.log(`\n--compare: not comparable: ${comparison.reason}.`);
                failed ||= `not comparable: ${comparison.reason}`;
            } else {
                console.log(`\nAgainst bench/soak-baseline.json (${baseline.meta?.commit ?? '?'}, ${baseline.meta?.date ?? '?'}, ${baseline.meta?.machine ?? '?'}):`);
                if (baseline.meta?.machine && baseline.meta.machine !== meta.machine) console.log(`⚠ The baseline was taken on ${baseline.meta.machine}; numbers from another machine mean little here.`);
                for (const n of comparison.notes) console.log(`⚠ ${n}`);
                console.log(table(['metric', 'what', 'baseline', 'now', 'verdict'], comparison.checks.map((c) => [c.metric, c.what, c.base ?? '—', c.now ?? '—', c.verdict])));
            }
        }
    }

    const metricFailed = Object.values(analysis).some((a) => a.verdict === 'FAIL');
    const regressed = !!comparison?.regressed;
    const hiddenBad = !!hidden.problems?.length;
    const exit = failed ? EXIT.BENCH_FAILED : metricFailed || regressed || hiddenBad ? EXIT.REGRESSED : EXIT.OK;
    console.log(failed ? `\n✗ The soak failed: ${failed}`
        : exit === EXIT.REGRESSED ? `\n✗ ${[metricFailed && 'a metric FAILED', regressed && 'REGRESSED against the baseline', hiddenBad && 'the hidden phase misbehaved'].filter(Boolean).join('; ')}.`
            : '\n✓ No growth over the limits, and the hidden phase behaved.');

    const elapsedS = (Date.now() - started) / 1000;
    fs.writeFileSync(file, JSON.stringify({
        meta: { ...meta, elapsedS }, failed, exit, samples, intervals,
        analysis: Object.fromEntries(Object.entries(analysis).map(([k, a]) => [k, { ...a, fit: a.fit && { ...a.fit, slope: round(a.fit.slope, 4) } }])),
        hidden, snapshots, snapshotDiff, comparison
    }, null, 1));
    console.log(`Wrote ${path.relative(root, file)} (${fmt(elapsedS, 0)} s).`);

    if (args.saveBaseline) {
        const refusal = baselineRefusal({ failed, analysis });
        if (refusal) {
            console.log(`✗ Not saving bench/soak-baseline.json: ${refusal}.`);
        } else {
            fs.writeFileSync(baselineFile, JSON.stringify(baselineOf(analysis, args, { commit: meta.commit, date: meta.date, machine: meta.machine, chrome: meta.chrome?.product }), null, 2) + '\n');
            console.log(`Wrote bench/soak-baseline.json (${JSON.stringify(settingsOf(args))}).`);
        }
    }
    process.exit(exit);
}

main().catch((err) => {
    console.error(err?.stack || err);
    runCleanups();
    process.exit(EXIT.BENCH_FAILED);
});
