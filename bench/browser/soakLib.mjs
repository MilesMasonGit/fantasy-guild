// The memory soak's pure parts (`npm run bench:soak`, bench/soak.mjs): the thresholds, options,
// the run's timeline, the line fit, the verdicts, the hidden-phase check and the baseline
// compare. No browser, no I/O, so they are unit-tested (src/tests/BenchSoak.test.js).

import { median } from '../lib/stats.mjs';
import { SCENE_IDS, EXTRA_SCENE_IDS, ENVELOPE_SCENE, ENVELOPE_SCENE_NAMES, EXIT } from './drawLib.mjs';

// ---------------------------------------------------------------------------
// The thresholds
// ---------------------------------------------------------------------------

/**
 * What a soak judges, and where it fails. Slopes are per minute, fitted by least squares over the
 * visible samples after the warm-up (the hidden phase's samples are left out of the fit, but a
 * step it leaves behind shows in the visible samples after it).
 *
 * Why these numbers. The page on cap128 after GC (measured by the smoke runs, bench/README.md): JS heap
 * 16–17 MB, ~2,000 DOM nodes, ~850 listeners, ~520 EventBus subscribers, 11 documents and 11
 * frames. The rule of thumb: a growth that would reach about five times the page in an 8-hour
 * session left running beside other programs fails.
 * - **Heap over 200 KB a minute fails** (over 50 warns): about 94 MB in 8 h, six times the heap, and GC
 *   pauses grow with it. 50 KB/min is what a cache still warming up can show (decoded art, JIT
 *   code: the smoke runs' compiled code grew ~130 KB a minute in their first minutes), so it is
 *   only flagged.
 * - **A count over its slope limit fails** even with churn on top: 20 nodes a minute (9,600 in
 *   8 h), 10 listeners, 2 EventBus subscribers; warnings at a quarter of that.
 * - **A count that rises and never falls back fails**: DOM nodes by more than 200 (a tenth of the
 *   page), listeners by more than 30, EventBus subscribers by more than 10, documents or frames by
 *   more than 3. A live board churns (toasts come and go, Tokens are used up and respawn), so a
 *   count going up and down is fine; one that only ratchets up is something mounted and never let
 *   go. "Never falls back" allows a dip of `jitter` below the highest value so far. Documents and
 *   frames are the page plus one per SVG picture on screen (each is drawn through an SVG document
 *   and frame of its own: 10 on cap128), so a picture shown for the first time adds one for good.
 * - **Too short to judge**: under {@link CONFIG.minFitMinutes} minutes or {@link
 *   CONFIG.minFitSamples} samples in the fit, slopes are printed but not judged ("short"): a
 *   3-minute slope extrapolated to hours is noise.
 * - **The hidden phase** is judged by the same slope limits on its own samples (from
 *   {@link CONFIG.minHiddenSamples} samples over {@link CONFIG.minHiddenMinutes} minutes): a game
 *   left in a background tab for hours must not pile up what it releases on return.
 * The `compare` entries are `--compare`'s tolerances against bench/soak-baseline.json: a slope or
 * a level (median of the fitted samples) worse by more than both the floor and the ratio fails.
 */
export const CONFIG = {
    minFitMinutes: 10,
    minFitSamples: 5,
    minHiddenMinutes: 2,
    minHiddenSamples: 3,
    /** Hidden phase: the page's own task time must fall to this share of the visible phase's. */
    hiddenTaskShare: 0.75,
    /** Hidden phase: the engine must keep at least this share of its visible tick rate. */
    hiddenTickShare: 0.8,
    /**
     * Rates compared with the baseline though not fitted: the visible, fitted intervals' time-weighted
     * mean (`fittedRates`). Worse by more than both the floor and the ratio regresses. An idle page
     * measured 124 ms of its own task time and 122 style passes a second.
     */
    rates: {
        taskMsPerS: { label: 'page task time', unit: 'ms/s', compare: { floor: 25, ratio: 0.25 } },
        stylesPerS: { label: 'style passes', unit: '/s', compare: { floor: 25, ratio: 0.25 } }
    },
    metrics: {
        heapUsed: {
            label: 'JS heap used', unit: 'KB', read: (s) => s.cdp?.JSHeapUsedSize / 1024,
            warnSlope: 50, failSlope: 200, compare: { slopeFloor: 100, slopeRatio: 0.5, levelFloor: 5120, levelRatio: 0.2 }
        },
        nodes: {
            label: 'DOM nodes (live and detached)', unit: 'nodes', read: (s) => s.cdp?.Nodes,
            warnSlope: 5, failSlope: 20, failNet: 200, jitter: 20, compare: { slopeFloor: 10, slopeRatio: 0.5, levelFloor: 500, levelRatio: 0.2 }
        },
        listeners: {
            label: 'JS event listeners', unit: 'listeners', read: (s) => s.cdp?.JSEventListeners,
            warnSlope: 2.5, failSlope: 10, failNet: 30, jitter: 5, compare: { slopeFloor: 2, slopeRatio: 0.5, levelFloor: 100, levelRatio: 0.2 }
        },
        busSubscribers: {
            label: 'EventBus subscribers', unit: 'subs', read: (s) => s.page?.bus?.total,
            warnSlope: 0.5, failSlope: 2, failNet: 10, jitter: 2, compare: { slopeFloor: 1, slopeRatio: 0.5, levelFloor: 20, levelRatio: 0.2 }
        },
        documents: {
            label: 'Documents (page + SVG pictures)', unit: 'docs', read: (s) => s.cdp?.Documents,
            failSlope: 0.5, failNet: 3, jitter: 0, compare: { slopeFloor: 0.2, slopeRatio: 0.5, levelFloor: 3, levelRatio: 0.2 }
        },
        frames: {
            label: 'Frames (page + SVG pictures)', unit: 'frames', read: (s) => s.cdp?.Frames,
            failSlope: 0.5, failNet: 3, jitter: 0, compare: { slopeFloor: 0.2, slopeRatio: 0.5, levelFloor: 3, levelRatio: 0.2 }
        },
        // Printed and fitted, never judged: they move with the game, or are too noisy to gate on.
        heapTotal: { label: 'JS heap total', unit: 'KB', read: (s) => s.cdp?.JSHeapTotalSize / 1024, info: true },
        elements: { label: 'elements in the document', unit: 'elements', read: (s) => s.page?.elements, info: true },
        layoutObjects: { label: 'layout objects', unit: 'objects', read: (s) => s.cdp?.LayoutObjects, info: true },
        tokens: { label: 'Tokens on the mat', unit: 'Tokens', read: (s) => s.page?.tokens, info: true },
        rendererPrivate: { label: 'renderer private memory', unit: 'KB', read: (s) => s.proc?.renderer?.privateKb, info: true },
        gpuPrivate: { label: 'GPU process private memory', unit: 'KB', read: (s) => s.proc?.gpu?.privateKb, info: true }
    }
};

/** The CDP `Performance.getMetrics` names kept per sample. */
export const CDP_METRICS = [
    'JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'JSEventListeners', 'Documents', 'Frames', 'LayoutObjects',
    'LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration',
    'DevToolsCommandDuration', 'ArrayBufferContents', 'DetachedScriptStates', 'Resources'
];

export { EXIT };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export const DEFAULTS = { scene: 'cap128', minutes: 30, every: 60, hidden: 5, settle: 60 };

/** The warm-up left out of the fit, in minutes: a tenth of the run, at most 5. */
export const defaultWarmup = (minutes) => Math.min(5, minutes * 0.1);

export function parseArgs(argv) {
    const a = {
        scene: DEFAULTS.scene, minutes: DEFAULTS.minutes, every: DEFAULTS.every, hidden: DEFAULTS.hidden,
        warmup: null, settle: DEFAULTS.settle, snapshot: false, readable: false, compare: false, saveBaseline: false, build: true, port: null
    };
    for (const arg of argv) {
        const [key, ...rest] = arg.replace(/^--/, '').split('=');
        const v = rest.join('=');
        switch (key) {
            case 'scene': a.scene = sceneId(v); break;
            case 'minutes': a.minutes = num(v, '--minutes', { min: 0, open: true }); break;
            case 'every': a.every = num(v, '--every', { min: 10 }); break;
            case 'hidden': a.hidden = num(v, '--hidden', { min: 0 }); break;
            case 'warmup': a.warmup = num(v, '--warmup', { min: 0 }); break;
            case 'settle': a.settle = num(v, '--settle', { min: 0 }); break;
            case 'snapshot': a.snapshot = true; break;
            case 'readable': a.readable = true; break;
            case 'compare': a.compare = true; break;
            case 'save-baseline': a.saveBaseline = true; break;
            case 'no-build': a.build = false; break;
            case 'port': a.port = Math.floor(num(v, '--port', { min: 1 })); break;
            default: throw new Error(`unknown option --${key} (see bench/README.md, "Memory soak")`);
        }
    }
    a.warmup ??= defaultWarmup(a.minutes);
    if (a.warmup >= a.minutes) throw new Error(`--warmup (${a.warmup} min) leaves nothing of a ${a.minutes}-minute run to fit`);
    soakPlan(a);   // throws when the hidden phase leaves no visible time on either side
    return a;
}

function num(value, name, { min = -Infinity, open = false } = {}) {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n) || (open ? n <= min : n < min)) {
        throw new Error(`${name} needs a number ${open ? 'over' : 'of at least'} ${min}`);
    }
    return n;
}

/** A scene id as `bench:draw` knows it (case-insensitive), or an error naming the known ones. */
export function sceneId(value) {
    const ids = [...SCENE_IDS, ...EXTRA_SCENE_IDS];
    const key = String(value || '').trim().toLowerCase();
    const known = ids.find((id) => id.toLowerCase() === key);
    if (known) return known;
    if (ENVELOPE_SCENE.test(key)) return key;
    throw new Error(`unknown scene ${value}; known: ${ids.join(', ')}, and ${ENVELOPE_SCENE_NAMES}`);
}

// ---------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------

/**
 * The run as a list of steps, in seconds from the first sample: a sample every `every` seconds and
 * at the end, the page hidden in the middle for `hidden` minutes (snapped to the sample grid, with
 * a sample at each switch, taken before it), and the heap snapshots' places.
 * Each step: `{ atS, phase, fit, then, snapshot }`. A sample's `phase` is the one in force over the
 * interval that ends with it: the sample at the hiding is `visible`, the one at the showing is
 * `hidden`. `fit`: a visible sample after the warm-up (the slopes' samples). `then`: `'hide'` or
 * `'show'` after the sample. `snapshot`: `'start'` (the first fitted sample), `'hidden'` (the last hidden sample, taken while
 * the page is still hidden) or `'end'` (the last).
 */
export function soakPlan({ minutes, every, hidden = 0, warmup = 0 }) {
    const totalS = minutes * 60;
    let hs = null;
    let he = null;
    if (hidden > 0) {
        const hiddenS = hidden * 60;
        hs = Math.floor((totalS - hiddenS) / 2 / every) * every;
        if (hs < every) hs = (totalS - hiddenS) / 2;
        he = hs + hiddenS;
        if (hs <= 0 || totalS - he <= 0) {
            throw new Error(`--hidden=${hidden} leaves no visible time on both sides of a ${minutes}-minute run`);
        }
    }
    const times = new Set();
    for (let t = 0; t <= totalS + 1e-9; t += every) times.add(round(t, 3));
    times.add(round(totalS, 3));
    if (hs !== null) { times.add(round(hs, 3)); times.add(round(he, 3)); }
    const sorted = [...times].sort((x, y) => x - y);
    const steps = sorted.map((atS) => {
        const phase = hs !== null && atS > hs && atS <= he ? 'hidden' : 'visible';
        return {
            atS, phase,
            fit: phase === 'visible' && atS >= warmup * 60 - 1e-9,
            then: atS === round(hs, 3) ? 'hide' : atS === round(he, 3) ? 'show' : null,
            snapshot: null
        };
    });
    const firstFit = steps.find((s) => s.fit);
    if (firstFit) firstFit.snapshot = 'start';
    const last = steps[steps.length - 1];
    if (last !== firstFit) last.snapshot = 'end';
    const lastHidden = steps.filter((s) => s.phase === 'hidden').pop();
    if (lastHidden) lastHidden.snapshot = 'hidden';
    return { totalS, hiddenStartS: hs, hiddenEndS: he, warmupS: warmup * 60, steps };
}

// ---------------------------------------------------------------------------
// The fit and the verdicts
// ---------------------------------------------------------------------------

/**
 * Least-squares line through `points` ({x, y}, x in minutes): slope (y per minute), intercept,
 * r², how many points and the minutes they span. Null when fewer than two distinct x.
 */
export function fitLine(points) {
    const p = points.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
    const n = p.length;
    if (n < 2) return null;
    let sx = 0, sy = 0;
    for (const q of p) { sx += q.x; sy += q.y; }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const q of p) {
        sxx += (q.x - mx) ** 2;
        sxy += (q.x - mx) * (q.y - my);
        syy += (q.y - my) ** 2;
    }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    const xs = p.map((q) => q.x);
    return {
        n, slope, intercept: my - slope * mx,
        r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
        spanMin: Math.max(...xs) - Math.min(...xs)
    };
}

/** True when the series never falls more than `jitter` below its highest value so far. */
export function neverFallsBack(values, jitter = 0) {
    let high = -Infinity;
    for (const v of values) {
        if (!Number.isFinite(v)) continue;
        if (v < high - jitter) return false;
        high = Math.max(high, v);
    }
    return true;
}

/**
 * One metric's verdict from its fit and its fitted values (in order): `info` (never judged),
 * `short` (too little to judge), `FAIL`, `WARN` or `ok`, with why.
 */
export function judgeMetric(def, fit, values, cfg = CONFIG) {
    if (def.info) return { verdict: 'info', why: '' };
    if (!fit || fit.n < cfg.minFitSamples || fit.spanMin < cfg.minFitMinutes) {
        return { verdict: 'short', why: `${fit?.n ?? 0} samples over ${fmt(fit?.spanMin ?? 0, 1)} min; slopes are judged from ${cfg.minFitSamples} samples over ${cfg.minFitMinutes} min` };
    }
    const v = values.filter(Number.isFinite);
    const net = v.length ? v[v.length - 1] - v[0] : 0;
    if (Number.isFinite(def.failSlope) && fit.slope > def.failSlope) {
        return { verdict: 'FAIL', why: `grows ${fmt(fit.slope, 2)} ${def.unit}/min, over the limit of ${def.failSlope}` };
    }
    if (Number.isFinite(def.failNet) && net > def.failNet && neverFallsBack(v, def.jitter ?? 0)) {
        return { verdict: 'FAIL', why: `rose by ${fmt(net, 0)} ${def.unit} and never fell back (limit ${def.failNet}, dips of ${def.jitter ?? 0} allowed)` };
    }
    if (Number.isFinite(def.warnSlope) && fit.slope > def.warnSlope) {
        return { verdict: 'WARN', why: `grows ${fmt(fit.slope, 2)} ${def.unit}/min, over ${def.warnSlope} (fails at ${def.failSlope})` };
    }
    return { verdict: 'ok', why: '' };
}

/** The fitted points of one metric: `{x: minutes, y}` for the samples `pick` keeps. */
export function seriesOf(samples, def, pick = (s) => s.fit) {
    return samples.filter(pick).map((s) => ({ x: s.tS / 60, y: def.read(s) })).filter((q) => Number.isFinite(q.y));
}

/**
 * Every metric's fits and verdict: `visible` (the judged fit), `hidden` (the hidden phase's own
 * samples, for reading only), the level (median of the fitted values) and the net change.
 */
export function analyse(samples, cfg = CONFIG) {
    const out = {};
    for (const [key, def] of Object.entries(cfg.metrics)) {
        const vis = seriesOf(samples, def);
        const hid = seriesOf(samples, def, (s) => s.phase === 'hidden');
        const fit = fitLine(vis);
        const { verdict, why } = judgeMetric(def, fit, vis.map((q) => q.y), cfg);
        out[key] = {
            label: def.label, unit: def.unit, fit, hiddenFit: fitLine(hid),
            level: vis.length ? median(vis.map((q) => q.y)) : null,
            net: vis.length ? vis[vis.length - 1].y - vis[0].y : null,
            first: vis.length ? vis[0].y : null, last: vis.length ? vis[vis.length - 1].y : null,
            verdict, why
        };
    }
    return out;
}

// ---------------------------------------------------------------------------
// Intervals and the hidden phase
// ---------------------------------------------------------------------------

const delta = (a, b, k) => (Number.isFinite(a?.cdp?.[k]) && Number.isFinite(b?.cdp?.[k]) ? b.cdp[k] - a.cdp[k] : null);

/**
 * What the page did between consecutive samples, per second: its own task time (CDP TaskDuration
 * less the bench's DevTools commands: the forced GCs, the probes, a snapshot), script time, style
 * passes and layouts, and from the Perf HUD's window (reset at every sample) frames, frame work and
 * engine ticks. An interval's phase is its closing sample's.
 */
export function intervalsOf(samples) {
    const out = [];
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        const dt = b.tS - a.tS;
        if (!(dt > 0)) continue;
        const task = delta(a, b, 'TaskDuration');
        const devtools = delta(a, b, 'DevToolsCommandDuration') ?? 0;
        const per = (v, k = 1) => (v === null ? null : (v * k) / dt);
        const iv = b.page?.interval || {};
        out.push({
            from: a.i, to: b.i, phase: b.phase, fit: !!(a.fit && b.fit), seconds: dt,
            taskMsPerS: per(task === null ? null : Math.max(0, task - devtools), 1000),
            scriptMsPerS: per(delta(a, b, 'ScriptDuration'), 1000),
            stylesPerS: per(delta(a, b, 'RecalcStyleCount')),
            layoutsPerS: per(delta(a, b, 'LayoutCount')),
            fps: Number.isFinite(iv.frames) && iv.seconds > 0 ? iv.frames / iv.seconds : null,
            workP50: iv.workP50 ?? null,
            ticksPerS: iv.ticksPerS ?? null
        });
    }
    return out;
}

const RATE_KEYS = ['taskMsPerS', 'scriptMsPerS', 'stylesPerS', 'layoutsPerS', 'fps', 'ticksPerS'];

/** Time-weighted means of the interval rates of one phase. */
export function phaseRates(intervals, phase) {
    return ratesOf(intervals.filter((iv) => iv.phase === phase));
}

/** The rates of the visible intervals after the warm-up: what the baseline keeps and compares. */
export function fittedRates(intervals) {
    return ratesOf(intervals.filter((iv) => iv.phase === 'visible' && iv.fit));
}

function ratesOf(ivs) {
    const out = { intervals: ivs.length, seconds: ivs.reduce((s, iv) => s + iv.seconds, 0) };
    for (const k of RATE_KEYS) {
        const ok = ivs.filter((iv) => Number.isFinite(iv[k]));
        const t = ok.reduce((s, iv) => s + iv.seconds, 0);
        out[k] = t > 0 ? ok.reduce((s, iv) => s + iv[k] * iv.seconds, 0) / t : null;
    }
    return out;
}

/**
 * Did hiding the page do what the game promises (`src/ui/drawingPause.js`): the document hidden,
 * the mat's drawing clocks paused, no frames, less work, and the engine still ticking; and did it
 * come back? `failed` is the bench's own failure (the page never hid), `problems` the game's.
 */
export function hiddenCheck(samples, intervals, cfg = CONFIG) {
    const hiddenSamples = samples.filter((s) => s.phase === 'hidden');
    if (!hiddenSamples.length) return { ran: false };
    const visible = phaseRates(intervals, 'visible');
    const hidden = phaseRates(intervals, 'hidden');
    const lastHidden = hiddenSamples[hiddenSamples.length - 1];
    const after = samples.find((s) => s.i > lastHidden.i);
    const out = {
        ran: true, visible, hidden,
        visibilityHidden: hiddenSamples.every((s) => s.page?.visibility === 'hidden'),
        drawingPaused: hiddenSamples.some((s) => s.page?.drawingPaused === null || s.page?.drawingPaused === undefined)
            ? null : hiddenSamples.every((s) => s.page.drawingPaused === true),
        visibleAgain: after ? after.page?.visibility === 'visible' : null,
        drawingResumed: after ? (after.page?.drawingPaused === null || after.page?.drawingPaused === undefined ? null : after.page.drawingPaused === false) : null,
        taskShare: share(hidden.taskMsPerS, visible.taskMsPerS),
        tickShare: share(hidden.ticksPerS, visible.ticksPerS),
        problems: [], failed: null
    };
    if (!out.visibilityHidden) out.failed = 'the page never read hidden: headless Chrome did not hide it';
    if (out.drawingPaused === false) out.problems.push('the mat\'s drawing clocks were not paused while hidden');
    if (Number.isFinite(hidden.fps) && hidden.fps >= 1) out.problems.push(`${fmt(hidden.fps, 1)} frames a second while hidden`);
    if (Number.isFinite(out.taskShare) && out.taskShare > cfg.hiddenTaskShare) {
        out.problems.push(`the page's own work fell only to ${fmt(out.taskShare * 100, 0)} % of the visible phase's (wanted at most ${cfg.hiddenTaskShare * 100} %)`);
    }
    if (Number.isFinite(out.tickShare) && out.tickShare < cfg.hiddenTickShare) {
        out.problems.push(`the engine ticked ${fmt(hidden.ticksPerS, 1)}/s hidden against ${fmt(visible.ticksPerS, 1)}/s visible: the game must keep playing`);
    }
    if (out.visibleAgain === false) out.problems.push('the page did not read visible again after the hidden phase');
    if (out.drawingResumed === false) out.problems.push('the drawing clocks stayed paused after the page came back');

    // What the hidden phase held, and whether it let go: the last sample before hiding, the
    // hidden samples' highest, the first after showing; and each judged metric's own hidden slope.
    const before = [...samples].reverse().find((s) => s.i < hiddenSamples[0].i);
    out.levels = {};
    out.growth = {};
    for (const [key, def] of Object.entries(cfg.metrics)) {
        if (!['heapUsed', 'nodes', 'listeners', 'busSubscribers', 'elements'].includes(key)) continue;
        const hv = hiddenSamples.map((s) => def.read(s)).filter(Number.isFinite);
        out.levels[key] = { label: def.label, unit: def.unit, before: before ? def.read(before) : null, hiddenMax: hv.length ? Math.max(...hv) : null, after: after ? def.read(after) : null };
        if (def.info || !Number.isFinite(def.failSlope)) continue;
        const fit = fitLine(seriesOf(samples, def, (s) => s.phase === 'hidden'));
        if (!fit) continue;
        const judged = fit.n >= cfg.minHiddenSamples && fit.spanMin >= cfg.minHiddenMinutes;
        out.growth[key] = { slope: round(fit.slope, 3), n: fit.n, spanMin: round(fit.spanMin, 2), judged };
        if (judged && fit.slope > def.failSlope) out.problems.push(`${def.label} grew ${fmt(fit.slope, 1)} ${def.unit}/min while hidden (limit ${def.failSlope})`);
    }
    return out;
}

const share = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null);

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** What `--save-baseline` keeps: the settings, and per judged metric its slope and level. */
export function baselineOf(analysis, args, meta = {}, rates = null) {
    const metrics = {};
    for (const [key, a] of Object.entries(analysis)) {
        if (!CONFIG.metrics[key]?.compare) continue;
        metrics[key] = { slope: round(a.fit?.slope, 4), level: round(a.level, 1), n: a.fit?.n ?? 0, spanMin: round(a.fit?.spanMin, 2) };
    }
    return {
        meta: { ...meta, note: 'Slopes per minute and levels (median of the fitted samples). Machine-specific: re-take on the owner\'s PC, quiet: npm run bench:soak -- --save-baseline' },
        settings: settingsOf(args),
        metrics,
        rates: Object.fromEntries(Object.keys(CONFIG.rates).filter((k) => Number.isFinite(rates?.[k])).map((k) => [k, round(rates[k], 1)]))
    };
}

export const settingsOf = (args) => ({ scene: args.scene, minutes: args.minutes, every: args.every, hidden: args.hidden, warmup: round(args.warmup, 2) });

/** Why a baseline cannot be saved from this run, or null. */
export function baselineRefusal({ failed, analysis }) {
    if (failed) return `the run failed (${failed})`;
    const short = Object.values(analysis).find((a) => a.verdict === 'short');
    if (short) return `the run is too short to judge (${short.why})`;
    const fail = Object.entries(analysis).find(([, a]) => a.verdict === 'FAIL');
    if (fail) return `${fail[1].label} FAILED (${fail[1].why}): a baseline that grows would pass the next leak`;
    return null;
}

/** One number against the baseline: worse by more than both the floor and the ratio fails. */
function judgeNumber(base, now, floor, ratio) {
    if (!Number.isFinite(base) || !Number.isFinite(now)) return { verdict: 'not judged' };
    const worse = now - base;
    return { change: round(worse, 3), verdict: worse > floor && worse > Math.abs(base) * ratio ? 'REGRESSED' : 'ok' };
}

/**
 * Compare with bench/soak-baseline.json. Another board is not comparable (`reason`); a slope that
 * this run or the baseline could not judge (too short) is "not judged"; levels are always compared.
 */
export function compareToBaseline(analysis, args, baseline, cfg = CONFIG, rates = null) {
    const bs = baseline?.settings;
    if (!bs) return { comparable: false, reason: 'the baseline records no settings', checks: [], regressed: false };
    if (bs.scene !== args.scene) return { comparable: false, reason: `the baseline is the ${bs.scene} board, this run ${args.scene}`, checks: [], regressed: false };
    const notes = [];
    if (bs.minutes !== args.minutes || bs.hidden !== args.hidden || bs.every !== args.every) {
        notes.push(`settings differ: baseline ${bs.minutes} min, hidden ${bs.hidden}, every ${bs.every} s; this run ${args.minutes} min, hidden ${args.hidden}, every ${args.every} s (slopes are per minute, so still compared)`);
    }
    const checks = [];
    for (const [key, def] of Object.entries(cfg.metrics)) {
        if (!def.compare) continue;
        const now = analysis[key];
        const base = baseline.metrics?.[key];
        if (!base) { checks.push({ metric: key, what: '—', verdict: 'no baseline' }); continue; }
        const slopeJudged = now?.verdict !== 'short' && base.spanMin >= cfg.minFitMinutes && base.n >= cfg.minFitSamples;
        checks.push({
            metric: key, what: `slope ${def.unit}/min`, base: base.slope, now: round(now?.fit?.slope, 4),
            ...(slopeJudged ? judgeNumber(base.slope, now?.fit?.slope, def.compare.slopeFloor, def.compare.slopeRatio) : { verdict: 'not judged' })
        });
        checks.push({
            metric: key, what: `level ${def.unit}`, base: base.level, now: round(now?.level, 1),
            ...judgeNumber(base.level, now?.level, def.compare.levelFloor, def.compare.levelRatio)
        });
    }
    for (const [key, def] of Object.entries(cfg.rates || {})) {
        const base = baseline.rates?.[key];
        if (!Number.isFinite(base)) { checks.push({ metric: key, what: `visible ${def.unit}`, verdict: 'no baseline' }); continue; }
        checks.push({
            metric: key, what: `visible ${def.unit}`, base, now: round(rates?.[key], 1),
            ...judgeNumber(base, rates?.[key], def.compare.floor, def.compare.ratio)
        });
    }
    return { comparable: true, notes, checks, regressed: checks.some((c) => c.verdict === 'REGRESSED') };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function round(v, places = 3) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const f = 10 ** places;
    return Math.round(v * f) / f;
}

export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function table(header, lines) {
    const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => String(l[i]).length)));
    const row = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ');
    return [row(header), widths.map((w) => '-'.repeat(w)).join('  '), ...lines.map(row)].join('\n');
}

const mb = (bytes) => (Number.isFinite(bytes) ? bytes / 1048576 : null);

/** The per-sample columns, printed as each sample is taken. */
export const SAMPLE_COLUMNS = [
    { h: 't min', w: 6, v: (s) => fmt(s.tS / 60, 1) },
    { h: 'phase', w: 7, v: (s) => (s.phase === 'hidden' ? 'hidden' : s.fit ? 'visible' : 'warm-up') },
    { h: 'heap MB', w: 8, v: (s) => fmt(mb(s.cdp?.JSHeapUsedSize), 2) },
    { h: 'total MB', w: 8, v: (s) => fmt(mb(s.cdp?.JSHeapTotalSize), 1) },
    { h: 'nodes', w: 6, v: (s) => fmt(s.cdp?.Nodes, 0) },
    { h: 'elems', w: 6, v: (s) => fmt(s.page?.elements, 0) },
    { h: 'listnr', w: 6, v: (s) => fmt(s.cdp?.JSEventListeners, 0) },
    { h: 'docs', w: 4, v: (s) => fmt(s.cdp?.Documents, 0) },
    { h: 'bus', w: 4, v: (s) => fmt(s.page?.bus?.total, 0) },
    { h: 'Tokens', w: 6, v: (s) => fmt(s.page?.tokens, 0) },
    { h: 'piles', w: 5, v: (s) => fmt(s.page?.sprites, 0) },
    { h: 'toasts', w: 6, v: (s) => fmt(s.page?.notifications, 0) },
    { h: 'fps', w: 5, v: (s, iv) => fmt(iv?.fps, 0) },
    { h: 'tick/s', w: 6, v: (s, iv) => fmt(iv?.ticksPerS, 1) },
    { h: 'task ms/s', w: 9, v: (s, iv) => fmt(iv?.taskMsPerS, 0) },
    { h: 'rend MB', w: 7, v: (s) => fmt(s.proc?.renderer?.privateKb / 1024, 0) }
];

export const sampleHeader = () => SAMPLE_COLUMNS.map((c, i) => (i === 0 ? c.h.padEnd(c.w) : c.h.padStart(c.w))).join('  ');

/** One sample's row; `iv` is the interval that ends with it (rates), or null for the first. */
export const sampleRow = (s, iv) => SAMPLE_COLUMNS.map((c, i) => {
    const v = String(c.v(s, iv));
    return i === 0 ? v.padEnd(c.w) : v.padStart(c.w);
}).join('  ');

/** The slopes table: one line per metric. */
export function slopesTable(analysis) {
    const lines = Object.values(analysis).map((a) => [
        a.label,
        a.fit ? `${a.fit.n} / ${fmt(a.fit.spanMin, 1)}` : '—',
        a.fit ? `${fmt(a.fit.slope, 2)} ${a.unit}` : '—',
        fmt(a.net, 0),
        a.unit === 'KB' ? (Number.isFinite(a.level) ? `${fmt(a.level / 1024, 1)} MB` : '—') : fmt(a.level, 0),
        a.fit ? fmt(a.fit.r2, 2) : '—',
        a.hiddenFit ? `${fmt(a.hiddenFit.slope, 2)}` : '—',
        a.verdict + (a.why ? `: ${a.why}` : '')
    ]);
    return table(['metric', 'fit n / min', 'slope per min', 'net', 'level', 'r²', 'hidden slope', 'verdict'], lines);
}

/** The hidden phase, in words and numbers. */
export function hiddenText(h) {
    if (!h?.ran) return 'Hidden phase: not run (--hidden=0).';
    const rate = (r, k, d = 1) => fmt(r?.[k], d);
    const lines = [
        `Hidden phase: document ${h.visibilityHidden ? 'hidden' : 'NOT hidden'} at every hidden sample; drawing clocks ${h.drawingPaused === null ? 'unknown (the page has no __perf.drawingPaused)' : h.drawingPaused ? 'paused' : 'NOT paused'}; afterwards ${h.visibleAgain ? 'visible' : 'NOT visible'}, clocks ${h.drawingResumed === null ? 'unknown' : h.drawingResumed ? 'running' : 'still paused'}.`,
        table(['phase', 'intervals', 'fps', 'engine ticks/s', 'page task ms/s', 'script ms/s', 'style passes/s', 'layouts/s'], [
            ['visible', h.visible.intervals, rate(h.visible, 'fps'), rate(h.visible, 'ticksPerS'), rate(h.visible, 'taskMsPerS'), rate(h.visible, 'scriptMsPerS'), rate(h.visible, 'stylesPerS'), rate(h.visible, 'layoutsPerS')],
            ['hidden', h.hidden.intervals, rate(h.hidden, 'fps'), rate(h.hidden, 'ticksPerS'), rate(h.hidden, 'taskMsPerS'), rate(h.hidden, 'scriptMsPerS'), rate(h.hidden, 'stylesPerS'), rate(h.hidden, 'layoutsPerS')]
        ]),
        `Page task time hidden / visible: ${h.taskShare === null ? '—' : fmt(h.taskShare * 100, 0) + ' %'}; engine ticks hidden / visible: ${h.tickShare === null ? '—' : fmt(h.tickShare * 100, 0) + ' %'}.`
    ];
    const lv = Object.entries(h.levels || {});
    if (lv.length) {
        const v = (l, x) => (l.unit === 'KB' ? fmt(x / 1024, 2) : fmt(x, 0));
        const g = (key) => {
            const x = h.growth?.[key];
            if (!x) return '—';
            return `${fmt(x.slope, 2)}${x.judged ? '' : ' (not judged)'}`;
        };
        lines.push(table(['held while hidden', 'before', 'hidden max', 'after', 'hidden slope /min'], lv.map(([key, l]) => [
            `${l.label}${l.unit === 'KB' ? ' (MB)' : ''}`, v(l, l.before), v(l, l.hiddenMax), v(l, l.after), g(key)
        ])));
        const short = Object.values(h.growth || {}).find((x) => !x.judged);
        if (short) lines.push(`Hidden slopes are judged from ${CONFIG.minHiddenSamples} samples over ${CONFIG.minHiddenMinutes} min; this hidden phase had ${short.n} over ${fmt(short.spanMin, 1)} min.`);
    }
    if (h.failed) lines.push(`✗ ${h.failed}`);
    for (const p of h.problems) lines.push(`✗ ${p}`);
    if (!h.failed && !h.problems.length) lines.push('✓ Hidden, the page stopped drawing and kept playing, and came back.');
    return lines.join('\n');
}
