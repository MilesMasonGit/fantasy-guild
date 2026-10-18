// The game's own layout (main) for a fixed budget, as JSON positions: the "today" reference for the placement rounds.
// Optional 5th argument: a Hall clearing other than the game's, read from a copy of Layout.js in the scratch worktree p23b.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { matTuningDefault } from '../../../../src/config/matTuning.js';
const [budgetJson, seed] = [process.argv[2], Number(process.argv[3] || 7)];
const clearing = process.argv[5] ? Number(process.argv[5]) : null;
let layoutModule = '../../../../src/systems/atlas/Layout.js';
let temp = null;
if (clearing) {
    const dir = new URL('../../../../.claude/worktrees/p23b/src/systems/atlas/', import.meta.url);
    const src = readFileSync(new URL('Layout.js', dir), 'utf8').replace(/export const HALL_CLEARING = \d+;/, `export const HALL_CLEARING = ${clearing};`);
    temp = new URL('LayoutClearing.tmp.mjs', dir);
    writeFileSync(temp, src);
    layoutModule = temp.href;
}
const { layout } = await import(layoutModule);
const entries = JSON.parse(budgetJson);
const mat = { w: Number(process.argv[4] || 1760), h: Math.round(Number(process.argv[4] || 1760) * 0.64) };
const crowding = { hitboxPct: matTuningDefault('hitboxPct'), overlapPct: matTuningDefault('overlapPct') };
const r = layout({ entries, ground: { main: 'meadow', terrains: {}, water: 0, shore: [] } }, { seed, mat, crowding, artRadius: () => 64 });
if (temp) rmSync(temp);
console.log(JSON.stringify({ crowding, hall: r.hall, nodes: r.nodes, unplaced: r.unplaced.length }));
