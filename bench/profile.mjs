// Fantasy Guild drawing profile (`npm run bench:profile`): WHERE a scene's frame time goes, for
// ranking causes (brief 60). `bench:draw` says how much a frame costs; this says what in it.
//
//   npm run bench:profile -- --scene=S2 --cpu=4       one scene, settled, then a trace and a CPU profile
//   npm run bench:profile -- --scene=S3 --off=bubbles a draw switch off (as bench:draw --switches)
//   npm run bench:profile -- --no-build               reuse dist-perf-prof/ as it is
//   --settle=20 --trace=6 --sample=8                  seconds: settle, trace window, CPU-profile window
//
// The page is the perf build, UNMINIFIED and with source maps (dist-perf-prof/, its own folder),
// so functions keep their names and every sample is mapped back to a file and line under src/.
// Same Chrome, window, CPU throttle, scenes and settle as bench:draw. Two windows, one after
// the other, so neither tool's overhead lands in the other's numbers:
//  1. a Chrome trace (DevTools' Performance panel categories, no JS sampler): main-thread time
//     by kind (script, style, layout, paint, GC), how many elements each style pass touched, the
//     busiest threads (the GPU process included), and the script entry points (timers,
//     animation frames, events) with their total time;
//  2. a V8 CPU profile: JavaScript self time by function and by source file.
// The Perf HUD's own figures for the trace window are printed beside it (tracing slows the page a
// little, so they read a little high). Raw files for DevTools go to bench/results/profile/.
// ⚠️ Machine-specific, like every drawing number. A profile ranks causes; bench:draw measures.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startPerfServer, buildPerf, PROFILE_OUT_DIR } from './browser/servers.mjs';
import { SCENES, sceneUrl, openBoard } from './browser/scenes.mjs';
import { metricsOf, DRAW_SWITCHES } from './browser/drawLib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(here, 'results', 'profile');

function parseArgs(argv) {
    const a = { scene: 'S2', cpu: 4, settleS: 20, traceS: 6, sampleS: 8, off: [], build: true, top: 30, invalidations: false };
    for (const arg of argv) {
        const [k, ...rest] = arg.replace(/^--/, '').split('=');
        const v = rest.join('=');
        switch (k) {
            case 'scene': {
                const id = Object.keys(SCENES).find(s => s.toLowerCase() === v.toLowerCase());
                if (!id) throw new Error(`unknown scene ${v}; known: ${Object.keys(SCENES).join(', ')}`);
                a.scene = id;
                break;
            }
            case 'cpu': a.cpu = Number(v); break;
            case 'settle': a.settleS = Number(v); break;
            case 'trace': a.traceS = Number(v); break;
            case 'sample': a.sampleS = Number(v); break;
            case 'top': a.top = Number(v); break;
            case 'off':
                a.off = v.split(',').map(s => s.trim()).filter(Boolean);
                for (const s of a.off) if (!DRAW_SWITCHES.includes(s)) throw new Error(`unknown switch ${s}`);
                break;
            case 'no-build': a.build = false; break;
            case 'invalidations': a.invalidations = true; break;
            default: throw new Error(`unknown option --${k}`);
        }
    }
    return a;
}

// ---------------------------------------------------------------------------
// Source maps (a minimal VLQ decoder: no packages)
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64I = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64I[B64.charCodeAt(i)] = i;

/** Decode a v3 map's `mappings` into, per generated line, sorted [genCol, src, line, col]. */
function decodeMappings(str) {
    const lines = [];
    let line = [];
    let seg = [];
    let genCol = 0, src = 0, oLine = 0, oCol = 0, value = 0, shift = 0;
    const push = () => {
        if (!seg.length) return;
        genCol += seg[0];
        if (seg.length >= 4) {
            src += seg[1]; oLine += seg[2]; oCol += seg[3];
            line.push([genCol, src, oLine, oCol]);
        }
        seg = [];
    };
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c === 59) { push(); lines.push(line); line = []; genCol = 0; continue; }   // ;
        if (c === 44) { push(); continue; }                                           // ,
        const d = B64I[c];
        value += (d & 31) * 2 ** shift;
        if (d & 32) { shift += 5; continue; }
        seg.push(value % 2 ? -Math.floor(value / 2) : value / 2);
        value = 0; shift = 0;
    }
    push();
    lines.push(line);
    return lines;
}

function loadMaps(buildDir) {
    const maps = new Map();   // bundle file name → { sources, lines }
    const assets = path.join(buildDir, 'assets');
    if (!fs.existsSync(assets)) return maps;
    for (const f of fs.readdirSync(assets)) {
        if (!f.endsWith('.js.map')) continue;
        const m = JSON.parse(fs.readFileSync(path.join(assets, f), 'utf8'));
        maps.set(f.replace(/\.map$/, ''), { sources: m.sources.map(cleanSource), lines: decodeMappings(m.mappings) });
    }
    return maps;
}

function cleanSource(s) {
    return s.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '').replace(/^.*?node_modules\//, 'node_modules/').replace(/\?.*$/, '');
}

/** Where a bundle position (0-based line and column) came from, or null. */
function lookup(maps, url, line0, col0) {
    const file = String(url || '').replace(/^.*\/assets\//, '').replace(/\?.*$/, '');
    const m = maps.get(file);
    if (!m) return null;
    const segs = m.lines[line0];
    if (!segs?.length) return null;
    let lo = 0, hi = segs.length - 1, best = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (segs[mid][0] <= col0) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const s = segs[Math.max(0, best)];
    return { file: m.sources[s[1]], line: s[2] + 1 };
}

// ---------------------------------------------------------------------------
// The trace
// ---------------------------------------------------------------------------

const TRACE_CATEGORIES = [
    '-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
    'toplevel', 'v8.execute', 'blink.user_timing', 'v8', 'disabled-by-default-v8.gc'
];

// What made each style pass: which elements were invalidated and why (heavy; `--invalidations`).
const INVALIDATION_CATEGORY = 'disabled-by-default-devtools.timeline.invalidationTracking';

async function trace(page, seconds, { invalidations = false } = {}) {
    const events = [];
    const offData = page.on('Tracing.dataCollected', (p) => { for (const e of p.value) events.push(e); });
    const done = new Promise((resolve) => { const off = page.on('Tracing.tracingComplete', () => { off(); resolve(); }); });
    await page.send('Tracing.start', {
        transferMode: 'ReportEvents',
        traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: invalidations ? [...TRACE_CATEGORIES, INVALIDATION_CATEGORY] : TRACE_CATEGORIES }
    });
    await page.evaluate('window.__perf.reset(), true');
    await sleep(seconds * 1000);
    const report = await page.evaluate('window.__perf.report()');
    await page.send('Tracing.end');
    await Promise.race([done, sleep(60000)]);
    offData();
    return { events, report };
}

const BUCKETS = [
    ['gc', (n) => /GC|Scavenge|Sweep|Mark(ing)?\b|BlinkGC|ThreadState::/.test(n)],
    ['script', (n) => /^(FunctionCall|EvaluateScript|TimerFire|FireAnimationFrame|EventDispatch|RunMicrotasks|FireIdleCallback|V8\.Execute|v8\.(run|callFunction|compile|compileModule|evaluateModule|produceCache|newInstance)|V8\.CompileCode|V8\.ScriptCompiler|ParseHTML|v8\.callModuleMethod|PerformanceObserver|ResizeObserver|IntersectionObserver)/.test(n)],
    ['style', (n) => /^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|ScheduleStyleRecalculation|StyleInvalidator|InvalidateLayout)/.test(n)],
    ['layout', (n) => /^(Layout|UpdateLayerTree|HitTest|LayoutShift|ComputeIntersections|IntersectionObserverController|LocalFrameView::RunPostLifecycleSteps)/.test(n)],
    ['paint', (n) => /^(PrePaint|Paint|PaintImage|Layerize|Commit|UpdateLayer|CompositeLayers|Decode Image|PaintSetup|Image Decode|ImageDecodeTask|RasterTask|Draw LazyPixelRef|LayerTreeHostImpl|ProxyMain::BeginMainFrame::commit)/.test(n)]
];
const bucketOf = (name) => BUCKETS.find(([, test]) => test(name))?.[0] ?? 'other';

/** Pair B/E into X, per thread; keep X. Returns events with `end`. */
function completeEvents(evts) {
    const out = [];
    const open = new Map();
    for (const e of evts) {
        if (e.ph === 'X' && Number.isFinite(e.dur)) out.push({ ...e, end: e.ts + e.dur });
        else if (e.ph === 'B') {
            const k = `${e.pid}|${e.tid}`;
            if (!open.has(k)) open.set(k, []);
            open.get(k).push(e);
        } else if (e.ph === 'E') {
            const st = open.get(`${e.pid}|${e.tid}`);
            const b = st?.pop();
            if (b) out.push({ ...b, ph: 'X', dur: e.ts - b.ts, end: e.ts, args: { ...b.args, endArgs: e.args } });
        }
    }
    return out;
}

/** Self time per event name on one thread, plus top-level busy time. */
function selfTimes(threadEvents) {
    const evs = threadEvents.slice().sort((a, b) => (a.ts - b.ts) || (b.dur - a.dur));
    const stack = [];
    let topBusy = 0;
    for (const e of evs) {
        while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
        const parent = stack[stack.length - 1];
        e.childDur = 0;
        if (parent) {
            if (e.end <= parent.end) parent.childDur += e.dur;
            e.parent = parent;
        } else {
            topBusy += e.dur;
        }
        stack.push(e);
    }
    const byName = new Map();
    for (const e of evs) {
        const self = Math.max(0, e.dur - e.childDur);
        const agg = byName.get(e.name) || { name: e.name, selfUs: 0, count: 0 };
        agg.selfUs += self;
        agg.count++;
        byName.set(e.name, agg);
    }
    return { byName, topBusy, evs };
}

function analyseTrace(events, maps, seconds) {
    const threadNames = new Map();
    const processNames = new Map();
    for (const e of events) {
        if (e.ph === 'M' && e.name === 'thread_name') threadNames.set(`${e.pid}|${e.tid}`, e.args?.name);
        if (e.ph === 'M' && e.name === 'process_name') processNames.set(e.pid, e.args?.name);
    }
    const complete = completeEvents(events);
    const byThread = new Map();
    for (const e of complete) {
        const k = `${e.pid}|${e.tid}`;
        if (!byThread.has(k)) byThread.set(k, []);
        byThread.get(k).push(e);
    }
    // The page's main thread: the busiest CrRendererMain.
    let mainKey = null;
    let mainBusy = -1;
    const threads = [];
    for (const [k, evs] of byThread) {
        const { topBusy } = selfTimes(evs);
        const [pid] = k.split('|');
        threads.push({ thread: `${processNames.get(Number(pid)) || pid} / ${threadNames.get(k) || k}`, busyMsPerS: topBusy / 1000 / seconds });
        if (threadNames.get(k) === 'CrRendererMain' && topBusy > mainBusy) { mainBusy = topBusy; mainKey = k; }
    }
    threads.sort((a, b) => b.busyMsPerS - a.busyMsPerS);
    if (!mainKey) return { threads, error: 'no renderer main thread in the trace' };

    const { byName, topBusy, evs } = selfTimes(byThread.get(mainKey));
    const buckets = {};
    for (const agg of byName.values()) {
        const b = bucketOf(agg.name);
        buckets[b] = (buckets[b] || 0) + agg.selfUs;
    }
    const names = [...byName.values()].sort((a, b) => b.selfUs - a.selfUs);

    // Frames: the main thread's begin-frame events.
    const frames = evs.filter(e => e.name === 'BeginMainThreadFrame' || e.name === 'BeginFrame').length
        || events.filter(e => e.name === 'BeginMainThreadFrame' && `${e.pid}|${e.tid}` === mainKey).length;

    // Style passes: how many elements each touched.
    const styleCounts = [];
    for (const e of evs) {
        if (e.name !== 'UpdateLayoutTree') continue;
        const n = e.args?.elementCount ?? e.args?.endArgs?.elementCount ?? e.args?.data?.elementCount;
        if (Number.isFinite(n)) styleCounts.push({ n, ms: e.dur / 1000 });
    }
    styleCounts.sort((a, b) => a.n - b.n);
    const sumStyleEl = styleCounts.reduce((s, x) => s + x.n, 0);
    const layoutEvents = evs.filter(e => e.name === 'Layout');
    const layoutObjects = layoutEvents.map(e => e.args?.beginData?.dirtyObjects).filter(Number.isFinite).sort((a, b) => a - b);

    // Script entry points: where each piece of JavaScript was called from, inclusive time.
    const entries = new Map();
    const entryKind = { FunctionCall: 'call', TimerFire: 'timer', FireAnimationFrame: 'rAF', EventDispatch: 'event', RunMicrotasks: 'microtasks', FireIdleCallback: 'idle' };
    const callKey = (e) => {
        const d = e.args?.data || {};
        const at = d.url ? lookup(maps, d.url, Math.max(0, (d.lineNumber ?? 1) - 1), Math.max(0, (d.columnNumber ?? 1) - 1)) : null;
        let via = null; let p = e.parent;
        while (p && !via) { if (entryKind[p.name]) via = entryKind[p.name] + (p.name === 'EventDispatch' && p.args?.data?.type ? ` ${p.args.data.type}` : ''); p = p.parent; }
        return `${via || 'task'} → ${d.functionName || '(anonymous)'}${at ? ` @ ${at.file}:${at.line}` : d.url ? ` @ ${String(d.url).replace(/^.*\//, '')}:${d.lineNumber}` : ''}`;
    };
    for (const e of evs) {
        if (e.name !== 'FunctionCall') continue;
        // Count each FunctionCall once, at its outermost: nested ones are inside its time.
        let p = e.parent; let nested = false;
        while (p) { if (p.name === 'FunctionCall') { nested = true; break; } p = p.parent; }
        if (nested) continue;
        const key = callKey(e);
        const agg = entries.get(key) || { entry: key, totalUs: 0, count: 0 };
        agg.totalUs += e.dur;
        agg.count++;
        entries.set(key, agg);
    }

    // Forced style and layout: a style pass or a layout run INSIDE script (a box read after a
    // write), by the script that asked; the rest is the frame's own.
    const forced = { styleUs: 0, layoutUs: 0, by: new Map() };
    for (const e of evs) {
        if (e.name !== 'UpdateLayoutTree' && e.name !== 'Layout') continue;
        let p = e.parent;
        while (p && p.name !== 'FunctionCall' && !entryKind[p.name]) p = p.parent;
        if (!p) continue;
        if (e.name === 'Layout') forced.layoutUs += e.dur; else forced.styleUs += e.dur;
        const key = p.name === 'FunctionCall' ? callKey(p) : p.name;
        const agg = forced.by.get(key) || { entry: key, totalUs: 0, count: 0 };
        agg.totalUs += e.dur;
        agg.count++;
        forced.by.set(key, agg);
    }
    // The longest tasks: what each was made of. Spikes, not the average, decide the 1-in-1,000 frame.
    const t0 = evs.length ? evs[0].ts : 0;
    const rootOf = (e) => { let r = e; while (r.parent) r = r.parent; return r; };
    const tasks = new Map();
    for (const e of evs) {
        const r = rootOf(e);
        let t = tasks.get(r);
        if (!t) { t = { root: r, buckets: {}, maxStyleEl: 0, styleEl: 0, calls: new Map() }; tasks.set(r, t); }
        const b = bucketOf(e.name);
        t.buckets[b] = (t.buckets[b] || 0) + Math.max(0, e.dur - e.childDur);
        if (e.name === 'UpdateLayoutTree') {
            const n = e.args?.elementCount ?? e.args?.endArgs?.elementCount ?? 0;
            t.styleEl += n;
            t.maxStyleEl = Math.max(t.maxStyleEl, n);
        }
        if (e.name === 'FunctionCall') {
            let p = e.parent; let nested = false;
            while (p) { if (p.name === 'FunctionCall') { nested = true; break; } p = p.parent; }
            if (!nested) { const k = callKey(e); t.calls.set(k, (t.calls.get(k) || 0) + e.dur); }
        }
    }
    const longest = [...tasks.values()].sort((a, b) => b.root.dur - a.root.dur).slice(0, 10).map(t => ({
        atS: (t.root.ts - t0) / 1e6,
        ms: t.root.dur / 1000,
        byKind: Object.fromEntries(Object.entries(t.buckets).sort((a, b) => b[1] - a[1]).map(([k, us]) => [k, Math.round(us / 100) / 10])),
        styleElements: t.styleEl,
        calls: [...t.calls.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, us]) => `${(us / 1000).toFixed(1)} ms ${k}`)
    }));
    // Style invalidations (with --invalidations): the reasons and the elements, for the window and
    // for the longest task's style passes.
    const describe = (d) => {
        const n = String(d?.nodeName || '?');
        const attr = n.match(/data-[a-z-]+/g)?.slice(0, 2).join(' ') || n.match(/class='([^' ]+)/)?.[1] || '';
        return `${n.split(' ')[0]} ${attr}`.trim();
    };
    const invalidations = { byReason: new Map(), byNode: new Map(), inLongest: new Map() };
    const longestRoot = [...tasks.values()].sort((a, b) => b.root.dur - a.root.dur)[0]?.root;
    for (const e of events) {
        if (e.name !== 'StyleRecalcInvalidationTracking' && e.name !== 'StyleInvalidatorInvalidationTracking' && e.name !== 'ScheduleStyleInvalidationTracking') continue;
        if (`${e.pid}|${e.tid}` !== mainKey) continue;
        const d = e.args?.data || {};
        const reason = e.name === 'ScheduleStyleInvalidationTracking'
            ? `schedule: ${d.changedAttribute ? 'attribute ' + d.changedAttribute : d.changedClass ? 'class ' + d.changedClass : d.changedId ? 'id' : d.changedPseudo ? 'pseudo ' + d.changedPseudo : '?'}`
            : `${e.name === 'StyleRecalcInvalidationTracking' ? 'recalc' : 'invalidator'}: ${d.reason || '?'}${d.extraData ? ' ' + String(d.extraData).slice(0, 30) : ''}`;
        invalidations.byReason.set(reason, (invalidations.byReason.get(reason) || 0) + 1);
        const node = describe(d);
        invalidations.byNode.set(node, (invalidations.byNode.get(node) || 0) + 1);
        if (longestRoot && e.ts >= longestRoot.ts - 50000 && e.ts <= longestRoot.end) {
            const k = `${reason} · ${node}`;
            invalidations.inLongest.set(k, (invalidations.inLongest.get(k) || 0) + 1);
        }
    }
    const topOf = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => ({ what: k, perS: c / seconds, count: c }));
    const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.max(0, Math.ceil(p * arr.length) - 1))] : null);
    return {
        longest,
        invalidations: invalidations.byReason.size ? {
            byReason: topOf(invalidations.byReason, 15), byNode: topOf(invalidations.byNode, 15), inLongest: topOf(invalidations.inLongest, 15)
        } : null,
        mainThread: threadNames.get(mainKey),
        busyMsPerS: topBusy / 1000 / seconds,
        frames,
        msPerFrame: frames ? topBusy / 1000 / frames : null,
        bucketsMsPerS: Object.fromEntries(Object.entries(buckets).map(([k, us]) => [k, us / 1000 / seconds])),
        topEvents: names.slice(0, 25).map(a => ({ name: a.name, bucket: bucketOf(a.name), selfMsPerS: a.selfUs / 1000 / seconds, perS: a.count / seconds })),
        style: {
            passesPerS: styleCounts.length / seconds,
            elementsPerS: sumStyleEl / seconds,
            elementsP50: q(styleCounts.map(x => x.n), 0.5),
            elementsP95: q(styleCounts.map(x => x.n), 0.95),
            elementsMax: styleCounts.length ? styleCounts[styleCounts.length - 1].n : null
        },
        layout: { perS: layoutEvents.length / seconds, dirtyP50: q(layoutObjects, 0.5), dirtyMax: layoutObjects.length ? layoutObjects[layoutObjects.length - 1] : null },
        entries: [...entries.values()].sort((a, b) => b.totalUs - a.totalUs).slice(0, 25)
            .map(a => ({ entry: a.entry, msPerS: a.totalUs / 1000 / seconds, perS: a.count / seconds })),
        forced: {
            styleMsPerS: forced.styleUs / 1000 / seconds,
            layoutMsPerS: forced.layoutUs / 1000 / seconds,
            by: [...forced.by.values()].sort((a, b) => b.totalUs - a.totalUs).slice(0, 10)
                .map(a => ({ entry: a.entry, msPerS: a.totalUs / 1000 / seconds, perS: a.count / seconds }))
        },
        threads: threads.slice(0, 10)
    };
}

// ---------------------------------------------------------------------------
// Composited layers
// ---------------------------------------------------------------------------

/**
 * The page's composited layers right now, and why each exists (`LayerTree.compositingReasons`),
 * grouped by reason and by the element that owns the layer. More layers make every frame's
 * layerize, commit and layer updates dearer; "Overlap" layers exist only because they are drawn
 * over a composited layer beneath them.
 */
async function layerCensus(page) {
    let latest = null;
    const off = page.on('LayerTree.layerTreeDidChange', (p) => { if (p.layers) latest = p.layers; });
    await page.send('DOM.enable');
    await page.send('LayerTree.enable');
    for (let i = 0; i < 20 && !latest; i++) await sleep(250);
    await sleep(500);
    const layers = latest || [];
    const byReason = new Map();
    const byElement = new Map();
    for (const l of layers) {
        let ids;
        try { ids = (await page.send('LayerTree.compositingReasons', { layerId: l.layerId })).compositingReasonIds || []; } catch { ids = ['?']; }
        const reason = ids.join('+') || '(none)';
        byReason.set(reason, (byReason.get(reason) || 0) + 1);
        if (!l.backendNodeId) continue;
        try {
            const { node } = await page.send('DOM.describeNode', { backendNodeId: l.backendNodeId });
            const attrs = node.attributes || [];
            const names = [];
            let cls = '';
            for (let i = 0; i < attrs.length; i += 2) {
                if (attrs[i].startsWith('data-')) names.push(attrs[i]);
                if (attrs[i] === 'class') cls = String(attrs[i + 1]).trim().split(/\s+/).find(c => c.startsWith('gi-')) || String(attrs[i + 1]).trim().split(/\s+/)[0] || '';
            }
            const key = `${node.nodeName}${names.length ? ' ' + names.slice(0, 2).join(' ') : cls ? ' .' + cls : ''} (${reason})`;
            byElement.set(key, (byElement.get(key) || 0) + 1);
        } catch { /* the node went */ }
    }
    off();
    await page.send('LayerTree.disable');
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([what, n]) => ({ what, n }));
    return { count: layers.length, drawsContent: layers.filter(l => l.drawsContent).length, byReason: top(byReason), byElement: top(byElement) };
}

// ---------------------------------------------------------------------------
// The CPU profile
// ---------------------------------------------------------------------------

async function cpuProfile(page, seconds) {
    await page.send('Profiler.enable');
    await page.send('Profiler.setSamplingInterval', { interval: 200 });
    await page.send('Profiler.start');
    await sleep(seconds * 1000);
    const { profile } = await page.send('Profiler.stop', {}, 120000);
    await page.send('Profiler.disable');
    return profile;
}

function analyseProfile(profile, maps, top) {
    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    const selfUs = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
        const dt = profile.timeDeltas[i] || 0;
        selfUs.set(profile.samples[i], (selfUs.get(profile.samples[i]) || 0) + dt);
    }
    const total = profile.endTime - profile.startTime;
    const byFn = new Map();
    const byFile = new Map();
    const special = {};
    for (const [id, us] of selfUs) {
        const n = nodes.get(id);
        const cf = n?.callFrame || {};
        const name = cf.functionName || '(anonymous)';
        if (/^\((idle|program|garbage collector|root)\)$/.test(name)) { special[name] = (special[name] || 0) + us; continue; }
        const at = cf.url ? lookup(maps, cf.url, cf.lineNumber, cf.columnNumber) : null;
        const file = at?.file || (cf.url ? cf.url.replace(/^.*\//, '') : '(native)');
        const fnKey = `${name} @ ${file}${at ? ':' + at.line : ''}`;
        byFn.set(fnKey, (byFn.get(fnKey) || 0) + us);
        byFile.set(file, (byFile.get(file) || 0) + us);
    }
    const seconds = total / 1e6;
    const rows = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, us]) => ({ what: k, msPerS: us / 1000 / seconds, pct: (100 * us) / total }));
    return {
        seconds,
        jsMsPerS: [...byFile.values()].reduce((s, v) => s + v, 0) / 1000 / seconds,
        specialMsPerS: Object.fromEntries(Object.entries(special).map(([k, us]) => [k, us / 1000 / seconds])),
        functions: rows(byFn),
        files: rows(byFile)
    };
}

// ---------------------------------------------------------------------------

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const scene = SCENES[args.scene];
    let commit = 'unknown';
    try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a checkout */ }
    console.log(`Fantasy Guild drawing profile — ${commit} · ${scene.name} · CPU ${args.cpu}× · settle ${args.settleS} s, trace ${args.traceS} s, CPU profile ${args.sampleS} s${args.off.length ? ` · off: ${args.off.join(',')}` : ''}`);
    if (args.build) {
        process.stdout.write(`Building the profiling build (perf, unminified, source maps → ${PROFILE_OUT_DIR}/)…\n`);
        buildPerf({ profile: true });
    }
    const maps = loadMaps(path.join(root, PROFILE_OUT_DIR));
    const server = await startPerfServer({ outDir: PROFILE_OUT_DIR });
    const chrome = await launchChrome({ width: 1600, height: 1000 });
    try {
        const page = await openBoard(chrome, sceneUrl(server.url, scene, args.off), { cpu: args.cpu, stress: scene.stress });
        const how = scene.ui ? await scene.ui(page) : null;
        if (how) console.log(`  ${how}`);
        await sleep(args.settleS * 1000);
        const t = await trace(page, args.traceS, { invalidations: args.invalidations });
        const hud = metricsOf(t.report);
        const tr = analyseTrace(t.events, maps, args.traceS);
        const prof = await cpuProfile(page, args.sampleS);
        const layers = await layerCensus(page);
        const cp = analyseProfile(prof, maps, args.top);
        const result = { meta: { commit, date: new Date().toISOString(), args, chrome: chrome.info.product }, hud, events: t.report?.events?.top || [], trace: tr, cpu: cp, layers };

        fs.mkdirSync(outDir, { recursive: true });
        const stamp = `${result.meta.date.replace(/[:.]/g, '-')}-${args.scene}-${args.cpu}x${args.off.length ? '-off-' + args.off.join('+') : ''}`;
        fs.writeFileSync(path.join(outDir, `${stamp}.trace.json`), JSON.stringify({ traceEvents: t.events }));
        fs.writeFileSync(path.join(outDir, `${stamp}.cpuprofile`), JSON.stringify(prof));
        fs.writeFileSync(path.join(outDir, `${stamp}.summary.json`), JSON.stringify(result, null, 2));
        await page.close();

        console.log(`\nPerf HUD over the trace window: ${f1(hud.fps)} fps, frame work p50/p95/p99 ${f2(hud.workP50)}/${f2(hud.workP95)}/${f2(hud.workP99)} ms, ≤16.7 ms ${f1(hud.in16Pct)} %, ${hud.tokens} Tokens, ${hud.domNodes} DOM nodes`);
        const evTop = (t.report?.events?.top || []).slice(0, 10).map(e => `${e.name} ${f1(e.perSecond)}`).join(' · ');
        console.log(`Engine events per second: ${evTop}`);
        if (tr.error) console.log(`trace: ${tr.error}`);
        else {
            console.log(`\nMain thread (${tr.mainThread}): busy ${f1(tr.busyMsPerS)} ms/s, ${tr.frames} frames, ${f2(tr.msPerFrame)} ms a frame`);
            console.log('  by kind, ms/s: ' + Object.entries(tr.bucketsMsPerS).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
            console.log(`  style passes ${f1(tr.style.passesPerS)}/s, elements per pass p50/p95/max ${tr.style.elementsP50}/${tr.style.elementsP95}/${tr.style.elementsMax}, ${Math.round(tr.style.elementsPerS)} elements/s · layouts ${f1(tr.layout.perS)}/s (dirty objects p50 ${tr.layout.dirtyP50}, max ${tr.layout.dirtyMax})`);
            console.log('\n  top events by self time (ms/s, per s):');
            for (const e of tr.topEvents.slice(0, 15)) console.log(`    ${f2(e.selfMsPerS).padStart(7)}  ${f1(e.perS).padStart(6)}/s  ${e.bucket.padEnd(6)} ${e.name}`);
            console.log('\n  script entry points (inclusive ms/s, calls/s):');
            for (const e of tr.entries.slice(0, 15)) console.log(`    ${f2(e.msPerS).padStart(7)}  ${f1(e.perS).padStart(6)}/s  ${e.entry}`);
            console.log(`\n  forced inside script: style ${f2(tr.forced.styleMsPerS)} ms/s, layout ${f2(tr.forced.layoutMsPerS)} ms/s, by:`);
            for (const e of tr.forced.by) console.log(`    ${f2(e.msPerS).padStart(7)}  ${f1(e.perS).padStart(6)}/s  ${e.entry}`);
            console.log('\n  longest main-thread tasks (ms; by kind; elements restyled; biggest scripts):');
            for (const t of tr.longest.slice(0, 8)) {
                console.log(`    ${f1(t.ms).padStart(6)} ms at ${f1(t.atS)} s · ${Object.entries(t.byKind).map(([k, v]) => `${k} ${v}`).join(', ')} · ${t.styleElements} el`);
                for (const c of t.calls) console.log(`             ${c}`);
            }
            if (tr.invalidations) {
                console.log('\n  style invalidations, by reason (per s):');
                for (const r of tr.invalidations.byReason) console.log(`    ${f1(r.perS).padStart(7)}  ${r.what}`);
                console.log('  by element (per s):');
                for (const r of tr.invalidations.byNode) console.log(`    ${f1(r.perS).padStart(7)}  ${r.what}`);
                console.log('  in and just before the longest task (count):');
                for (const r of tr.invalidations.inLongest) console.log(`    ${String(r.count).padStart(7)}  ${r.what}`);
            }
            console.log('\n  busiest threads (ms/s):');
            for (const th of tr.threads.slice(0, 6)) console.log(`    ${f1(th.busyMsPerS).padStart(7)}  ${th.thread}`);
        }
        console.log(`\nComposited layers: ${layers.count} (${layers.drawsContent} draw content). By reason:`);
        for (const r of layers.byReason) console.log(`    ${String(r.n).padStart(4)}  ${r.what}`);
        console.log('  by element:');
        for (const r of layers.byElement) console.log(`    ${String(r.n).padStart(4)}  ${r.what}`);
        console.log(`\nJavaScript (CPU profile, ${f1(cp.seconds)} s): ${f1(cp.jsMsPerS)} ms/s of JS · ${Object.entries(cp.specialMsPerS).map(([k, v]) => `${k} ${f1(v)}`).join(' · ')}`);
        console.log('  by file (self ms/s):');
        for (const r of cp.files.slice(0, 15)) console.log(`    ${f2(r.msPerS).padStart(7)}  ${r.what}`);
        console.log('  by function (self ms/s):');
        for (const r of cp.functions.slice(0, args.top)) console.log(`    ${f2(r.msPerS).padStart(7)}  ${r.what}`);
        console.log(`\nWrote bench/results/profile/${stamp}.{trace.json,cpuprofile,summary.json}`);
    } finally {
        await chrome.close();
        await server.close();
    }
}

main().catch((err) => {
    console.error(err?.stack || err);
    runCleanups();
    process.exit(3);
});
