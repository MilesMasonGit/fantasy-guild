// Builds the W4 change pack from the worktree's data/ (newer than the CMS's last autosave).
const fs = require('fs');
const path = require('path');
const root = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'data/tokens.json'), 'utf8'));
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'data/tokenRecipes.json'), 'utf8'));
const recipe = (id) => JSON.parse(JSON.stringify(recipes.find(r => r.id === id)));
const token = (id) => JSON.parse(JSON.stringify(tokens[id]));

const map = (id, name, sprite, ore) => ({
    op: 'create', kind: 'item', id,
    value: {
        id, name, description: `Shows where ${ore} lies under a Stone outcrop: a Build ${ore === 'coal' ? 'Coal' : 'Copper'} Mine recipe spends one.`,
        type: 'material', sprite, stackable: true, restoreAmount: 0, equipSlot: '', value: 1, autoSyncId: true, tags: []
    },
    note: `The prospecting map a ${ore} mine is built from (owner's table: metal mines need a prospecting map). No source yet: W6 makes it a drop from a powerful enemy.`,
    placeholderArt: true
});

const withMap = (id, mapId, why) => {
    const r = recipe(id);
    r.inputs = [...r.inputs, { itemId: mapId, quantity: 1 }];
    return { op: 'edit', kind: 'recipe', id, value: r, note: why };
};

const onStone = (id, why) => {
    const t = token(id);
    t.standsOn = ['stone'];
    return { op: 'edit', kind: 'token', id, value: t, note: why };
};

const pack = {
    format: 'fantasy-guild-change-pack',
    version: 1,
    id: '2026-11-01-w4-mines-on-stone',
    createdAt: new Date().toISOString(),
    asked: 'Building nodes anywhere (brief 330 W4): metal mines need a prospecting map and stand only on Stone terrain; quarries stand on Stone; today\'s Copper Mine, Coal Mine and Quarry change to these rules (owner, 2026-10-29).',
    entries: [
        map('item_copper_prospecting_map', 'Copper Prospecting Map', 't_map_mountain_copper', 'copper'),
        map('item_coal_prospecting_map', 'Coal Prospecting Map', 't_map_mountain', 'coal'),
        withMap('recipe_build_copper_mine', 'item_copper_prospecting_map', 'Build Copper Mine also spends a Copper Prospecting Map.'),
        withMap('recipe_build_coal_mine', 'item_coal_prospecting_map', 'Build Coal Mine also spends a Coal Prospecting Map.'),
        onStone('token_copper_mine', 'Copper Mine stands only on Stone (Stands on: Stone). A Foundation set to build one off Stone waits, saying Needs stone.'),
        onStone('token_coal_mine', 'Coal Mine stands only on Stone (Stands on: Stone).'),
        onStone('token_quarry', 'Quarry stands only on Stone (Stands on: Stone). Its recipe stays as it is: no unlock item (owner\'s table: basic).')
    ]
};

const out = process.argv[2];
fs.writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
console.log('wrote', out, pack.entries.length, 'entries');
