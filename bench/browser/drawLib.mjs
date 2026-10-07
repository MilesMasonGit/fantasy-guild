// The drawing bench's pure parts: options, what it keeps from a Perf HUD report, medians and
// spreads, the cost table and the baseline compare. No browser, no I/O, so they are unit-tested
// (src/tests/BenchDraw.test.js).

import { median } from '../lib/stats.mjs';

export const DRAW_SWITCHES = [
    'rings', 'alerts', 'speech', 'tooltips',
    'heroAnim', 'enemyAnim', 'walkDraw', 'itemFlight',
    'notifications', 'bin', 'dock', 'drawers',
    'spriteFx', 'background', 'particles'
];

/** Scene ids, in run order. The UI scenes are all on the S2 board. */
export const SCENE_IDS = ['S1', 'S2', 'S3', 'bank', 'shop', 'notify', 'loot', 'inspect'];

export const DEFAULTS = {
    settleS: 20,
    windowS: 20,
    quickSettleS: 6,
    quickWindowS: 8
};

/**
 * `--compare` fails a scene when a number is worse than the baseline by more than BOTH its
 * ratio and its floor: about three times the run-to-run spread measured on the owner's PC
 * (bench/README.md, "Drawing and drag benches"). A slowed CPU gets its own, wider set: Chrome's
 * CPU throttle multiplies any other load on the machine, and its spread was several times the
 * unthrottled one.
 */
export const TOLERANCE = {
    full: {
        fps: { worseIf: 'lower', ratio: 0.05, floor: 3 },
        workP50: { worseIf: 'higher', ratio: 0.20, floor: 0.3 },
        workP99: { worseIf: 'higher', ratio: 0.30, floor: 2.0 },
        inBudgetPct: { worseIf: 'lower', ratio: 0.05, floor: 4 }
    },
    slowed: {
        fps: { worseIf: 'lower', ratio: 0.25, floor: 5 },
        workP50: { worseIf: 'higher', ratio: 0.35, floor: 2.0 },
        workP99: { worseIf: 'higher', ratio: 0.50, floor: 10 },
        inBudgetPct: { worseIf: 'lower', ratio: 0.25, floor: 5 }
    }
};

export const toleranceFor = (cond) => (/@1x$/.test(cond) ? TOLERANCE.full : TOLERANCE.slowed);

export const EXIT = { OK: 0, REGRESSED: 1, BENCH_FAILED: 3 };

export function parseArgs(argv) {
    const args = {
        builds: ['perf'], cpus: [1, 4], quick: false, only: null, switches: false,
        repeats: 1, compare: false, saveBaseline: false, ab: null, build: true,
        settleS: null, windowS: null, port: null, cpuGiven: false, repeatsGiven: false
    };
    for (const a of argv) {
        const [key, ...rest] = a.replace(/^--/, '').split('=');
        const value = rest.join('=');
        switch (key) {
            case 'dev': if (!args.builds.includes('dev')) args.builds.push('dev'); break;
            case 'dev-only': args.builds = ['dev']; break;
            case 'quick': args.quick = true; break;
            case 'only': args.only = value.split(',').map(s => s.trim()).filter(Boolean); break;
            case 'switches': args.switches = true; break;
            case 'repeats': args.repeats = Math.max(1, Math.floor(Number(value)) || 1); args.repeatsGiven = true; break;
            case 'compare': args.compare = true; break;
            case 'save-baseline': args.saveBaseline = true; break;
            case 'ab':
                if (!/^https?:\/\//.test(value)) throw new Error('--ab needs the second server\'s URL, e.g. --ab=http://localhost:5391');
                args.ab = value.replace(/\/+$/, '');
                break;
            case 'no-build': args.build = false; break;
            case 'cpu': {
                const cpus = value.split(',').map(Number).filter(n => Number.isFinite(n) && n >= 1);
                if (!cpus.length) throw new Error('--cpu takes slowdown rates, e.g. --cpu=1,4');
                args.cpus = cpus;
                args.cpuGiven = true;
                break;
            }
            case 'settle': args.settleS = positive(value, '--settle'); break;
            case 'window': args.windowS = positive(value, '--window'); break;
            case 'port': args.port = Math.floor(positive(value, '--port')); break;
            default: throw new Error(`unknown option --${key} (see bench/README.md)`);
        }
    }
    if (args.only) {
        const known = new Set([...SCENE_IDS.map(s => s.toLowerCase())]);
        const bad = args.only.filter(s => !known.has(s.toLowerCase()));
        if (bad.length) throw new Error(`unknown scene ${bad.join(', ')}; known: ${SCENE_IDS.join(', ')}`);
        args.only = args.only.map(s => SCENE_IDS.find(id => id.toLowerCase() === s.toLowerCase()));
    }
    // The cost table is one condition: the plan's "perf build, 1×" unless --cpu says otherwise.
    if (args.switches && !args.cpuGiven) args.cpus = [1];
    if (args.quick && !args.only) args.only = ['S2'];
    // One window per scene is fine for reading; a baseline and a gate want medians.
    if (!args.repeatsGiven && args.saveBaseline) args.repeats = 3;
    else if (!args.repeatsGiven && args.compare) args.repeats = 2;
    args.settleS ??= args.quick ? DEFAULTS.quickSettleS : DEFAULTS.settleS;
    args.windowS ??= args.quick ? DEFAULTS.quickWindowS : DEFAULTS.windowS;
    if (args.saveBaseline && (args.ab || args.switches)) throw new Error('--save-baseline cannot be combined with --ab or --switches');
    return args;
}

function positive(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} needs a positive number`);
    return n;
}

export const conditionKey = (build, cpu) => `${build}@${cpu}x`;

/** The numbers worth keeping from one `__perf.report()`. */
export function metricsOf(report) {
    const seconds = report?.window?.seconds || 0;
    const f = report?.frames || {};
    const w = report?.frameWork || {};
    const surfaces = report?.react?.surfaces || {};
    // ⚠️ React's production build never calls a `<Profiler>`'s onRender, so the perf build
    // reports 0 subtree commits whatever happens. Null, not a false zero. (MatBoard's own
    // renders are counted by an effect and work in both builds.)
    const profilerWorks = !String(report?.env?.build || '').startsWith('perf') && !String(report?.env?.build || '').startsWith('production');
    const perS = (s) => (profilerWorks ? s?.perSecond ?? null : null);
    return {
        seconds,
        representative: !!report?.window?.representative,
        hiddenS: report?.window?.hiddenSeconds ?? null,
        reactArmed: !!report?.react?.armed,
        frames: f.count ?? 0,
        fps: seconds > 0 ? round(f.count / seconds, 1) : null,
        intervalP50: f.p50 ?? null,
        intervalP95: f.p95 ?? null,
        intervalP99: f.p99 ?? null,
        workP50: w.p50 ?? null,
        workP99: w.p99 ?? null,
        inBudgetPct: w.pctAtOrUnder?.['6.06ms'] ?? null,
        loafCount: report?.longAnimationFrames?.count ?? null,
        loafMaxMs: report?.longAnimationFrames?.maxMs ?? null,
        tickP50: report?.tick?.p50 ?? null,
        tickP99: report?.tick?.p99 ?? null,
        ticksPerS: report?.tick?.perSecond ?? null,
        matOwnPerS: report?.react?.ownRenders?.MatBoard?.perSecond ?? null,
        matSubtreePerS: perS(surfaces.MatBoard),
        dockPerS: perS(surfaces.HeroDock),
        drawerPerS: perS(surfaces.Drawer),
        domNodes: report?.dom?.nodes ?? null,
        heapMb: report?.heap?.usedMb ?? null,
        tokens: report?.census?.tokens ?? null,
        build: report?.env?.build ?? null
    };
}

/** Why a measured window cannot be trusted, or null. */
export function rejectReason(m) {
    if (!m.frames) return 'no frames were drawn';
    if (!m.representative) return 'not representative (the page was hidden or drew nothing)';
    if (m.hiddenS > 1) return `hidden for ${m.hiddenS} s`;
    if (!m.reactArmed) return 'React commit counting was not armed';
    return null;
}

export const NUMERIC_KEYS = [
    'fps', 'intervalP50', 'intervalP95', 'intervalP99', 'workP50', 'workP99', 'inBudgetPct',
    'loafCount', 'loafMaxMs', 'tickP50', 'tickP99', 'ticksPerS', 'matOwnPerS', 'matSubtreePerS',
    'dockPerS', 'drawerPerS', 'domNodes', 'heapMb', 'tokens'
];

/** Median of each number across repeats, plus the min–max spread of the headline ones. */
export function aggregate(runs) {
    const out = { n: runs.length };
    for (const k of NUMERIC_KEYS) out[k] = median(runs.map(r => r[k]).filter(v => v !== null && v !== undefined));
    out.spread = {};
    for (const k of ['fps', 'workP50', 'workP99', 'inBudgetPct']) {
        const v = runs.map(r => r[k]).filter(Number.isFinite);
        out.spread[k] = v.length ? { min: Math.min(...v), max: Math.max(...v) } : null;
    }
    return out;
}

/**
 * The cost table: each switch's number minus all-on. `fpsGain` and `workSavedMs` are positive
 * when turning the system's drawing off made frames cheaper. `noise` is the spread of the
 * all-on runs themselves: a cost inside it is not measurable.
 */
export function costTable(allOnRuns, offBySwitch) {
    const base = aggregate(allOnRuns);
    const noise = {
        fps: spreadWidth(base.spread.fps),
        workP50: spreadWidth(base.spread.workP50),
        workP99: spreadWidth(base.spread.workP99)
    };
    const rows = Object.entries(offBySwitch).map(([name, runs]) => {
        const off = aggregate(runs);
        const fpsGain = off.fps - base.fps;
        const workSavedMs = base.workP50 - off.workP50;
        const p99SavedMs = base.workP99 - off.workP99;
        return {
            switch: name, fps: off.fps, workP50: off.workP50, workP99: off.workP99, inBudgetPct: off.inBudgetPct,
            fpsGain: round(fpsGain, 1), workSavedMs: round(workSavedMs, 3), p99SavedMs: round(p99SavedMs, 2),
            matSubtreePerS: off.matSubtreePerS, domNodes: off.domNodes,
            aboveNoise: Math.abs(workSavedMs) > noise.workP50 || Math.abs(fpsGain) > noise.fps
        };
    });
    rows.sort((a, b) => b.workSavedMs - a.workSavedMs);
    return { allOn: base, noise, rows };
}

const spreadWidth = (s) => (s ? round(s.max - s.min, 3) : null);

/** One number against the baseline: `{ base, now, verdict }`. */
export function judge(metric, base, now, tol) {
    if (!Number.isFinite(base) || !Number.isFinite(now)) return { metric, base, now, verdict: 'no baseline' };
    const worse = tol.worseIf === 'lower' ? base - now : now - base;
    const regressed = worse > tol.floor && worse > Math.abs(base) * tol.ratio;
    return { metric, base, now, change: round(now - base, 3), verdict: regressed ? 'REGRESSED' : 'ok' };
}

/**
 * Compare a run's medians with the baseline. `results` and `baseline.conditions` are both
 * `{ [conditionKey]: { [sceneId]: medians } }`.
 */
export function compareToBaseline(results, baseline) {
    const checks = [];
    for (const [cond, scenes] of Object.entries(results)) {
        const tol = toleranceFor(cond);
        for (const [scene, now] of Object.entries(scenes)) {
            const base = baseline?.conditions?.[cond]?.[scene];
            if (!base) { checks.push({ cond, scene, metric: '—', verdict: 'no baseline' }); continue; }
            for (const metric of Object.keys(tol)) checks.push({ cond, scene, ...judge(metric, base[metric], now[metric], tol[metric]) });
        }
    }
    return { checks, regressed: checks.some(c => c.verdict === 'REGRESSED') };
}

/**
 * Settle and window change the numbers themselves (a board is still settling for its first
 * ~20 s), so a run is only comparable with a baseline taken with the same ones. Null when they
 * match, else the reason.
 */
export function settingsMismatch(args, baseline) {
    const s = baseline?.settings;
    if (!s) return 'the baseline records no settings';
    if (s.settleS !== args.settleS || s.windowS !== args.windowS) {
        return `the baseline used settle ${s.settleS} s / window ${s.windowS} s, this run ${args.settleS} s / ${args.windowS} s`;
    }
    return null;
}

/** What `--save-baseline` writes per scene: only the compared numbers, plus context. */
export function baselineEntry(agg) {
    return {
        fps: agg.fps, workP50: agg.workP50, workP99: agg.workP99, inBudgetPct: agg.inBudgetPct,
        tokens: agg.tokens, domNodes: agg.domNodes, n: agg.n
    };
}

/** A/B order for one scene: A, B, B, A (repeated), so drift over time hits both sides equally. */
export function abOrder(rounds = 1) {
    const out = [];
    for (let i = 0; i < rounds; i++) out.push('A', 'B', 'B', 'A');
    return out;
}

export function round(v, places = 3) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const f = 10 ** places;
    return Math.round(v * f) / f;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function table(header, lines) {
    const widths = header.map((h, i) => Math.max(h.length, ...lines.map(l => String(l[i]).length)));
    const row = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ');
    return [row(header), widths.map(w => '-'.repeat(w)).join('  '), ...lines.map(row)].join('\n');
}

export function sceneTable(rows) {
    const header = ['scene', 'fps', 'interval p50/p95/p99 ms', 'work p50/p99 ms', '≤6.06 %', 'LoAF n/max', 'tick p50/p99 ms', 'Mat own/s', 'mat sub/s', 'dock/s', 'DOM', 'heap MB'];
    const lines = rows.map(({ label, m }) => [
        label,
        fmt(m.fps) + (m.n > 1 && m.spread?.fps ? ` (${fmt(m.spread.fps.min)}–${fmt(m.spread.fps.max)})` : ''),
        `${fmt(m.intervalP50, 2)}/${fmt(m.intervalP95, 2)}/${fmt(m.intervalP99, 2)}`,
        `${fmt(m.workP50, 2)}/${fmt(m.workP99, 2)}`,
        fmt(m.inBudgetPct),
        `${fmt(m.loafCount, 0)}/${fmt(m.loafMaxMs, 0)}`,
        `${fmt(m.tickP50, 2)}/${fmt(m.tickP99, 2)}`,
        fmt(m.matOwnPerS),
        fmt(m.matSubtreePerS),
        fmt(m.dockPerS),
        fmt(m.domNodes, 0),
        fmt(m.heapMb)
    ]);
    return table(header, lines);
}

export function costTableText(ct) {
    const header = ['switch off', 'fps', 'fps gain', 'work p50 ms', 'saved p50 ms', 'work p99 ms', 'saved p99 ms', '≤6.06 %', 'mat sub/s', 'DOM', 'above noise'];
    const a = ct.allOn;
    const lines = [[
        `(all on, n=${a.n})`, fmt(a.fps), '', fmt(a.workP50, 2), '', fmt(a.workP99, 2), '', fmt(a.inBudgetPct), fmt(a.matSubtreePerS), fmt(a.domNodes, 0), ''
    ]];
    for (const r of ct.rows) {
        lines.push([r.switch, fmt(r.fps), fmt(r.fpsGain), fmt(r.workP50, 2), fmt(r.workSavedMs, 2), fmt(r.workP99, 2), fmt(r.p99SavedMs, 2), fmt(r.inBudgetPct), fmt(r.matSubtreePerS), fmt(r.domNodes, 0), r.aboveNoise ? 'yes' : 'no']);
    }
    return table(header, lines) + `\nnoise (spread of the all-on runs): fps ±${fmt(ct.noise.fps)}, work p50 ${fmt(ct.noise.workP50, 2)} ms, work p99 ${fmt(ct.noise.workP99, 2)} ms`;
}
