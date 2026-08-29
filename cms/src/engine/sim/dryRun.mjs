/**
 * Economic simulator — the dry-run report (phase P3+4).
 *
 * ```
 * node cms/src/engine/sim/dryRun.mjs
 * ```
 *
 * Loads the real `data/*.json`, runs the first three passes, and prints what
 * they decided: every item's elected anchor and why, every derived value, and
 * every row raised, grouped by severity.
 *
 * ## Why a script and not a screen
 *
 * The roadmap's phase P3 had a read-only CMS preview so a developer could
 * review anchor elections before anything wrote. The owner dropped that
 * surface, so this is how the engine's behaviour gets reviewed instead.
 *
 * **It reads `data/` and writes nothing** — no file, no store, no Sync. It is
 * safe to run at any time.
 *
 * ⚠️ Reading the output: the shipped content is placeholder and its Tempo /
 * Purpose tags are provisional test substrate. Odd numbers and refusals are the
 * machinery working on stand-in content, not evidence of a bug, and are never a
 * reason to adjust a curve, band or dial.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSim } from './simRunner.js';

const root = new URL('../../../../', import.meta.url);
const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`data/${name}`, root)), 'utf8'));

const tokens = load('tokens.json');
const recipes = load('tokenRecipes.json');
const items = load('items.json');

const result = runSim({ tokens, recipes, items });

const pad = (s, n) => String(s).padEnd(n);
const line = (ch = '─') => console.log(ch.repeat(78));

console.log('');
line('═');
console.log('  ECONOMIC SIMULATOR — DRY RUN (passes 1–3: time, anchors, pricing)');
console.log('  Reads data/. Writes nothing. Not wired to the CMS.');
line('═');

// ── Pass 1: time ─────────────────────────────────────────────────────────────
console.log('\nCYCLE TIMES (middle of the tempo band at the required level)\n');
console.log(`  ${pad('entity', 26)}${pad('kind', 8)}${pad('lvl', 5)}${pad('tempo', 8)}${pad('purpose', 9)}${pad('cycle', 8)}units/hr`);
line();
for (const entity of result.entities) {
    const t = result.timing.get(entity.id);
    if (!t) continue;
    const rates = t.outputs.map(o => `${o.itemId} ${o.unitsPerHour.toFixed(1)}/h`).join(', ');
    console.log(`  ${pad(entity.id, 26)}${pad(entity.kind, 8)}${pad(entity.level, 5)}${pad(entity.tempo, 8)}${pad(entity.purpose, 9)}${pad(`${t.cycleTimeMs / 1000}s`, 8)}${rates}`);
}

const skipCounts = { inert: 0, untagged: 0 };
for (const reason of result.skipped.values()) skipCounts[reason] = (skipCounts[reason] ?? 0) + 1;
console.log(`\n  skipped: ${skipCounts.inert} inert (no work cycle — silent), ${skipCounts.untagged} untagged (one Info row each)`);

// Worth seeing while reviewing, though it is deliberately not a row: something
// carries Tempo/Purpose tags but has nothing to produce, so the passes skip it
// in silence.
const taggedButInert = result.entities.filter(e => result.skipped.get(e.id) === 'inert' && (e.tempo || e.purpose));
if (taggedButInert.length > 0) {
    console.log(`  tagged but inert (silent, no row): ${taggedButInert.map(e => e.id).join(', ')}`);
}

// ── Pass 2 + 3: elections and values ─────────────────────────────────────────
console.log('\n\nITEMS — ELECTED ANCHOR AND DERIVED VALUE\n');
console.log(`  ${pad('item', 24)}${pad('value', 8)}${pad('ideal', 9)}${pad('anchor', 24)}reason`);
line();
const itemIds = [...new Set([...Object.keys(items), ...result.elections.keys()])].sort();
for (const itemId of itemIds) {
    const election = result.elections.get(itemId);
    const detail = result.details.get(itemId);
    const value = result.values.has(itemId) ? `${result.values.get(itemId)}g` : '—';
    const ideal = detail ? detail.ideal.toFixed(2) : '—';
    console.log(`  ${pad(itemId, 24)}${pad(value, 8)}${pad(ideal, 9)}${pad(election?.sourceId ?? '(none)', 24)}${election?.reason ?? 'no eligible source'}`);
}

if (result.downcycles.size > 0) {
    console.log('\n\nDOWNCYCLE RECIPES (outside the walk — they price nothing)\n');
    for (const d of result.downcycles.values()) {
        console.log(`  ${pad(d.entityId, 26)} in ${d.inputValue.toFixed(2)}g · cap ${d.cap.toFixed(2)}g · returns ${d.derivedReturn.toFixed(2)}g`);
    }
}

// ── Rows ─────────────────────────────────────────────────────────────────────
console.log('\n\nROWS RAISED\n');
for (const severity of ['critical', 'warning', 'info']) {
    const rows = result.rows.filter(r => r.severity === severity);
    console.log(`  ${severity.toUpperCase()} — ${rows.length}`);
    line();
    for (const row of rows) {
        console.log(`  [${row.code}] ${row.message}`);
        for (const remedy of row.remedies) console.log(`      → ${remedy}`);
    }
    console.log('');
}

console.log(`  ${result.values.size} of ${itemIds.length} items priced; ${result.rows.length} rows.`);
console.log('');
