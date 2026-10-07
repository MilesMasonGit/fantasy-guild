// @vitest-environment node
// The drawing bench's pure parts (bench/browser/drawLib.mjs): options, what is kept from a Perf
// HUD report, the cost table and the baseline compare. The bench itself drives Chrome and is
// not run here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
    parseArgs, metricsOf, rejectReason, aggregate, costTable, judge, compareToBaseline, settingsMismatch,
    toleranceFor, abOrder, DRAW_SWITCHES, TOLERANCE, baselineEntry
} from '../../bench/browser/drawLib.mjs';

const report = (over = {}) => ({
    window: { seconds: 20, hiddenSeconds: 0, representative: true },
    env: { build: 'vite-dev (React development build)' },
    frames: { count: 3200, p50: 6.1, p95: 6.2, p99: 12.1 },
    frameWork: { p50: 2.1, p99: 8.3, pctAtOrUnder: { '6.06ms': 97.7 } },
    longAnimationFrames: { count: 1, maxMs: 60 },
    tick: { p50: 0.3, p99: 1.9, perSecond: 10 },
    react: { armed: true, ownRenders: { MatBoard: { perSecond: 0.5 } }, surfaces: { MatBoard: { perSecond: 8.4 }, HeroDock: { perSecond: 0.6 } } },
    dom: { nodes: 1540 },
    heap: { usedMb: 21 },
    census: { tokens: 107 },
    ...over
});

describe('drawing bench options', () => {
    it('defaults to the perf build at CPU 1x and 4x, every scene, one window each', () => {
        const a = parseArgs([]);
        expect(a.builds).toEqual(['perf']);
        expect(a.cpus).toEqual([1, 4]);
        expect(a.only).toBeNull();
        expect(a.repeats).toBe(1);
        expect(a.settleS).toBe(20);
        expect(a.windowS).toBe(20);
    });

    it('--dev adds the dev build; --quick is S2 with short windows', () => {
        expect(parseArgs(['--dev']).builds).toEqual(['perf', 'dev']);
        const q = parseArgs(['--quick']);
        expect(q.only).toEqual(['S2']);
        expect(q.settleS).toBeLessThan(20);
        expect(q.windowS).toBeLessThan(20);
    });

    it('--switches runs at CPU 1x unless --cpu says otherwise', () => {
        expect(parseArgs(['--switches']).cpus).toEqual([1]);
        expect(parseArgs(['--switches', '--cpu=4']).cpus).toEqual([4]);
    });

    it('a baseline takes three windows per scene and a compare two, unless --repeats is given', () => {
        expect(parseArgs(['--save-baseline']).repeats).toBe(3);
        expect(parseArgs(['--compare']).repeats).toBe(2);
        expect(parseArgs(['--compare', '--repeats=1']).repeats).toBe(1);
    });

    it('scene names are case-insensitive and unknown ones are refused', () => {
        expect(parseArgs(['--only=s2,BANK']).only).toEqual(['S2', 'bank']);
        expect(() => parseArgs(['--only=S9'])).toThrow(/unknown scene/);
        expect(() => parseArgs(['--frobnicate'])).toThrow(/unknown option/);
        expect(() => parseArgs(['--ab=localhost:5391'])).toThrow(/URL/);
        expect(() => parseArgs(['--save-baseline', '--switches'])).toThrow();
    });
});

describe('what is kept from a report', () => {
    it('reads fps from frames over the window, and the frame-work and commit figures', () => {
        const m = metricsOf(report());
        expect(m.fps).toBe(160);
        expect(m.workP50).toBe(2.1);
        expect(m.inBudgetPct).toBe(97.7);
        expect(m.matSubtreePerS).toBe(8.4);
        expect(m.dockPerS).toBe(0.6);
        expect(rejectReason(m)).toBeNull();
    });

    it('reports no subtree commits for the perf build rather than a false zero', () => {
        const m = metricsOf(report({ env: { build: 'perf' } }));
        expect(m.matSubtreePerS).toBeNull();
        expect(m.dockPerS).toBeNull();
        expect(m.matOwnPerS).toBe(0.5);
    });

    it('rejects a window that drew nothing, was hidden, or did not count React commits', () => {
        expect(rejectReason(metricsOf(report({ frames: { count: 0 } })))).toMatch(/no frames/);
        expect(rejectReason(metricsOf(report({ window: { seconds: 20, hiddenSeconds: 3, representative: false } })))).toMatch(/representative/);
        expect(rejectReason(metricsOf(report({ react: { armed: false } })))).toMatch(/React/);
    });
});

describe('medians, spread and the cost table', () => {
    const run = (fps, workP50, workP99 = 8) => ({ fps, workP50, workP99, inBudgetPct: 97, matSubtreePerS: 8, domNodes: 1500 });

    it('takes medians and keeps the spread of the headline numbers', () => {
        const a = aggregate([run(160, 2.0), run(164, 2.2), run(162, 2.1)]);
        expect(a.fps).toBe(162);
        expect(a.workP50).toBe(2.1);
        expect(a.spread.fps).toEqual({ min: 160, max: 164 });
    });

    it('a switch that makes frames cheaper shows a positive saving, and noise comes from the all-on spread', () => {
        const ct = costTable([run(160, 2.0), run(162, 2.2), run(161, 2.1)], {
            rings: [run(163, 1.5)],
            speech: [run(161, 2.12)]
        });
        expect(ct.noise.workP50).toBeCloseTo(0.2);
        const rings = ct.rows.find(r => r.switch === 'rings');
        expect(rings.workSavedMs).toBeCloseTo(0.6);
        expect(rings.aboveNoise).toBe(true);
        expect(ct.rows.find(r => r.switch === 'speech').aboveNoise).toBe(false);
        expect(ct.rows[0].switch).toBe('rings');
    });
});

describe('the baseline compare', () => {
    it('fails only when worse by more than both the ratio and the floor', () => {
        const tol = TOLERANCE.full.workP50;
        expect(judge('workP50', 2.0, 2.3, tol).verdict).toBe('ok');           // +0.3 ms is at the floor
        expect(judge('workP50', 2.0, 2.6, tol).verdict).toBe('REGRESSED');    // +30 %, +0.6 ms
        expect(judge('workP50', 0.5, 0.75, tol).verdict).toBe('ok');          // +50 % but under the floor
        expect(judge('fps', 160, 150, TOLERANCE.full.fps).verdict).toBe('REGRESSED');
        expect(judge('fps', 160, 170, TOLERANCE.full.fps).verdict).toBe('ok'); // faster is never a fail
        expect(judge('fps', NaN, 150, TOLERANCE.full.fps).verdict).toBe('no baseline');
    });

    it('uses the wider set for a slowed CPU', () => {
        expect(toleranceFor('perf@1x')).toBe(TOLERANCE.full);
        expect(toleranceFor('perf@4x')).toBe(TOLERANCE.slowed);
        const baseline = { conditions: { 'perf@4x': { S2: { fps: 80, workP50: 14, workP99: 50, inBudgetPct: 4 } } } };
        // −15 % fps at 4x is inside the slowed tolerance (−25 %).
        expect(compareToBaseline({ 'perf@4x': { S2: { fps: 68, workP50: 15, workP99: 55, inBudgetPct: 3 } } }, baseline).regressed).toBe(false);
        expect(compareToBaseline({ 'perf@4x': { S2: { fps: 50, workP50: 15, workP99: 55, inBudgetPct: 3 } } }, baseline).regressed).toBe(true);
    });

    it('a scene with no baseline is reported, not failed', () => {
        const c = compareToBaseline({ 'perf@1x': { S2: { fps: 160 } } }, { conditions: {} });
        expect(c.regressed).toBe(false);
        expect(c.checks[0].verdict).toBe('no baseline');
    });

    it('refuses to compare runs with a different settle or window', () => {
        const baseline = { settings: { settleS: 20, windowS: 20 } };
        expect(settingsMismatch({ settleS: 20, windowS: 20 }, baseline)).toBeNull();
        expect(settingsMismatch({ settleS: 6, windowS: 8 }, baseline)).toMatch(/settle 20/);
        expect(settingsMismatch({ settleS: 20, windowS: 20 }, {})).toMatch(/no settings/);
    });

    it('a baseline entry keeps only the compared numbers and context', () => {
        expect(Object.keys(baselineEntry(aggregate([{ fps: 1, workP50: 1, workP99: 1, inBudgetPct: 1, tokens: 3, domNodes: 4 }]))).sort())
            .toEqual(['domNodes', 'fps', 'inBudgetPct', 'n', 'tokens', 'workP50', 'workP99']);
    });

    it('A/B runs interleave A, B, B, A', () => {
        expect(abOrder(2)).toEqual(['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A']);
    });
});

describe('the switch list', () => {
    it('matches the game\'s registry of drawing switches', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../ui/dev/perf/drawSwitches.js'), 'utf8');
        const block = src.match(/DRAW_SWITCHES = \[([\s\S]*?)\]/)[1];
        const names = [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);
        expect(DRAW_SWITCHES).toEqual(names);
    });
});
