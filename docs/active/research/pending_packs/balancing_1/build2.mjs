// Balancing pack 2 (2026-11-02), a follow-up to the synced balancing-1: the owner's choice (a), Plane 1 25 min
// long (budget 55 min, already in the synced Ledger settings) and Beer at Cooking 9, plus any level gate the
// preview then proposes. Usage (from anywhere): node build2.mjs <scratch dir>
//  1. today's workspace from data/ + plan (its settings carry the 55 min budget);
//  2. Beer's recipe at Cooking 9;
//  3. Sync's Recalculate emulated (postsync.mjs), then the preview run on that;
//  4. the pack = Beer + the preview's level-gate proposals (its XP proposals are derived: Sync undoes them, T-291).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const HERE = path.join(WT, 'docs/active/research/pending_packs/balancing_1');
const OUT = process.argv[2];
const ID = '2026-11-02-balancing-2';
const { workspaceFromDataFiles, setValue, proposedValue, currentValue, fingerprint } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = path.join(WT, 'data');
const opt = (n, fb) => (fs.existsSync(path.join(data, n)) ? rd(path.join(data, n)) : fb);
const ws = workspaceFromDataFiles({
    items: rd(path.join(data, 'items.json')), tokens: rd(path.join(data, 'tokens.json')), effects: opt('effects.json', {}),
    tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null), skillPerks: opt('skillPerks.json', null),
    hallStars: opt('hallStars.json', null), world: opt('world.json', null), plan: rd(path.join(WT, 'cms/plan/plan.json'))
});
if (ws.planSettings?.stages?.find(s => s.tier === 1)?.budgetMinutes !== 55) throw new Error('expected the synced Plane 1 budget of 55 min');
fs.writeFileSync(path.join(OUT, 'ws0.json'), JSON.stringify(ws));

const beerCur = currentValue(ws, 'recipe', 'recipe_mtp8qjj9');
const beer = {
    op: 'edit', kind: 'recipe', id: 'recipe_mtp8qjj9', value: { ...beerCur, levelRequirement: 9 }, fingerprint: fingerprint(beerCur),
    note: `Level needed (levelRequirement) ${beerCur.levelRequirement} → 9. Owner 2026-11-02, choice (a): Plane 1 is 25 min long (done 55 min into a new game); at Cooking 15 Beer held Plane 1 to about 2 h.`,
};
const wsB = { ...ws, ...setValue(ws, beer.kind, beer.id, proposedValue(beer)) };
fs.writeFileSync(path.join(OUT, 'wsBeer.json'), JSON.stringify(wsB));
const ps = execFileSync('node', [path.join(HERE, 'postsync.mjs'), path.join(OUT, 'wsBeer.json'), path.join(OUT, 'wsBeerSynced.json')], { cwd: WT, encoding: 'utf8' });
fs.writeFileSync(path.join(OUT, 'postsync.txt'), ps);
const log = execFileSync('node', ['cms/changePackTool.mjs', 'balance', '--from', path.join(OUT, 'wsBeerSynced.json'), '--out', path.join(OUT, 'preview.json')], { cwd: WT, encoding: 'utf8', maxBuffer: 1 << 26 });
fs.writeFileSync(path.join(OUT, 'preview.txt'), log);
const proposed = rd(path.join(OUT, 'preview.json')).entries;
const gates = proposed.filter(e => /^Level needed/.test(e.note) && e.id !== beer.id)
    // A gate proposal's record came from the recalculated workspace: put only the level onto the synced record.
    .map(e => { const cur = currentValue(ws, e.kind, e.id); return { ...e, value: { ...cur, levelRequirement: e.value.levelRequirement }, fingerprint: fingerprint(cur) }; });
const left = proposed.filter(e => !gates.includes(e) && !/^Level needed/.test(e.note));
const pack = {
    format: 'fantasy-guild-change-pack', version: 1, id: ID, createdAt: new Date().toISOString(),
    asked: 'Follow-up to the first balancing pack (owner 2026-11-02, choice (a)): Plane 1 is 25 minutes long, so its budget is 55 min from a new game, and Beer drops to Cooking 9.',
    intent: { stages: [{ tier: 1, move: 'faster', toHours: 1.53, note: 'Beer at Cooking 9 instead of 15: Plane 1 goes from 2 h to 1 h 32 min; the rest waits on the Alchemy XP Sync undoes (T-291).' }] },
    entries: [beer, ...gates],
};
fs.writeFileSync(path.join(OUT, ID + '.json'), JSON.stringify(pack, null, 2) + '\n');
console.log(`entries ${pack.entries.length} (Beer + ${gates.length} gates); preview proposals not taken (derived XP, T-291): ${left.length}`);
