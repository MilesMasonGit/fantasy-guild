// The fish pack: a tool-free source for Tropical Fish, Salmon, Swordfish and Lobster (ContentRules rule 1).
// Usage: node mkpack.mjs --from ws.json [--out file]; writes <id>.json beside this script by default.
// ⚠️ Build it against the workspace WITH the combat pack applied (it edits the Crab and the Water Elemental too):
//   node mkws.mjs ws_combat.json ../combat_v5/2026-11-02-combat-v5-content.json
// so the owner reviews the combat pack first and this one second, without a conflict.
import fs from 'fs';
import path from 'path';

const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const { currentValue } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i === -1 ? d : args[i + 1]; };
if (!argOf('--from')) throw new Error('--from <workspace.json> is required');
const ws = JSON.parse(fs.readFileSync(argOf('--from'), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

const drop = (itemId, chance, min, max) => ({
    itemId, chance, minQty: min, maxQty: max, baseQty: { min, max }, variable: chance < 100
});
const phrase = (name, chance, min, max) => `${min === max ? min : `${min}–${max}`} ${name}${chance < 100 ? ` (${chance}%)` : ''}`;

const entries = [];
// Each new drop goes in after the enemy's food lines (index `at`), so the description reads food first.
const addDrops = (id, at, drops, note) => {
    const cur = currentValue(ws, 'token', id);
    if (!cur) throw new Error('missing token ' + id);
    const v = clone(cur);
    const outs = v.config.outputs;
    for (const [itemId] of drops) if (outs.some(o => o.itemId === itemId)) throw new Error(id + ' already drops ' + itemId);
    outs.splice(at, 0, ...drops.map(([itemId, chance, min, max]) => drop(itemId, chance, min, max)));
    // The CMS recomposes the description on save; this keeps the review's text in step until then.
    const after = outs[at + drops.length];
    const anchor = after ? phrase(currentValue(ws, 'item', after.itemId)?.name || after.itemId, after.chance, after.minQty, after.maxQty) : null;
    const added = drops.map(([itemId, chance, min, max]) => phrase(currentValue(ws, 'item', itemId).name, chance, min, max)).join(', ');
    if (!anchor || !v.description.includes(anchor)) throw new Error('cannot place the new drops in the description of ' + id);
    v.description = v.description.replace(anchor, `${added}, ${anchor}`);
    entries.push({ op: 'edit', kind: 'token', id, value: v, note });
};

addDrops('token_crab', 2, [['item_tropical_fish', 25, 1, 1], ['item_lobster', 10, 1, 1]],
    'The Crab, a Coast creature, also drops Tropical Fish (25 %) and Lobster (10 %): a barehanded way to both when the Fishing Rod or the Trap runs out (ContentRules rule 1), as the Toxic Frog does for Trout. Rarer than a rod or a baited trap at the Coast, so fishing stays the way to them.');
addDrops('token_water_elemental', 2, [['item_salmon', 50, 1, 2], ['item_swordfish', 25, 1, 1]],
    'The Water Elemental also drops 1–2 Salmon (50 %) and Swordfish (25 %): a barehanded way to both (ContentRules rule 1). The bigger fish from the bigger water fight; the rod stays the steady source.');

const pack = {
    format: 'fantasy-guild-change-pack', version: 1,
    id: '2026-11-02-fish-tool-free',
    createdAt: new Date().toISOString(),
    asked: 'Give Tropical Fish, Salmon, Swordfish and Lobster a source that needs no tool (ContentRules rule 1: every material a recipe spends has a barehanded route). Director, 2026-11-02. Review after the combat pack: it edits the Crab and the Water Elemental too.',
    entries
};
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const out = argOf('--out') || path.join(here, pack.id + '.json');
fs.writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
console.log(out, entries.length);
