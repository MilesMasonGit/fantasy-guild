// map and modifier items: the authored Cartography block, and the recipe the generation engine reads

import { ITEM_TYPES } from '../../config/registries/itemRegistry.js';
import { tokenName } from '../../config/registries/tokenRegistry.js';
import { budget, describe } from './Budget.js';

/**
 * Maps and Modifiers are items. The owner authors them in the CMS's Map editor, which writes each
 * one into the item collection (one record, no copy), so a map is banked, dropped, paid by a
 * bounty and shown in the Bank like any item. What makes it a map is its type and its
 * `cartography` block:
 *
 *     Base Map (type 'map'):
 *       cartography: { biome: 'forest', points: 40,
 *                      nodes: [{ typeId, weight }], camps: [{ typeId, count }],
 *                      treasures: [{ typeId, count }], terrain?: 'grass', water?: 0,
 *                      upcycle?: { itemId, ratio }, bountyWeight?: 1 }
 *
 *     Modifier (type 'modifier'):
 *       cartography: { effects: [{ kind: 'density' | 'replace' | 'threat' | 'treasure', ... }],
 *                      upcycle?: { itemId, ratio }, bountyWeight?: 1 }
 *
 * {@link recipeOf} turns one into the recipe shape `Budget.js` documents. `upcycle` (trade N of
 * this map for one of another) and `bountyWeight` are not part of the recipe.
 *
 * ⚠️ The CMS imports this file (the Map editor's preview and its audit read a map through it, as
 * the game's boot audit does), so it must stay free of game state: no board, no Bank.
 */

/** The item types that are maps. */
export const MAP_ITEM_TYPES = Object.freeze([ITEM_TYPES.MAP, ITEM_TYPES.MODIFIER]);

/** The modifier effects the engine reads (`Budget.js`, rules 2–4). */
export const MODIFIER_EFFECT_KINDS = Object.freeze({
    DENSITY: 'density',
    REPLACE: 'replace',
    THREAT: 'threat',
    TREASURE: 'treasure'
});

const KNOWN_EFFECTS = new Set(Object.values(MODIFIER_EFFECT_KINDS));

/** Player- and author-facing words, kept together for translation. */
export const MAP_TEXT = Object.freeze({
    typeLabel: Object.freeze({ [ITEM_TYPES.MAP]: 'Base Map', [ITEM_TYPES.MODIFIER]: 'Map Modifier' }),
    whatItWrites: 'What it writes',
    modifierHeadline: 'Changes what the Base Maps beside it write',
    density: (points, name) => `+${points} × ${name}`,
    replace: (share, from, to) => (share >= 1 ? `${from} → ${to}` : `${Math.round(share * 100)}% of ${from} → ${to}`),
    threat: (count, name) => `+${count} × ${name} (enemy camp)`,
    treasure: (count, name) => `+${count} × ${name} (treasure)`,
    writesNoNodes: 'writes no Tokens: give it points and at least one node, or a camp or a treasure',
    changesNothing: 'changes nothing: give it at least one effect that names its Tokens',
    unknownEffect: (kind) => `has an effect of a kind the game does not read ("${kind}"), so that effect does nothing`,
    missingToken: (where, typeId) => `${where} names the Token "${typeId}", which does not exist`,
    upcycleNotAMap: (itemId) => `trades up into "${itemId}", which is not a map`
});

/** Where a Token reference sits, in the audit's words. */
const REF_ROLE = Object.freeze({
    node: 'One of its nodes',
    camp: 'One of its camps',
    treasure: 'One of its treasures',
    density: 'Its "more of" effect',
    replaceFrom: 'Its "instead" effect (what it replaces)',
    replaceTo: 'Its "instead" effect (what it becomes)',
    threat: 'Its enemy camp effect',
    treasureEffect: 'Its treasure effect'
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const listOf = (v) => (Array.isArray(v) ? v.filter(isObject) : []);
const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);

export function isMapItem(def) {
    return isObject(def) && MAP_ITEM_TYPES.includes(def.type);
}

export function isBaseMap(def) {
    return isObject(def) && def.type === ITEM_TYPES.MAP;
}

export function isModifier(def) {
    return isObject(def) && def.type === ITEM_TYPES.MODIFIER;
}

/** The Cartography block, or an empty one. */
function cartographyOf(def) {
    return isObject(def?.cartography) ? def.cartography : {};
}

/** A new item's Cartography block, for the CMS. */
export function blankCartography(type) {
    if (type === ITEM_TYPES.MODIFIER) return { effects: [] };
    return { biome: '', points: 40, nodes: [], camps: [], treasures: [] };
}

/** `[{ typeId, <amount> }]` rows that name a Token, copied. */
function rows(list, amount) {
    return listOf(list)
        .filter(row => typeof row.typeId === 'string' && row.typeId)
        .map(row => ({ typeId: row.typeId, [amount]: row[amount] }));
}

/**
 * The generation engine's recipe for a map item, or null for any other item. Never shares an
 * object with the item, and never throws on a malformed block.
 */
export function recipeOf(def) {
    if (!isMapItem(def)) return null;
    const c = cartographyOf(def);

    if (isModifier(def)) {
        return {
            id: def.id,
            kind: 'modifier',
            effects: listOf(c.effects).map(effect => ({ ...effect }))
        };
    }

    const recipe = {
        id: def.id,
        kind: 'base',
        biome: (typeof c.biome === 'string' && c.biome) || null,
        points: finite(c.points, 0),
        nodes: rows(c.nodes, 'weight')
    };
    const camps = rows(c.camps, 'count');
    const treasures = rows(c.treasures, 'count');
    if (camps.length) recipe.camps = camps;
    if (treasures.length) recipe.treasures = treasures;
    if (typeof c.terrain === 'string' && c.terrain) recipe.terrain = c.terrain;
    if (Number.isFinite(c.water)) recipe.water = c.water;
    return recipe;
}

/** Every Token a map item names: `[{ typeId, role }]`, in authoring order. */
export function tokenRefsOf(def) {
    if (!isMapItem(def)) return [];
    const c = cartographyOf(def);
    const refs = [];
    const add = (typeId, role) => {
        if (typeof typeId === 'string' && typeId) refs.push({ typeId, role });
    };

    if (isModifier(def)) {
        for (const effect of listOf(c.effects)) {
            switch (effect.kind) {
                case MODIFIER_EFFECT_KINDS.DENSITY: add(effect.typeId, REF_ROLE.density); break;
                case MODIFIER_EFFECT_KINDS.REPLACE:
                    add(effect.from, REF_ROLE.replaceFrom);
                    add(effect.to, REF_ROLE.replaceTo);
                    break;
                case MODIFIER_EFFECT_KINDS.THREAT: add(effect.typeId, REF_ROLE.threat); break;
                case MODIFIER_EFFECT_KINDS.TREASURE: add(effect.typeId, REF_ROLE.treasureEffect); break;
                default: break;
            }
        }
        return refs;
    }

    for (const row of listOf(c.nodes)) add(row.typeId, REF_ROLE.node);
    for (const row of listOf(c.camps)) add(row.typeId, REF_ROLE.camp);
    for (const row of listOf(c.treasures)) add(row.typeId, REF_ROLE.treasure);
    return refs;
}

/** Whether a modifier effect is complete enough to change a budget. */
function isUsableEffect(effect) {
    switch (effect?.kind) {
        case MODIFIER_EFFECT_KINDS.DENSITY: return !!effect.typeId && finite(effect.points, 0) > 0;
        case MODIFIER_EFFECT_KINDS.REPLACE: return !!effect.from && !!effect.to && effect.from !== effect.to;
        case MODIFIER_EFFECT_KINDS.THREAT:
        case MODIFIER_EFFECT_KINDS.TREASURE: return !!effect.typeId;
        default: return false;
    }
}

/** A cap no map reaches, for asking whether a map writes anything at all. */
const NO_CAP = Number.MAX_SAFE_INTEGER;

/**
 * What the content audits say about one map item, as sentences: a Token it names that does not
 * exist, a Base Map that writes no Tokens, a Modifier that changes nothing or carries an effect the
 * engine does not read, an upcycle into something that is not a map. Shared by the boot audit
 * (`ContentAudit.js`) and the CMS's Economy Audit, so both say the same thing.
 *
 * @param {object} def  the item
 * @param {{tokenExists: (typeId: string) => boolean, itemOf?: (itemId: string) => object|null}} lookups
 * @returns {string[]}
 */
export function mapItemFindings(def, { tokenExists, itemOf = null } = {}) {
    if (!isMapItem(def)) return [];
    const out = [];

    for (const { typeId, role } of tokenRefsOf(def)) {
        if (tokenExists && !tokenExists(typeId)) out.push(MAP_TEXT.missingToken(role, typeId));
    }

    if (isModifier(def)) {
        const effects = listOf(cartographyOf(def).effects);
        for (const effect of effects) {
            if (!KNOWN_EFFECTS.has(effect.kind)) out.push(MAP_TEXT.unknownEffect(effect.kind));
        }
        if (!effects.some(isUsableEffect)) out.push(MAP_TEXT.changesNothing);
    } else if (budget([recipeOf(def)], { cap: NO_CAP }).total === 0) {
        out.push(MAP_TEXT.writesNoNodes);
    }

    const upcycle = upcycleOf(def);
    if (upcycle && itemOf && !isMapItem(itemOf(upcycle.itemId))) out.push(MAP_TEXT.upcycleNotAMap(upcycle.itemId));

    return out;
}

/** One modifier effect in words, or null for one that does nothing. */
function effectLine(effect, nameOf) {
    if (!isUsableEffect(effect)) return null;
    const name = (id) => nameOf(id) || id;
    switch (effect.kind) {
        case MODIFIER_EFFECT_KINDS.DENSITY: {
            const points = Math.round(effect.points);
            return { role: effect.kind, typeId: effect.typeId, count: points, text: MAP_TEXT.density(points, name(effect.typeId)) };
        }
        case MODIFIER_EFFECT_KINDS.REPLACE: {
            const share = Math.min(1, finite(effect.share, 1) > 0 ? finite(effect.share, 1) : 1);
            return { role: effect.kind, typeId: effect.to, count: 0, text: MAP_TEXT.replace(share, name(effect.from), name(effect.to)) };
        }
        default: {
            const count = Math.max(1, Math.floor(finite(effect.count, 1)));
            const say = effect.kind === MODIFIER_EFFECT_KINDS.THREAT ? MAP_TEXT.threat : MAP_TEXT.treasure;
            return { role: effect.kind, typeId: effect.typeId, count, text: say(count, name(effect.typeId)) };
        }
    }
}

/**
 * "What it writes", for a map item's inspection: a Base Map's node summary under the Token cap
 * (`Budget.describe`), or a Modifier's effects one per line. Null for any other item.
 *
 * @param {object} def  the item
 * @param {{cap: number, nameOf?: (typeId: string) => string}} options  the Token cap in force, and
 *   Token names (the registry's by default)
 * @returns {{headline: string, lines: {role: string, typeId: string, count: number, text: string}[], text: string}|null}
 */
export function whatItWrites(def, { cap, nameOf = tokenName } = {}) {
    if (!isMapItem(def)) return null;
    if (isBaseMap(def)) return describe(budget([recipeOf(def)], { cap }), { nameOf });

    const lines = listOf(cartographyOf(def).effects)
        .map(effect => effectLine(effect, nameOf))
        .filter(Boolean);
    const headline = MAP_TEXT.modifierHeadline;
    return { headline, lines, text: [headline, ...lines.map(l => l.text)].join('\n') };
}

/** The upcycle trade a map offers (the Cartography screen trades in a later slice): `{ itemId, ratio }`, or null. */
export function upcycleOf(def) {
    if (!isMapItem(def)) return null;
    const upcycle = cartographyOf(def).upcycle;
    if (!isObject(upcycle) || typeof upcycle.itemId !== 'string' || !upcycle.itemId) return null;
    const ratio = finite(upcycle.ratio, 0);
    return ratio > 0 ? { itemId: upcycle.itemId, ratio } : null;
}

/** How often a bounty pays this map, relative to the others: 1 unless the map says, 0 for any other item. */
export function bountyWeightOf(def) {
    if (!isMapItem(def)) return 0;
    return Math.max(0, finite(cartographyOf(def).bountyWeight, 1));
}
