// Fantasy Guild — gathering tools: the kinds, an item's tool, a Token's need, hands
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Tool field, the Token editor's Needs tool field and the audit read the kinds from here.
// Pure: its one import (`catchPools.js`) is pure too, so both sides can load it.

import { hasCatchPools, catchToolKinds } from './catchPools.js';

/**
 * A gathering tool is an item a hero carries in one hand: `tool: { kind, tier, starter? }` on the
 * item. A gathering Token names the kind it needs and the lowest tier that will do:
 * `needsTool: { kind, minTier }`. Only a hero holding a tool of that kind, at that tier or above,
 * may work it. Tools gate only: they add no speed or yield.
 *
 * ⚠️ Water is the exception (`catchPools.js`): it needs any kind its catch pools name, and a
 * fishing tool's tier never gates. Its need carries the list as `kinds`.
 *
 * Adding a kind is one row here: the editors offer it and the audit accepts it.
 */
export const TOOL_KINDS = Object.freeze([
    Object.freeze({ id: 'pickaxe', label: 'Pickaxe' }),
    Object.freeze({ id: 'woodaxe', label: 'Woodaxe' }),
    Object.freeze({ id: 'fishing_rod', label: 'Fishing Rod' }),
    Object.freeze({ id: 'sickle', label: 'Sickle' }),
    Object.freeze({ id: 'fishing_net', label: 'Fishing Net' }),
    Object.freeze({ id: 'fishing_cage', label: 'Fishing Cage' })
]);

/** A hero has two hands. A tool takes one; a two-handed weapon takes both. */
export const HANDS = 2;

/** The equip category whose items are held in the hands. */
export const HAND_CATEGORY = 'hand';

/**
 * The context tags the retired tool Tokens offered (`Acts as`), by the tool kind each became.
 * Only the audit reads this, to point at content still written the old way.
 */
export const RETIRED_TOOL_TAGS = Object.freeze({
    pickaxe: 'pickaxe',
    axe: 'woodaxe',
    woodaxe: 'woodaxe',
    fishing_net: 'fishing_rod',
    fishing_rod: 'fishing_rod',
    sickle: 'sickle'
});

/** Whether `id` names a tool kind the game has. */
export function isToolKind(id) {
    return TOOL_KINDS.some(k => k.id === id);
}

/** A kind's name for the player ("Fishing Rod"), or the id itself for a kind the game lacks. */
export function toolKindLabel(id) {
    return TOOL_KINDS.find(k => k.id === id)?.label || String(id || '');
}

/** A tier: a whole number from 1. Absent or nonsense reads as 1. */
export function tierValue(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * An item's tool as `{ kind, tier, starter }`, or null when it is not one (no `tool` block, or a
 * kind the game does not have).
 */
export function toolOf(item) {
    const block = item?.tool;
    if (!block || typeof block !== 'object' || !isToolKind(block.kind)) return null;
    return { kind: block.kind, tier: tierValue(block.tier), starter: block.starter === true };
}

/**
 * A Token type's tool need as `{ kind, minTier }`, or null when its work needs no tool.
 *
 * Water (a Token with catch pools) needs any kind its pools name, at any tier, whatever its
 * `needsTool` says: `{ kind, kinds, minTier: 1 }`, `kind` being the first of `kinds`.
 */
export function neededToolOf(def) {
    if (hasCatchPools(def)) {
        const need = waterNeedOf(def);
        if (need) return need;
    }
    const block = def?.needsTool;
    if (!block || typeof block !== 'object' || !isToolKind(block.kind)) return null;
    return { kind: block.kind, minTier: tierValue(block.minTier) };
}

/**
 * A water's need, kept per Token type (the flags and the runner ask it every tick): frozen, so a
 * reader cannot change the kept one. Null when none of its pools names a kind the game has.
 */
const waterNeeds = new WeakMap();
function waterNeedOf(def) {
    if (waterNeeds.has(def)) return waterNeeds.get(def);
    const kinds = catchToolKinds(def).filter(isToolKind);
    const need = kinds.length ? Object.freeze({ kind: kinds[0], kinds: Object.freeze(kinds), minTier: 1 }) : null;
    waterNeeds.set(def, need);
    return need;
}

/** Whether a tool (from {@link toolOf}) answers a need (from {@link neededToolOf}). */
export function toolMeets(tool, need) {
    if (!need) return true;
    if (!tool) return false;
    if (Array.isArray(need.kinds)) return need.kinds.includes(tool.kind);
    return tool.kind === need.kind && tool.tier >= need.minTier;
}

/** The kinds a need accepts: its `kinds`, or its one `kind`. */
function kindsOfNeed(need) {
    return Array.isArray(need?.kinds) && need.kinds.length ? need.kinds : [need.kind];
}

/**
 * How many hands an item takes: 0 for anything not held in the hands; a tool always 1, whatever
 * else it says; otherwise 2 for `hands: 2` (a two-handed weapon), else 1.
 */
export function handsOf(item) {
    if (item?.equipSlot !== HAND_CATEGORY) return 0;
    if (toolOf(item)) return 1;
    return item.hands === 2 ? 2 : 1;
}

/**
 * The words for a need, without an article: the kind at the bottom rung ("Pickaxe"), else the
 * first tool item that reaches the tier and the words "or better" ("Iron Pickaxe or better"), as
 * `toolNames.js` words a Token requirement. The game never prints a tier number.
 *
 * @param {{kind: string, minTier: number}} need
 * @param {Record<string, object>} items  the item catalogue to name a tool from
 */
export function toolNeedPhrase(need, items = {}) {
    if (!need) return '';
    // Water: any of its kinds, by name ("Fishing Rod or Fishing Net").
    if (Array.isArray(need.kinds) && need.kinds.length) {
        const labels = need.kinds.map(toolKindLabel);
        return labels.length < 2 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
    }
    const label = toolKindLabel(need.kind);
    if (!(need.minTier > 1)) return label;
    const best = items?.[toolItemFor(need, items)];
    return best?.name ? `${best.name} or better` : `stronger ${label}`;
}

/**
 * The id of the first tool item that answers a need: the lowest tier that reaches it, then by
 * name. Null when no item does.
 */
export function toolItemFor(need, items = {}) {
    if (!need) return null;
    const kinds = kindsOfNeed(need);
    const best = Object.entries(items || {})
        .map(([id, def]) => ({ id: def?.id || id, name: String(def?.name || ''), tool: toolOf(def) }))
        .filter(c => c.tool && kinds.includes(c.tool.kind) && toolMeets(c.tool, need))
        .sort((a, b) => kinds.indexOf(a.tool.kind) - kinds.indexOf(b.tool.kind)
            || a.tool.tier - b.tool.tier || a.name.localeCompare(b.name))[0];
    return best ? best.id : null;
}

/** The starter tools, by id, in kind order: a new game's Bank holds one of each. */
export function starterToolIds(items = {}) {
    const order = (kind) => TOOL_KINDS.findIndex(k => k.id === kind);
    return Object.entries(items || {})
        .map(([id, def]) => ({ id: def?.id || id, tool: toolOf(def), name: def?.name || '' }))
        .filter(c => c.tool?.starter)
        .sort((a, b) => order(a.tool.kind) - order(b.tool.kind) || a.tool.tier - b.tool.tier || a.name.localeCompare(b.name))
        .map(c => c.id);
}
