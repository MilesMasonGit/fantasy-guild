// Builds the seed maps content pack (owner's rulings, 2026-11-02) from a worktree's data/ and cms/plan/plan.json.
//
//   node mkpack_seed_maps.mjs <worktree> <out-dir> [--delete-code-named]
//
// Default: ids the game's code names stay (they lose their drops but are not deleted), and the world
// tables are untouched. --delete-code-named deletes those too, which takes the 13 hidden modifier
// extras out of the world tables and resets the ring values to what treasures alone can reach.
// Writes <out-dir>/<pack id>.json (unstamped: run changePackTool stamp on it) and
// <out-dir>/workspace_applied.json (the workspace with every entry applied, for `world --from`).
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const args = process.argv.slice(2);
const deleteCodeNamed = args.includes('--delete-code-named');
const [root, outDir] = args.filter(a => !a.startsWith('--'));
if (!root || !outDir) throw new Error('usage: node mkpack_seed_maps.mjs <worktree> <out-dir> [--delete-code-named]');
const mod = async (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { workspaceFromDataFiles, currentValue, setValue, proposedValue } = await mod('cms/src/engine/changePacks.js');

const read = (rel, fallback) => (fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : fallback);
const ws = workspaceFromDataFiles({
    items: read('data/items.json'), tokens: read('data/tokens.json'), effects: read('data/effects.json', {}),
    tokenRecipes: read('data/tokenRecipes.json', []), starterCamp: read('data/starterCamp.json', null),
    skillPerks: read('data/skillPerks.json', null), hallStars: read('data/hallStars.json', null),
    world: read('data/world.json', null), plan: read('cms/plan/plan.json', null),
});
const clone = (v) => JSON.parse(JSON.stringify(v));
const cur = (kind, id) => {
    const v = currentValue(ws, kind, id);
    if (!v) throw new Error(`not in the workspace: ${kind} ${id}`);
    return clone(v);
};
const entries = [];

// ── The retiring items ─────────────────────────────────────────────────────────────────────────
const isRetiring = (def) => def?.type === 'map' || def?.type === 'modifier';
const RETIRING = Object.keys(ws.items).filter(id => isRetiring(ws.items[id]));
// Named outside tests in src/ or cms/src/. The grep, with file and line, is in this folder's README.
const CODE_NAMED = new Set([
    'map_forest', 'map_mountain', 'map_volcano',
    'mod_rich_veins', 'mod_overgrown', 'mod_bountiful', 'mod_teeming_waters', 'mod_goblin_camp', 'mod_wolf_den',
    'mod_crab_rocks', 'mod_wild_hive', 'mod_cow_pasture', 'mod_thorn_thicket', 'mod_ember_vents', 'mod_sulphur_rocks', 'mod_frog_pond'
]);
for (const id of CODE_NAMED) if (!RETIRING.includes(id)) throw new Error(`not a map or modifier: ${id}`);
const dropsRetired = (itemId) => RETIRING.includes(itemId);

// ── 1. The seed items take the name of the Token they build, and a map sprite ───────────────────
// A modifier's own sprite where the place had a modifier; else the sprite of the old Base Map that held
// the camp, which is a stand-in (the review flags it).
const SPRITE = {
    token_goblin_camp: ['mod_goblin_camp'], token_wolf_den: ['mod_wolf_den'], token_crab_rocks: ['mod_crab_rocks'],
    token_wild_hive: ['mod_wild_hive'], token_cow_pasture: ['mod_cow_pasture'], token_thorn_thicket: ['mod_thorn_thicket'],
    token_ember_vents: ['mod_ember_vents'], token_sulphur_rocks: ['mod_sulphur_rocks'], token_frog_pond: ['mod_frog_pond'],
    token_chief_tent: ['map_mountain', true], token_alpha_den: ['map_forest', true], token_tide_pool: ['map_coast', true],
    token_queens_hive: ['map_cherry_grove', true], token_slime_pit: ['map_meadow', true], token_wind_stones: ['map_flower_meadow', true],
    token_smoking_crater: ['map_volcano', true], token_basking_stone: ['map_yellowstone', true], token_toxic_pool: ['map_bog', true]
};
const PLURAL = new Set(['token_crab_rocks', 'token_ember_vents', 'token_sulphur_rocks', 'token_wind_stones']);
const articled = (camp, name) => (PLURAL.has(camp) ? name : `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`);
const seedRecipes = Object.values(ws.recipePools).flat().filter(r => r.inputs?.some(i => /_banner$/.test(i.itemId || '')));
if (seedRecipes.length !== 18) throw new Error(`expected 18 banner recipes, found ${seedRecipes.length}`);
const standIns = [];
for (const r of seedRecipes.sort((a, b) => a.id.localeCompare(b.id))) {
    const itemId = r.inputs.find(i => /_banner$/.test(i.itemId)).itemId;
    const camp = r.outputs[0].tokenId;
    const place = ws.tokens[camp].name;
    const [sourceId, standIn] = SPRITE[camp] || [];
    if (!sourceId) throw new Error(`no sprite chosen for ${camp}`);
    if (r.name.includes('Banner')) throw new Error(`recipe name names the banner: ${r.id}`);
    const v = cur('item', itemId);
    const was = v.name;
    v.name = `${place} Map`;
    v.sprite = ws.items[sourceId].sprite;
    v.description = `Shows where ${articled(camp, place)} can stand: the Build ${place} recipe spends one.`;
    if (v.plan) v.plan = { ...v.plan, note: 'Seed map: a rare drop that builds its camp.' };
    if (standIn) standIns.push(`${v.name}: ${v.sprite} (from ${ws.items[sourceId].name})`);
    entries.push({
        op: 'edit', kind: 'item', id: itemId, value: v,
        note: `${was} is now the ${v.name}, named after the Token it builds, with a map sprite (${v.sprite}, ${standIn ? `a stand-in, from the old ${ws.items[sourceId].name}` : `the old ${ws.items[sourceId].name} modifier's own`}). Same id, same drop, same recipe.`,
        ...(standIn ? { placeholderArt: true } : {})
    });
}

// ── 2. Tokens lose every line naming a retiring item, kept or deleted ───────────────────────────
const applied = () => {
    let a = clone(ws);
    for (const e of entries) a = { ...a, ...setValue(a, e.kind, e.id, proposedValue(e)) };
    return a;
};
const removed = {};
for (const id of Object.keys(ws.tokens).sort()) {
    const outs = ws.tokens[id].config?.outputs;
    const gone = (outs || []).filter(o => dropsRetired(o.itemId));
    if (!gone.length) continue;
    const t = cur('token', id);
    t.config.outputs = t.config.outputs.filter(o => !dropsRetired(o.itemId));
    removed[id] = gone.map(o => o.itemId);
    const names = gone.map(o => ws.items[o.itemId].name).join(', ');
    entries.push({ op: 'edit', kind: 'token', id, value: t, note: `${t.name} no longer drops the retired maps and modifiers: ${names}.` });
}

// ── 3. The retired items go; ids the code names stay unless told otherwise ──────────────────────
const kept = [];
for (const id of RETIRING) {
    if (CODE_NAMED.has(id) && !deleteCodeNamed) { kept.push(id); continue; }
    const d = ws.items[id];
    entries.push({
        op: 'delete', kind: 'map', id,
        note: `${d.name}: the ${d.type === 'map' ? 'Base Map' : 'modifier'} retires (owner, 2026-11-02: the player no longer influences a mat through map items and modifiers). Nothing drops it after this pack.`
    });
}

// ── 4. With the modifiers gone, a cell's hidden extras are its treasures ────────────────────────
// Ring values are what chests alone can reach: one Copper Chest in ring 1, one Iron Chest or two Copper
// Chests in ring 2, one Iron Chest in ring 3.
if (deleteCodeNamed) {
    const world = cur('world', 'world');
    world.extras = world.extras.filter(e => e.kind !== 'modifier');
    world.ringValue = { 1: 6, 2: 12, 3: 12 };
    entries.push({
        op: 'edit', kind: 'world', id: 'world', value: world,
        note: 'The 13 modifier lines leave the hidden extras, so a cell no longer hides extra veins, trees or camps: its extras are its chests. Ring values drop to 6, 12 and 12 so chests alone meet them (they were 16, 24 and 32, sums modifiers made up).'
    });
}

const pack = {
    format: 'fantasy-guild-change-pack',
    version: 1,
    id: '2026-11-02-seed-maps',
    createdAt: new Date().toISOString(),
    asked: 'Owner, 2026-11-02: the player no longer influences a mat through map items and modifiers. The seed items that build a creature camp are named after the Token they build (Wolf Den Map, Goblin Camp Map) and take a map sprite. The old map and modifier items retire, with their drop lines; the Coal Prospecting Map stays.',
    entries
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${pack.id}.json`), JSON.stringify(pack, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'workspace_applied.json'), JSON.stringify(applied()));
const counts = {};
for (const e of entries) counts[`${e.op} ${e.kind}`] = (counts[`${e.op} ${e.kind}`] || 0) + 1;
console.log(`wrote ${pack.id}.json: ${entries.length} entries`, counts);
console.log('drop lines removed:', Object.values(removed).flat().length, 'from', Object.keys(removed).length, 'tokens');
console.log('kept because code names them:', kept.join(', ') || 'none');
console.log('stand-ins:\n  ' + standIns.join('\n  '));
