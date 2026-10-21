// Fantasy Guild — gathering tools: the kinds, an item's tool, a Token's need, hands
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Tool field, the Token editor's Needs tool field and the audit read the kinds from here.
// Pure: no imports, so both sides can load it.

/**
 * A gathering tool is an item a hero carries in one hand: `tool: { kind, tier, starter? }` on the
 * item. A gathering Token names the kind it needs and the lowest tier that will do:
 * `needsTool: { kind, minTier }`. Only a hero holding a tool of that kind, at that tier or above,
 * may work it. Tools gate only: they add no speed or yield.
 *
 * Adding a kind is one row here: the editors offer it and the audit accepts it.
 */
export const TOOL_KINDS = Object.freeze([
    Object.freeze({ id: 'pickaxe', label: 'Pickaxe' }),
    Object.freeze({ id: 'woodaxe', label: 'Woodaxe' }),
    Object.freeze({ id: 'fishing_rod', label: 'Fishing Rod' }),
    Object.freeze({ id: 'sickle', label: 'Sickle' })
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

/** A Token type's tool need as `{ kind, minTier }`, or null when its work needs no tool. */
export function neededToolOf(def) {
    const block = def?.needsTool;
    if (!block || typeof block !== 'object' || !isToolKind(block.kind)) return null;
    return { kind: block.kind, minTier: tierValue(block.minTier) };
}

/** Whether a tool (from {@link toolOf}) answers a need (from {@link neededToolOf}). */
export function toolMeets(tool, need) {
    if (!need) return true;
    return !!tool && tool.kind === need.kind && tool.tier >= need.minTier;
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
    const best = Object.entries(items || {})
        .map(([id, def]) => ({ id: def?.id || id, name: String(def?.name || ''), tool: toolOf(def) }))
        .filter(c => c.tool && c.tool.kind === need.kind && c.tool.tier >= need.minTier)
        .sort((a, b) => a.tool.tier - b.tool.tier || a.name.localeCompare(b.name))[0];
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
