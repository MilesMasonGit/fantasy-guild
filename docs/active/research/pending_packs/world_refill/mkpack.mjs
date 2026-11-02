// The world refill pack: ring-3 sources rest and refill instead of wearing out for good (owner 2026-11-02).
// Usage: node mkpack.mjs --from ws.json [--out file]; ws.json built from today's data/ by ../fish/mkws.mjs.
// Rule: a tier-3 source rests twice as long as its Starter Camp kind (Iron and Fir, tier 2, sit at about 1.5x).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const { currentValue } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i === -1 ? d : args[i + 1]; };
if (!argOf('--from')) throw new Error('--from <workspace.json> is required');
const ws = JSON.parse(fs.readFileSync(argOf('--from'), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const ID = '2026-11-02-world-refill';
const TIER3 = 2; // times the Starter Camp's rest

const STARTER = { vein: 60000, fruitTree: 180000, bush: 150000, stump: 150000, sapling: 150000 };
const entries = [];
const token = (id) => { const v = currentValue(ws, 'token', id); if (!v) throw new Error('missing ' + id); if (v.respawn) throw new Error(id + ' already respawns'); return clone(v); };
const mins = (ms) => `${ms / 60000} min`;

function refill(id, kind, restingSprite, why) {
    const v = token(id);
    const afterMs = kind === 'grove' ? (STARTER.stump + STARTER.sapling) * TIER3 : STARTER[kind] * TIER3;
    v.respawn = { mode: 'refill', afterMs, ...(restingSprite ? { restingSprite } : {}) };
    entries.push({ op: 'edit', kind: 'token', id, value: v, note: `${v.name}: rests ${mins(afterMs)} at 0 charges, then refills to ${v.uses} (${why}).` });
}

const veins = ['token_gold_ore_vein', 'token_silver_ore_vein', 'token_mythril_ore_vein', 'token_adamantium_ore', 'token_darkmetal_ore_vein', 'token_clay_deposit', 'token_quartz_deposit'];
for (const id of veins) refill(id, 'vein', 't_vein_stone', 'as the Copper and Coal veins, twice their 1 min');
for (const id of ['token_lemon_tree', 'token_lime_tree', 'token_orange_tree', 'token_banana_tree', 'token_coconut_tree']) refill(id, 'fruitTree', 't_tree_oak', 'as the Apple, Cherry and Peach trees, twice the Apple’s 3 min');
for (const id of ['token_raspberry_bush', 'token_pineapple_bush', 'token_watermelon_patch']) refill(id, 'bush', 't_garden', 'as the Redberry Bush, twice its 2.5 min');
for (const id of ['token_birch_forest', 'token_maple_forest', 'token_mahogany_forest']) refill(id, 'grove', null, 'a grove has no stump: it rests as long as its species’ tree takes to regrow');

// Timber trees: Tree -> Stump (costs a seedling) -> Sapling -> Tree, as the Oak and Fir.
const oakStump = currentValue(ws, 'token', 'token_oak_stump');
const oakSapling = currentValue(ws, 'token', 'token_oak_sapling');
for (const sp of ['birch', 'maple', 'mahogany', 'ebony', 'cedar']) {
    const Sp = sp[0].toUpperCase() + sp.slice(1);
    const treeId = `token_${sp}_tree`, stumpId = `token_${sp}_stump`, saplingId = `token_${sp}_sapling`, seedling = `item_${sp}_seedling`;
    for (const id of [stumpId, saplingId]) if (currentValue(ws, 'token', id)) throw new Error(id + ' exists');
    if (!currentValue(ws, 'item', seedling)) throw new Error('missing ' + seedling);
    const tree = token(treeId);
    if (!tree.config.outputs.some((o) => o.itemId === seedling)) throw new Error(treeId + ' drops no seedling');
    tree.respawn = { mode: 'regrow', into: stumpId };
    const growMs = STARTER.stump * TIER3;
    const plan = { status: 'live', tier: tree.plan?.tier ?? 3, note: `Part of the ${Sp} Tree's cycle (world refill pack).` };
    const stump = { ...clone(oakStump), id: stumpId, name: `${Sp} Stump`, sprite: `t_stump_${sp}`, tags: [Sp],
        grows: { into: saplingId, afterMs: growMs, cost: [{ itemId: seedling, quantity: 1 }] }, plan };
    const sapling = { ...clone(oakSapling), id: saplingId, name: `${Sp} Sapling`, sprite: `t_sapling_${sp}`, tags: ['Forest', Sp],
        grows: { into: treeId, afterMs: STARTER.sapling * TIER3 }, plan };
    entries.push({ op: 'edit', kind: 'token', id: treeId, value: tree, note: `${tree.name}: at 0 charges becomes a ${Sp} Stump instead of wearing out (as the Oak and Fir).` });
    entries.push({ op: 'create', kind: 'token', id: stumpId, value: stump, note: `${Sp} Stump: after ${mins(growMs)} spends one ${Sp} Seedling from the Bank and becomes a ${Sp} Sapling (Oak's 2.5 min, twice). Needs no Forest in reach: no ${Sp} Forest plants saplings yet.` });
    entries.push({ op: 'create', kind: 'token', id: saplingId, value: sapling, note: `${Sp} Sapling: grows back into a ${Sp} Tree after ${mins(STARTER.sapling * TIER3)} (Oak's 2.5 min, twice).` });
}

const pack = {
    format: 'fantasy-guild-change-pack', version: 1, id: ID, createdAt: new Date().toISOString(),
    asked: 'World sources rest and refill, like the Starter Camp’s veins and forests: the ring-3 origins with 100–1000 uses and no respawn must rest and refill rather than wear out for good (owner 2026-11-02).',
    entries
};
const here = path.dirname(fileURLToPath(import.meta.url));
const out = argOf('--out', path.join(here, ID + '.json'));
fs.writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
console.log('wrote', out, entries.length, 'entries');
