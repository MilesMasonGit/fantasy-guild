// React commits, component renders and context changes per drag phase, on a stress board in the
// dev build.
//
//   node bench/drag-commits.mjs                            this checkout, cap128, 12 drags a kind
//   node bench/drag-commits.mjs --b=<checkout path>        A/B: this checkout (A) against another (B), A,B,B,A
//   node bench/drag-commits.mjs --a=<before> --b=<after>   A/B of two other checkouts
//   options: --scene=cap128 (any ?stress= name) · --n=12 (drags per kind) · --kinds=token,flag
//            · --seed=1 · --settle=100 (ticks before the drags) · --top=25 · --dump=1 (print the
//            commits of the first N drags of each kind, one by one)
//
// How it counts: the same stand-in for the React DevTools hook as `tick-commits.mjs`, installed
// before the page's first script, hears every commit and walks its fibers as the DevTools do. A
// rendered component whose nearest component parent did not render is an ORIGIN (its own state,
// a context or a store woke it). A context provider whose value is a different object from the
// last commit's is a CONTEXT CHANGE: every component reading that context re-renders.
//
// The same drags every run: the board is built and settled with a seeded engine (as
// `tick-commits.mjs` does), then the game loop is stopped, so nothing but the drags commits (a
// quiet window before the drags says how much does anyway). Each drag is real browser input
// (`Input.dispatchMouseEvent`), picked by the drag bench's own kit (`dragKit.mjs`) with
// `Math.random` a seeded stream while it picks, and is split into three phases:
//   pickup  the press and the two moves that cross dnd-kit's 8 px threshold, then 250 ms still
//   carry   12 moves to the target, ~16 ms apart (counts are also given per move)
//   drop    the release, then 500 ms still
// The pickup's stillness keeps its commits apart from the carry's; a real hand keeps moving.
//
// ⚠️ Dev build only: the stand-in hook needs React's development build, which names fibers. A dev
// server per checkout, each on its own port and its own Vite cache. Counts are exact run to run;
// the milliseconds are the development build's.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launchChrome, sleep, onCleanup } from './browser/cdp.mjs';
import { freePort } from './browser/servers.mjs';
import { clickUntil, BANK_OPEN, SHOP_OPEN } from './browser/scenes.mjs';
import { installDragKit } from './browser/dragKit.mjs';
import { KINDS, dragPath } from './browser/dragLib.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
    const a = { scene: 'cap128', n: 12, kinds: null, seed: 1, settle: 100, top: 25, dump: 0, full: false, a: null, b: null };
    for (const s of argv) {
        const m = /^--([^=]+)(?:=(.*))?$/.exec(s);
        if (!m) continue;
        const [, k, v] = m;
        if (k === 'a' || k === 'b') a[k] = path.resolve(v);
        else if (k === 'scene') a.scene = v;
        else if (k === 'kinds') a.kinds = v.split(',').map(x => x.trim()).filter(Boolean);
        else if (k === 'full') a.full = true;
        else if (['n', 'seed', 'settle', 'top', 'dump'].includes(k)) a[k] = Number(v);
        else throw new Error(`unknown option --${k}`);
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
        cacheDir: path.join(root, 'node_modules', `.vite-dragc-${path.basename(root)}-${key}`),
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
    const S = window.__tc = { on: false, phase: null, kind: null, drag: 0, commits: [], ctxNames: null, anchors: {} };
    const TAGS = new Set([0, 1, 11, 14, 15]);
    const CONTEXT_PROVIDER = 10;
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
    const labels = new WeakMap();
    function ctxLabel(f, value) {
        const ctx = (f.type && f.type._context) || f.type;
        if (!ctx) return '?';
        const named = S.ctxNames && S.ctxNames.get(ctx);
        if (named) return named;
        let l = labels.get(ctx);
        if (l) return l;
        if (ctx.displayName) l = ctx.displayName;
        else if (value && typeof value === 'object' && 'activators' in value) l = 'dnd-kit internal (useDraggable, useDroppable)';
        else if (value && typeof value === 'object' && 'droppableRects' in value) l = 'dnd-kit public (useDndContext)';
        else if (value && typeof value === 'object' && 'scaleX' in value) l = 'dnd-kit transform (the dragged node)';
        else {
            let p = f.return;
            while (p && !TAGS.has(p.tag)) p = p.return;
            l = 'context in ' + (p ? nameOf(p) : '?');
        }
        labels.set(ctx, l);
        return l;
    }
    // Each stack entry: fiber, mounting?, did the nearest component above it render this commit?
    function walk(rootFiber, acc) {
        const stack = [rootFiber, false, false];
        while (stack.length) {
            const parentRendered = stack.pop();
            const mount = stack.pop();
            const f = stack.pop();
            // Reached: React created or cloned this fiber in this commit (began work on it).
            acc.fibers++;
            let rendered = parentRendered;
            if (TAGS.has(f.tag)) {
                if (mount) { acc.mounts++; rendered = true; }
                else if ((f.flags & 1) === 1) {
                    acc.renders++;
                    const n = nameOf(f);
                    acc.byName[n] = (acc.byName[n] || 0) + 1;
                    if (!parentRendered) acc.origins[n] = (acc.origins[n] || 0) + 1;
                    rendered = true;
                } else rendered = false;
            } else if (f.tag === CONTEXT_PROVIDER && !mount && f.alternate) {
                const v = f.memoizedProps && f.memoizedProps.value;
                const was = f.alternate.memoizedProps && f.alternate.memoizedProps.value;
                if (!Object.is(v, was)) {
                    const l = ctxLabel(f, v);
                    acc.ctx[l] = (acc.ctx[l] || 0) + 1;
                }
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
            S.root = root;
            if (!S.on) return;
            const acc = { t: performance.now(), phase: S.phase, kind: S.kind, drag: S.drag, renders: 0, mounts: 0, fibers: 0, byName: {}, origins: {}, ctx: {},
                ms: root.current.actualDuration ?? null };
            walk(root.current, acc);
            S.commits.push(acc);
        }
    };
    /** Every fiber in the committed tree. */
    S.treeSize = () => {
        let n = 0;
        const stack = S.root ? [S.root.current] : [];
        while (stack.length) { const f = stack.pop(); n++; for (let c = f.child; c; c = c.sibling) stack.push(c); }
        return n;
    };
    // When the press, the drag's start and the release reached the page, for the dump.
    for (const type of ['pointerdown', 'pointerup']) {
        window.addEventListener(type, () => { S.anchors[type] = performance.now(); }, true);
    }

    const realRandom = Math.random, realNow = Date.now;
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const realSetTimeout = window.setTimeout;
    const engineSetTimeout = function (fn, ms, ...rest) {
        if ((new Error().stack || '').includes('SpriteLayer')) return 0;
        return realSetTimeout.call(window, fn, ms, ...rest);
    };
    const D = window.__det = {
        rng: null, vt: 0, inEngine: false, pickRng: null,
        begin(seed) { D.rng = mulberry32(seed); D.vt = realNow(); D.pickRng = mulberry32(seed * 7919 + 13); },
        on() { Math.random = D.rng; Date.now = () => D.vt; window.setTimeout = engineSetTimeout; D.inEngine = true; },
        off() { Math.random = realRandom; Date.now = realNow; window.setTimeout = realSetTimeout; D.inEngine = false; },
        /** Run fn with Math.random the picks' own seeded stream. */
        seeded(fn) { Math.random = D.pickRng; try { return fn(); } finally { Math.random = realRandom; } }
    };
})();`;

const BUILD = (scene, seed) => `(async () => {
    const P = window.__perf;
    for (const m of ['/src/systems/board/HeroMotion.js', '/src/systems/board/EnemyMotion.js']) {
        const mod = await import(m);
        mod.setRandomForTests(() => Math.random());
    }
    // The drag system's own contexts, by name.
    try {
        const k = await import('/src/ui/dnd/DndKit.jsx');
        window.__tc.ctxNames = new Map([[k.DeckDndContext, 'useActiveDrag (DeckDndContext)'], [k.DragSurfaceContext, 'useDragSurface'], [k.DragPointerContext, 'useDragPointer']]);
    } catch { /* named by shape instead */ }
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
    const step = () => {
        D.on();
        try { GL.runHandlers(100); } finally { D.off(); D.vt += 100; }
        k++;
        if (k >= ${n}) { setTimeout(() => resolve(k), 100); return; }
        setTimeout(step, Math.max(0, t0 + (k + 1) * 100 - performance.now()));
    };
    setTimeout(step, 100);
})`;

const PHASE = (phase, kind, drag) => `(() => { const S = window.__tc; S.phase = ${JSON.stringify(phase)}; S.kind = ${JSON.stringify(kind)}; S.drag = ${drag}; return true; })()`;

async function arrange(page, needs) {
    const isOpen = async (expr) => !!(await page.evaluate(expr));
    const closed = (expr) => `!(${expr})`;
    if (needs !== 'shop' && await isOpen(SHOP_OPEN)) await clickUntil(page, 'button[aria-label="Shop"]', closed(SHOP_OPEN), 'the Shop to close');
    if (needs !== 'bank' && await isOpen(BANK_OPEN)) await clickUntil(page, 'button[aria-label="Item Bank"]', closed(BANK_OPEN), 'the Bank to close');
    if (needs === 'shop' && !await isOpen(SHOP_OPEN)) await clickUntil(page, 'button[aria-label="Shop"]', SHOP_OPEN, 'the Shop to open');
    if (needs === 'bank' && !await isOpen(BANK_OPEN)) await clickUntil(page, 'button[aria-label="Item Bank"]', BANK_OPEN, 'the Bank to open');
    if (needs === 'shop') {
        // ⚠️ A board at its Token cap refuses every purchase: lift the cap (the Mat Tuner's dev
        // override) so the Shop's rows can be bought.
        await page.evaluate(`import('/src/config/matTuning.js').then(m => { m.setMatTuning('tokenCap', 2000); return true; })`);
        await page.evaluate('window.__dragKit.ensureShopFunds()');
        await sleep(300);
    }
    if (needs === 'bank') {
        await page.waitFor(`!!document.querySelector('button[title*=" — drag to sort"]')`, { timeoutMs: 8000, what: 'the Bank to show items' });
    }
    await page.key('Escape', 'Escape', 27);
    await sleep(600);
}

const CARRY_MOVES = 12;

async function oneDrag(page, kind, drag) {
    await page.mouse('mouseMoved', 1586, 12);
    await sleep(250);
    const pick = await page.evaluate(`window.__det.seeded(() => window.__dragKit.pick.${kind.id}())`);
    if (pick.skip) return { skipped: pick.skip };
    if (pick.hoverFirst) {
        await page.mouse('mouseMoved', pick.hoverFirst.x, pick.hoverFirst.y);
        await sleep(300);
    }
    const from = pick.source, to = pick.target;
    const pts = dragPath(from, to);
    await page.mouse('mouseMoved', from.x, from.y);
    await sleep(80);
    const held = { button: 'left', buttons: 1 };
    await page.evaluate(PHASE('pickup', kind.id, drag));
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(16);
    await page.mouse('mouseMoved', pts[0].x, pts[0].y, held);
    await sleep(16);
    await page.mouse('mouseMoved', pts[1].x, pts[1].y, held);
    await sleep(250);
    await page.evaluate(PHASE('carry', kind.id, drag));
    const carry = pts.slice(2);
    if (carry.length !== CARRY_MOVES) throw new Error(`the drag path has ${carry.length} carry moves, not ${CARRY_MOVES}`);
    for (const p of carry) {
        await page.mouse('mouseMoved', p.x, p.y, held);
        await sleep(16);
    }
    await sleep(40);
    const inHand = await page.evaluate('window.__dragKit.inHand()');
    await page.evaluate(PHASE('drop', kind.id, drag));
    await page.mouse('mouseReleased', to.x, to.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(500);
    await page.evaluate(PHASE(null, null, 0));
    const check = await page.evaluate(`window.__dragKit.check(${JSON.stringify(pick.expect)})`);
    return { what: pick.source.what, ok: !!check.ok && inHand === pick.source.hand, detail: check.detail };
}

async function measure(chrome, url, args) {
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
        await page.evaluate('window.__perf.hideHud(), true');
        await page.evaluate(`(${installDragKit.toString()})()`);
        await page.evaluate('window.__dragKit.ensureEquipStock()');
        await page.evaluate('window.__perf.game.NotificationSystem.dismissAll?.(), true');
        await sleep(2000);

        const treeSize = await page.evaluate('window.__tc.treeSize()');
        // What commits with no drag at all, as long as a drag's three phases.
        await page.evaluate(`(() => { const S = window.__tc; S.commits = []; S.on = true; S.phase = 'quiet'; return true; })()`);
        await sleep(3000);
        await page.evaluate(PHASE(null, null, 0));

        const kinds = KINDS.filter(k => !args.kinds || args.kinds.includes(k.id));
        const drags = {};
        for (const kind of kinds) {
            await arrange(page, kind.needs);
            await page.evaluate('window.__perf.game.NotificationSystem.dismissAll?.(), true');
            await sleep(400);
            drags[kind.id] = [];
            for (let i = 1; i <= args.n; i++) {
                let d;
                try { d = await oneDrag(page, kind, i); } catch (err) { d = { error: err.message.split('\n')[0] }; }
                drags[kind.id].push(d);
                process.stdout.write(d.skipped ? 's' : d.error ? 'E' : d.ok ? '.' : 'x');
            }
            process.stdout.write(' ');
        }
        const commits = await page.evaluate(`(() => { const S = window.__tc; S.on = false; return S.commits; })()`, { timeoutMs: 120000 });
        return { commits, drags, treeSize, errors: page.consoleErrors.slice(0, 5) };
    } finally {
        await page.close();
    }
}

/** Per kind and phase: commits, renders, mounts, context changes and React ms, per drag. */
function summarise({ commits, drags, treeSize }) {
    const out = { treeSize, quiet: { commits: 0, renders: 0 }, kinds: {} };
    for (const c of commits) {
        if (c.phase === 'quiet') { out.quiet.commits++; out.quiet.renders += c.renders; continue; }
        if (!c.phase || !c.kind) continue;
        const k = out.kinds[c.kind] || (out.kinds[c.kind] = {});
        const p = k[c.phase] || (k[c.phase] = { commits: 0, renders: 0, mounts: 0, fibers: 0, ms: 0, ctx: {}, byName: {}, origins: {} });
        p.commits++; p.renders += c.renders; p.mounts += c.mounts; p.fibers += c.fibers; p.ms += c.ms || 0;
        for (const [n, v] of Object.entries(c.ctx)) p.ctx[n] = (p.ctx[n] || 0) + v;
        for (const [n, v] of Object.entries(c.byName)) p.byName[n] = (p.byName[n] || 0) + v;
        for (const [n, v] of Object.entries(c.origins)) p.origins[n] = (p.origins[n] || 0) + v;
    }
    for (const [kind, list] of Object.entries(drags)) {
        const done = list.filter(d => !d.skipped && !d.error);
        const k = out.kinds[kind] || (out.kinds[kind] = {});
        k.drags = done.length;
        k.ok = done.filter(d => d.ok).length;
        k.skipped = list.filter(d => d.skipped).length;
        k.errors = list.filter(d => d.error).map(d => d.error);
        k.whats = done.map(d => d.what);
    }
    return out;
}

const f2 = (x) => (x == null || !Number.isFinite(x) ? '–' : (Math.round(x * 100) / 100).toFixed(2));
const PHASES = ['pickup', 'carry', 'drop'];

function perDrag(k, phase, field, sub) {
    const p = k[phase];
    if (!p || !k.drags) return 0;
    const v = sub ? (p[field][sub] || 0) : p[field];
    return v / k.drags / (phase === 'carry' ? CARRY_MOVES : 1);
}

function printOne(label, s, top) {
    console.log(`\n${label}`);
    console.log(`  ${s.treeSize} fibers in the tree · quiet (3 s, no drag): ${s.quiet.commits} commits, ${s.quiet.renders} renders`);
    for (const [kind, k] of Object.entries(s.kinds)) {
        console.log(`  ${kind}: ${k.drags} drags (${k.ok} as intended${k.skipped ? `, ${k.skipped} skipped` : ''}${k.errors?.length ? `, errors: ${k.errors.join(' | ')}` : ''})`);
        for (const ph of PHASES) {
            const p = k[ph];
            if (!p) { console.log(`    ${ph.padEnd(6)} no commits`); continue; }
            const per = ph === 'carry' ? 'per move' : 'per drag';
            const ctx = Object.keys(p.ctx).sort().map(n => `${n} ${f2(perDrag(k, ph, 'ctx', n))}`).join(' · ');
            console.log(`    ${ph.padEnd(6)} ${per}: ${f2(perDrag(k, ph, 'commits'))} commits · ${f2(perDrag(k, ph, 'renders'))} renders · ${f2(perDrag(k, ph, 'mounts'))} mounts · ${f2(perDrag(k, ph, 'fibers'))} fibers touched · React ${f2(perDrag(k, ph, 'ms'))} ms (dev)`);
            if (ctx) console.log(`           context changes: ${ctx}`);
            const rows = Object.entries(p.byName).sort((a, b) => b[1] - a[1]).slice(0, top)
                .map(([n, v]) => `${n} ${f2(v / k.drags / (ph === 'carry' ? CARRY_MOVES : 1))}${p.origins[n] ? ` (origin ${f2(p.origins[n] / k.drags / (ph === 'carry' ? CARRY_MOVES : 1))})` : ''}`);
            if (rows.length) console.log(`           renders: ${rows.join(' · ')}`);
        }
    }
}

function printDump(commits, n, full = false) {
    const byDrag = new Map();
    for (const c of commits) {
        if (!c.kind || c.drag > n) continue;
        const key = `${c.kind} #${c.drag}`;
        if (!byDrag.has(key)) byDrag.set(key, []);
        byDrag.get(key).push(c);
    }
    for (const [key, list] of byDrag) {
        console.log(`\n  ${key}: ${list.length} commits (phase, renders, mounts, React ms: context changes · [origins] names)`);
        for (const c of list) {
            const names = Object.entries(c.byName).sort((a, b) => b[1] - a[1]).slice(0, full ? 400 : 14).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(' ');
            const ctx = Object.entries(c.ctx).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(', ');
            console.log(`    ${c.phase.padEnd(6)} ${String(c.fibers).padStart(5)}f ${String(c.renders).padStart(4)}r ${String(c.mounts).padStart(3)}m${c.ms == null ? '' : `${(Math.round(c.ms * 10) / 10).toFixed(1).padStart(5)}ms`}  ${ctx || '-'} · [${Object.keys(c.origins).join(', ')}] ${names}`);
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const roots = [args.a || here, ...(args.b ? [args.b] : [])];
    const servers = [];
    for (const r of roots) servers.push(await startDev(r));
    const chrome = await launchChrome({ width: 1600, height: 1000 });
    const order = args.b ? [0, 1, 1, 0] : [0];
    const results = roots.map(() => []);
    try {
        for (const i of order) {
            const side = i === 0 ? 'A' : 'B';
            process.stdout.write(`${side} ${roots[i]} … `);
            const m = await measure(chrome, servers[i].url, args);
            const s = summarise(m);
            results[i].push(s);
            const pk = Object.entries(s.kinds).map(([kind, k]) => `${kind} ${f2(perDrag(k, 'pickup', 'commits'))}c/${f2(perDrag(k, 'pickup', 'renders'))}r`).join(' · ');
            console.log(` pickups: ${pk}${m.errors.length ? ` (page errors: ${m.errors.join(' | ')})` : ''}`);
            if (args.dump) printDump(m.commits, args.dump, args.full);
        }
    } finally {
        await chrome.close();
        for (const s of servers) await s.close();
    }
    for (let i = 0; i < roots.length; i++) {
        for (const [k, s] of results[i].entries()) printOne(`${i === 0 ? 'A' : 'B'} run ${k + 1}: ${roots[i]} (${args.scene}, seed ${args.seed})`, s, args.top);
    }
    // The same drags on every run: the picks' names, in order.
    const fps = results.flat().map(s => createHash('sha1').update(JSON.stringify(Object.entries(s.kinds).map(([k, v]) => [k, v.whats]))).digest('hex').slice(0, 10));
    console.log(new Set(fps).size > 1 ? `\n⚠️ THE DRAGS DIFFER between runs (picks fingerprint ${fps.join(', ')}, A runs first)` : `\nThe same drags in every run (picks fingerprint ${fps[0]})`);
    if (args.b) {
        const [A, B] = results;
        const mean = (side, f) => side.reduce((s, x) => s + f(x), 0) / side.length;
        console.log('\nA/B (means of A,B,B,A), per drag (carry: per move): commits · renders · context changes');
        const kinds = Object.keys(A[0].kinds);
        for (const kind of kinds) {
            for (const ph of PHASES) {
                const val = (side, field) => mean(side, s => (s.kinds[kind] ? perDrag(s.kinds[kind], ph, field) : 0));
                const ctxTotal = (side) => mean(side, s => {
                    const k = s.kinds[kind];
                    if (!k?.[ph]) return 0;
                    return Object.values(k[ph].ctx).reduce((x, y) => x + y, 0) / k.drags / (ph === 'carry' ? CARRY_MOVES : 1);
                });
                console.log(`  ${kind.padEnd(9)} ${ph.padEnd(6)} commits ${f2(val(A, 'commits'))} → ${f2(val(B, 'commits'))} · renders ${f2(val(A, 'renders'))} → ${f2(val(B, 'renders'))} · fibers touched ${f2(val(A, 'fibers'))} → ${f2(val(B, 'fibers'))} · context changes ${f2(ctxTotal(A))} → ${f2(ctxTotal(B))} · React ${f2(val(A, 'ms'))} → ${f2(val(B, 'ms'))} ms (dev)`);
            }
        }
    }
    if (process.env.DRAG_COMMITS_JSON) {
        const fs = await import('node:fs');
        fs.writeFileSync(process.env.DRAG_COMMITS_JSON, JSON.stringify({ args, roots, results }, null, 1));
    }
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
