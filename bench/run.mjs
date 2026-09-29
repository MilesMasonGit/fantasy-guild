// Fantasy Guild bench — Tier A, the headless engine benchmark (`npm run bench`).
//
// Runs each scenario in a fresh Node process (bench/worker.mjs), a few times,
// takes the median, prints a table and writes JSON to bench/results/.
//
//   npm run bench                       S1–S6, default lengths
//   npm run bench -- --only=S2,S3       some scenarios
//   npm run bench -- --compare          also compare with bench/baseline.json:
//                                       the work first (fingerprints), then
//                                       the timings
//   npm run bench -- --accept-work-change=CR3-123
//                                       compare, but let a deliberate, ruled
//                                       work change through: rewrites only the
//                                       fingerprints in bench/baseline.json and
//                                       records the ticket (implies --compare)
//   npm run bench -- --save-baseline    write this run as bench/baseline.json
//   npm run bench -- --long             S6 for the full 8 game-hours
//   npm run bench -- --repeats=5        timing runs per scenario (default 3)
//   npm run bench -- --no-profile       skip the profile passes
//   npm run bench -- --cpu-prof         also write V8 .cpuprofile files
//   npm run bench -- --inject-slow=0.5  add a tick handler that busy-waits
//                                       0.5 ms — proves --compare catches it
//
// Exit codes:
//   0  all good
//   1  SLOWER — a timing regression (> 20 % and > 0.02 ms over the baseline)
//   2  WORK CHANGED — a scenario ended in a different state, or drew a
//      different number of random numbers, than the baseline (or its repeats
//      disagreed with each other). Wins over 1: timings of different work are
//      not comparable.
//   3  the bench itself failed (a worker crashed, a bad option, no baseline)
//
// See bench/README.md.

import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { median } from './lib/stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const resultsDir = path.join(here, 'results');
const baselineFile = path.join(here, 'baseline.json');

/**
 * Scenario id → file, and which get a profile pass by default. `longChangesWork`:
 * `--long` runs more ticks, so the end state differs from a normal run's.
 */
const SCENARIOS = [
    { id: 'S1', file: 's1-quiet-hall.mjs', name: 'Quiet Hall', profile: false },
    { id: 'S2', file: 's2-realistic.mjs', name: 'Realistic late game', profile: true },
    { id: 'S3', file: 's3-torture.mjs', name: 'Torture', profile: true },
    { id: 'S4', file: 's4-push-storm.mjs', name: 'Push storm', profile: true },
    { id: 'S5', file: 's5-rebuild-storm.mjs', name: 'Rebuild storm', profile: true },
    { id: 'S6', file: 's6-long-idle.mjs', name: 'Long idle', profile: false, repeats: 1, longChangesWork: true }
];

/** A regression is > 20 % slower AND more than this many ms slower (timer noise floor). */
const REGRESSION_RATIO = 1.2;
const NOISE_FLOOR_MS = 0.02;

const EXIT = { OK: 0, SLOWER: 1, WORK_CHANGED: 2, BENCH_FAILED: 3 };

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = { repeats: 3, profile: true, compare: false, saveBaseline: false, long: false, cpuProf: false, injectSlowMs: 0, only: null, seed: 1, acceptWorkChange: null };
    for (const a of argv) {
        const [key, ...rest] = a.replace(/^--/, '').split('=');
        const value = rest.join('=');
        switch (key) {
            case 'only': args.only = new Set(value.split(',').map(s => s.trim().toUpperCase())); break;
            case 'repeats': args.repeats = Math.max(1, Number(value) || 1); break;
            case 'no-profile': args.profile = false; break;
            case 'compare': args.compare = true; break;
            case 'save-baseline': args.saveBaseline = true; break;
            case 'long': args.long = true; break;
            case 'cpu-prof': args.cpuProf = true; break;
            case 'inject-slow': args.injectSlowMs = Number(value) || 0; break;
            case 'seed': args.seed = Number(value) || 1; break;
            case 'accept-work-change':
                // The ticket that ruled the change, e.g. CR3-201. Required: a
                // silent re-baseline of the work is exactly what the gate stops.
                if (!value.trim()) throw new Error('--accept-work-change needs the ticket that ruled the change, e.g. --accept-work-change=CR3-201');
                args.acceptWorkChange = value.trim();
                args.compare = true;
                break;
            default: throw new Error(`unknown option --${key} (see bench/run.mjs)`);
        }
    }
    return args;
}

// ---------------------------------------------------------------------------
// Running workers
// ---------------------------------------------------------------------------

function runWorker(scenario, mode, args, index) {
    fs.mkdirSync(resultsDir, { recursive: true });
    const out = path.join(resultsDir, `.tmp-${scenario.id}-${mode}-${index}.json`);
    const nodeFlags = ['--expose-gc'];
    if (args.cpuProf) {
        const dir = path.join(resultsDir, 'prof');
        fs.mkdirSync(dir, { recursive: true });
        nodeFlags.push('--cpu-prof', `--cpu-prof-dir=${dir}`, `--cpu-prof-name=${scenario.id}-${mode}-${index}-${Date.now()}.cpuprofile`);
    }
    const opts = { file: scenario.file, mode, seed: args.seed, long: args.long, injectSlowMs: args.injectSlowMs };
    const res = spawnSync(process.execPath, [...nodeFlags, path.join(here, 'worker.mjs'), JSON.stringify(opts), out], {
        cwd: root, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true
    });
    if (res.status !== 0 || !fs.existsSync(out)) {
        throw new Error(`${scenario.id} ${mode} run ${index} failed (exit ${res.status})`);
    }
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    fs.rmSync(out, { force: true });
    return result;
}

/** Median of each tick statistic across repeats. */
function aggregateTicks(runs) {
    const keys = ['mean', 'p50', 'p95', 'p99', 'max'];
    const tick = {};
    for (const k of keys) tick[k] = median(runs.map(r => r.tick[k]));
    return tick;
}

/** S4: each kind of operation on its own (CR3-156), never one mixed "worst". */
function aggregateCustom(runs) {
    const c0 = runs[0].custom;
    return {
        arrivalsP50: median(runs.map(r => r.custom.arrivals.p50)),
        arrivalsWorst: median(runs.map(r => r.custom.arrivals.worstMs)),
        landedP50: median(runs.map(r => r.custom.landingDrops.p50)),
        landedWorst: median(runs.map(r => r.custom.landingDrops.worstMs)),
        refusedWorst: median(runs.map(r => r.custom.refusedDrops.worstMs)),
        shrinkMs: median(runs.map(r => r.custom.shrinkMs)),
        // Counts are work, not time: they are in the fingerprint as well.
        arrivalsLanded: c0.arrivals.landed,
        refusedCount: c0.refusedDrops.count,
        landing: {
            placed: c0.landingDrops.placed, nudged: c0.landingDrops.nudged,
            refused: c0.landingDrops.refused, restocked: c0.landingDrops.restocked,
            nudgeMeanU: c0.landingDrops.nudgeMeanU, nudgeMaxU: c0.landingDrops.nudgeMaxU
        },
        rimRadius: c0.rimRadius,
        shrinkTokens: c0.shrink.tokens
    };
}

function sameWork(runs) {
    const prints = runs.map(r => JSON.stringify(r.fingerprint));
    return prints.every(p => p === prints[0]);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function printTable(rows) {
    const header = ['Scenario', 'Tokens', 'mean ms', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'events/tick', 'heap Δ MB', 'same work'];
    const lines = rows.map(r => {
        if (r.custom) {
            return [`${r.id} ${r.name}`, String(r.tokens ?? ''), '', '', '', '', '',
                '', '', r.sameWork ? 'yes' : 'NO'];
        }
        return [
            `${r.id} ${r.name}`, String(r.tokens ?? ''),
            f(r.tick.mean), f(r.tick.p50), f(r.tick.p95), f(r.tick.p99), f(r.tick.max),
            r.profile ? f(r.profile.eventsPerTick, 1) : '',
            f(r.heapDeltaMb, 2), r.sameWork ? 'yes' : 'NO'
        ];
    });
    const widths = header.map((h, i) => Math.max(h.length, ...lines.map(l => l[i].length)));
    const fmt = (cells) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
    console.log('\n' + fmt(header));
    console.log(widths.map(w => '-'.repeat(w)).join('  '));
    for (const l of lines) console.log(fmt(l));

    for (const r of rows) {
        if (r.custom) {
            const c = r.custom;
            const l = c.landing;
            console.log(`\n${r.id} ${r.name}:`);
            console.log(`  arrivals (they push)       p50 ${f(c.arrivalsP50, 2)} ms, worst ${f(c.arrivalsWorst, 2)} ms · ${c.arrivalsLanded}/50 landed`);
            console.log(`  player drops, refused      worst ${f(c.refusedWorst, 2)} ms · ${c.refusedCount}/50 refused, by design (FP-46: a drop never pushes, and the cluster's middle has no room within nudge reach)`);
            console.log(`  player drops at the rim    p50 ${f(c.landedP50, 2)} ms, worst ${f(c.landedWorst, 2)} ms · aimed ${f(c.rimRadius, 1)} u out · ${l.placed + l.nudged}/50 landed (${l.placed} exact, ${l.nudged} nudged: mean ${f(l.nudgeMeanU, 1)} u, max ${f(l.nudgeMaxU, 1)} u) · ${l.refused} refused${l.restocked ? ` · ${l.restocked} restocked` : ''}`);
            console.log(`  shrink 20→6                ${f(c.shrinkMs, 1)} ms with ${c.shrinkTokens} Tokens`);
        }
        if (r.checkpoints) {
            console.log(`\n${r.id} ${r.name} checkpoints (heap after forced GC):`);
            for (const c of r.checkpoints) {
                console.log(`  ${String(c.gameMinutes).padStart(4)} min  heap ${f(c.heapMb, 2)} MB  tokens ${c.tokens}  sprites ${c.sprites}  listeners ${c.listeners}  notifications ${c.notifications}  bin ${c.bin}  state ${c.stateJsonKb} KB`);
            }
        }
        if (r.profile && !r.custom) {
            const top = r.profile.handlers.slice(0, 4).map(h => `${h.name} ${f(h.msPerTick)}`).join(', ');
            console.log(`\n${r.id} profile (probes on; slower than the timing runs): handlers ms/tick — ${top}`);
        }
        if (r.errors?.length) console.log(`\n⚠ ${r.id} logged errors:\n  ${r.errors.join('\n  ')}`);
    }
}

// ---------------------------------------------------------------------------
// Compare, part 1: the work (CR3-550)
// ---------------------------------------------------------------------------

/**
 * The options a scenario's work depends on. The seed changes every scenario's
 * work; `--long` changes S6's. Nothing else does — `--repeats`, `--inject-slow`,
 * `--no-profile` and `--cpu-prof` change only how long things take.
 */
function identityOptions(scenarioId, args) {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    return scenario?.longChangesWork ? { seed: args.seed, long: args.long } : { seed: args.seed };
}

/** The fields of two fingerprints that differ, as `[{ field, base, now }]`. */
function diffFingerprint(base, now) {
    const fields = [...new Set([...Object.keys(base || {}), ...Object.keys(now || {})])];
    return fields
        .filter(k => JSON.stringify(base?.[k]) !== JSON.stringify(now?.[k]))
        .map(field => ({ field, base: base?.[field], now: now?.[field] }));
}

/**
 * Per scenario, one verdict:
 *  - `same`             — the fingerprint matches the baseline exactly;
 *  - `WORK CHANGED`     — it does not (the differing fields are listed);
 *  - `NOT DETERMINISTIC` — this run's own repeats disagreed, so there is no
 *                         single answer to compare (also a failure);
 *  - `NO FINGERPRINT`   — the baseline has none for this scenario (re-take it);
 *  - `not checked`      — this run's seed (or S6's `--long`) differs from the
 *                         baseline's, so its work is expected to differ.
 */
function compareWork(rows, baseline, args) {
    const checks = [];
    for (const row of rows) {
        const base = baseline.scenarios?.[row.id];
        const now = row.fingerprints[0];
        const options = identityOptions(row.id, args);
        if (!row.sameWork) {
            checks.push({ id: row.id, verdict: 'NOT DETERMINISTIC', diffs: diffFingerprint(row.fingerprints[0], row.fingerprints.find(p => JSON.stringify(p) !== JSON.stringify(row.fingerprints[0]))) });
            continue;
        }
        if (!base?.fingerprint) {
            checks.push({ id: row.id, verdict: 'NO FINGERPRINT', diffs: [] });
            continue;
        }
        if (JSON.stringify(base.fingerprintOptions) !== JSON.stringify(options)) {
            checks.push({ id: row.id, verdict: 'not checked', diffs: [], note: `run with ${JSON.stringify(options)}, baseline taken with ${JSON.stringify(base.fingerprintOptions)}` });
            continue;
        }
        const diffs = diffFingerprint(base.fingerprint, now);
        checks.push({ id: row.id, verdict: diffs.length ? 'WORK CHANGED' : 'same', diffs });
    }
    return checks;
}

const show = (v) => (v === undefined ? '(none)' : typeof v === 'string' ? v : JSON.stringify(v));

function printWork(checks, baseline, accepted) {
    console.log(`\nWork against bench/baseline.json (${baseline.meta?.commit ?? '?'}): the end state and the number of random draws must match exactly`);
    if (baseline.meta?.node && baseline.meta.node !== process.version) {
        console.log(`⚠ Node changed: baseline ${baseline.meta.node}, now ${process.version}. The work may differ for reasons outside the code; re-take the baseline on a Node upgrade.`);
    }
    for (const c of checks) {
        let verdict = c.verdict;
        if (accepted && (c.verdict === 'WORK CHANGED' || c.verdict === 'NO FINGERPRINT')) verdict = `${c.verdict}: accepted under ${accepted}`;
        console.log(`  ${c.id.padEnd(4)}  ${verdict}${c.note ? ` (${c.note})` : ''}`);
        for (const d of c.diffs) {
            console.log(`          ${d.field.padEnd(24)} ${c.verdict === 'NOT DETERMINISTIC' ? 'run 1' : 'baseline'} ${show(d.base).padEnd(20)} ${c.verdict === 'NOT DETERMINISTIC' ? 'other run' : 'now'} ${show(d.now)}`);
        }
        if (c.verdict === 'NO FINGERPRINT') console.log('          the baseline predates the work gate: re-take it with --save-baseline');
    }
}

// ---------------------------------------------------------------------------
// Compare, part 2: the timings
// ---------------------------------------------------------------------------

/**
 * The numbers --compare checks, per scenario.
 *
 * S4's landing drops are checked on their **p50**, not their worst: each takes
 * ~3 ms, so the worst of 50 is whichever one a GC pause or the OS happened to
 * hit, and moved 4.5–8.4 ms between runs on a quiet machine (the p50 stayed
 * within 3.10–3.41). Their worst is still printed and kept in the results JSON.
 */
function comparable(row) {
    if (row.custom) {
        return {
            arrivalsWorst: row.custom.arrivalsWorst,
            landedP50: row.custom.landedP50,
            refusedWorst: row.custom.refusedWorst,
            shrinkMs: row.custom.shrinkMs
        };
    }
    return { p50: row.tick.p50, p99: row.tick.p99 };
}

function compareTiming(rows, baseline) {
    const out = [];
    for (const row of rows) {
        const base = baseline.scenarios?.[row.id];
        if (!base) { out.push({ id: row.id, metric: '—', base: NaN, now: NaN, ratio: NaN, verdict: 'no baseline' }); continue; }
        for (const [metric, value] of Object.entries(comparable(row))) {
            const b = base[metric];
            const ratio = value / b;
            const regressed = Number.isFinite(b) && ratio > REGRESSION_RATIO && (value - b) > NOISE_FLOOR_MS;
            out.push({ id: row.id, metric, base: b, now: value, ratio, verdict: !Number.isFinite(b) ? 'no baseline' : regressed ? 'REGRESSED' : 'ok' });
        }
    }
    console.log(`\nTiming against bench/baseline.json (${baseline.meta?.commit ?? '?'}, ${baseline.meta?.date ?? '?'}): fail above ×${REGRESSION_RATIO} and +${NOISE_FLOOR_MS} ms`);
    console.log('Scenario  metric          baseline ms      now ms    ratio  verdict');
    for (const c of out) {
        console.log(`${c.id.padEnd(8)}  ${c.metric.padEnd(14)}  ${f(c.base).padStart(11)}  ${f(c.now).padStart(10)}  ${f(c.ratio, 2).padStart(7)}  ${c.verdict}`);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function gitInfo() {
    try {
        const commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim();
        const dirty = execSync('git status --porcelain -- src data bench', { cwd: root }).toString().trim().length > 0;
        return { commit, branch, dirty };
    } catch {
        return { commit: 'unknown', branch: 'unknown', dirty: null };
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const started = Date.now();
    const meta = {
        ...gitInfo(),
        date: new Date().toISOString(),
        node: process.version,
        machine: os.hostname(),
        cpu: os.cpus()[0]?.model?.trim(),
        cores: os.cpus().length,
        platform: `${os.platform()} ${os.release()}`,
        args: { ...args, only: args.only ? [...args.only] : null }
    };
    console.log(`Fantasy Guild bench — ${meta.commit}${meta.dirty ? ' (uncommitted changes)' : ''} on ${meta.branch} · Node ${meta.node} · ${meta.machine} · ${meta.cpu}`);
    if (args.injectSlowMs) console.log(`⚠ --inject-slow=${args.injectSlowMs}: every tick runs an extra busy-wait handler`);

    const rows = [];
    for (const scenario of SCENARIOS) {
        if (args.only && !args.only.has(scenario.id)) continue;
        const repeats = scenario.repeats ?? args.repeats;
        const runs = [];
        for (let i = 0; i < repeats; i++) {
            process.stdout.write(`  ${scenario.id} ${scenario.name}: timing run ${i + 1}/${repeats}…\r`);
            runs.push(runWorker(scenario, 'timing', args, i));
        }
        let profile = null;
        if (args.profile && scenario.profile) {
            process.stdout.write(`  ${scenario.id} ${scenario.name}: profile run…            \r`);
            profile = runWorker(scenario, 'profile', args, 0);
        }
        process.stdout.write(' '.repeat(60) + '\r');

        const first = runs[0];
        const row = {
            id: scenario.id, name: scenario.name, repeats,
            tokens: (first.endCensus || first.startCensus)?.tokens,
            census: { start: first.startCensus, warm: first.warmCensus, end: first.endCensus },
            sameWork: sameWork(runs),
            fingerprints: runs.map(r => r.fingerprint),
            errors: [...new Set(runs.flatMap(r => r.errors || []))],
            runs: runs.map(r => ({ tick: r.tick, custom: r.custom, heap: r.heap, buildMs: r.buildMs, totalMs: r.totalMs }))
        };
        if (first.custom) {
            row.custom = aggregateCustom(runs);
        } else {
            row.tick = aggregateTicks(runs);
            row.ticks = first.ticks;
            row.heapDeltaMb = median(runs.map(r => r.heap.deltaMb));
            row.checkpoints = first.checkpoints;
        }
        if (profile) {
            row.profile = profile.profile;
            row.profileTick = profile.tick;
            row.profileLogger = profile.logger;
            row.profileCustom = profile.custom;
        }
        rows.push(row);
    }

    printTable(rows);

    let workChecks = null;
    let timing = null;
    let workFailed = false;
    let slower = false;
    let benchFailed = false;
    let accepted = null;
    let baseline = null;

    if (args.compare) {
        if (!fs.existsSync(baselineFile)) {
            console.log('\n--compare: there is no bench/baseline.json yet (make one with --save-baseline).');
            benchFailed = true;
        } else {
            baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
            workChecks = compareWork(rows, baseline, args);
            const changed = workChecks.filter(c => c.verdict === 'WORK CHANGED' || c.verdict === 'NO FINGERPRINT');
            const nondeterministic = workChecks.filter(c => c.verdict === 'NOT DETERMINISTIC');
            if (args.acceptWorkChange && changed.length) {
                accepted = {
                    ticket: args.acceptWorkChange,
                    scenarios: Object.fromEntries(changed.map(c => [c.id, c.diffs.map(d => d.field)]))
                };
            }
            printWork(workChecks, baseline, accepted?.ticket);
            workFailed = nondeterministic.length > 0 || (changed.length > 0 && !accepted);

            timing = compareTiming(rows, baseline);
            slower = timing.some(c => c.verdict === 'REGRESSED');

            console.log('');
            if (nondeterministic.length) {
                console.log(`✗ WORK CHANGED: ${nondeterministic.map(c => c.id).join(', ')} did different work from one repeat to the next (not deterministic). Nothing can be compared until that is fixed.`);
            }
            if (changed.length && !accepted) {
                console.log(`✗ WORK CHANGED: ${changed.map(c => `${c.id} (${c.diffs.map(d => d.field).join(', ') || 'no fingerprint in the baseline'})`).join('; ')}.`);
                console.log('  The engine did different work from the baseline: a different end state or a different number of random draws.');
                console.log('  If a speed fix did this, it is not identical: find out why. If the change is deliberate and ruled,');
                console.log('  re-run with --accept-work-change=<ticket> to record it in bench/baseline.json.');
            }
            if (accepted) {
                console.log(`✓ WORK CHANGED, accepted under ${accepted.ticket}: the new fingerprints of ${Object.keys(accepted.scenarios).join(', ')} are written to bench/baseline.json (commit it with the change).`);
            } else if (args.acceptWorkChange && !nondeterministic.length) {
                console.log(`--accept-work-change=${args.acceptWorkChange}: nothing to accept, the work matches the baseline. bench/baseline.json is unchanged.`);
            }
            if (!workFailed && !changed.length) console.log('✓ Same work as the baseline.');
            if (slower) {
                console.log(`✗ REGRESSION: at least one number is more than 20 % slower than the baseline.${workFailed || accepted ? ' (The work changed too, so these timings measure different work.)' : ''}`);
            } else {
                console.log('✓ No timing regression against the baseline.');
            }
        }
    }

    const elapsedS = (Date.now() - started) / 1000;
    const report = {
        meta: { ...meta, elapsedS },
        scenarios: rows,
        work: workChecks,
        acceptedWorkChange: accepted,
        comparison: timing
    };
    fs.mkdirSync(resultsDir, { recursive: true });
    const stamp = meta.date.replace(/[:.]/g, '-');
    const file = path.join(resultsDir, `bench-${stamp}-${meta.commit}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${path.relative(root, file)} (${elapsedS.toFixed(0)} s).`);

    // --accept-work-change: rewrite ONLY the fingerprints of the scenarios that
    // changed. The timing numbers stay those of the quiet-machine baseline.
    if (accepted && baseline) {
        for (const id of Object.keys(accepted.scenarios)) {
            const row = rows.find(r => r.id === id);
            baseline.scenarios[id] = {
                ...(baseline.scenarios[id] || comparable(row)),
                fingerprint: row.fingerprints[0],
                fingerprintOptions: identityOptions(id, args)
            };
        }
        baseline.meta.workChanges = [...(baseline.meta.workChanges || []), {
            ticket: accepted.ticket, commit: meta.commit, branch: meta.branch, dirty: meta.dirty,
            date: meta.date, node: meta.node, scenarios: accepted.scenarios
        }];
        fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
        console.log('Updated the fingerprints in bench/baseline.json.');
    }

    if (args.saveBaseline) {
        const unsettled = rows.filter(r => !r.sameWork);
        if (unsettled.length) {
            console.log(`✗ Not saving bench/baseline.json: ${unsettled.map(r => r.id).join(', ')} did different work from one repeat to the next.`);
            workFailed = true;
        } else {
            const out = {
                meta: { ...meta, note: 'Medians of the timing runs, and each scenario\'s work fingerprint. Re-take on a quiet machine: npm run bench -- --save-baseline' },
                scenarios: Object.fromEntries(rows.map(r => [r.id, {
                    ...comparable(r),
                    fingerprint: r.fingerprints[0],
                    fingerprintOptions: identityOptions(r.id, args)
                }]))
            };
            if (args.acceptWorkChange) out.meta.workChanges = [{ ticket: args.acceptWorkChange, commit: meta.commit, date: meta.date, scenarios: 'all (re-saved)' }];
            fs.writeFileSync(baselineFile, JSON.stringify(out, null, 2) + '\n');
            console.log('Wrote bench/baseline.json.');
        }
    }

    const code = workFailed ? EXIT.WORK_CHANGED : benchFailed ? EXIT.BENCH_FAILED : slower ? EXIT.SLOWER : EXIT.OK;
    process.exit(code);
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(EXIT.BENCH_FAILED);
});
