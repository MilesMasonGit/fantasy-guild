// A loaded save follows the CMS's renames

import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { getEffect } from '../../config/registries/effectRegistry.js';
import { renameTable } from '../../config/registries/renameRegistry.js';
import { RENAME_KINDS, followRename } from '../../config/renameTable.js';
import { logger } from '../../utils/Logger.js';

/**
 * A save holds the ids of the content it was played with. When the CMS renames an item, a Token or
 * a library effect, its Sync records old id to new id (`data/renames.json`, `renameTable.js`), and
 * a save loading later is rewritten here, everywhere such an id lives:
 * - the Bank: its stacks, each tab's order and the tab an item is filed in;
 * - each hero: the loadout, the drink and elixir counters, the live effects; a Summoned worker's kind;
 * - the live mat and every other Region's mat: each Token's type and the loot on the floor;
 * - the world map's places: origins, camps, chests, arrivals, a wild place's focus, the price asked;
 * - the collection's discoveries and counts, and the pinned item stubs.
 *
 * Only an id the data no longer defines is followed, and only to an id it does: a name used again
 * belongs to what has it now, and a rename whose new id is gone too (deleted since) leaves the save
 * as it was. Where an old and a new id meet (the guild went on playing under the new name before
 * this load), the two are joined: stacks and counts add up, a list keeps the first.
 *
 * Station picks and a Field's crop are recipe ids, which keep their id through a rename in the
 * CMS, so nothing here touches them.
 *
 * Pure apart from the registries it reads and one log line; returns the same object when nothing
 * needed changing.
 */

/**
 * Token ids deleted in the CMS with no rename to record, by the Token a save holding one loads as:
 * the Saplings, gone since Forests and the Orchard plant full Trees, load as their Tree, whole (its
 * starting charges, no growth left). A change pack cannot write the rename list, so the code holds
 * these; the CMS's own renames win over them.
 */
export const GROWN_SAPLINGS = Object.freeze({
    token_oak_sapling: 'token_oak_tree',
    token_apple_sapling: 'token_apple_tree',
    token_fir_sapling: 'token_fir_tree',
    token_birch_sapling: 'token_birch_tree',
    token_maple_sapling: 'token_maple_tree',
    token_mahogany_sapling: 'token_mahogany_tree',
    token_ebony_sapling: 'token_ebony_tree',
    token_cedar_sapling: 'token_cedar_tree'
});

/** Whether the data defines an id, per kind. */
const DEFINED = Object.freeze({
    items: (id) => !!getItem(id),
    tokens: (id) => !!getTokenType(id),
    effects: (id) => !!getEffect(id)
});

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Per kind, old id to the id it goes by now, for every rename that leads to a defined id; null when
 * no rename does (no table, or every old id defined again).
 */
export function activeRenames(table = renameTable(), defined = DEFINED) {
    let any = false;
    const active = {};
    for (const kind of RENAME_KINDS) {
        const map = table?.[kind] || {};
        const found = new Map();
        for (const from of Object.keys(map)) {
            const to = followRename(map, from, defined[kind]);
            if (to) found.set(from, to);
        }
        active[kind] = found;
        if (found.size) any = true;
    }
    return any ? active : null;
}

/**
 * The save `state` with every renamed id followed (see the module note).
 *
 * @param {object} state a saved state, as `migrateState` holds it
 * @param {{ table?: object, defined?: Record<string, (id: string) => boolean> }} [options]
 * @returns {object}
 */
export function followRenames(state, { table = renameTable(), defined = DEFINED, startingUses = tokenStartingUses } = {}) {
    if (!isPlainObject(state)) return state;
    const active = activeRenames({ ...table, tokens: { ...GROWN_SAPLINGS, ...(table?.tokens || {}) } }, defined);
    if (!active) return state;

    const followed = new Map();
    const followerOf = (kind) => (id) => {
        if (typeof id !== 'string') return id;
        const to = active[kind].get(id);
        if (to === undefined) return id;
        followed.set(`${kind}|${id}`, to);
        return to;
    };
    const ids = { item: followerOf('items'), token: followerOf('tokens'), effect: followerOf('effects') };
    // A Sapling's Tree, when this load turns it into one; the CMS's own rename of the id wins.
    ids.grownTree = (typeId) => (has(GROWN_SAPLINGS, typeId) && !has(table?.tokens || {}, typeId) ? active.tokens.get(typeId) ?? null : null);
    ids.startingUses = startingUses;

    let out = state;
    const put = (key, value) => {
        if (value === out[key]) return;
        if (out === state) out = { ...state };
        out[key] = value;
    };
    put('inventory', inventoryFollowing(state.inventory, ids));
    put('heroes', mapList(state.heroes, h => heroFollowing(h, ids)));
    put('board', boardFollowing(state.board, ids));
    put('atlas', atlasFollowing(state.atlas, ids));
    put('world', worldFollowing(state.world, ids));
    put('collection', collectionFollowing(state.collection, ids));
    put('ui', uiFollowing(state.ui, ids));

    if (followed.size) {
        const lines = [...followed].map(([key, to]) => `${key.split('|')[1]} → ${to}`);
        logger.info('SaveMigration', `Followed ${followed.size} renamed id(s) in this save: ${lines.join(', ')}`);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Building blocks: each returns the same value when nothing in it changed
// ---------------------------------------------------------------------------

/** `list` with `fn` applied to each entry. */
function mapList(list, fn) {
    if (!Array.isArray(list)) return list;
    let out = list;
    for (let i = 0; i < list.length; i++) {
        const next = fn(list[i]);
        if (next === list[i]) continue;
        if (out === list) out = list.slice();
        out[i] = next;
    }
    return out;
}

/** An object's values with `fn` applied to each. */
function mapValues(obj, fn) {
    if (!isPlainObject(obj)) return obj;
    let out = obj;
    for (const [key, value] of Object.entries(obj)) {
        const next = fn(value);
        if (next === value) continue;
        if (out === obj) out = { ...obj };
        out[key] = next;
    }
    return out;
}

/** `obj`'s field `key` through `fn`, when `obj` has it. */
function mapField(obj, key, fn) {
    if (!isPlainObject(obj) || !has(obj, key)) return obj;
    const next = fn(obj[key]);
    return next === obj[key] ? obj : { ...obj, [key]: next };
}

/**
 * A map keyed by ids with its keys followed, in its own order. Two keys that become one are
 * joined: `join(kept, moved)`, `kept` being the entry already under the id it ends at.
 */
function renameKeys(obj, follow, join) {
    if (!isPlainObject(obj)) return obj;
    if (!Object.keys(obj).some(k => follow(k) !== k)) return obj;
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        const to = follow(key);
        if (!has(out, to)) out[to] = value;
        else out[to] = to === key ? join(value, out[to]) : join(out[to], value);
    }
    return out;
}

/** A list of ids followed, each id once (the first place it stood). */
function idList(list, follow) {
    const mapped = mapList(list, follow);
    if (mapped === list) return list;
    return mapped.filter((id, i) => mapped.indexOf(id) === i);
}

const keepFirst = (kept) => kept;

/** Counts add up; a discovery mark stays found. */
function joinCounts(kept, moved) {
    if (typeof kept === 'number' && typeof moved === 'number') return kept + moved;
    if (kept === true || moved === true) return true;
    return kept ?? moved;
}

/** Two Bank stacks of one item, as one. */
function joinStacks(kept, moved) {
    if (!isPlainObject(kept) || !isPlainObject(moved)) return isPlainObject(kept) ? kept : moved;
    return { ...kept, quantity: (Number(kept.quantity) || 0) + (Number(moved.quantity) || 0) };
}

// ---------------------------------------------------------------------------
// Where ids live
// ---------------------------------------------------------------------------

function inventoryFollowing(inv, { item }) {
    if (!isPlainObject(inv)) return inv;
    let out = inv;
    const stacks = renameKeys(mapValues(inv.items, e => mapField(e, 'itemId', item)), item, joinStacks);
    if (stacks !== inv.items) out = { ...out, items: stacks };
    const defs = mapValues(inv.groupDefs, def => {
        if (!isPlainObject(def) || !Array.isArray(def.orderedItems)) return def;
        const ordered = idList(def.orderedItems, item);
        return ordered === def.orderedItems ? def : { ...def, orderedItems: ordered };
    });
    if (defs !== inv.groupDefs) out = { ...out, groupDefs: defs };
    const overrides = renameKeys(inv.itemOverrides, item, keepFirst);
    if (overrides !== inv.itemOverrides) out = { ...out, itemOverrides: overrides };
    return out;
}

function heroFollowing(hero, { item, effect, token }) {
    if (!isPlainObject(hero)) return hero;
    let out = hero;
    // A Summoned worker names its kind, a Token type.
    out = mapField(out, 'summon', block => mapField(block, 'typeId', token));
    // A loadout is a grid of item ids; an older save's is an object of named slots.
    if (Array.isArray(hero.equipment)) out = mapField(out, 'equipment', list => mapList(list, item));
    else if (isPlainObject(hero.equipment)) out = mapField(out, 'equipment', slots => mapValues(slots, item));
    out = mapField(out, 'drinkCycles', counts => renameKeys(counts, item, keepFirst));
    out = mapField(out, 'elixirFights', counts => renameKeys(counts, item, keepFirst));
    out = mapField(out, 'poisonAttacks', counts => renameKeys(counts, item, keepFirst));
    out = mapField(out, 'effects', list => mapList(list, e => mapField(e, 'effectId', effect)));
    return out;
}

function tokenFollowing(instance, ids) {
    if (!isPlainObject(instance)) return instance;
    const tree = ids.grownTree?.(instance.typeId) ?? null;
    let out = instance;
    out = mapField(out, 'typeId', ids.token);
    if (tree && out.typeId === tree) out = grownWhole(out, ids.startingUses(tree));
    return out;
}

/** A Sapling loaded as its Tree: the Tree's starting charges, and the growth clock it ran dropped. */
function grownWhole(instance, uses) {
    const out = { ...instance, usesRemaining: uses };
    if (isPlainObject(instance.clocks) && has(instance.clocks, 'growMs')) {
        const { growMs: _grown, ...clocks } = instance.clocks;
        out.clocks = clocks;
    }
    return out;
}

function boardFollowing(board, ids) {
    if (!isPlainObject(board)) return board;
    let out = mapField(board, 'tokens', tokens => mapValues(tokens, t => tokenFollowing(t, ids)));
    // Only items drop as loot (`SpriteLayer.addSprite`).
    out = mapField(out, 'sprites', list => mapList(list, s => (s?.kind === 'item' ? mapField(s, 'refId', ids.item) : s)));
    return out;
}

function atlasFollowing(atlas, ids) {
    return mapField(atlas, 'regions', regions => mapValues(regions, region => mapField(region, 'board', b => boardFollowing(b, ids))));
}

function cellFollowing(cell, { item, token }) {
    if (!isPlainObject(cell)) return cell;
    let out = cell;
    out = mapField(out, 'origins', list => mapList(list, o => mapField(o, 'id', token)));
    out = mapField(out, 'camps', list => mapList(list, c => (typeof c === 'string' ? token(c) : mapField(c, 'id', token))));
    out = mapField(out, 'arrival', list => mapList(list, r => mapField(r, 'typeId', token)));
    // A wild place made of one origin names it; a wild layout names a layout, not content.
    out = mapField(out, 'extreme', x => (x?.kind === 'composition' ? mapField(x, 'focus', token) : x));
    out = mapField(out, 'requires', price => mapField(price, 'items', list => mapList(list, r => mapField(r, 'itemId', item))));
    return out;
}

function worldFollowing(world, ids) {
    return mapField(world, 'cells', cells => (Array.isArray(cells) ? mapList(cells, c => cellFollowing(c, ids)) : mapValues(cells, c => cellFollowing(c, ids))));
}

/** The collection's maps keyed by an item id, and those keyed by a Token type id. */
const ITEM_KEYED = ['discoveredItems', 'itemLifetimeCounts'];
const TOKEN_KEYED = ['discoveredEnemies', 'enemyKillCounts', 'cyclesByTokenType', 'tokensHad', 'tokensBuilt'];

function collectionFollowing(collection, { item, token }) {
    if (!isPlainObject(collection)) return collection;
    let out = collection;
    for (const key of ITEM_KEYED) out = mapField(out, key, map => renameKeys(map, item, joinCounts));
    for (const key of TOKEN_KEYED) out = mapField(out, key, map => renameKeys(map, token, joinCounts));
    return out;
}

function uiFollowing(ui, { item }) {
    return mapField(ui, 'pinnedStubs', pins => {
        const mapped = mapList(pins, p => mapField(p, 'itemId', item));
        if (mapped === pins) return pins;
        // Two pins of one item become one, counting both.
        const out = [];
        for (const pin of mapped) {
            const same = isPlainObject(pin) ? out.find(p => isPlainObject(p) && p.itemId === pin.itemId) : null;
            if (!same) { out.push(pin); continue; }
            out[out.indexOf(same)] = {
                ...same,
                added: (Number(same.added) || 0) + (Number(pin.added) || 0),
                removed: (Number(same.removed) || 0) + (Number(pin.removed) || 0)
            };
        }
        return out;
    });
}
