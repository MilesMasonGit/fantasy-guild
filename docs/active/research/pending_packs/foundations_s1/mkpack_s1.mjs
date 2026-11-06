// Builds the Foundations pack (brief 410 S1) from a worktree's data/ and cms/plan/plan.json.
//
//   node mkpack_s1.mjs <worktree> <out-file>
//
// Writes the pack, unstamped: run `node cms/changePackTool.mjs stamp <out-file>` on it, then
// `check` and `gate`. Reads only; the pack is the one thing it makes.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [root, outFile] = process.argv.slice(2);
if (!root || !outFile) throw new Error('usage: node mkpack_s1.mjs <worktree> <out-file>');
const mod = async (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { workspaceFromDataFiles, currentValue } = await mod('cms/src/engine/changePacks.js');

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
const OAK = 'item_oak_wood';

// ── The list: order and skill icons (concept_detail_pass.md, "5. Shop", the Foundation table) ──
const LIST = [
    { id: 'token_wood_foundation', order: 1, skills: ['crafting', 'cooking', 'alchemy', 'fishing', 'forestry'] },
    { id: 'token_stone_foundation', order: 2, skills: ['smithing', 'faith'] },
    { id: 'token_farmland', order: 3, skills: ['farming', 'forestry'] },
];
for (const { id, order, skills } of LIST) {
    const value = cur('token', id);
    value.shop = { ...value.shop, skills, order };
    entries.push({
        op: 'edit', kind: 'token', id, value,
        note: `${value.name}: place ${order} in the Shop list, with the skill icons ${skills.join(', ')}.`,
    });
}

// ── Two new Foundations, modelled on the Wood Foundation ──
const wood = cur('token', 'token_wood_foundation');
const NEW = [
    {
        id: 'token_excavation', name: 'Excavation', sprite: 't_foundation_granite', kind: 'excavation', order: 4,
        skills: ['mining'], description: 'Cleared ground to dig into. Build a mine or a quarry on it.',
        note: 'New Foundation for mines and quarries. Placeholder price, Oak Wood only: it cannot cost Stone, since the first Quarry built on it is what gets you Stone. Stand-in sprite (the granite Foundation) until the owner draws it.',
    },
    {
        id: 'token_battlefield', name: 'Battlefield', sprite: 't_foundation_basalt', kind: 'battlefield', order: 5,
        skills: ['melee', 'ranged', 'magic'], description: 'Open ground for a fight. Plant a banner on it to raise an enemy camp.',
        note: 'New Foundation for the enemy spawners built from a banner. Placeholder price, Oak Wood only. Stand-in sprite (the basalt Foundation) until the owner draws it.',
    },
];
for (const n of NEW) {
    const value = clone(wood);
    delete value.id;
    Object.assign(value, {
        name: n.name, description: n.description, sprite: n.sprite,
        foundation: { kind: n.kind, skill: 'construction' },
        // The section is the first icon, so today's drawer lists the five in the authored order until
        // the pop-up Shop (S2) drops the headings.
        shop: { price: [{ itemId: OAK, quantity: 15 }], section: n.skills[0], skills: n.skills, order: n.order },
        plan: { status: 'live', tier: 0 },
    });
    entries.push({ op: 'create', kind: 'token', id: n.id, value, note: n.note, placeholderArt: true });
}

// ── Coast and Goblin Camp leave the Shop (the Starter Camp and the world tables still place them) ──
for (const id of ['token_coast', 'token_goblin_camp']) {
    const value = cur('token', id);
    delete value.shop;
    entries.push({
        op: 'edit', kind: 'token', id, value,
        note: `${value.name} is no longer sold: the Shop is Foundations only. It still comes in the Starter Camp and the world map's tables${id === 'token_goblin_camp' ? ', and a Goblin Banner builds one on a Battlefield' : ''}.`,
    });
}

// ── Building recipes move to their Foundation ──
const recipes = Object.values(ws.recipePools).flat();
const move = (recipe, kinds, why) => {
    const value = clone(recipe);
    const from = (value.foundationKinds || []).join(', ');
    value.foundationKinds = kinds;
    entries.push({ op: 'edit', kind: 'recipe', id: value.id, value, note: `${value.name}: built on ${kinds.join(', ')} instead of ${from}. ${why}` });
};
for (const id of ['recipe_build_copper_mine', 'recipe_build_coal_mine', 'recipe_build_quarry']) {
    move(cur('recipe', id), ['excavation'], 'Mines and quarries go on an Excavation.');
}
move(cur('recipe', 'recipe_build_mining_camp'), ['wood'], 'The Wood Foundation is the main support structure; the Mining Camp moves off Stone.');

// Every enemy spawner built from a banner: a building recipe with a banner among its inputs whose Token spawns.
const bannerBuilt = recipes.filter((r) => Array.isArray(r.foundationKinds) && r.foundationKinds.length
    && (r.inputs || []).some((i) => /_banner$/.test(i.itemId || ''))
    && ws.tokens[(r.outputs || []).find((o) => o.tokenId)?.tokenId]?.spawner);
for (const r of bannerBuilt) move(clone(r), ['battlefield'], 'Enemy spawners built from a banner go on a Battlefield.');

const pack = {
    format: 'fantasy-guild-change-pack',
    version: 1,
    id: path.basename(outFile, '.json'),
    createdAt: new Date().toISOString(),
    asked: 'The Shop sells Foundations only, each type for its own kind of building: Wood first (the main support structure), then Stone, Farmland, a new Excavation for mines and quarries, and a new Battlefield for enemy spawners. Coast and Goblin Camp leave the Shop. Skill icons on each Foundation hint at what it is good for (owner, 2026-11-03; brief 410 S1).',
    entries,
};
fs.writeFileSync(outFile, JSON.stringify(pack, null, 2) + '\n');
console.log(`${entries.length} entries (${bannerBuilt.length} banner spawners) -> ${outFile}`);
