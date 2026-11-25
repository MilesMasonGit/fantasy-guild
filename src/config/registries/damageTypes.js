// Fantasy Guild — damage types: the nine types a hit can carry, in three groups
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's type dropdowns, the enemy's resistances and the Rules rows' type picker read the list
// from here. Pure: no imports.

/**
 * Only weapons and ammo give a hit its type: a weapon has one (`damageType` on the item), a ranged
 * shot two (the bow's and the arrow's). Gear and effects only boost or resist a type.
 *
 * Only the nine types carry numbers. A group only names a set of types: the CMS's Set all buttons
 * fill a group's three types at once, and the audits name any line still written on a group, which
 * the game ignores.
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

/** The group a type belongs to; a group is its own. Null for anything else. */
export function groupOf(id) {
    if (GROUP_BY_ID.has(id)) return id;
    return TYPE_BY_ID.get(id)?.group || null;
}

/** The types in a group, in registry order. */
export function typesOfGroup(groupId) {
    return DAMAGE_TYPES.filter(t => t.group === groupId).map(t => t.id);
}

/**
 * The CMS's Set all: a copy of a resistances map with each of a group's three types set to `value`
 * (any line already on one replaced) and any line on the group itself gone.
 */
export function withGroupFilled(map, groupId, value) {
    const next = { ...(map && typeof map === 'object' && !Array.isArray(map) ? map : {}) };
    delete next[groupId];
    for (const id of typesOfGroup(groupId)) next[id] = value;
    return next;
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

/** What an enemy's plain swing hits with: Crush, like a fist. */
export const PLAIN_ENEMY_HIT_TYPE = 'crush';

/**
 * The library's Venom status. ⚠️ Named by id: its ticks hurt as Poison ({@link STATUS_DAMAGE_TYPES}),
 * so the content's Venom must be `effect_venom`, the id the CMS gives an effect named Venom.
 */
export const VENOM_EFFECT_ID = 'effect_venom';

/** The damage type a status's ticks hurt in, by library effect id (`DealDamage`). A status not listed is untyped. */
export const STATUS_DAMAGE_TYPES = Object.freeze({ [VENOM_EFFECT_ID]: 'poison' });

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
 * The steps an enemy's resistance may take (owner): resist 25, 50 or 100 %, weak 25 or 50 %, and
 * weak 100 % so a line can undo a kind's resistance and more (the Crab's Crush −100 on top of
 * Armoured's 50 is weak 50 %). Stored signed, a weakness negative: `resistances: { slash: 50, crush: -50 }`.
 */
export const RESISTANCE_STEPS = Object.freeze([100, 50, 25, -25, -50, -100]);

export const isResistanceStep = (n) => RESISTANCE_STEPS.includes(n);

/**
 * An enemy's resistances as the engine reads them: known types only, each at an allowed step.
 * Anything else, a group's line included, is dropped (the content audits name it).
 * @returns {Object<string, number>}
 */
export function normaliseResistances(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, value] of Object.entries(raw)) {
        const n = Number(value);
        if (isDamageTypeId(id) && isResistanceStep(n)) out[id] = n;
    }
    return out;
}

/** How much an enemy's own lines resist a hit of type `id`, in signed percent: that type's line alone. */
export function resistanceFor(resistances, id) {
    if (!resistances || !isDamageTypeId(id)) return 0;
    return Number(resistances[id]) || 0;
}

/**
 * What the audits say after naming a line written on a group (which the game ignores): "on the
 * Physical group, which carries no number — …". A rule names one type, so it splits into three
 * rules; a resistances block has a Set all button.
 */
export function groupLineAdvice(groupId, { rule = false } = {}) {
    const label = damageTypeLabel(groupId);
    const types = typesOfGroup(groupId).map(damageTypeLabel).join(', ');
    const how = rule ? `one rule each for ${types}` : `${types} in the CMS (Set all ${label})`;
    return `on the ${label} group, which carries no number — it is ignored. Split it into ${how}`;
}

/**
 * Each problem with an authored resistances block, as a sentence for the audits (what is wrong and
 * what to do), or none.
 * @returns {string[]}
 */
export function resistanceProblems(raw) {
    if (raw == null) return [];
    const again = ' — that line is ignored. Pick it again in the CMS';
    if (typeof raw !== 'object' || Array.isArray(raw)) return [`its resistances are not a list of types${again}`];
    const out = [];
    for (const [id, value] of Object.entries(raw)) {
        if (isDamageGroupId(id)) out.push(`its ${damageTypeLabel(id)} ${value} resistance is ${groupLineAdvice(id)}`);
        else if (!isDamageTypeId(id)) out.push(`a resistance names "${id}", which is not a damage type${again}`);
        else if (!isResistanceStep(Number(value))) out.push(`its ${damageTypeLabel(id)} resistance is ${value}, not one of the steps (resist 25, 50 or 100; weak 25, 50 or 100)${again}`);
    }
    return out;
}
