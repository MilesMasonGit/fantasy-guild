// How much of the mat's stacking order is rewritten per engine tick, per hover and per Token move,
// on a stress board in the dev build.
//
//   node bench/stack-writes.mjs                              this checkout, cap128
//   node bench/stack-writes.mjs --a=<before> --b=<after>     A/B of two checkouts, A,B,B,A
//   options: --scene=cap128 (any ?stress= name) · --settle=100 · --ticks=300 · --hovers=60
//            · --moves=30 · --gap=120 (ms after each hover or move) · --seed=1 · --trace · --runs=4
//
// What it counts:
// - **z changes**, by box: a MutationObserver on the mat sees every style write, and a box whose
//   z-index after a batch of writes differs from before is one change. Token art, Token badges,
//   flags and heroes are counted apart. A box's first z (a Token or hero arriving) is not a change.
// - **React renders**, by component (dev build): the same stand-in for the DevTools hook as
//   `tick-commits.mjs`.
// - with `--trace`: **elements restyled**, the sum of `UpdateLayoutTree` element counts while
//   hovering and while moving, net of a window as long with nothing done (animations restyle on
//   their own).
//
// Three phases on one board, in order: **ticks** (the tool drives them, deterministic as in
// `tick-commits.mjs`: seeded `Math.random`, a 100 ms-a-tick clock inside each tick, the engine's
// events fingerprinted), **hovers** (real mouse moves from the browser onto the centres of Tokens
// spread over the mat, back to front; each one moves the hover from the last Token to the next),
// **moves** (Tokens spread over the mat, each moved through `Placement.moveTokenTo` to the point
// mirrored top to bottom, as a drop does; refused moves count as nothing). The loop is stopped
// throughout, so nothing else moves while hovering and moving.
//
// ⚠️ Dev build only (component names). Counts are exact run to run; milliseconds are not taken.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launchChrome, sleep, onCleanup } from './browser/cdp.mjs';
import { freePort } from './browser/servers.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
    const a = { scene: 'cap128', settle: 100, ticks: 300, hovers: 60, moves: 30, gap: 120, seed: 1, a: null, b: null, trace: false, runs: null };
    for (const s of argv) {
        const m = /^--([^=]+)(?:=(.*))?$/.exec(s);
        if (!m) continue;
        const [, k, v] = m;
        if (k === 'a' || k === 'b') a[k] = path.resolve(v);
        else if (k === 'scene') a.scene = v;
        else if (k === 'trace') a.trace = true;
        else if (['settle', 'ticks', 'hovers', 'moves', 'gap', 'seed', 'runs'].includes(k)) a[k] = Number(v);
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
        // ⚠️ Told this checkout, or a server for another checkout draws without half its styles.
        css: { postcss: { plugins: [tailwind({ base: root }), autoprefixer()] } },
        cacheDir: path.join(root, 'node_modules', `.vite-stack-${path.basename(root)}-${key}`),
        server: { port, strictPort: true, host: 'localhost', open: false },
        logLevel: 'warn',
        clearScreen: false
    });
    await server.listen();
    const unregister = onCleanup(() => { server.close(); });
    return { url: `http://localhost:${port}`, close: async () => { unregister(); await server.close(); } };
}

// Runs in the page before any of its scripts: React's commits, and the deterministic engine.
const HOOK = `(() => {
    const S = window.__sw = { on: false, renders: {}, commits: 0 };
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
    function walk(rootFiber) {
        const stack = [rootFiber, false];
        while (stack.length) {
            const mount = stack.pop();
            const f = stack.pop();
            if (TAGS.has(f.tag) && !mount && (f.flags & 1) === 1) {
                const n = nameOf(f);
                S.renders[n] = (S.renders[n] || 0) + 1;
            }
            const prev = f.alternate;
            if (!mount && prev && f.child === prev.child) continue;
            for (let c = f.child; c; c = c.sibling) stack.push(c, mount || !c.alternate);
        }
    }
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        renderers: new Map(), supportsFiber: true, isDisabled: false,
        inject(internals) { const id = this.renderers.size + 1; this.renderers.set(id, internals); return id; },
        checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
        onCommitFiberRoot(id, root) { if (!S.on) return; S.commits++; walk(root.current); }
    };
    const realRandom = Math.random, realNow = Date.now;
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // ⚠️ As in tick-commits.mjs: a loot sprite's wall-clock absorption timer races the tick.
    const realSetTimeout = window.setTimeout;
    const engineSetTimeout = function (fn, ms, ...rest) {
        if ((new Error().stack || '').includes('SpriteLayer')) return 0;
        return realSetTimeout.call(window, fn, ms, ...rest);
    };
    const D = window.__det = {
        rng: null, vt: 0, inEngine: false,
        begin(seed) { D.rng = mulberry32(seed); D.vt = realNow(); },
        on() { Math.random = D.rng; Date.now = () => D.vt; window.setTimeout = engineSetTimeout; D.inEngine = true; },
        off() { Math.random = realRandom; Date.now = realNow; window.setTimeout = realSetTimeout; D.inEngine = false; }
    };
})();`;

const BUILD = (scene, seed) => `(async () => {
    const P = window.__perf;
    const EB = P.game.EventBus;
    const pub = EB.publish;
    const F = window.__fp = { on: false, events: 0, fp: 0, ids: new Map() };
    EB.publish = function (name, payload) {
        if (F.on && window.__det.inEngine && !String(name).startsWith('notification_')) {
            F.events++;
            const id = payload && (payload.instanceId || payload.heroId || payload.typeId || payload.itemId);
            if (id && !F.ids.has(id)) F.ids.set(id, F.ids.size);
            const k = name + '|' + (id ? F.ids.get(id) : '');
            let h = F.fp | 0;
            for (let i = 0; i < k.length; i++) h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0;
            F.fp = h;
        }
        return pub.apply(this, arguments);
    };
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

const DRIVE = (n) => `new Promise((resolve) => {
    const GL = window.__perf.game.GameLoop, D = window.__det;
    let k = 0;
    const t0 = performance.now();
    // Each tick's z changes, read just before the next tick (React has drawn it by then).
    const mark = () => { if (window.__z && window.__z.marking) window.__z.mark(); };
    const step = () => {
        mark();
        D.on();
        try { GL.runHandlers(100); } finally { D.off(); D.vt += 100; }
        k++;
        if (k >= ${n}) { setTimeout(() => { mark(); resolve(k); }, 150); return; }
        setTimeout(step, Math.max(0, t0 + (k + 1) * 100 - performance.now()));
    };
    setTimeout(step, 100);
})`;

// Every box's z, watched. A batch of writes to one box is one change if its z ends different.
const WATCH = `(() => {
    const mat = document.querySelector('[data-mat-board]');
    if (!mat) throw new Error('no mat');
    const KINDS = [['data-token-art', 'art'], ['data-token-overlay', 'badges'], ['data-flag', 'flag'], ['data-board-hero', 'hero']];
    const kindOf = (el) => { for (const [a, k] of KINDS) if (el.hasAttribute && el.hasAttribute(a)) return k; return null; };
    const SEL = KINDS.map(([a]) => '[' + a + ']').join(',');
    const Z = window.__z = { last: new WeakMap(), counts: { art: 0, badges: 0, flag: 0, hero: 0 }, fresh: 0 };
    const seed = (root) => {
        const els = root.matches?.(SEL) ? [root, ...root.querySelectorAll(SEL)] : [...(root.querySelectorAll?.(SEL) || [])];
        for (const el of els) if (!Z.last.has(el)) { Z.last.set(el, el.style.zIndex); Z.fresh++; }
    };
    seed(mat);
    new MutationObserver((recs) => {
        const seen = new Set();
        for (const r of recs) {
            if (r.type === 'childList') { for (const n of r.addedNodes) if (n.nodeType === 1) seed(n); continue; }
            const el = r.target;
            if (seen.has(el)) continue;
            seen.add(el);
            const k = kindOf(el);
            if (!k) continue;
            const z = el.style.zIndex;
            if (!Z.last.has(el)) { Z.last.set(el, z); Z.fresh++; continue; }
            if (Z.last.get(el) !== z) { Z.last.set(el, z); Z.counts[k]++; }
        }
    }).observe(mat, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    // Counts since the last take, and start again.
    Z.take = () => {
        const out = { z: { ...Z.counts }, renders: { ...window.__sw.renders }, commits: window.__sw.commits };
        for (const k of Object.keys(Z.counts)) Z.counts[k] = 0;
        window.__sw.renders = {};
        window.__sw.commits = 0;
        return out;
    };
    // Per tick: the z changes since the last mark.
    Z.marking = false;
    Z.tickLog = [];
    Z.markedAt = 0;
    const total = () => Object.values(Z.counts).reduce((a, b) => a + b, 0);
    Z.startTicks = () => { Z.tickLog = []; Z.markedAt = total(); Z.marking = true; };
    Z.mark = () => { const t = total(); Z.tickLog.push(t - Z.markedAt); Z.markedAt = t; };
    Z.stopTicks = () => { Z.marking = false; return Z.tickLog.slice(1); };
    // How many z values the mat's boxes hold, and how many boxes share each.
    Z.census = () => {
        const art = [...mat.querySelectorAll('[data-token-art]')].map(el => el.style.zIndex);
        const flags = [...mat.querySelectorAll('button[data-flag]')].map(el => el.style.zIndex);
        const all = [...art, ...flags];
        const distinct = new Set(all).size;
        const byZ = new Map();
        for (const z of all) byZ.set(z, (byZ.get(z) || 0) + 1);
        return { tokens: art.length, flags: flags.length, distinct, sharedZ: [...byZ.values()].filter(n => n > 1).reduce((s, n) => s + n, 0) };
    };
    window.__sw.on = true;
    Z.take();
    return Z.census();
})()`;

// Tokens spread over the mat, back to front: their screen centres.
const HOVER_POINTS = (n) => `(async () => {
    const BS = window.__perf.game.BoardState;
    const origin = document.querySelector('[data-board-origin]');
    const rect = document.querySelector('[data-mat-board]').getBoundingClientRect();
    const natural = Number(origin.getAttribute('data-natural-width'));
    const s = rect.width / natural;
    const all = BS.tokens().slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];
    const stride = Math.max(1, all.length / ${n});
    for (let i = 0; out.length < ${n} && Math.floor(i) < all.length; i += stride) {
        const t = all[Math.floor(i)];
        out.push({ x: rect.left + t.x * s, y: rect.top + t.y * s });
    }
    return out;
})()`;

// Tokens spread over the mat, each to its point mirrored top to bottom.
const MOVE_PLAN = (n) => `(async () => {
    const BS = window.__perf.game.BoardState;
    const geo = await import('/src/config/matGeometry.js');
    const H = geo.matH();
    const all = BS.tokens().slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];
    const stride = Math.max(1, all.length / ${n});
    for (let i = 0; out.length < ${n} && Math.floor(i) < all.length; i += stride) {
        const t = all[Math.floor(i)];
        out.push({ id: t.id, x: t.x, y: H - t.y });
    }
    return out;
})()`;

const MOVE = (m) => `(async () => {
    const Placement = await import('/src/systems/board/Placement.js');
    const D = window.__det;
    D.on();
    let r;
    try { r = Placement.moveTokenTo(${JSON.stringify(m.id)}, { x: ${m.x}, y: ${m.y} }); } finally { D.off(); }
    return !!r?.success;
})()`;

const TRACE_CATEGORIES = ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline'];

async function startTrace(page) {
    const events = [];
    const off = page.on('Tracing.dataCollected', (p) => { for (const e of p.value) events.push(e); });
    const done = new Promise((resolve) => { const o = page.on('Tracing.tracingComplete', () => { o(); resolve(); }); });
    await page.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: TRACE_CATEGORIES } });
    return async () => {
        await page.send('Tracing.end');
        await Promise.race([done, sleep(60000)]);
        off();
        return restyled(events);
    };
}

/** Elements restyled on the page's main thread(s): the sum of `UpdateLayoutTree` element counts. */
function restyled(events) {
    const names = new Map();
    for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}|${e.tid}`, e.args?.name);
    let elements = 0;
    let passes = 0;
    for (const e of events) {
        if (e.name !== 'UpdateLayoutTree' || names.get(`${e.pid}|${e.tid}`) !== 'CrRendererMain') continue;
        const n = e.args?.elementCount ?? e.args?.data?.elementCount;
        if (Number.isFinite(n)) { elements += n; passes++; }
    }
    return { elements, passes };
}

const take = (page) => page.evaluate('window.__z.take()');

function addInto(acc, t) {
    for (const [k, v] of Object.entries(t.z)) acc.z[k] = (acc.z[k] || 0) + v;
    for (const [k, v] of Object.entries(t.renders)) acc.renders[k] = (acc.renders[k] || 0) + v;
    acc.commits += t.commits;
    const zAll = Object.values(t.z).reduce((s, v) => s + v, 0);
    acc.perAction.push(zAll);
    return acc;
}

const fresh = () => ({ z: {}, renders: {}, commits: 0, perAction: [], n: 0 });

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
        // The pointer off the mat, so nothing is hovered while the ticks run.
        await page.mouse('mouseMoved', 2, 2);
        await sleep(300);

        const census = await page.evaluate(WATCH);

        // Ticks.
        await page.evaluate('window.__fp.on = true, window.__fp.events = 0, window.__fp.fp = 0, true');
        await page.evaluate('window.__z.startTicks(), true');
        await page.evaluate(DRIVE(args.ticks), { timeoutMs: args.ticks * 200 + 60000 });
        const tickLog = await page.evaluate('window.__z.stopTicks()');
        await page.evaluate('window.__fp.on = false, true');
        const ticks = addInto(fresh(), await take(page));
        ticks.perAction = tickLog;
        ticks.n = args.ticks;
        const work = await page.evaluate('({ events: window.__fp.events, fp: window.__fp.fp })');
        const censusAfterTicks = await page.evaluate('window.__z.census()');

        // Hovers.
        const points = await page.evaluate(HOVER_POINTS(args.hovers));
        const stopHoverTrace = args.trace ? await startTrace(page) : null;
        const hoverT0 = Date.now();
        const hovers = fresh();
        for (const p of points) {
            await page.mouse('mouseMoved', Math.round(p.x), Math.round(p.y));
            await sleep(args.gap);
            addInto(hovers, await take(page));
            hovers.n++;
        }
        await page.mouse('mouseMoved', 2, 2);
        await sleep(args.gap);
        const hoverOff = await take(page);
        const hoverMs = Date.now() - hoverT0;
        const hoverTrace = stopHoverTrace ? await stopHoverTrace() : null;

        // Moves.
        const plan = await page.evaluate(MOVE_PLAN(args.moves));
        const stopMoveTrace = args.trace ? await startTrace(page) : null;
        const moveT0 = Date.now();
        const moves = fresh();
        let landed = 0;
        const landedYs = [];
        for (const m of plan) {
            const ok = await page.evaluate(MOVE(m));
            await sleep(args.gap);
            const t = await take(page);
            if (!ok) continue;
            landed++;
            addInto(moves, t);
            moves.n++;
        }
        const moveMs = Date.now() - moveT0;
        const moveTrace = stopMoveTrace ? await stopMoveTrace() : null;
        for (const m of plan) landedYs.push(await page.evaluate(`window.__perf.game.BoardState.getTokenById(${JSON.stringify(m.id)})?.y ?? null`));

        // A window as long as each traced phase, with nothing done: what restyles on its own.
        let quiet = null;
        if (args.trace) {
            const stopQuiet = await startTrace(page);
            await sleep(hoverMs);
            quiet = await stopQuiet();
        }
        const census2 = await page.evaluate('window.__z.census()');
        return {
            census, censusAfterTicks, censusEnd: census2, ticks, work, hovers, hoverOff, moves, landed,
            moveFp: landedYs.map(y => (y == null ? 'x' : Math.round(y))).join(','),
            trace: args.trace ? { hover: hoverTrace, move: moveTrace, quiet, hoverMs, moveMs } : null,
            errors: page.consoleErrors.slice(0, 5)
        };
    } finally {
        await page.close();
    }
}

const f2 = (x) => (x == null ? '–' : (Math.round(x * 100) / 100).toFixed(2));
const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
const WATCHED = ['MatBoard', 'MatToken', 'FlagLayer', 'Flag', 'FlagBody', 'MatHero', 'MatHeroBody'];
// The dev build names a memoised component's inner function `MatToken2` beside the `MatToken` const.
const rendersOf = (renders, k) => Object.entries(renders).filter(([n]) => n.replace(/\d+$/, '') === k).reduce((s2, [, v]) => s2 + v, 0);
const pct = (xs, q) => { if (!xs.length) return 0; const a = xs.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };

function line(label, ph) {
    const n = Math.max(1, ph.n);
    const z = ['art', 'badges', 'flag', 'hero'].map(k => `${k} ${f2((ph.z[k] || 0) / n)}`).join(' · ');
    const xs = ph.perAction;
    const max = xs.length ? Math.max(...xs) : 0;
    const spread = `p50 ${pct(xs, 0.5)}, p90 ${pct(xs, 0.9)}, most ${max}, ${xs.filter(x => x > 0).length} of ${xs.length} with any`;
    const r = WATCHED.map(k => `${k} ${f2(rendersOf(ph.renders, k) / n)}`).join(' · ');
    const top = Object.entries(ph.renders).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${f2(v / n)}`).join(' · ');
    return `  ${label} (${ph.n}): z changes ${f2(sum(ph.z) / n)} each (${z}; ${spread}) · renders ${f2(sum(ph.renders) / n)} each (${r}) · commits ${f2(ph.commits / n)}
      most rendered: ${top}`;
}

function print(label, m) {
    console.log(`\n${label}`);
    console.log(`  board: ${m.census.tokens} Tokens and ${m.census.flags} flags on ${m.census.distinct} distinct z values (${m.census.sharedZ} share a z with another); after the ticks ${m.censusAfterTicks.tokens} + ${m.censusAfterTicks.flags} on ${m.censusAfterTicks.distinct} (${m.censusAfterTicks.sharedZ} share); at the end ${m.censusEnd.tokens} + ${m.censusEnd.flags} on ${m.censusEnd.distinct} (${m.censusEnd.sharedZ} share)`);
    console.log(`  work: ${m.work.events} engine events, fingerprint ${m.work.fp}; moves landed ${m.landed}, ends ${createHash('sha1').update(m.moveFp).digest('hex').slice(0, 8)}`);
    console.log(line('per tick', m.ticks));
    console.log(line('per hover', m.hovers));
    console.log(`  hover off the mat: z changes ${sum(m.hoverOff.z)}`);
    console.log(line('per move', m.moves));
    if (m.trace) {
        const t = m.trace;
        // The quiet window lasted as long as the hovering did.
        const net = (ph, ms) => (ph.elements - (t.quiet.elements * ms) / t.hoverMs);
        console.log(`  elements restyled: hovering ${t.hover.elements} (${t.hover.passes} passes), moving ${t.move.elements} (${t.move.passes}), quiet ${t.quiet.elements} (${t.quiet.passes}) in ${t.hoverMs} ms (hovering ${t.hoverMs} ms, moving ${t.moveMs} ms) → net per hover ${f2(net(t.hover, t.hoverMs) / Math.max(1, m.hovers.n))}, per move ${f2(net(t.move, t.moveMs) / Math.max(1, m.moves.n))}`);
    }
    if (m.errors.length) console.log(`  page errors: ${m.errors.join(' | ')}`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const roots = [args.a || here, ...(args.b ? [args.b] : [])];
    const servers = [];
    for (const r of roots) servers.push(await startDev(r));
    const chrome = await launchChrome({});
    const runs = args.runs ?? (args.b ? 4 : 1);
    const order = args.b ? Array.from({ length: Math.max(2, runs) }, (_, k) => [0, 1, 1, 0][k % 4]) : Array(Math.max(1, runs)).fill(0);
    const results = roots.map(() => []);
    try {
        for (const i of order) {
            const side = i === 0 ? 'A' : 'B';
            process.stdout.write(`${side} ${roots[i]} (${args.scene}) …`);
            const m = await measureBoard(chrome, servers[i].url, args);
            results[i].push(m);
            console.log(` ticks ${f2(sum(m.ticks.z) / m.ticks.n)} z/tick · hovers ${f2(sum(m.hovers.z) / Math.max(1, m.hovers.n))} z/hover · moves ${f2(sum(m.moves.z) / Math.max(1, m.moves.n))} z/move`);
        }
    } finally {
        await chrome.close();
        for (const s of servers) await s.close();
    }
    for (let i = 0; i < roots.length; i++) {
        for (const [k, m] of results[i].entries()) print(`${i === 0 ? 'A' : 'B'} run ${k + 1}: ${roots[i]} (${args.scene}, seed ${args.seed})`, m);
    }
    const all = results.flat();
    const works = new Set(all.map(m => `${m.work.events}/${m.work.fp}/${m.landed}/${m.moveFp}`));
    console.log(works.size > 1
        ? `\n⚠️ WORK DIFFERS between runs: ${all.map(m => `${m.work.events}/${m.work.fp}/${m.landed}`).join(', ')}`
        : `\nSame work in every run: ${all[0].work.events} engine events in the ticks (fingerprint ${all[0].work.fp}), ${all[0].landed} moves landed at the same places`);
    if (process.env.STACK_WRITES_JSON) {
        const fs = await import('node:fs');
        fs.writeFileSync(process.env.STACK_WRITES_JSON, JSON.stringify({ args, roots, results }, null, 1));
    }
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
