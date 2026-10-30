// Fantasy Guild — calibration: the progression ledger's rate calculator against the real engine.
//
//   node bench/calibrate.mjs                      every setup, seeds 1-3, 8 game-hours each
//   node bench/calibrate.mjs --only=vein --hours=4 --seeds=1,2
//
// Each setup (`bench/calibration/setups.mjs`) is a small board of shipped content played in the real
// engine through the game's own catch-up, in its own process, and priced by the calculator
// (`src/systems/progression/ledger/rates.js`). The table shows items and XP per hour, engine against
// calculator, and the difference. Exits 1 when any compared number differs by more than the
// tolerance (default 15 %), 3 when a run fails. Results go to `bench/results/calibration-*.json`.
//
// ⚠️ Not the bench: it times nothing, and it reads shipped content on purpose. It is heavy enough
// (a few game-days of catch-up) to move bench numbers if run beside one.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));
const hours = Number(args.hours) || 8;
const seeds = String(args.seeds || '1,2,3').split(',').map(Number).filter(Number.isFinite);
const tolerance = (Number(args.tolerance) || 15) / 100;

const { SETUPS } = await import('./calibration/setups.mjs');
const only = args.only ? String(args.only).split(',') : null;
const setups = SETUPS.filter(s => !only || only.includes(s.id));

const resultsDir = path.join(root, 'bench', 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const runs = [];
let failed = false;
for (const setup of setups) {
    for (const seed of seeds) {
        const out = path.join(resultsDir, `.calibration-${setup.id}-${seed}.json`);
        const r = spawnSync(process.execPath, [path.join(here, 'calibration', 'worker.mjs'), JSON.stringify({ id: setup.id, seed, hours, trace: !!args.trace }), out], { stdio: ['ignore', 'inherit', 'inherit'] });
        if (r.status !== 0 || !fs.existsSync(out)) {
            failed = true;
            continue;
        }
        runs.push(JSON.parse(fs.readFileSync(out, 'utf8')));
        fs.rmSync(out, { force: true });
    }
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pad = (s, n) => String(s).padEnd(n);
const num = (n) => (Number.isFinite(n) ? n.toFixed(1) : '—');
const pct = (calc, engine) => (engine ? (calc - engine) / engine : (calc ? Infinity : 0));

const report = [];
let outside = false;
for (const setup of setups) {
    const mine = runs.filter(r => r.id === setup.id);
    if (!mine.length) continue;
    console.log(`\n${setup.name}  (${mine.length} seed${mine.length === 1 ? '' : 's'} × ${hours} game-hours after a ${setup.warmupMs / 60000} min warm-up)`);
    console.log(`  ${pad('', 26)}${pad('engine/h', 12)}${pad('calc/h', 12)}${pad('diff', 9)}engine per seed`);
    const rows = [];
    const line = (kind, key, engineValues, calcValue) => {
        const engine = mean(engineValues);
        const d = pct(calcValue, engine);
        const known = setup.known?.[`${kind} ${key}`] ?? null;
        const bad = Math.abs(d) > tolerance;
        if (bad && !known) outside = true;
        rows.push({ kind, key, engine, engineValues, calc: calcValue, diff: d, outside: bad, known });
        console.log(`  ${pad(`${kind} ${key}`, 26)}${pad(num(engine), 12)}${pad(num(calcValue), 12)}${pad(`${(d * 100).toFixed(1)}%`, 9)}${engineValues.map(num).join(' / ')}${bad ? (known ? `   KNOWN: ${known}` : '   OUTSIDE') : ''}`);
    };
    for (const item of setup.compare.items) line('item', item, mine.map(r => r.engine.made[item] || 0), mine[0].calc.made[item] || 0);
    for (const item of setup.compare.spent || []) line('spent', item, mine.map(r => -(r.engine.net[item] || 0)), mine[0].calc.spent[item] || 0);
    for (const skill of setup.compare.skills) line('xp', skill, mine.map(r => r.engine.xp[skill] || 0), mine[0].calc.xp[skill] || 0);
    const calcWorks = mine[0].calc.works.map(w => `${w.target.recipe || w.target.token} ${num(w.cyclesPerHour)} cycles/h (${w.limitedBy}${w.fed ? ', fed by the chain' : ''})`);
    console.log(`  calculator: ${calcWorks.join('; ')}`);
    console.log(`  engine cycles/h: ${Object.keys(mine[0].engine.cyclesPerHour).map((k) => `${k} ${num(mean(mine.map(r => r.engine.cyclesPerHour[k] || 0)))}`).join('; ')}`);
    const unmodelled = mine[0].calc.works.flatMap(w => w.unmodelled.map(u => `${u.source}: ${u.why}`));
    if (unmodelled.length) console.log(`  unmodelled: ${[...new Set(unmodelled)].join('; ')}`);
    console.log(`  engine: ${num(mean(mine.map(r => r.engine.playMsPerGameHour)))} ms per game-hour of catch-up`);
    report.push({ id: setup.id, name: setup.name, rows, runs: mine });
}

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a checkout */ }
const file = path.join(resultsDir, `calibration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify({ commit, hours, seeds, tolerance, report }, null, 2));
console.log(`\nwritten ${path.relative(root, file)}`);

if (failed) process.exit(3);
process.exit(outside ? 1 : 0);
