// Fantasy Guild bench — Tier A, the headless engine benchmark (`npm run bench`).
//
// Runs each scenario in a fresh Node process (bench/worker.mjs), a few times,
// takes the median, prints a table and writes JSON to bench/results/.
//
//   npm run bench                       S1–S6, default lengths
//   npm run bench -- --only=S2,S3       some scenarios
//   npm run bench -- --compare          also compare with bench/baseline.json;
//                                       exits 1 on a regression over 20 %
//   npm run bench -- --save-baseline    write this run as bench/baseline.json
//   npm run bench -- --long             S6 for the full 8 game-hours
//   npm run bench -- --repeats=5        timing runs per scenario (default 3)
//   npm run bench -- --no-profile       skip the profile passes
//   npm run bench -- --cpu-prof         also write V8 .cpuprofile files
//   npm run bench -- --inject-slow=0.5  add a tick handler that busy-waits
//                                       0.5 ms — proves --compare catches it
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

/** Scenario id → file, and which get a profile pass by default. */
const SCENARIOS = [
    { id: 'S1', file: 's1-quiet-hall.mjs', name: 'Quiet Hall', profile: false },
    { id: 'S2', file: 's2-realistic.mjs', name: 'Realistic late game', profile: true },
    { id: 'S3', file: 's3-torture.mjs', name: 'Torture', profile: true },
    { id: 'S4', file: 's4-push-storm.mjs', name: 'Push storm', profile: true },
    { id: 'S5', file: 's5-rebuild-storm.mjs', name: 'Rebuild storm', profile: true },
    { id: 'S6', file: 's6-long-idle.mjs', name: 'Long idle', profile: false, repeats: 1 }
];

/** A regression is > 20 % slower AND more than this many ms slower (timer noise floor). */
const REGRESSION_RATIO = 1.2;
const NOISE_FLOOR_MS = 0.02;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = { repeats: 3, profile: true, compare: false, saveBaseline: false, long: false, cpuProf: false, injectSlowMs: 0, only: null, seed: 1 };
    for (const a of argv) {
        const [key, value] = a.replace(/^--/, '').split('=');
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

function aggregateCustom(runs) {
    return {
        worstDropMs: median(runs.map(r => r.custom.worstDropMs)),
        shrinkMs: median(runs.map(r => r.custom.shrinkMs)),
        arrivalsP50: median(runs.map(r => r.custom.arrivals.p50)),
        arrivalsWorst: median(runs.map(r => r.custom.arrivals.worstMs)),
        dropsWorst: median(runs.map(r => r.custom.drops.worstMs)),
        arrivalsLanded: runs[0].custom.arrivals.landed,
        dropsLanded: runs[0].custom.drops.landed,
        shrinkTokens: runs[0].custom.shrink.tokens
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
            console.log(`\n${r.id} ${r.name}: worst single arrival/drop ${f(c.worstDropMs, 2)} ms · arrivals p50 ${f(c.arrivalsP50, 2)} ms, worst ${f(c.arrivalsWorst, 2)} ms (${c.arrivalsLanded}/50 landed) · player drops worst ${f(c.dropsWorst, 2)} ms (${c.dropsLanded}/50 landed) · shrink 20→6 with ${c.shrinkTokens} Tokens ${f(c.shrinkMs, 1)} ms`);
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
// Compare
// ---------------------------------------------------------------------------

/** The numbers --compare checks, per scenario. */
function comparable(row) {
    if (row.custom) return { worstDropMs: row.custom.worstDropMs, shrinkMs: row.custom.shrinkMs };
    return { p50: row.tick.p50, p99: row.tick.p99 };
}

function compare(rows, baseline) {
    const out = [];
    for (const row of rows) {
        const base = baseline.scenarios?.[row.id];
        if (!base) { out.push({ id: row.id, metric: '—', base: NaN, now: NaN, ratio: NaN, verdict: 'no baseline' }); continue; }
        for (const [metric, value] of Object.entries(comparable(row))) {
            const b = base[metric];
            const ratio = value / b;
            const regressed = Number.isFinite(b) && ratio > REGRESSION_RATIO && (value - b) > NOISE_FLOOR_MS;
            out.push({ id: row.id, metric, base: b, now: value, ratio, verdict: regressed ? 'REGRESSED' : 'ok' });
        }
    }
    console.log(`\nCompare with bench/baseline.json (${baseline.meta?.commit ?? '?'}, ${baseline.meta?.date ?? '?'}): fail above ×${REGRESSION_RATIO} and +${NOISE_FLOOR_MS} ms`);
    console.log('Scenario  metric        baseline ms      now ms    ratio  verdict');
    for (const c of out) {
        console.log(`${c.id.padEnd(8)}  ${c.metric.padEnd(12)}  ${f(c.base).padStart(11)}  ${f(c.now).padStart(10)}  ${f(c.ratio, 2).padStart(7)}  ${c.verdict}`);
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

    let comparison = null;
    let failed = false;
    if (args.compare) {
        if (!fs.existsSync(baselineFile)) {
            console.log('\n--compare: there is no bench/baseline.json yet (make one with --save-baseline).');
            failed = true;
        } else {
            comparison = compare(rows, JSON.parse(fs.readFileSync(baselineFile, 'utf8')));
            failed = comparison.some(c => c.verdict === 'REGRESSED');
            console.log(failed ? '\n✗ REGRESSION: at least one number is more than 20 % slower than the baseline.' : '\n✓ No regression against the baseline.');
        }
    }

    const elapsedS = (Date.now() - started) / 1000;
    const report = { meta: { ...meta, elapsedS }, scenarios: rows, comparison };
    fs.mkdirSync(resultsDir, { recursive: true });
    const stamp = meta.date.replace(/[:.]/g, '-');
    const file = path.join(resultsDir, `bench-${stamp}-${meta.commit}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${path.relative(root, file)} (${elapsedS.toFixed(0)} s).`);

    if (args.saveBaseline) {
        const baseline = {
            meta: { ...meta, note: 'Medians of the timing runs. Re-take on a quiet machine: npm run bench -- --save-baseline' },
            scenarios: Object.fromEntries(rows.map(r => [r.id, comparable(r)]))
        };
        fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
        console.log('Wrote bench/baseline.json.');
    }

    process.exit(failed ? 1 : 0);
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(2);
});
