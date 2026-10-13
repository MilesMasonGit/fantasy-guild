// React commits per engine tick, on a stress board in the dev build.
//
//   node bench/tick-commits.mjs                       this checkout, S2
//   node bench/tick-commits.mjs --b=<checkout path>   A/B: this checkout (A) against another (B), A,B,B,A
//   node bench/tick-commits.mjs --a=<before> --b=<after>   A/B of two other checkouts
//   options: --scene=realistic (any ?stress= name) · --settle=150 · --ticks=600 (ticks) · --top=30
//            · --seed=1 · --dump=40 (print the first commits of the window)
//
// How it counts: a stand-in for the React DevTools hook is installed before the page's first
// script, so React (dev build) reports every commit to it. Each commit's fibers are walked as the
// DevTools do: a subtree whose child list is the same object as last commit's was not reached; a
// component in a reached subtree rendered when React marked it `PerformedWork`. A rendered
// component whose nearest component parent did not render is an ORIGIN: its own state, a
// context or a store woke it.
//
// The same work on both sides: the game loop is stopped and the tool drives the ticks itself,
// 100 ms of game time each, paced on the wall clock as the loop paces them. While a tick runs,
// `Math.random` is a seeded stream and `Date.now` a clock that moves 100 ms a tick, so the
// board is built and played identically on every run whatever the UI does in between; the
// engine events of the measured ticks are counted and fingerprinted, and two runs that did not
// do the same work are flagged (WORK DIFFERS).
//
// Two windows: **driven** (the ticks) and **idle** (as long, no ticks: what commits without
// any tick, from timers and animations). Commits a tick sets off = (driven − idle) ÷ ticks, and
// the same for each component's renders.
//
// ⚠️ Dev build only: the stand-in hook needs React's development build, which reports fibers
// by name. A dev server per checkout, each on its own port and its own Vite cache.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launchChrome, sleep, onCleanup } from './browser/cdp.mjs';
import { freePort } from './browser/servers.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
    const a = { scene: 'realistic', settle: 150, ticks: 600, top: 30, a: null, b: null, seed: 1, dump: 0 };
    for (const s of argv) {
        const m = /^--([^=]+)(?:=(.*))?$/.exec(s);
        if (!m) continue;
        const [, k, v] = m;
        if (k === 'a' || k === 'b') a[k] = path.resolve(v);
        else if (k === 'scene') a.scene = v;
        else if (['settle', 'ticks', 'top', 'seed', 'dump'].includes(k)) a[k] = Number(v);
    }
    return a;
}

async function startDev(root) {
    const { createServer } = await import('vite');
    const tailwind = (await import('@tailwindcss/postcss')).default;
    const autoprefixer = (await import('autoprefixer')).default;
    const port = await freePort();
    const key = createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 8);
    const server = await createServer({
        root,
        configFile: path.join(root, 'vite.config.js'),
        // ⚠️ Tailwind finds the classes in use from the working directory unless told: told this
        // checkout, or a server for another checkout draws without half its styles.
        css: { postcss: { plugins: [tailwind({ base: root }), autoprefixer()] } },
        cacheDir: path.join(root, 'node_modules', `.vite-commits-${path.basename(root)}-${key}`),
        server: { port, strictPort: true, host: 'localhost', open: false },
        logLevel: 'warn',
        clearScreen: false
    });
    await server.listen();
    const unregister = onCleanup(() => { server.close(); });
    return { url: `http://localhost:${port}`, close: async () => { unregister(); await server.close(); } };
}

// Runs in the page before any of its scripts.
const HOOK = `(() => {
    const S = window.__tc = { on: false, commits: [], ticks: [], events: {}, fp: 0, ids: new Map(), t: null };
    // Main-thread time, per kind (reset with each window): React's scheduler tasks (render,
    // commit and effects), microtasks (the stores' selectors, React's own scheduling), and,
    // inside ticks, the engine's listeners and the UI's, each exclusive of what it called.
    const freshTimes = () => ({ schedMs: 0, schedTasks: 0, microMs: 0, micro: 0, uiListenerMs: 0, engineListenerMs: 0, uiByEvent: {}, afterTickMs: 0 });
    S.t = freshTimes();
    S.freshTimes = freshTimes;
    const RealMC = window.MessageChannel;
    const portSetter = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage').set;
    window.MessageChannel = function () {
        const mc = new RealMC();
        let handler = null;
        Object.defineProperty(mc.port1, 'onmessage', {
            configurable: true,
            get() { return handler; },
            set(fn) {
                handler = fn;
                const timed = fn && fn.name === 'performWorkUntilDeadline'
                    ? function (ev) {
                        const t0 = performance.now();
                        try { return fn.call(this, ev); }
                        finally { if (S.on) { S.t.schedMs += performance.now() - t0; S.t.schedTasks++; } }
                    }
                    : fn;
                portSetter.call(mc.port1, timed);
            }
        });
        return mc;
    };
    window.MessageChannel.prototype = RealMC.prototype;
    const realQM = window.queueMicrotask.bind(window);
    window.queueMicrotask = (fn) => realQM(() => {
        if (!S.on) return fn();
        const t0 = performance.now();
        try { return fn(); } finally { S.t.microMs += performance.now() - t0; S.t.micro++; }
    });
    const TAGS = new Set([0, 1, 11, 14, 15]);
    function nameOf(f) {
        const t = f.type;
        if (typeof t === 'function') return t.displayName || t.name || '(anonymous)';
        if (t && typeof t === 'object') {
            if (t.displayName) return t.displayName;
            if (t.render) return t.render.displayName || t.render.name || '(forwardRef)';
            if (t.type) return t.type.displayName || t.type.name || '(memo)';
        }
        return String(t);
    }
    // Each stack entry: fiber, mounting?, did the nearest component above it render this commit?
    function walk(rootFiber, acc) {
        const stack = [rootFiber, false, false];
        while (stack.length) {
            const parentRendered = stack.pop();
            const mount = stack.pop();
            const f = stack.pop();
            let rendered = parentRendered;
            if (TAGS.has(f.tag)) {
                if (mount) { acc.mounts++; rendered = true; }
                else if ((f.flags & 1) === 1) {
                    acc.renders++;
                    const n = nameOf(f);
                    acc.byName[n] = (acc.byName[n] || 0) + 1;
                    acc.selfMs[n] = (acc.selfMs[n] || 0) + (f.selfBaseDuration || 0);
                    if (!parentRendered) acc.origins[n] = (acc.origins[n] || 0) + 1;
                    rendered = true;
                } else rendered = false;
            }
            const prev = f.alternate;
            if (!mount && prev && f.child === prev.child) continue;
            for (let c = f.child; c; c = c.sibling) stack.push(c, mount || !c.alternate, rendered);
        }
    }
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        renderers: new Map(), supportsFiber: true, isDisabled: false,
        inject(internals) { const id = this.renderers.size + 1; this.renderers.set(id, internals); return id; },
        checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
        onCommitFiberRoot(id, root) {
            if (!S.on) return;
            const acc = { t: performance.now(), renders: 0, mounts: 0, byName: {}, selfMs: {}, origins: {}, ms: root.current.actualDuration ?? null };
            walk(root.current, acc);
            S.commits.push(acc);
        }
    };

    // The deterministic engine: a seeded Math.random and a 100 ms-a-tick Date.now, only while
    // the engine runs.
    const realRandom = Math.random, realNow = Date.now;
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // ⚠️ A loot sprite's absorption also runs on a wall-clock timer that races the tick due at
    // the same moment; inside the engine that timer is dropped, so absorption happens on the
    // game clock's path in the tick (the same tick every run, at most one tick later).
    const realSetTimeout = window.setTimeout;
    const engineSetTimeout = function (fn, ms, ...rest) {
        if ((new Error().stack || '').includes('SpriteLayer')) { D.droppedTimers++; return 0; }
        return realSetTimeout.call(window, fn, ms, ...rest);
    };
    const D = window.__det = {
        rng: null, vt: 0, inEngine: false, droppedTimers: 0,
        begin(seed) { D.rng = mulberry32(seed); D.vt = realNow(); },
        on() { Math.random = D.rng; Date.now = () => D.vt; window.setTimeout = engineSetTimeout; D.inEngine = true; },
        off() { Math.random = realRandom; Date.now = realNow; window.setTimeout = realSetTimeout; D.inEngine = false; }
    };
})();`;

// Build the board deterministically and stop the wall-clock loop before it ticks.
const BUILD = (scene, seed) => `(async () => {
    const P = window.__perf;
    const EB = P.game.EventBus;
    // Count the engine's own events, inside ticks only, and fingerprint them.
    const pub = EB.publish;
    EB.publish = function (name, payload) {
        const S = window.__tc;
        if (S.on && window.__det.inEngine) {
            S.events[name] = (S.events[name] || 0) + 1;
            // Ids carry the clock and a random tail: fingerprint them by first appearance.
            const id = payload && (payload.instanceId || payload.heroId || payload.typeId || payload.itemId);
            if (id && !S.ids.has(id)) S.ids.set(id, S.ids.size);
            const k = name + '|' + (id ? S.ids.get(id) : '');
            let h = S.fp | 0;
            for (let i = 0; i < k.length; i++) h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0;
            S.fp = h;
        }
        if (!(S.on && window.__det.inEngine)) return pub.apply(this, arguments);
        // EventBus.publish's own loop, with each listener timed exclusive of the listeners its
        // own publishes called.
        const subs = this.quiet && !this.quietExcept.has(name) ? this.engineSubscribers.get(name) : this.subscribers.get(name);
        if (!subs) return undefined;
        const engine = this.engineSubscribers.get(name);
        subs.forEach((cb) => {
            const outer = S.inner || 0;
            S.inner = 0;
            const t0 = performance.now();
            try { cb(payload); } catch (error) { console.error('EventBus: Error in subscriber for ' + name, error); }
            const total = performance.now() - t0;
            const self = total - S.inner;
            S.inner = outer + total;
            if (engine && engine.has(cb)) S.t.engineListenerMs += self;
            else { S.t.uiListenerMs += self; S.t.uiByEvent[name] = (S.t.uiByEvent[name] || 0) + self; }
        });
        return undefined;
    };
    // Hero and enemy pottering keep their own copy of Math.random from load: point them at
    // whichever Math.random is current (the seeded one inside a tick).
    for (const m of ['/src/systems/board/HeroMotion.js', '/src/systems/board/EnemyMotion.js']) {
        const mod = await import(m);
        mod.setRandomForTests(() => Math.random());
    }
    window.__det.begin(${seed});
    window.__det.on();
    try { await P.start(${JSON.stringify(scene)}); }
    finally { window.__det.off(); }
    P.game.GameLoop.stop();
    return P.report().scenario?.id || null;
})()`;

// Drive n ticks of 100 ms, paced on the wall clock (self-correcting, as a 100 ms interval).
const DRIVE = (n) => `new Promise((resolve) => {
    const GL = window.__perf.game.GameLoop, D = window.__det, S = window.__tc;
    let k = 0;
    const t0 = performance.now();
    const step = () => {
        const a = performance.now();
        D.on();
        try { GL.runHandlers(100); } finally { D.off(); D.vt += 100; }
        const b = performance.now();
        if (S.on) S.ticks.push([a, b]);
        // The tick's microtasks run before the next task: this message lands after them.
        if (S.on) { const ch = new MessageChannel(); ch.port1.onmessage = () => { S.t.afterTickMs += performance.now() - b; ch.port1.close(); }; ch.port2.postMessage(0); }
        k++;
        if (k >= ${n}) { setTimeout(() => resolve(k), 100); return; }
        setTimeout(step, Math.max(0, t0 + (k + 1) * 100 - performance.now()));
    };
    setTimeout(step, 100);
})`;

const BEGIN = `(() => { const S = window.__tc; S.commits = []; S.ticks = []; S.events = {}; S.fp = 0; S.ids = new Map(); S.t = S.freshTimes(); S.t0 = performance.now(); S.on = true; return true; })()`;

// Summarise in the page (commit lists are large); returns plain numbers.
const END = (dumpN) => `(() => {
    const S = window.__tc; S.on = false;
    const seconds = (performance.now() - S.t0) / 1000;
    const byName = {}, selfMs = {}, origins = {}, signatures = {};
    let renders = 0, mounts = 0, ms = 0;
    for (const c of S.commits) {
        renders += c.renders; mounts += c.mounts; ms += c.ms || 0;
        for (const [k, v] of Object.entries(c.byName)) byName[k] = (byName[k] || 0) + v;
        for (const [k, v] of Object.entries(c.selfMs)) selfMs[k] = (selfMs[k] || 0) + v;
        for (const [k, v] of Object.entries(c.origins)) origins[k] = (origins[k] || 0) + v;
        const sig = Object.keys(c.origins).sort().join(' + ') || '(mounts only)';
        const g = signatures[sig] || (signatures[sig] = { commits: 0, renders: 0, ms: 0 });
        g.commits++; g.renders += c.renders; g.ms += c.ms || 0;
    }
    // Commits between one tick's end and the next tick's start, per tick.
    const gaps = {};
    const ticks = S.ticks, commits = S.commits;
    let ci = 0;
    while (ci < commits.length && ticks.length && commits[ci].t < ticks[0][1]) ci++;
    for (let i = 0; i < ticks.length - 1; i++) {
        const end = ticks[i][1], next = ticks[i + 1][0];
        let n = 0;
        while (ci < commits.length && commits[ci].t <= next) { if (commits[ci].t >= end) n++; ci++; }
        gaps[n] = (gaps[n] || 0) + 1;
    }
    const tickMs = ticks.map(t => t[1] - t[0]).sort((a, b) => a - b);
    const sample = [];
    let ti = 0;
    for (const c of commits.slice(0, ${dumpN})) {
        while (ti + 1 < ticks.length && ticks[ti + 1][1] <= c.t) ti++;
        sample.push({ sinceTick: ticks.length && ticks[ti][1] <= c.t ? Math.round((c.t - ticks[ti][1]) * 10) / 10 : null, tick: ti,
            renders: c.renders, mounts: c.mounts, ms: c.ms, names: c.byName, origins: c.origins });
    }
    let events = 0;
    for (const v of Object.values(S.events)) events += v;
    let tickMsTotal = 0;
    for (const t of ticks) tickMsTotal += t[1] - t[0];
    return { seconds, ticks: ticks.length, commits: commits.length, renders, mounts, reactMs: ms, byName, selfMs, origins, signatures, times: S.t, tickMsTotal,
        commitsBetweenTicks: gaps, sample, events, eventsByName: S.events, fingerprint: S.fp,
        tickP50: tickMs.length ? tickMs[Math.floor(tickMs.length / 2)] : null };
})()`;

async function measureBoard(chrome, url, args) {
    const page = await chrome.newPage();
    try {
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
        await page.navigate(`${url}/?perf=1`);
        await page.waitFor(`!!window.__perf && window.__perf.game.EventBus.hasSubscribers('dev:stress_started')`,
            { timeoutMs: 180000, intervalMs: 500, what: 'the game UI' });
        await sleep(1000);
        const id = await page.evaluate(BUILD(args.scene, args.seed), { timeoutMs: 120000 });
        if (!id || id === 'live') throw new Error(`the ${args.scene} board was not built`);
        await page.evaluate(DRIVE(args.settle), { timeoutMs: args.settle * 200 + 60000 });

        await page.evaluate(BEGIN);
        await page.evaluate(DRIVE(args.ticks), { timeoutMs: args.ticks * 200 + 60000 });
        const driven = await page.evaluate(END(args.dump));

        await page.evaluate(BEGIN);
        await sleep(driven.seconds * 1000);
        const idle = await page.evaluate(END(args.dump));
        return { driven, idle, errors: page.consoleErrors.slice(0, 5) };
    } finally {
        await page.close();
    }
}

function perTick(m) {
    const { driven, idle } = m;
    const n = driven.ticks;
    const per = (a, b) => (a - (b * driven.seconds) / idle.seconds) / n;
    const names = new Set([...Object.keys(driven.byName), ...Object.keys(idle.byName)]);
    const byName = {}, selfMs = {}, origins = {};
    for (const k of names) {
        byName[k] = per(driven.byName[k] || 0, idle.byName[k] || 0);
        selfMs[k] = per(driven.selfMs[k] || 0, idle.selfMs[k] || 0);
        origins[k] = per(driven.origins[k] || 0, idle.origins[k] || 0);
    }
    const signatures = {};
    for (const [k, g] of Object.entries(driven.signatures)) {
        const st = idle.signatures[k] || { commits: 0, renders: 0, ms: 0 };
        signatures[k] = { commits: per(g.commits, st.commits), renders: per(g.renders, st.renders), ms: per(g.ms, st.ms) };
    }
    const t = driven.times, ti = idle.times;
    const uiByEvent = Object.fromEntries(Object.entries(t.uiByEvent).map(([k, v]) => [k, v / n]));
    const times = {
        drivenSchedMsPerTick: t.schedMs / n,
        idleSchedMsPerSecond: ti.schedMs / idle.seconds,
        tickMs: driven.tickMsTotal / n,
        engineListenerMs: t.engineListenerMs / n,
        uiListenerMs: t.uiListenerMs / n,
        afterTickMs: t.afterTickMs / n,
        microMs: per(t.microMs, ti.microMs),
        schedMs: per(t.schedMs, ti.schedMs),
        schedTasks: per(t.schedTasks, ti.schedTasks),
        uiByEvent
    };
    return {
        ticks: n,
        seconds: driven.seconds,
        times,
        commitsPerTick: per(driven.commits, idle.commits),
        rendersPerTick: per(driven.renders, idle.renders),
        mountsPerTick: per(driven.mounts, idle.mounts),
        reactMsPerTick: per(driven.reactMs, idle.reactMs),
        drivenCommits: driven.commits,
        idleCommits: idle.commits,
        drivenRenders: driven.renders,
        idleRenders: idle.renders,
        commitsBetweenTicks: driven.commitsBetweenTicks,
        tickP50: driven.tickP50,
        events: driven.events,
        eventsByName: driven.eventsByName,
        fingerprint: driven.fingerprint,
        byName, selfMs, origins, signatures,
        sample: { driven: driven.sample, idle: idle.sample }
    };
}

const f2 = (x) => (x == null ? '–' : (Math.round(x * 100) / 100).toFixed(2));

function printOne(label, p, top) {
    console.log(`\n${label}`);
    console.log(`  ${p.ticks} ticks in ${f2(p.seconds)} s · tick p50 ${f2(p.tickP50)} ms · engine events ${p.events} · fingerprint ${p.fingerprint}`);
    console.log(`  while playing, everything that committed ÷ ticks: ${f2(p.drivenCommits / p.ticks)} commits, ${f2(p.drivenRenders / p.ticks)} renders, React scheduler ${f2(p.times.drivenSchedMsPerTick)} ms (dev) per tick · with no ticks: ${f2(p.idleCommits / p.seconds)} commits/s, React ${f2(p.times.idleSchedMsPerSecond)} ms/s`);
    console.log(`  commits: driven ${p.drivenCommits} · idle ${p.idleCommits} → **${f2(p.commitsPerTick)} commits per tick** (net of the no-tick background)`);
    console.log(`  component renders: driven ${p.drivenRenders} · idle ${p.idleRenders} → ${f2(p.rendersPerTick)} renders per tick, ${f2(p.mountsPerTick)} mounts per tick`);
    console.log(`  React render time (dev build, Profiler actualDuration) ${f2(p.reactMsPerTick)} ms per tick`);
    const T = p.times;
    console.log(`  main thread per tick (dev build): the tick ${f2(T.tickMs)} ms (engine listeners ${f2(T.engineListenerMs)}, UI listeners ${f2(T.uiListenerMs)}) · its microtasks ${f2(T.afterTickMs)} ms · all microtasks ${f2(T.microMs)} ms · React scheduler ${f2(T.schedMs)} ms in ${f2(T.schedTasks)} tasks`);
    const ev = Object.entries(T.uiByEvent).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`  UI listener ms per tick by event: ${ev.map(([k, v]) => `${k} ${(Math.round(v * 1000) / 1000).toFixed(3)}`).join(' · ')}`);
    console.log(`  commits between one tick and the next: ${Object.entries(p.commitsBetweenTicks).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    const rows = Object.entries(p.byName).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1]).slice(0, top);
    console.log('  per tick by component: renders · own render ms (dev) · times it was an origin');
    for (const [n, v] of rows) console.log(`    ${f2(v).padStart(7)} · ${f2(p.selfMs[n]).padStart(6)} ms · ${f2(p.origins[n]).padStart(6)}  ${n}`);
    const sigs = Object.entries(p.signatures).filter(([, g]) => Math.abs(g.commits) >= 0.005).sort((a, b) => b[1].commits - a[1].commits).slice(0, top);
    console.log('  per tick by what woke the commit (its origins): commits · renders · React ms (dev)');
    for (const [k, g] of sigs) console.log(`    ${f2(g.commits).padStart(6)} · ${f2(g.renders).padStart(6)} · ${f2(g.ms).padStart(6)} ms  ${k}`);
}

function printSample(p) {
    for (const [w, list] of Object.entries(p.sample)) {
        if (!list.length) continue;
        console.log(`\n  ${w}: first ${list.length} commits (ms since the last tick ended, tick #, renders, mounts, React ms: [origins] names)`);
        for (const c of list) {
            const names = Object.entries(c.names).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(' ');
            console.log(`    ${String(c.sinceTick).padStart(6)}  #${c.tick}  ${c.renders}r ${c.mounts}m ${c.ms == null ? '' : `${Math.round(c.ms * 10) / 10}ms`}  [${Object.keys(c.origins).join(', ')}]  ${names}`);
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const roots = [args.a || here, ...(args.b ? [args.b] : [])];
    const servers = [];
    for (const r of roots) servers.push(await startDev(r));
    const chrome = await launchChrome({});
    const order = args.b ? [0, 1, 1, 0] : [0];
    const results = roots.map(() => []);
    try {
        for (const i of order) {
            const side = i === 0 ? 'A' : 'B';
            process.stdout.write(`${side} ${roots[i]} …`);
            const m = await measureBoard(chrome, servers[i].url, args);
            const p = perTick(m);
            results[i].push(p);
            console.log(` ${f2(p.commitsPerTick)} commits per tick, ${f2(p.rendersPerTick)} renders per tick, fingerprint ${p.fingerprint}${m.errors.length ? ` (page errors: ${m.errors.join(' | ')})` : ''}`);
            if (args.dump) printSample(p);
        }
    } finally {
        await chrome.close();
        for (const s of servers) await s.close();
    }
    for (let i = 0; i < roots.length; i++) {
        for (const [k, p] of results[i].entries()) printOne(`${i === 0 ? 'A' : 'B'} run ${k + 1}: ${roots[i]} (${args.scene}, seed ${args.seed})`, p, args.top);
    }
    if (process.env.TICK_COMMITS_JSON) {
        const fs = await import('node:fs');
        fs.writeFileSync(process.env.TICK_COMMITS_JSON, JSON.stringify({ args, roots, results: results.map(rs => rs.map(({ sample, ...rest }) => rest)) }, null, 1));
    }
    const all = results.flat();
    const fps = new Set(all.map(p => `${p.events}/${p.fingerprint}`));
    if (fps.size > 1) console.log(`\n⚠️ WORK DIFFERS between runs (engine events / fingerprint): ${[...fps].join(', ')}`);
    else console.log(`\nSame work in every run: ${all[0].events} engine events, fingerprint ${all[0].fingerprint}`);
    if (args.b) {
        const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
        const [A, B] = results;
        const tm = (side, k) => f2(mean(side.map(p => p.times[k])));
        const all2 = (side, f) => f2(mean(side.map(f)));
        console.log(`A/B (means of A,B,B,A), while playing per tick: commits ${all2(A, p => p.drivenCommits / p.ticks)} → ${all2(B, p => p.drivenCommits / p.ticks)} · renders ${all2(A, p => p.drivenRenders / p.ticks)} → ${all2(B, p => p.drivenRenders / p.ticks)} · React scheduler (dev) ${tm(A, 'drivenSchedMsPerTick')} → ${tm(B, 'drivenSchedMsPerTick')} ms; with no ticks: React ${tm(A, 'idleSchedMsPerSecond')} → ${tm(B, 'idleSchedMsPerSecond')} ms/s`);
        console.log(`A/B (means of A,B,B,A), main thread ms per tick (dev): tick ${tm(A, 'tickMs')} → ${tm(B, 'tickMs')} · UI listeners ${tm(A, 'uiListenerMs')} → ${tm(B, 'uiListenerMs')} · tick microtasks ${tm(A, 'afterTickMs')} → ${tm(B, 'afterTickMs')} · React scheduler ${tm(A, 'schedMs')} → ${tm(B, 'schedMs')}`);
        console.log(`A/B (means of A,B,B,A): commits per tick ${f2(mean(A.map(p => p.commitsPerTick)))} → ${f2(mean(B.map(p => p.commitsPerTick)))} · renders per tick ${f2(mean(A.map(p => p.rendersPerTick)))} → ${f2(mean(B.map(p => p.rendersPerTick)))} · React ms per tick (dev) ${f2(mean(A.map(p => p.reactMsPerTick)))} → ${f2(mean(B.map(p => p.reactMsPerTick)))}`);
    }
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
