// The drag bench's pure parts: options, the per-kind summary and the failure grouping. Unit-tested
// in src/tests/BenchDrag.test.js.

import { quantile } from '../lib/stats.mjs';

/** Drag kinds, in run order, and what each needs open. */
export const KINDS = [
    { id: 'dockHero', label: 'hero dock → mat', needs: 'mat' },
    { id: 'flag', label: 'flag → mat', needs: 'mat' },
    { id: 'token', label: 'Token → mat', needs: 'mat' },
    { id: 'tokenToBin', label: 'Token → bin', needs: 'mat' },
    { id: 'binToMat', label: 'bin → mat', needs: 'mat' },
    { id: 'shop', label: 'Shop row → mat', needs: 'shop' },
    { id: 'equip', label: 'Bank item → dock hero', needs: 'bank' }
];

export const EXIT = { OK: 0, BELOW_100: 1, BENCH_FAILED: 3 };

export function parseArgs(argv) {
    const args = { n: 50, build: 'perf', buildFirst: true, cpu: 1, overlays: true, kinds: null, port: null };
    for (const a of argv) {
        const [key, ...rest] = a.replace(/^--/, '').split('=');
        const value = rest.join('=');
        switch (key) {
            case 'n': {
                const n = Math.floor(Number(value));
                if (!(n >= 1)) throw new Error('--n needs a whole number of drags per kind, e.g. --n=20');
                args.n = n;
                break;
            }
            case 'dev': args.build = 'dev'; break;
            case 'no-build': args.buildFirst = false; break;
            case 'cpu': {
                const c = Number(value);
                if (!(c >= 1)) throw new Error('--cpu needs a slowdown rate ≥ 1');
                args.cpu = c;
                break;
            }
            case 'no-overlays': args.overlays = false; break;
            case 'kinds': {
                const ids = value.split(',').map(s => s.trim()).filter(Boolean);
                const bad = ids.filter(id => !KINDS.some(k => k.id === id));
                if (bad.length) throw new Error(`unknown kind ${bad.join(', ')}; known: ${KINDS.map(k => k.id).join(', ')}`);
                args.kinds = ids;
                break;
            }
            case 'port': args.port = Math.floor(Number(value)) || null; break;
            default: throw new Error(`unknown option --${key} (see bench/README.md)`);
        }
    }
    return args;
}

/**
 * Why one attempt failed, as a short cause plus what was under the pointer at the press. The
 * grouping key: the same blocker failing the same way is one line in the report.
 */
export function failureCause(a) {
    if (a.skipped) return `skipped: ${a.skipped}`;
    if (a.error) return `bench error: ${a.error}`;
    if (!a.pickedUp) return `never picked up · under the pointer: ${a.under?.identity ?? '?'}`;
    if (a.wrongThing) return `picked up the wrong thing (${String(a.inHand).split(' ')[0]}) · under the pointer: ${a.under?.identity ?? '?'}`;
    if (a.stuck) return 'picked up, but the drag never ended';
    const refusal = (a.notes || []).find(n => /^(warning|error)/.test(n));
    if (refusal) return `dropped, refused by the game: ${refusal.replace(/^\w+: /, '')}`;
    if (a.dropSound === 'unassign') {
        const other = a.underTarget?.droppables?.length ? ` · other drop targets there: ${a.underTarget.droppables.slice(0, 3).join(', ')}` : '';
        return `dropped, no target took it · under the drop point: ${a.underTarget?.identity ?? '?'}${other}`;
    }
    return `dropped, state not as intended: ${a.detail ?? '?'}${a.dropSound ? ` (drop sound ${a.dropSound})` : ''}`;
}

/** Per kind: attempts, successes, %, pickup delay p50/p95, and grouped failure causes. */
export function summarise(attempts) {
    const tried = attempts.filter(a => !a.skipped);
    const ok = tried.filter(a => a.ok);
    const delays = tried.map(a => a.pressToStartMs).filter(Number.isFinite).sort((x, y) => x - y);
    const fromThreshold = tried.map(a => a.thresholdToStartMs).filter(Number.isFinite).sort((x, y) => x - y);
    const causes = new Map();
    for (const a of attempts) {
        if (a.ok) continue;
        const c = failureCause(a);
        const entry = causes.get(c) || { cause: c, count: 0, example: null };
        entry.count++;
        if (!entry.example) entry.example = { source: a.source, under: a.under, inHand: a.inHand, notes: a.notes, detail: a.detail };
        causes.set(c, entry);
    }
    return {
        attempts: tried.length,
        skipped: attempts.length - tried.length,
        successes: ok.length,
        successPct: tried.length ? Math.round((1000 * ok.length) / tried.length) / 10 : null,
        pickupP50: delays.length ? quantile(delays, 0.5) : null,
        pickupP95: delays.length ? quantile(delays, 0.95) : null,
        thresholdP50: fromThreshold.length ? quantile(fromThreshold, 0.5) : null,
        thresholdP95: fromThreshold.length ? quantile(fromThreshold, 0.95) : null,
        failures: [...causes.values()].sort((a, b) => b.count - a.count)
    };
}

/** Exit 1 when any kind (in any pass) is below 100 %, or had nothing it could try. */
export function exitCode(summaries, benchFailed = false) {
    if (benchFailed) return EXIT.BENCH_FAILED;
    const below = Object.values(summaries).some(s => s.attempts === 0 || s.successes < s.attempts);
    return below ? EXIT.BELOW_100 : EXIT.OK;
}

/**
 * The pointer path of one drag: a few steps under the 8 px activation distance, one past it,
 * then eased steps to the target and a short wiggle there (dnd-kit hit-tests on pointer moves).
 */
export function dragPath(from, to, steps = 10) {
    const pts = [];
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    pts.push({ x: from.x + ux * 3, y: from.y + uy * 3 });
    pts.push({ x: from.x + ux * 12, y: from.y + uy * 12 });
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
        pts.push({ x: from.x + dx * e, y: from.y + dy * e });
    }
    pts.push({ x: to.x + 2, y: to.y + 1 });
    pts.push({ x: to.x, y: to.y });
    return pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}
