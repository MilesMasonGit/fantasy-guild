// Fantasy Guild — damage types: the nine types a hit can carry, in three groups
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's type dropdowns, the enemy's resistances and the Rules rows' type picker read the list
// from here. Pure: no imports.

/**
 * Only weapons and ammo give a hit its type: a weapon has one (`damageType` on the item), a ranged
 * shot two (the bow's and the arrow's). Gear and effects only boost or resist a type or a whole
 * group (`concept_combat_v2.md`).
 */

/** @type {ReadonlyArray<{id: string, label: string}>} */
export const DAMAGE_GROUPS = Object.freeze([
    Object.freeze({ id: 'physical', label: 'Physical' }),
    Object.freeze({ id: 'elemental', label: 'Elemental' }),
    Object.freeze({ id: 'special', label: 'Special' })
]);

/** @type {ReadonlyArray<{id: string, label: string, group: string}>} */
export const DAMAGE_TYPES = Object.freeze([
    Object.freeze({ id: 'slash', label: 'Slash', group: 'physical' }),
    Object.freeze({ id: 'crush', label: 'Crush', group: 'physical' }),
    Object.freeze({ id: 'stab', label: 'Stab', group: 'physical' }),
    Object.freeze({ id: 'fire', label: 'Fire', group: 'elemental' }),
    Object.freeze({ id: 'ice', label: 'Ice', group: 'elemental' }),
    Object.freeze({ id: 'electric', label: 'Electric', group: 'elemental' }),
    Object.freeze({ id: 'poison', label: 'Poison', group: 'special' }),
    Object.freeze({ id: 'light', label: 'Light', group: 'special' }),
    Object.freeze({ id: 'dark', label: 'Dark', group: 'special' })
]);

const TYPE_BY_ID = new Map(DAMAGE_TYPES.map(t => [t.id, t]));
const GROUP_BY_ID = new Map(DAMAGE_GROUPS.map(g => [g.id, g]));

export const isDamageTypeId = (id) => TYPE_BY_ID.has(id);
export const isDamageGroupId = (id) => GROUP_BY_ID.has(id);
/** A type or a group: what a resistance, a weakness or a Type Damage / Resistance row may name. */
export const isTypeOrGroupId = (id) => TYPE_BY_ID.has(id) || GROUP_BY_ID.has(id);

/** The group a type belongs to; a group is its own. Null for anything else. */
export function groupOf(id) {
    if (GROUP_BY_ID.has(id)) return id;
    return TYPE_BY_ID.get(id)?.group || null;
}

/** The types in a group, in registry order. */
export function typesOfGroup(groupId) {
    return DAMAGE_TYPES.filter(t => t.group === groupId).map(t => t.id);
}

/** A type's or a group's English name (the CMS's; the game's own words are in `en.json`). */
export function damageTypeLabel(id) {
    return TYPE_BY_ID.get(id)?.label || GROUP_BY_ID.get(id)?.label || String(id ?? '');
}

/**
 * The type an untyped weapon hits with, by the style it fights in, so content authored before
 * damage types keeps fighting as it did: swords were the melee weapon, a bow's shot was an arrow, a
 * dagger stabs. Magic takes Fire, the first Elemental type.
 */
export const DEFAULT_DAMAGE_TYPE_BY_STYLE = Object.freeze({
    melee: 'slash',
    ranged: 'stab',
    magic: 'fire',
    stealth: 'stab'
});

/** A fist. */
export const BAREHANDED_DAMAGE_TYPE = 'crush';

/** An arrow authored with no type. */
export const DEFAULT_ARROW_DAMAGE_TYPE = 'stab';

/**
 * What an enemy's plain swing hits with: the Physical group as a whole, so a hero's Physical
 * resistance takes from it and a resistance to one Physical type does not.
 */
export const PLAIN_ENEMY_HIT_TYPE = 'physical';

/**
 * The type a weapon hits with: the `damageType` it names, else its style's default
 * ({@link DEFAULT_DAMAGE_TYPE_BY_STYLE}).
 * @param {object} item a weapon
 * @param {string} style the style it fights in
 */
export function weaponDamageTypeOf(item, style) {
    if (isDamageTypeId(item?.damageType)) return item.damageType;
    return DEFAULT_DAMAGE_TYPE_BY_STYLE[style] || BAREHANDED_DAMAGE_TYPE;
}

/**
 * An arrow's part of a shot, or null when the item is not an arrow: `arrow: { damage, damageType }`
 * on a Consumable. Its damage is a number ≥ 0 (anything else reads 0); an unknown or missing type
 * reads as {@link DEFAULT_ARROW_DAMAGE_TYPE}.
 * @returns {{damage: number, damageType: string}|null}
 */
export function arrowOf(item) {
    const block = item?.arrow;
    if (!block || typeof block !== 'object') return null;
    const n = Number(block.damage);
    return {
        damage: Number.isFinite(n) && n > 0 ? n : 0,
        damageType: isDamageTypeId(block.damageType) ? block.damageType : DEFAULT_ARROW_DAMAGE_TYPE
    };
}

// --- Enemy resistances and weaknesses --------------------------------------------------------

/**
 * The steps an enemy's resistance may take (owner): resist 25, 50 or 100 %, weak 25 or 50 %. Stored
 * signed, a weakness negative: `resistances: { physical: 50, crush: -50 }`.
 */
export const RESISTANCE_STEPS = Object.freeze([100, 50, 25, -25, -50]);

export const isResistanceStep = (n) => RESISTANCE_STEPS.includes(n);

/**
 * An enemy's resistances as the engine reads them: known types and groups only, each at an
 * allowed step. Anything else is dropped (the content audits name it).
 * @returns {Object<string, number>}
 */
export function normaliseResistances(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, value] of Object.entries(raw)) {
        const n = Number(value);
        if (isTypeOrGroupId(id) && isResistanceStep(n)) out[id] = n;
    }
    return out;
}

/**
 * How much an enemy resists a hit of type (or group) `id`, in signed percent: a line naming the type
 * replaces its group's (owner: "Physical resist 50 %, Crush weak 50 %" reads as written). A hit
 * typed only by its group (an enemy's plain swing) meets the group's line alone.
 */
export function resistanceFor(resistances, id) {
    if (!resistances) return 0;
    if (isDamageGroupId(id)) return resistances[id] ?? 0;
    if (resistances[id] != null) return resistances[id];
    const group = TYPE_BY_ID.get(id)?.group;
    return (group && resistances[group]) ?? 0;
}

/**
 * One problem with an authored resistances block, as a sentence for the audits, or none.
 * @returns {string[]}
 */
export function resistanceProblems(raw) {
    if (raw == null) return [];
    if (typeof raw !== 'object' || Array.isArray(raw)) return ['its resistances are not a list of types'];
    const out = [];
    for (const [id, value] of Object.entries(raw)) {
        if (!isTypeOrGroupId(id)) out.push(`a resistance names "${id}", which is not a damage type or group`);
        else if (!isResistanceStep(Number(value))) out.push(`its ${damageTypeLabel(id)} resistance is ${value}, not one of the steps (resist 25, 50 or 100; weak 25 or 50)`);
    }
    return out;
}
