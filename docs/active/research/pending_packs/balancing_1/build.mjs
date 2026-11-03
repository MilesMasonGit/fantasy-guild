// The first balancing pack (2026-11-02): the ledger's balancing preview plus the owner's answers.
// Usage: node build.mjs <scratch dir>   (writes ws0.json, moves.json, wsMoves25.json, preview.json, the pack)
//  1. today's workspace from data/ + plan (as mkws.mjs);
//  2. the plan-tier moves: Beer and Cooked Lobster (owner), and Lobster (director: its chain held the camp at 44 min);
//  3. the preview run on that workspace with the owner's Plane 1 budget of 25 min (a Ledger setting, not pack-carried);
//  4. the pack = the moves + the preview's proposals, less Beer's gate cut (owner: moved instead of lowered).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const OUT = process.argv[2];
const ID = '2026-11-02-balancing-1';
const { workspaceFromDataFiles, setValue, proposedValue, currentValue, fingerprint } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = path.join(WT, 'data');
const opt = (n, fb) => (fs.existsSync(path.join(data, n)) ? rd(path.join(data, n)) : fb);
let ws = workspaceFromDataFiles({
    items: rd(path.join(data, 'items.json')), tokens: rd(path.join(data, 'tokens.json')), effects: opt('effects.json', {}),
    tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null), skillPerks: opt('skillPerks.json', null),
    hallStars: opt('hallStars.json', null), world: opt('world.json', null), plan: rd(path.join(WT, 'cms/plan/plan.json'))
});
fs.writeFileSync(path.join(OUT, 'ws0.json'), JSON.stringify(ws));

const MOVES = [
    ['item', 'item_beer', 'owner'], ['recipe', 'recipe_mtp8qjj9', 'owner'],
    ['item', 'item_cooked_lobster', 'owner'], ['recipe', 'recipe_cooked_lobster', 'owner'],
    ['item', 'item_lobster', 'director'],
];
const moveNote = {
    owner: 'Plane 1 (owner 2026-11-02): planned for Plane 1 instead of lowering its gate, so the Starter Camp stays short.',
    director: 'Plane 1 (director 2026-11-02, with Cooked Lobster): its first catch is a chain (Worm, Worm Bait, then the trap) that held the Starter Camp at 44 min; the camp Coast still catches it.',
};
const moves = MOVES.map(([kind, id, who]) => {
    const cur = currentValue(ws, kind, id);
    if (!cur) throw new Error('missing ' + kind + ' ' + id);
    const value = { ...cur, plan: { ...(cur.plan || {}), status: cur.plan?.status || 'live', tier: 1, note: moveNote[who] } };
    return { op: 'edit', kind, id, value, fingerprint: fingerprint(cur), note: `Plan tier ${cur.plan?.tier ?? 'none'} → 1. ${moveNote[who]}` };
});
let wsM = ws;
for (const e of moves) wsM = { ...wsM, ...setValue(wsM, e.kind, e.id, proposedValue(e)) };
wsM.planSettings = { stages: [{ tier: 0, budgetMinutes: 30 }, { tier: 1, budgetMinutes: 25 }, { tier: 2, budgetMinutes: 24 * 60 }] };
fs.writeFileSync(path.join(OUT, 'wsMoves25.json'), JSON.stringify(wsM));

const SKIP = { recipe_mtp8qjj9: 'Beer: owner moved it to Plane 1 instead of lowering its gate (preview asked Cooking 15 → 5).' };
const movedIds = new Set(moves.map(e => e.id));
// The preview, run again on its own result until it proposes nothing more we take (a cut source hands its
// levels to another, which the next round then proposes).
let taken = [];
let wsRun = wsM;
for (let round = 1; round <= 4; round++) {
    const wsFile = path.join(OUT, `wsRound${round}.json`);
    fs.writeFileSync(wsFile, JSON.stringify(wsRun));
    const preview = path.join(OUT, `preview${round}.json`);
    const log = execFileSync('node', ['cms/changePackTool.mjs', 'balance', '--from', wsFile, '--out', preview], { cwd: WT, encoding: 'utf8', maxBuffer: 1 << 26 });
    fs.writeFileSync(path.join(OUT, `preview${round}.txt`), log);
    const fresh = rd(preview).entries.filter(e => !SKIP[e.id]);
    console.log(`round ${round}: ${fresh.length} new proposals taken`);
    if (!fresh.length) break;
    for (const e of fresh) {
        if (movedIds.has(e.id)) throw new Error('overlap ' + e.id);
        const i = taken.findIndex(t => t.id === e.id && t.kind === e.kind);
        if (i >= 0) taken[i] = { ...e, note: taken[i].note + ' Then: ' + e.note }; else taken.push(e);
        wsRun = { ...wsRun, ...setValue(wsRun, e.kind, e.id, proposedValue(e)) };
    }
}
// XP a cycle the Economy simulator derives (postsync.mjs, run on the workspace with every proposal applied,
// puts each of these back to its derived number): Sync's Recalculate would undo them, so they wait for the
// ledger's apply-after-Recalculate phase. Copper Nails and Build Herb Garden are not derived and stay.
const DERIVED_XP = new Set(['token_wild_lavender', 'token_oak_tree', 'token_birch_tree', 'token_maple_tree', 'token_cedar_tree',
    'token_mahogany_tree', 'token_silver_ore_vein', 'token_gold_ore_vein', 'token_mythril_ore_vein', 'token_adamantium_ore',
    'token_mahogany_forest', 'token_birch_forest', 'token_maple_forest', 'recipe_mtp8qjj1', 'recipe_mtp8qjj3', 'recipe_mtp8qjj4']);
const derivedLeft = taken.filter(e => DERIVED_XP.has(e.id));
if (derivedLeft.some(e => !/^XP a cycle/.test(e.note))) throw new Error('a derived-XP id carries another lever');
fs.writeFileSync(path.join(OUT, 'derived_xp_held_back.json'), JSON.stringify(derivedLeft, null, 2));
taken = taken.filter(e => !DERIVED_XP.has(e.id));
const entries = [...moves, ...taken].map(e => ({ ...e, fingerprint: e.op === 'create' ? undefined : fingerprint(currentValue(ws, e.kind, e.id)) }));

const pack = {
    format: 'fantasy-guild-change-pack', version: 1, id: ID, createdAt: new Date().toISOString(),
    asked: 'The first balancing pack: the ledger balancing preview, with the owner answers of 2026-11-02 (Plane 2 raises its level gates; Plane 1 budget about 25 min; Beer and Cooked Lobster move to Plane 1 instead of lowering their gates; Guild Hall prices and strengths stay).',
    // Measured with the gate on today's workspace (stage times do not depend on the budgets).
    intent: { stages: [
        { tier: 0, move: 'faster', toHours: 0.57, note: 'Beer, Cooked Lobster and Lobster planned for Plane 1, Fine Fishing Rod at Crafting 5: the Starter Camp lands near its 30 min (34 min).' },
        { tier: 1, move: 'slower', toHours: 2, note: 'Plane 1 now holds Beer (Cooking 15, kept: owner) and Cooked Lobster (a 1 h chain of first finds): about 2 h.' },
        { tier: 2, move: 'slower', toHours: 23.48, note: 'Plane 2 raises its level gates to fill its one-day budget (owner 2026-11-02).' },
    ] },
    entries,
};
fs.writeFileSync(path.join(OUT, ID + '.json'), JSON.stringify(pack, null, 2) + '\n');
console.log(`moves ${moves.length}, taken ${taken.length}, derived XP held back ${derivedLeft.length}; not taken: ${Object.values(SKIP).join(' ')}`);
