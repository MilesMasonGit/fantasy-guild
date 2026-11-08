// @vitest-environment node
// The memory soak's pure parts (bench/browser/soakLib.mjs, bench/browser/heapSnapshot.mjs): options,
// the run's timeline, the line fit, the verdicts, the hidden-phase check, the baseline compare and
// the heap-snapshot reader. The soak itself drives Chrome and is not run here.
import { describe, it, expect } from 'vitest';
import {
    CONFIG, parseArgs, soakPlan, fitLine, neverFallsBack, judgeMetric, analyse, intervalsOf, phaseRates,
    hiddenCheck, fittedRates, compareToBaseline, baselineOf, baselineRefusal, slopesTable, hiddenText, sampleHeader, sampleRow, defaultWarmup
} from '../../bench/browser/soakLib.mjs';
import { classSummary, classNameOf, diffClasses } from '../../bench/browser/heapSnapshot.mjs';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Samples along a plan, each metric a function of the sample's minute and phase.
 * `heapKb(t, phase)`, `nodes(t, phase)` …; rates: `taskMs` (page task ms per second of the
 * interval ending at that sample), `fps`, `ticks`.
 */
function makeSamples({ minutes = 30, every = 60, hidden = 5, warmup = 3, heapKb = () => 40000, nodes = () => 5000, listeners = () => 800,
    bus = () => 300, documents = () => 1, taskMs = (ph) => (ph === 'hidden' ? 20 : 100), fps = (ph) => (ph === 'hidden' ? 0 : 164), ticks = () => 10, paused = (ph) => ph === 'hidden' } = {}) {
    const plan = soakPlan({ minutes, every, hidden, warmup });
    let task = 0;
    let prev = 0;
    return plan.steps.map((step, i) => {
        const t = step.atS / 60;
        task += (step.atS - prev) * taskMs(step.phase) / 1000;
        prev = step.atS;
        return {
            i, tS: step.atS, phase: step.phase, fit: step.fit,
            cdp: {
                JSHeapUsedSize: heapKb(t, step.phase) * 1024, JSHeapTotalSize: 60000 * 1024, Nodes: nodes(t, step.phase),
                JSEventListeners: listeners(t, step.phase), Documents: documents(t, step.phase), Frames: 1,
                TaskDuration: task, DevToolsCommandDuration: 0, ScriptDuration: task / 2, LayoutCount: i * 100, RecalcStyleCount: i * 200
            },
            page: {
                visibility: step.phase === 'hidden' ? 'hidden' : 'visible', drawingPaused: paused(step.phase), elements: 1500, tokens: 130,
                bus: { total: bus(t, step.phase), events: 40, engine: 100 },
                interval: i ? { seconds: every, frames: fps(step.phase) * every, ticksPerS: ticks(step.phase) } : null
            },
            proc: { renderer: { privateKb: 200000 }, gpu: { privateKb: 100000 } }
        };
    });
}

const NODE_TYPES = ['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp', 'number', 'native', 'synthetic', 'concatenated string', 'sliced string', 'symbol', 'bigint', 'object shape'];
const EDGE_TYPES = ['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'];

/** A `.heapsnapshot` from nodes `{type, name, self, detached}` and edges `[from, to, type]`. */
function makeSnapshot(nodeList, edgeList) {
    const strings = [''];
    const str = (s) => { let i = strings.indexOf(s); if (i < 0) { i = strings.length; strings.push(s); } return i; };
    const nodes = [];
    const edges = [];
    const byFrom = nodeList.map(() => []);
    for (const e of edgeList) byFrom[e[0]].push(e);
    nodeList.forEach((n, i) => {
        const out = byFrom[i];
        nodes.push(NODE_TYPES.indexOf(n.type), str(n.name || ''), i * 2 + 1, n.self || 0, out.length, 0, n.detached || 0);
        for (const [, to, type = 'property'] of out) edges.push(EDGE_TYPES.indexOf(type), str('e'), to * 7);
    });
    return {
        snapshot: {
            meta: {
                node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id', 'detachedness'],
                node_types: [NODE_TYPES, 'string', 'number', 'number', 'number', 'number', 'number'],
                edge_fields: ['type', 'name_or_index', 'to_node'],
                edge_types: [EDGE_TYPES, 'string_or_number', 'node']
            },
            node_count: nodeList.length, edge_count: edges.length / 3
        },
        nodes, edges, strings
    };
}

// ---------------------------------------------------------------------------

describe('soak options', () => {
    it('defaults to cap128 for 30 minutes, a sample a minute, hidden 5 minutes, 3 minutes of warm-up', () => {
        const a = parseArgs([]);
        expect(a).toMatchObject({ scene: 'cap128', minutes: 30, every: 60, hidden: 5, warmup: 3, settle: 60, snapshot: false, readable: false, compare: false, saveBaseline: false, build: true });
        expect(parseArgs(['--readable']).readable).toBe(true);
    });

    it('the warm-up is a tenth of the run, at most 5 minutes, unless given', () => {
        expect(defaultWarmup(100)).toBe(5);
        expect(parseArgs(['--minutes=3', '--hidden=1']).warmup).toBeCloseTo(0.3);
        expect(parseArgs(['--minutes=30', '--warmup=0']).warmup).toBe(0);
    });

    it('takes any bench:draw scene, case-insensitively, and refuses others', () => {
        expect(parseArgs(['--scene=S2']).scene).toBe('S2');
        expect(parseArgs(['--scene=CAP256']).scene).toBe('cap256');
        expect(parseArgs(['--scene=heroes12']).scene).toBe('heroes12');
        expect(() => parseArgs(['--scene=nowhere'])).toThrow(/unknown scene/);
    });

    it('refuses what cannot run', () => {
        expect(() => parseArgs(['--bogus'])).toThrow(/unknown option/);
        expect(() => parseArgs(['--every=5'])).toThrow(/--every/);
        expect(() => parseArgs(['--minutes=0'])).toThrow(/--minutes/);
        expect(() => parseArgs(['--minutes=3', '--hidden=3'])).toThrow(/no visible time/);
        expect(() => parseArgs(['--minutes=3', '--warmup=3'])).toThrow(/--warmup/);
    });
});

describe('the soak timeline', () => {
    it('30 minutes: a sample a minute, hidden 12 to 17 on the grid, fit from minute 3, snapshots at the ends of the fit', () => {
        const p = soakPlan({ minutes: 30, every: 60, hidden: 5, warmup: 3 });
        expect(p.steps).toHaveLength(31);
        expect([p.hiddenStartS, p.hiddenEndS]).toEqual([720, 1020]);
        const at = (s) => p.steps.find((x) => x.atS === s);
        expect(at(720)).toMatchObject({ phase: 'visible', then: 'hide', fit: true });
        expect(at(780).phase).toBe('hidden');
        expect(at(1020)).toMatchObject({ phase: 'hidden', then: 'show', fit: false });
        expect(at(1080)).toMatchObject({ phase: 'visible', fit: true, then: null });
        expect(p.steps.filter((s) => s.phase === 'hidden')).toHaveLength(5);
        expect(at(120).fit).toBe(false);
        expect(at(180)).toMatchObject({ fit: true, snapshot: 'start' });
        expect(at(1800).snapshot).toBe('end');
        expect(p.steps.filter((s) => s.snapshot === 'hidden').map((s) => s.atS)).toEqual([1020]);
    });

    it('the 3-minute smoke: visible, hide at 1, show at 2, visible', () => {
        const p = soakPlan({ minutes: 3, every: 60, hidden: 1, warmup: 0.3 });
        expect(p.steps.map((s) => [s.atS, s.phase, s.then, s.fit, s.snapshot])).toEqual([
            [0, 'visible', null, false, null],
            [60, 'visible', 'hide', true, 'start'],
            [120, 'hidden', 'show', false, 'hidden'],
            [180, 'visible', null, true, 'end']
        ]);
    });

    it('without a hidden phase every sample is visible; a phase off the grid gets samples of its own', () => {
        expect(soakPlan({ minutes: 5, every: 60, hidden: 0 }).steps.every((s) => s.phase === 'visible' && !s.then)).toBe(true);
        const p = soakPlan({ minutes: 2, every: 60, hidden: 1 });
        expect(p.steps.map((s) => [s.atS, s.phase, s.then])).toEqual([[0, 'visible', null], [30, 'visible', 'hide'], [60, 'hidden', null], [90, 'hidden', 'show'], [120, 'visible', null]]);
    });
});

describe('the line fit', () => {
    it('fits an exact line, and says how far it reaches', () => {
        const f = fitLine([0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 })));
        expect(f.slope).toBeCloseTo(2);
        expect(f.intercept).toBeCloseTo(1);
        expect(f.r2).toBeCloseTo(1);
        expect(f).toMatchObject({ n: 5, spanMin: 4 });
    });

    it('needs two distinct x and skips missing values', () => {
        expect(fitLine([{ x: 1, y: 2 }])).toBeNull();
        expect(fitLine([{ x: 1, y: 2 }, { x: 1, y: 3 }])).toBeNull();
        expect(fitLine([{ x: 0, y: 0 }, { x: 1, y: NaN }, { x: 2, y: 4 }]).slope).toBeCloseTo(2);
    });

    it('a flat noisy series has a slope near zero', () => {
        const f = fitLine(Array.from({ length: 27 }, (_, i) => ({ x: i + 3, y: 40000 + (i % 2 ? 400 : -400) })));
        expect(Math.abs(f.slope)).toBeLessThan(20);
    });
});

describe('the verdicts', () => {
    const fitOf = (values, from = 3) => fitLine(values.map((y, i) => ({ x: from + i, y })));
    const nodes = CONFIG.metrics.nodes;
    const heap = CONFIG.metrics.heapUsed;

    it('a count that never falls back is told apart from one that churns', () => {
        expect(neverFallsBack([1, 2, 2, 3])).toBe(true);
        expect(neverFallsBack([1, 3, 2])).toBe(false);
        expect(neverFallsBack([1, 3, 2], 1)).toBe(true);
        expect(neverFallsBack([1, NaN, 2])).toBe(true);
    });

    it('heap: over 200 KB/min fails, over 50 warns, flat is ok', () => {
        const series = (perMin) => Array.from({ length: 27 }, (_, i) => 40000 + perMin * i + (i % 2 ? 300 : -300));
        for (const [perMin, verdict] of [[250, 'FAIL'], [100, 'WARN'], [0, 'ok']]) {
            const v = series(perMin);
            expect(judgeMetric(heap, fitOf(v), v).verdict).toBe(verdict);
        }
    });

    it('nodes: a slow ratchet past 200 fails though its slope is under the limits', () => {
        const v = Array.from({ length: 27 }, (_, i) => 5000 + Math.round(i * 9.5));   // +247 over 26 min, never down
        const fit = fitOf(v);
        expect(fit.slope).toBeLessThan(nodes.failSlope);
        expect(judgeMetric(nodes, fit, v)).toMatchObject({ verdict: 'FAIL', why: expect.stringMatching(/never fell back/) });
    });

    it('nodes: the same rise with churn falling back is not a ratchet, only a warning on its slope', () => {
        const v = Array.from({ length: 27 }, (_, i) => 5000 + Math.round(i * 9.5) + (i % 3 === 1 ? -150 : 0));
        expect(v[26] - v[0]).toBeGreaterThan(nodes.failNet);
        expect(judgeMetric(nodes, fitOf(v), v)).toMatchObject({ verdict: 'WARN', why: expect.stringMatching(/grows/) });
    });

    it('nodes: a steep climb fails on its slope even with churn', () => {
        const v = Array.from({ length: 27 }, (_, i) => 5000 + 40 * i + (i % 2 ? 200 : -200));
        expect(judgeMetric(nodes, fitOf(v), v)).toMatchObject({ verdict: 'FAIL', why: expect.stringMatching(/over the limit of 20/) });
    });

    it('too few samples or minutes is "short", never judged; info metrics are never judged', () => {
        const v = [5000, 9000, 13000];
        expect(judgeMetric(nodes, fitOf(v), v).verdict).toBe('short');
        const nine = Array.from({ length: 10 }, (_, i) => 5000 + 500 * i);   // 10 samples over 9 min
        expect(judgeMetric(nodes, fitOf(nine), nine).verdict).toBe('short');
        expect(judgeMetric(CONFIG.metrics.tokens, fitOf([1, 900, 2000]), [1, 900, 2000]).verdict).toBe('info');
    });

    it('a steady page passes every metric over a 30-minute plan', () => {
        const a = analyse(makeSamples());
        for (const key of ['heapUsed', 'nodes', 'listeners', 'busSubscribers', 'documents', 'frames']) expect(a[key].verdict).toBe('ok');
        expect(a.heapUsed.fit.n).toBe(23);        // minutes 3–12 and 18–30
        expect(a.heapUsed.fit.spanMin).toBe(27);
        expect(a.tokens.verdict).toBe('info');
    });

    it('a step left behind by the hidden phase shows in the visible fit', () => {
        const a = analyse(makeSamples({ heapKb: (t) => (t > 15 ? 45120 : 40000) }));
        expect(a.heapUsed.fit.slope).toBeGreaterThan(200);
        expect(a.heapUsed.verdict).toBe('FAIL');
    });

    it('a listener and a subscriber leak fail; documents piling up fail, a new SVG picture or two does not', () => {
        const a = analyse(makeSamples({ listeners: (t) => 800 + Math.floor(t * 2), bus: (t) => 300 + Math.floor(t), documents: (t) => (t > 25 ? 15 : t > 20 ? 13 : 11) }));
        expect(a.listeners.verdict).toBe('FAIL');
        expect(a.busSubscribers.verdict).toBe('FAIL');
        expect(a.documents.verdict).toBe('FAIL');
        expect(analyse(makeSamples({ documents: (t) => (t > 25 ? 13 : t > 20 ? 12 : 11) })).documents.verdict).toBe('ok');
    });
});

describe('the hidden phase', () => {
    it('rates per interval: page task time less the bench\'s own DevTools commands, frames and ticks', () => {
        const s = [
            { i: 0, tS: 0, phase: 'visible', cdp: { TaskDuration: 10, DevToolsCommandDuration: 2, ScriptDuration: 4, LayoutCount: 100, RecalcStyleCount: 200 }, page: {} },
            { i: 1, tS: 60, phase: 'visible', cdp: { TaskDuration: 16, DevToolsCommandDuration: 3, ScriptDuration: 7, LayoutCount: 700, RecalcStyleCount: 1400 }, page: { interval: { seconds: 60, frames: 9600, ticksPerS: 10 } } }
        ];
        const [iv] = intervalsOf(s);
        expect(iv.taskMsPerS).toBeCloseTo((6 - 1) * 1000 / 60);
        expect(iv.scriptMsPerS).toBeCloseTo(50);
        expect(iv.layoutsPerS).toBeCloseTo(10);
        expect(iv.stylesPerS).toBeCloseTo(20);
        expect(iv.fps).toBeCloseTo(160);
        expect(iv.ticksPerS).toBe(10);
    });

    it('a page that hid, paused its drawing, kept ticking and came back passes', () => {
        const samples = makeSamples();
        const h = hiddenCheck(samples, intervalsOf(samples));
        expect(h).toMatchObject({ ran: true, visibilityHidden: true, drawingPaused: true, visibleAgain: true, drawingResumed: true, failed: null, problems: [] });
        expect(h.taskShare).toBeCloseTo(0.2);
        expect(phaseRates(intervalsOf(samples), 'hidden').fps).toBe(0);
        expect(hiddenText(h)).toMatch(/✓ Hidden/);
    });

    it('names each way the hidden page can misbehave', () => {
        const kept = makeSamples({ paused: () => false, taskMs: () => 100, ticks: (ph) => (ph === 'hidden' ? 2 : 10) });
        const h = hiddenCheck(kept, intervalsOf(kept));
        expect(h.failed).toBeNull();
        expect(h.problems.join(' | ')).toMatch(/not paused/);
        expect(h.problems.join(' | ')).toMatch(/fell only to 100 %/);
        expect(h.problems.join(' | ')).toMatch(/must keep playing/);
    });

    it('a page that never read hidden is the bench failing, and a build without the getter is unknown, not wrong', () => {
        const s = makeSamples();
        for (const x of s) x.page.visibility = 'visible';
        expect(hiddenCheck(s, intervalsOf(s)).failed).toMatch(/did not hide/);
        const old = makeSamples({ paused: () => null });
        const h = hiddenCheck(old, intervalsOf(old));
        expect(h.drawingPaused).toBeNull();
        expect(h.problems).toEqual([]);
    });

    it('a pile-up while hidden fails on its own slope, though the page lets go on return', () => {
        // Nodes and listeners climb every hidden minute (a detached DOM held until the next frame)
        // and drop back once the page draws again: the visible fit sees nothing.
        const s = makeSamples({
            nodes: (t, ph) => (ph === 'hidden' ? 2000 + 250 * (t - 12) : 2000),
            listeners: (t, ph) => (ph === 'hidden' ? 850 + 110 * (t - 12) : 850)
        });
        expect(analyse(s).nodes.verdict).toBe('ok');
        const h = hiddenCheck(s, intervalsOf(s));
        expect(h.growth.nodes.slope).toBeCloseTo(250);
        expect(h.growth.nodes.judged).toBe(true);
        expect(h.levels.nodes).toMatchObject({ before: 2000, hiddenMax: 3250, after: 2000 });
        expect(h.problems.join(' | ')).toMatch(/DOM nodes \(live and detached\) grew 250\.0 nodes\/min while hidden \(limit 20\)/);
        expect(h.problems.join(' | ')).toMatch(/JS event listeners grew 110\.0/);
        expect(hiddenText(h)).toMatch(/held while hidden/);
    });

    it('a hidden phase too short to fit is shown, not judged', () => {
        const s = makeSamples({ minutes: 3, hidden: 1, warmup: 0.3, nodes: (t, ph) => (ph === 'hidden' ? 2250 : 2000) });
        const h = hiddenCheck(s, intervalsOf(s));
        expect(h.growth).toEqual({});
        expect(h.levels.nodes).toMatchObject({ before: 2000, hiddenMax: 2250, after: 2000 });
        expect(h.problems).toEqual([]);
        // Six hidden samples over 1.7 minutes: the slope is shown, not judged.
        const t = makeSamples({ minutes: 4, every: 20, hidden: 2, warmup: 0.4, nodes: (m, ph) => (ph === 'hidden' ? 2000 + 300 * (m - 1) : 2000) });
        const ht = hiddenCheck(t, intervalsOf(t));
        expect(ht.growth.nodes).toMatchObject({ n: 6, judged: false });
        expect(ht.growth.nodes.slope).toBeCloseTo(300);
        expect(ht.problems).toEqual([]);
        expect(hiddenText(ht)).toMatch(/300\.00 \(not judged\)/);
        expect(hiddenText(ht)).toMatch(/judged from 3 samples over 2 min; this hidden phase had 6 over 1\.7 min/);
    });

    it('no hidden phase: not run', () => {
        const s = makeSamples({ hidden: 0 });
        expect(hiddenCheck(s, intervalsOf(s))).toEqual({ ran: false });
    });
});

describe('the soak baseline', () => {
    const args = { scene: 'cap128', minutes: 30, every: 60, hidden: 5, warmup: 3 };
    const steady = analyse(makeSamples());

    it('keeps the settings and, per judged metric, its slope and level', () => {
        const b = baselineOf(steady, args, { commit: 'abc' });
        expect(b.settings).toEqual({ scene: 'cap128', minutes: 30, every: 60, hidden: 5, warmup: 3 });
        expect(Object.keys(b.metrics).sort()).toEqual(['busSubscribers', 'documents', 'frames', 'heapUsed', 'listeners', 'nodes']);
        expect(b.metrics.heapUsed.level).toBe(40000);
    });

    it('is refused from a failed, short or growing run', () => {
        expect(baselineRefusal({ failed: 'Chrome died', analysis: steady })).toMatch(/failed/);
        expect(baselineRefusal({ failed: null, analysis: analyse(makeSamples({ minutes: 3, hidden: 1, warmup: 0.3 })) })).toMatch(/too short/);
        expect(baselineRefusal({ failed: null, analysis: analyse(makeSamples({ heapKb: (t) => 40000 + 300 * t })) })).toMatch(/FAILED/);
        expect(baselineRefusal({ failed: null, analysis: steady })).toBeNull();
    });

    it('compare: another board is not comparable; a steeper slope or a higher level regresses', () => {
        const baseline = baselineOf(steady, args);
        expect(compareToBaseline(steady, { ...args, scene: 'S2' }, baseline)).toMatchObject({ comparable: false, reason: expect.stringMatching(/cap128 board, this run S2/) });
        expect(compareToBaseline(steady, args, baseline).regressed).toBe(false);
        const growing = compareToBaseline(analyse(makeSamples({ heapKb: (t) => 40000 + 150 * t })), args, baseline);
        expect(growing.checks.find((c) => c.metric === 'heapUsed' && c.what.startsWith('slope')).verdict).toBe('REGRESSED');
        const bigger = compareToBaseline(analyse(makeSamples({ nodes: () => 7000 })), args, baseline);
        expect(bigger.checks.find((c) => c.metric === 'nodes' && c.what.startsWith('level')).verdict).toBe('REGRESSED');
        expect(bigger.checks.find((c) => c.metric === 'nodes' && c.what.startsWith('slope')).verdict).toBe('ok');
    });

    it('compare: the page task time and the style passes are compared as rates of the fitted intervals', () => {
        const rates = fittedRates(intervalsOf(makeSamples()));
        expect(rates.taskMsPerS).toBeCloseTo(100);
        expect(rates.stylesPerS).toBeCloseTo(200 / 60);
        const baseline = baselineOf(steady, args, {}, rates);
        expect(baseline.rates).toEqual({ taskMsPerS: 100, stylesPerS: 3.3 });
        const same = compareToBaseline(steady, args, baseline, undefined, rates);
        expect(same.regressed).toBe(false);
        expect(same.checks.filter((c) => c.metric === 'taskMsPerS' || c.metric === 'stylesPerS').map((c) => c.verdict)).toEqual(['ok', 'ok']);
        const busy = compareToBaseline(steady, args, baseline, undefined, { ...rates, taskMsPerS: 180, stylesPerS: 120 });
        expect(busy.regressed).toBe(true);
        expect(busy.checks.filter((c) => c.verdict === 'REGRESSED').map((c) => c.metric)).toEqual(['taskMsPerS', 'stylesPerS']);
        // An old baseline without rates leaves them unjudged.
        const old = compareToBaseline(steady, args, baselineOf(steady, args), undefined, rates);
        expect(old.regressed).toBe(false);
        expect(old.checks.filter((c) => c.verdict === 'no baseline').map((c) => c.metric)).toEqual(['taskMsPerS', 'stylesPerS']);
    });

    it('compare: a short run\'s slopes are not judged, its levels are', () => {
        const short = analyse(makeSamples({ minutes: 3, hidden: 1, warmup: 0.3, heapKb: () => 60000 }));
        const c = compareToBaseline(short, { ...args, minutes: 3, hidden: 1 }, baselineOf(steady, args));
        expect(c.notes[0]).toMatch(/settings differ/);
        expect(c.checks.filter((x) => x.what.startsWith('slope')).every((x) => x.verdict === 'not judged')).toBe(true);
        expect(c.checks.find((x) => x.metric === 'heapUsed' && x.what.startsWith('level')).verdict).toBe('REGRESSED');
    });
});

describe('the soak tables', () => {
    it('a sample row lines up with the header, and the slopes table names each verdict', () => {
        const s = makeSamples();
        const iv = intervalsOf(s.slice(0, 2))[0];
        expect(sampleRow(s[1], iv).length).toBe(sampleHeader().length);
        expect(sampleRow(s[0], null)).toMatch(/^0\.0 +warm-up/);
        const text = slopesTable(analyse(makeSamples({ heapKb: (t) => 40000 + 300 * t })));
        expect(text).toMatch(/JS heap used.*FAIL: grows 300\.00 KB\/min/);
    });
});

describe('the heap snapshot reader', () => {
    it('names classes as DevTools does, detached DOM included', () => {
        expect(classNameOf('object', 'Foo')).toBe('Foo');
        expect(classNameOf('native', 'HTMLDivElement', 2)).toBe('Detached HTMLDivElement');
        expect(classNameOf('native', 'HTMLDivElement', 1)).toBe('HTMLDivElement');
        expect(classNameOf('hidden', 'x')).toBe('(system)');
        expect(classNameOf('code', 'x')).toBe('(compiled code)');
        expect(classNameOf('closure', 'f')).toBe('(closure)');
        expect(classNameOf('object', '')).toBe('(anonymous)');
    });

    it('groups objects named by their id or their whole tag', () => {
        expect(classNameOf('object', 'system / Context / scope @75823')).toBe('system / Context / scope');
        expect(classNameOf('native', 'Detached <img src="assets/items/ore/i_ore_copper.png">', 2)).toBe('Detached <img>');
        expect(classNameOf('native', '<div id="boot-splash" style="position: fixed;">', 2)).toBe('Detached <div>');
        expect(classNameOf('native', '<audio preload="auto">', 1)).toBe('<audio>');
        expect(classNameOf('native', 'blink::KeyframeEffectModel<blink::StringKeyframe>')).toBe('blink::KeyframeEffectModel<blink::StringKeyframe>');
    });

    it('retained sizes follow the dominator tree: a node reached two ways belongs to neither', () => {
        // root → A(Foo 10) → B(Bar 20) → C(Bar 5); root → D(Foo 1) → C; root ⇢ W(Baz 100) weakly only.
        const snap = makeSnapshot(
            [{ type: 'synthetic' }, { type: 'object', name: 'Foo', self: 10 }, { type: 'object', name: 'Bar', self: 20 },
                { type: 'object', name: 'Foo', self: 1 }, { type: 'object', name: 'Bar', self: 5 }, { type: 'object', name: 'Baz', self: 100 }],
            [[0, 1], [0, 3], [0, 5, 'weak'], [1, 2], [2, 4], [3, 4]]
        );
        const s = classSummary(snap);
        expect(s.reachable).toBe(5);
        expect(s.totalSelf).toBe(36);
        expect(s.classes.get('Foo')).toEqual({ count: 2, self: 11, retained: 31 });   // A keeps A + B; D keeps D
        expect(s.classes.get('Bar')).toEqual({ count: 2, self: 25, retained: 25 });   // B, and C on its own (root dominates it)
        expect(s.classes.has('Baz')).toBe(false);
    });

    it('an object inside another of its class is not counted twice', () => {
        const snap = makeSnapshot(
            [{ type: 'synthetic' }, { type: 'object', name: 'Foo', self: 10 }, { type: 'object', name: 'Foo', self: 7 }, { type: 'object', name: 'Bar', self: 3 }],
            [[0, 1], [1, 2], [2, 3]]
        );
        const s = classSummary(snap);
        expect(s.classes.get('Foo')).toEqual({ count: 2, self: 17, retained: 20 });
        expect(s.classes.get('Bar')).toEqual({ count: 1, self: 3, retained: 3 });
    });

    it('a shortcut edge counts only from the root', () => {
        const snap = makeSnapshot(
            [{ type: 'synthetic' }, { type: 'object', name: 'Foo', self: 1 }, { type: 'object', name: 'Qux', self: 50 }, { type: 'object', name: 'Win', self: 2 }],
            [[0, 1], [0, 3, 'shortcut'], [1, 2, 'shortcut']]
        );
        const s = classSummary(snap);
        expect(s.classes.has('Qux')).toBe(false);
        expect(s.classes.get('Win').count).toBe(1);
    });

    it('a deep chain does not overflow the stack', () => {
        const n = 200000;
        const list = [{ type: 'synthetic' }, ...Array.from({ length: n }, () => ({ type: 'object', name: 'Link', self: 1 }))];
        const edgeList = Array.from({ length: n }, (_, i) => [i, i + 1]);
        const s = classSummary(makeSnapshot(list, edgeList));
        expect(s.classes.get('Link')).toEqual({ count: n, self: n, retained: n });
    });

    it('the diff ranks classes by retained growth and leaves out the snapshot\'s own groups', () => {
        const a = { classes: new Map([['Foo', { count: 2, self: 11, retained: 31 }], ['(synthetic)', { count: 3, self: 0, retained: 999 }], ['Gone', { count: 1, self: 5, retained: 5 }]]) };
        const b = { classes: new Map([['Foo', { count: 9, self: 50, retained: 100 }], ['Leak', { count: 40, self: 40, retained: 50 }], ['(synthetic)', { count: 3, self: 0, retained: 5000 }]]) };
        const rows = diffClasses(a, b);
        expect(rows.map((r) => [r.name, r.dRetained, r.dCount])).toEqual([['Foo', 69, 7], ['Leak', 50, 40], ['Gone', -5, -1]]);
    });
});
