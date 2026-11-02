// Build a CMS workspace from the worktree's data/ (and cms/plan/plan.json), as changePackTool does with no autosave.
// Usage: node mkws.mjs <out.json> [pack.json ...]  (packs applied in order, in memory, as the gate does)
import fs from 'fs';
import path from 'path';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const { workspaceFromDataFiles, setValue, proposedValue, entryConflict } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
// As packGate.applyPackInMemory (which loads through Vite): every entry applied, conflicts too.
function applyPackInMemory(ws, pack) { const conflicts = []; pack.entries.forEach((e, i) => { const c = entryConflict(ws, e); if (c.conflict) conflicts.push({ i, id: e.id, reason: c.reason }); ws = { ...ws, ...setValue(ws, e.kind, e.id, proposedValue(e)) }; }); return { workspace: ws, conflicts }; }
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = path.join(WT, 'data');
const opt = (n, fb) => (fs.existsSync(path.join(data, n)) ? rd(path.join(data, n)) : fb);
let ws = workspaceFromDataFiles({
    items: rd(path.join(data, 'items.json')), tokens: rd(path.join(data, 'tokens.json')), effects: opt('effects.json', {}),
    tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null), skillPerks: opt('skillPerks.json', null),
    hallStars: opt('hallStars.json', null), world: opt('world.json', null), plan: rd(path.join(WT, 'cms/plan/plan.json'))
});
for (const p of process.argv.slice(3)) {
    const r = applyPackInMemory(ws, rd(p));
    ws = r.workspace; console.log(p, "conflicts", JSON.stringify(r.conflicts));
}
fs.writeFileSync(process.argv[2], JSON.stringify(ws));
console.log('wrote', process.argv[2], Object.keys(ws));
