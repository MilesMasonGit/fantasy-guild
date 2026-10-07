// The in-game perf harness.
// ⚠️ DEV AND PERF BUILDS ONLY. `main.jsx` imports this behind a compile-time check, so a normal
// production build never contains it.
// It measures frame interval, frame work, long animation frames, engine ticks, React commits
// (via `<PerfProfiler>`), EventBus traffic, DOM nodes, listeners and heap.
// The harness must not become what it measures: nothing is installed until `start()`; `stop()`
// removes every wrapper, observer, listener and timer, so off costs nothing. Per frame it does
// one histogram increment, one ring write and one `postMessage`. The HUD updates at most twice
// a second, by `textContent`, outside React. Memory is fixed-size, and the report's by-name
// tables are bounded.

import { GameLoop } from '../../../systems/core/GameLoop.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { GameState } from '../../../state/GameState.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { MsHistogram, Ring, round } from './perfStats.js';
import { reactCommits, PROFILED_SURFACES, ownRenders, SELF_COUNTED } from './PerfProfiler.jsx';
import { HUD_STORAGE_KEY, profilingArmed, stressFromUrl, hudRemembered } from './perfFlags.js';
import { mountHud, unmountHud, renderHud, hudStatus, hudNodeCount, hudMounted } from './perfHud.js';
import { buildStress, resolveStress, STRESS_SCENARIOS, STRESS_STARTED_EVENT } from './stressScenarios.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

const REPORT_VERSION = 1;
const THRESHOLDS = [6.06, 8.33, 16.7];
const HUD_INTERVAL_MS = 500;
const SLOW_SAMPLE_MS = 2000;
const MAX_NAMED = 200;


const frames = new MsHistogram(0.01, 250);
const frameRing = new Ring(4096);
const frameWork = new MsHistogram(0.01, 250);
const ticks = new MsHistogram(0.001, 50);

let running = false;
let scenario = null;          // { id, name, label, buildMs, census, operations }
let windowStart = 0;          // performance.now() at reset
let windowStartWall = 0;      // Date.now() at reset
let hiddenMs = 0;
let hiddenSince = null;

let rafId = 0;
let lastFrameTs = 0;
let pendingFrameStart = 0;
let channel = null;

let loafObserver = null;
let loafType = null;          // 'long-animation-frame' | 'longtask' | null
let loaf = freshLoaf();

let eventsTotal = 0;
let listenerCalls = 0;
let eventsByName = new Map();

let originalPublish = null;
let publishWasOwn = false;
let originalRunHandlers = null;
let runHandlersWasOwn = false;

let hudTimer = 0;
let slowTimer = 0;
let dom = { last: null, min: null, max: null };
let listeners = { last: null, min: null, max: null };
let heap = { startMb: null, lastMb: null, maxMb: null, totalMb: null, limitMb: null };

// Rates on the HUD are "since the last HUD update", not whole-window.
let lastRate = { at: 0, events: 0, ticks: 0, commits: {}, own: {} };
let rates = { events: null, ticks: null, react: {}, own: {} };

function freshLoaf() {
    return { count: 0, over100: 0, over200: 0, maxMs: 0, totalMs: 0, blockingMs: 0, scripts: new Map(), worst: [] };
}


function onFrame(ts) {
    if (lastFrameTs) {
        const d = ts - lastFrameTs;
        frames.add(d);
        frameRing.add(d);
    }
    lastFrameTs = ts;
    // Frame work: the first task after this frame's rendering runs this
    // message. From the frame's start (ts) to then is the main thread's time
    // on this frame, plus anything else that ran before the thread came free.
    pendingFrameStart = ts;
    channel.port2.postMessage(0);
    rafId = requestAnimationFrame(onFrame);
}

function onFrameDone() {
    if (!pendingFrameStart) return;
    frameWork.add(performance.now() - pendingFrameStart);
    pendingFrameStart = 0;
}

function scriptKey(s) {
    const url = (s.sourceURL || '').replace(/^.*\/(src|node_modules|@fs)\//, '$1/').replace(/\?.*$/, '');
    const fn = s.sourceFunctionName || '';
    return `${s.invokerType || '?'} ${s.invoker || ''}${fn ? ' → ' + fn : ''}${url ? ' @ ' + url : ''}`.trim();
}

function onLoaf(list) {
    for (const e of list.getEntries()) {
        loaf.count++;
        loaf.totalMs += e.duration;
        if (e.blockingDuration) loaf.blockingMs += e.blockingDuration;
        if (e.duration > 100) loaf.over100++;
        if (e.duration > 200) loaf.over200++;
        if (e.duration > loaf.maxMs) loaf.maxMs = e.duration;
        const scripts = [];
        for (const s of e.scripts || []) {
            let key = scriptKey(s);
            if (!loaf.scripts.has(key) && loaf.scripts.size >= MAX_NAMED) key = '(other)';
            const agg = loaf.scripts.get(key) || { count: 0, totalMs: 0, maxMs: 0, forcedLayoutMs: 0 };
            agg.count++;
            agg.totalMs += s.duration;
            agg.maxMs = Math.max(agg.maxMs, s.duration);
            agg.forcedLayoutMs += s.forcedStyleAndLayoutDuration || 0;
            loaf.scripts.set(key, agg);
            scripts.push({ key: scriptKey(s), ms: round(s.duration, 1) });
        }
        const item = {
            atS: round((e.startTime - windowStart) / 1000, 1),
            ms: round(e.duration, 1),
            blockingMs: round(e.blockingDuration ?? null, 1),
            renderMs: e.renderStart ? round(e.startTime + e.duration - e.renderStart, 1) : null,
            styleLayoutMs: e.styleAndLayoutStart ? round(e.startTime + e.duration - e.styleAndLayoutStart, 1) : null,
            scripts: scripts.sort((a, b) => b.ms - a.ms).slice(0, 5)
        };
        loaf.worst.push(item);
        loaf.worst.sort((a, b) => b.ms - a.ms);
        if (loaf.worst.length > 10) loaf.worst.length = 10;
    }
}

function startLoaf() {
    const types = globalThis.PerformanceObserver?.supportedEntryTypes || [];
    loafType = types.includes('long-animation-frame') ? 'long-animation-frame'
        : types.includes('longtask') ? 'longtask' : null;
    if (!loafType) return;
    try {
        loafObserver = new PerformanceObserver(onLoaf);
        loafObserver.observe({ type: loafType, buffered: false });
    } catch {
        loafObserver = null;
        loafType = null;
    }
}

function countingPublish(eventName, payload) {
    eventsTotal++;
    const subs = this.subscribers?.get(eventName);
    if (subs) listenerCalls += subs.size;
    const key = eventsByName.has(eventName) || eventsByName.size < MAX_NAMED ? eventName : '(other)';
    eventsByName.set(key, (eventsByName.get(key) || 0) + 1);
    return originalPublish.call(this, eventName, payload);
}

function timedRunHandlers(delta) {
    const t0 = performance.now();
    try {
        return originalRunHandlers.call(this, delta);
    } finally {
        const t1 = performance.now();
        ticks.add(t1 - t0);
        try { performance.measure('fg-perf:tick', { start: t0, end: t1 }); } catch { /* old browser */ }
    }
}

function wrapEngine() {
    publishWasOwn = Object.prototype.hasOwnProperty.call(EventBus, 'publish');
    originalPublish = EventBus.publish;
    EventBus.publish = countingPublish;

    runHandlersWasOwn = Object.prototype.hasOwnProperty.call(GameLoop, 'runHandlers');
    originalRunHandlers = GameLoop.runHandlers;
    GameLoop.runHandlers = timedRunHandlers;
}

function unwrapEngine() {
    if (originalPublish) {
        if (publishWasOwn) EventBus.publish = originalPublish; else delete EventBus.publish;
        originalPublish = null;
    }
    if (originalRunHandlers) {
        if (runHandlersWasOwn) GameLoop.runHandlers = originalRunHandlers; else delete GameLoop.runHandlers;
        originalRunHandlers = null;
    }
}

function onVisibility() {
    if (document.visibilityState === 'hidden') {
        if (hiddenSince === null) hiddenSince = performance.now();
    } else if (hiddenSince !== null) {
        hiddenMs += performance.now() - hiddenSince;
        hiddenSince = null;
    }
}

function listenerTotal() {
    let n = 0;
    for (const set of EventBus.subscribers?.values?.() || []) n += set.size;
    return n;
}

function track(obj, v) {
    obj.last = v;
    obj.min = obj.min === null ? v : Math.min(obj.min, v);
    obj.max = obj.max === null ? v : Math.max(obj.max, v);
}

function slowSample() {
    track(dom, document.getElementsByTagName('*').length - hudNodeCount());
    track(listeners, listenerTotal());
    const m = performance.memory;
    if (m) {
        const used = m.usedJSHeapSize / 1048576;
        if (heap.startMb === null) heap.startMb = used;
        heap.lastMb = used;
        heap.maxMb = Math.max(heap.maxMb ?? 0, used);
        heap.totalMb = m.totalJSHeapSize / 1048576;
        heap.limitMb = m.jsHeapSizeLimit / 1048576;
    }
    // User Timing entries are kept by the browser until cleared; a 60-minute
    // soak would otherwise pile up 36,000 of them in the tool's own name.
    try { performance.clearMeasures('fg-perf:tick'); } catch { /* ignore */ }
}

function updateRates() {
    const now = performance.now();
    const dt = (now - lastRate.at) / 1000;
    if (lastRate.at && dt > 0) {
        rates.events = (eventsTotal - lastRate.events) / dt;
        rates.ticks = (ticks.count - lastRate.ticks) / dt;
        for (const id of PROFILED_SURFACES) {
            const c = reactCommits[id]?.commits || 0;
            rates.react[id] = (c - (lastRate.commits[id] || 0)) / dt;
            lastRate.commits[id] = c;
        }
        for (const id of SELF_COUNTED) {
            const n = ownRenders[id] || 0;
            rates.own[id] = (n - (lastRate.own[id] || 0)) / dt;
            lastRate.own[id] = n;
        }
    } else {
        for (const id of PROFILED_SURFACES) lastRate.commits[id] = reactCommits[id]?.commits || 0;
        for (const id of SELF_COUNTED) lastRate.own[id] = ownRenders[id] || 0;
    }
    lastRate.at = now;
    lastRate.events = eventsTotal;
    lastRate.ticks = ticks.count;
}

function hudTick() {
    updateRates();
    if (hudMounted()) renderHud(snapshot());
}


export function reset() {
    frames.reset(); frameRing.reset(); frameWork.reset(); ticks.reset();
    loaf = freshLoaf();
    eventsTotal = 0; listenerCalls = 0; eventsByName = new Map();
    for (const id of Object.keys(reactCommits)) delete reactCommits[id];
    for (const id of Object.keys(ownRenders)) delete ownRenders[id];
    dom = { last: null, min: null, max: null };
    listeners = { last: null, min: null, max: null };
    heap = { startMb: null, lastMb: null, maxMb: null, totalMb: null, limitMb: null };
    lastRate = { at: 0, events: 0, ticks: 0, commits: {}, own: {} };
    rates = { events: null, ticks: null, react: {}, own: {} };
    hiddenMs = 0;
    hiddenSince = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? performance.now() : null;
    lastFrameTs = 0;
    pendingFrameStart = 0;
    windowStart = performance.now();
    windowStartWall = Date.now();
    if (running) slowSample();
}

function startCollectors() {
    if (running) return;
    running = true;
    channel = new MessageChannel();
    channel.port1.onmessage = onFrameDone;
    wrapEngine();
    startLoaf();
    document.addEventListener('visibilitychange', onVisibility);
    reset();
    rafId = requestAnimationFrame(onFrame);
    hudTimer = setInterval(hudTick, HUD_INTERVAL_MS);
    slowTimer = setInterval(slowSample, SLOW_SAMPLE_MS);
}

export function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearInterval(hudTimer);
    clearInterval(slowTimer);
    loafObserver?.disconnect();
    loafObserver = null;
    if (channel) { channel.port1.onmessage = null; channel.port1.close(); channel = null; }
    document.removeEventListener('visibilitychange', onVisibility);
    unwrapEngine();
    try { performance.clearMeasures('fg-perf:tick'); } catch { /* ignore */ }
}

/**
 * Start measuring. With a scenario name (`quiet`, `realistic`, `torture`,
 * `push`, `rebuild` or `S1`…`S5`), build that stress board first — replacing
 * whatever game is in this tab (saves are never touched). With none, measure
 * the game as it is.
 *
 * @returns {Promise<object>} the scenario that was built, or `{ id: 'live' }`
 */
export async function start(name) {
    if (name) {
        if (!resolveStress(name)) throw new Error(`Unknown stress scenario "${name}"`);
        scenario = await buildStress(name);
    } else if (!scenario) {
        scenario = { id: 'live', name: 'live', label: 'Live game' };
    }
    startCollectors();
    reset();
    return scenario;
}

export function snapshot() {
    const f = frames.summary(THRESHOLDS);
    const ring = frameRing.summary();
    const nowHidden = hiddenMs + (hiddenSince !== null ? performance.now() - hiddenSince : 0);
    let top = null;
    for (const [key, agg] of loaf.scripts) {
        if (!top || agg.totalMs > top[1].totalMs) top = [key, agg];
    }
    return {
        scenario: scenario ? { id: scenario.id, name: scenario.name } : null,
        windowSeconds: (performance.now() - windowStart) / 1000,
        hiddenMs: nowHidden,
        refreshHz: ring.p50 ? 1000 / ring.p50 : null,
        frames: f,
        frameWork: frameWork.summary(),
        loaf: { supported: loafType === 'long-animation-frame', count: loaf.count, maxMs: loaf.maxMs, top: top ? top[0].slice(0, 60) : null },
        tick: { ...ticks.summary(), perSecond: rates.ticks },
        reactArmed: profilingArmed(),
        react: rates.react,
        ownRenders: rates.own,
        eventsPerSecond: rates.events,
        listeners: listeners.last,
        domNodes: dom.last,
        heapMb: heap.lastMb
    };
}

function tableTop(map, n, valueOf = (v) => v) {
    return [...map.entries()].sort((a, b) => valueOf(b[1]) - valueOf(a[1])).slice(0, n);
}

export function report() {
    const seconds = (performance.now() - windowStart) / 1000;
    const perS = (n) => (seconds > 0 ? round(n / seconds, 2) : null);
    const ring = frameRing.summary();
    const refreshHz = ring.p50 ? round(1000 / ring.p50, 1) : null;
    const vsync = ring.p50 || null;
    const react = {};
    for (const id of PROFILED_SURFACES) {
        const c = reactCommits[id] || { commits: 0, mounts: 0, totalMs: 0, maxMs: 0 };
        react[id] = { commits: c.commits, perSecond: perS(c.commits), mounts: c.mounts, totalMs: round(c.totalMs, 1), maxMs: round(c.maxMs, 2) };
    }
    const own = {};
    for (const id of SELF_COUNTED) own[id] = { renders: ownRenders[id] || 0, perSecond: perS(ownRenders[id] || 0) };
    const nowHidden = hiddenMs + (hiddenSince !== null ? performance.now() - hiddenSince : 0);
    let census = null;
    try {
        if (GameState.getIsInitialized?.() || GameState.state) {
            const tokens = BoardState.tokens();
            census = {
                tokens: tokens.length,
                heroes: (GameState.state?.heroes || []).length,
                sprites: (GameState.state?.board?.sprites || []).length
            };
        }
    } catch { census = null; }

    return {
        tool: 'fantasy-guild-perf-hud',
        reportVersion: REPORT_VERSION,
        scenario: scenario ? { ...scenario } : null,
        running,
        window: {
            startedAt: windowStartWall ? new Date(windowStartWall).toISOString() : null,
            endedAt: new Date().toISOString(),
            seconds: round(seconds, 1),
            hiddenSeconds: round(nowHidden / 1000, 1),
            // ⚠ A hidden or background window throttles timers and frames; numbers from one are not representative.
            representative: nowHidden < 1000 && frames.count > 0
        },
        env: {
            userAgent: navigator.userAgent,
            build: import.meta.env.DEV ? 'vite-dev (React development build)' : import.meta.env.MODE === 'perf' ? 'perf' : 'production',
            appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
            refreshHzEstimate: refreshHz,
            devicePixelRatio: globalThis.devicePixelRatio ?? null,
            viewport: { w: globalThis.innerWidth ?? null, h: globalThis.innerHeight ?? null },
            screen: globalThis.screen ? { w: screen.width, h: screen.height } : null,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            focused: typeof document.hasFocus === 'function' ? document.hasFocus() : null
        },
        census,
        frames: {
            ...frames.summary(THRESHOLDS),
            // Frames whose interval was over 1.5 refreshes: a vsync was missed.
            // On a 60 Hz screen the 6.06 / 8.33 counts are every frame by
            // definition; this and `frameWork` are the numbers to read there.
            missedVsync: vsync ? frames.countOver(vsync * 1.5) : null,
            recent: ring
        },
        frameWork: {
            note: 'estimate: frame start (rAF timestamp) to the first task after the frame; includes style/layout/paint and any script that ran in the frame',
            ...frameWork.summary(THRESHOLDS)
        },
        longAnimationFrames: {
            api: loafType,
            supported: loafType === 'long-animation-frame',
            count: loaf.count,
            over100ms: loaf.over100,
            over200ms: loaf.over200,
            maxMs: round(loaf.maxMs, 1),
            totalMs: round(loaf.totalMs, 1),
            blockingMs: round(loaf.blockingMs, 1),
            topScripts: tableTop(loaf.scripts, 12, v => v.totalMs).map(([key, v]) => ({
                script: key, count: v.count, totalMs: round(v.totalMs, 1), maxMs: round(v.maxMs, 1), forcedLayoutMs: round(v.forcedLayoutMs, 1)
            })),
            worst: loaf.worst
        },
        tick: { ...ticks.summary(), perSecond: perS(ticks.count) },
        // `surfaces` are Profiler subtree commits: 'MatBoard' there is the mat SUBTREE (every
        // hero frame step counts). `ownRenders` is the component's own committed renders.
        react: { armed: profilingArmed(), surfaces: react, ownRenders: own },
        events: {
            total: eventsTotal,
            perSecond: perS(eventsTotal),
            listenerCalls,
            listenerCallsPerSecond: perS(listenerCalls),
            top: tableTop(eventsByName, 25).map(([name, count]) => ({ name, count, perSecond: perS(count) }))
        },
        dom: { nodes: dom.last, min: dom.min, max: dom.max },
        listeners: { total: listeners.last, min: listeners.min, max: listeners.max },
        heap: heap.lastMb === null ? null : {
            usedMb: round(heap.lastMb, 1), startMb: round(heap.startMb, 1), maxMb: round(heap.maxMb, 1),
            totalMb: round(heap.totalMb, 1), limitMb: round(heap.limitMb, 0),
            note: 'performance.memory (Chromium only), NOT after a forced GC — use DevTools for the soak heap check'
        }
    };
}

export async function copyReport() {
    const text = JSON.stringify(report(), null, 2);
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        let ok;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
        return ok;
    }
}

export function showHud() {
    try { globalThis.localStorage?.setItem(HUD_STORAGE_KEY, '1'); } catch { /* ignore */ }
    if (!running) {
        if (!scenario) scenario = { id: 'live', name: 'live', label: 'Live game' };
        startCollectors();
    }
    mountHud({
        copy: async () => hudStatus((await copyReport()) ? 'Copied ✓ — paste it into the chat' : 'Copy failed — use window.__perf.report()'),
        reset: () => { reset(); hudStatus('Reset'); },
        close: () => hideHud()
    });
    hudTick();
}

export function hideHud() {
    try { globalThis.localStorage?.removeItem(HUD_STORAGE_KEY); } catch { /* ignore */ }
    unmountHud();
    stop();
}

export function toggleHud() {
    if (hudMounted()) hideHud(); else showHud();
    return hudMounted();
}

/**
 * Run `n` engine ticks of 100 ms, in chunks, yielding a frame between chunks. For agents in a
 * throttled preview pane, where the wall-clock loop barely runs. Ticks go through the
 * (wrapped) `GameLoop.runHandlers`.
 */
export async function drive(n = 100, chunk = 20) {
    let done = 0;
    while (done < n) {
        const k = Math.min(chunk, n - done);
        for (let i = 0; i < k; i++) GameLoop.runHandlers(100);
        done += k;
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        await new Promise(r => setTimeout(r, 0));
    }
    return done;
}

function whenUiReady(timeoutMs = 10000) {
    const t0 = performance.now();
    return new Promise((resolve) => {
        const check = () => {
            if (EventBus.hasSubscribers(STRESS_STARTED_EVENT) || performance.now() - t0 > timeoutMs) resolve();
            else setTimeout(check, 50);
        };
        check();
    });
}

/**
 * Install `window.__perf` and honour the URL flags. Called once from
 * `main.jsx`, dev builds only, after React has mounted.
 */
export async function installPerf() {
    const api = {
        start,
        stop,
        reset,
        report,
        snapshot,
        copyReport,
        showHud,
        hideHud,
        toggleHud,
        drive,
        scenarios: STRESS_SCENARIOS.map(s => ({ name: s.name, id: s.id, label: s.label })),
        get running() { return running; },
        get profilingArmed() { return profilingArmed(); }
    };
    globalThis.__perf = api;

    const stress = stressFromUrl();
    const params = new URLSearchParams(globalThis.location?.search || '');
    const wantHud = !!stress || params.get('perf') === '1' || hudRemembered();
    if (stress) {
        await whenUiReady();
        try {
            await start(stress);
        } catch (err) {
            console.error('[perf] stress scenario failed:', err);
        }
    }
    if (wantHud) showHud();
    return api;
}
