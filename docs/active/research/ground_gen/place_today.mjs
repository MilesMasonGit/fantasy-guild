// The game's own layout (main) for a fixed budget, as JSON positions: the "today" reference for the placement rounds.
import { layout } from '../../../../src/systems/atlas/Layout.js';
import { matTuningDefault } from '../../../../src/config/matTuning.js';
const [budgetJson, seed] = [process.argv[2], Number(process.argv[3] || 7)];
const entries = JSON.parse(budgetJson);
const mat = { w: Number(process.argv[4] || 1760), h: Math.round(Number(process.argv[4] || 1760) * 0.64) };
const crowding = { hitboxPct: matTuningDefault('hitboxPct'), overlapPct: matTuningDefault('overlapPct') };
const r = layout({ entries, ground: { main: 'meadow', terrains: {}, water: 0, shore: [] } }, { seed, mat, crowding, artRadius: () => 64 });
console.log(JSON.stringify({ crowding, hall: r.hall, nodes: r.nodes, unplaced: r.unplaced.length }));
