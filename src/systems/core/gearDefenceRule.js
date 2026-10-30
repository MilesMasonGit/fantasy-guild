// Gear's defence in the content: a piece's own lines that the game cannot read, and the best stack a hero could wear.

import { DAMAGE_TYPES, DAMAGE_GROUPS, isTypeOrGroupId, groupOf, isDamageGroupId, damageTypeLabel } from '../../config/registries/damageTypes.js';
import { COMBAT_SKILL_IDS, getSkill } from '../../config/registries/skillRegistry.js';
import { getCategoryCap } from '../../config/registries/equipmentCategories.js';
import { isWornGear, gearResistancesOf, isGearResistLine, isDamageCut, GEAR_RESIST_STACK_LIMIT, GEAR_RESIST_LINE_MAX } from '../../config/registries/gearDefence.js';
import { isWeapon, isOffHand } from '../../config/registries/weaponStyles.js';
import { toolOf, handsOf, HAND_CATEGORY } from '../../config/registries/toolKinds.js';
import { effectRefsOf, statementsFromEntry } from '../effects/effectLibrary.js';
import { KEYWORD } from '../effects/statements.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../effects/constants.js';

/**
 * The one rule behind what the audits say about gear's defence (`gearDefence.js`), shared by the
 * boot audit (`ContentAudit`) and the CMS Economy Audit, so both name the same things.
 *
 * ⚠️ Kept free of the registries: the CMS imports it and hands in its own workspace.
 *
 * **The best stack** (owner: no resistance cap, small numbers instead): for each damage type and
 * group, the most a hero could resist wearing the best piece the content has in every place gear
 * goes (a hat, a chest, two trinkets, one weapon and one off-hand item or tool, or a two-handed
 * weapon) plus every milestone perk (a hero at 99 holds them all). A piece counts its own lines and
 * its always-on Type Resistance rules at its scale. Elixirs and statuses last a fight and are left
 * out. Two pieces sharing one effect are counted twice (the loadout caps their scales together), so
 * the sum can only overstate.
 *
 * Output: `[{ entityType, entityId, entityName, field, message }]`, as `unknownRefRule`'s.
 */

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const asList = (collection) => (Array.isArray(collection) ? collection : Object.values(collection || {}));
const hasValue = (v) => v !== undefined && v !== null && v !== '';

/** The weapon fields an off-hand item carries that mean nothing on one. */
const WEAPON_ONLY_FIELDS = Object.freeze(['styles', 'damage', 'damageType', 'speed', 'tier']);

/** Findings for one item's defence fields and its off-hand mark. */
function itemFieldFindings(def, push) {
    const worn = isWornGear(def);
    if (hasValue(def.resistances)) {
        if (!worn) {
            push('resistances', 'has resistances but is not worn gear (a hand item, hat, chest or trinket), so they do nothing. Remove them in the CMS.');
        } else if (!isPlainObject(def.resistances)) {
            push('resistances', 'has resistances that are not a list of types, so they do nothing. Add them again in the CMS.');
        } else {
            for (const [id, value] of Object.entries(def.resistances)) {
                if (!isTypeOrGroupId(id)) {
                    push('resistances', `resists "${id}", which is not a damage type or group — that line is ignored. Pick it again in the CMS.`);
                } else if (!isGearResistLine(value)) {
                    push('resistances', `resists ${damageTypeLabel(id)} ${value}, not a whole number from −${GEAR_RESIST_LINE_MAX} to ${GEAR_RESIST_LINE_MAX} other than 0. Set it again in the CMS.`);
                }
            }
        }
    }
    if (hasValue(def.damageCut)) {
        if (!worn) {
            push('damageCut', 'cuts a style\'s damage but is not worn gear, so the cut does nothing. Remove it in the CMS.');
        } else if (!isPlainObject(def.damageCut)) {
            push('damageCut', 'has a damage cut that is not a list of styles, so it does nothing. Add it again in the CMS.');
        } else {
            for (const [style, value] of Object.entries(def.damageCut)) {
                if (!COMBAT_SKILL_IDS.includes(style)) {
                    push('damageCut', `cuts the damage of "${style}", which is not a combat style — that line is ignored. Pick it again in the CMS.`);
                } else if (!isDamageCut(value)) {
                    push('damageCut', `cuts ${getSkill(style)?.name || style} damage by ${value}, not a whole number from 1 to 100. Set it again in the CMS.`);
                }
            }
        }
    }
    if (def.offHand === true) {
        if (def.equipSlot !== HAND_CATEGORY) {
            push('offHand', 'is marked off-hand but is not held in the hands, so the mark does nothing. Make it a Hand item in the CMS, or clear the mark.');
        } else if (toolOf(def)) {
            push('offHand', 'is a tool and marked off-hand: it works as a tool and the mark does nothing. Clear one in the CMS.');
        } else {
            const stray = WEAPON_ONLY_FIELDS.filter(f => hasValue(def[f]));
            if (def.hands === 2) stray.push('hands');
            if (stray.length) {
                push('offHand', `is an off-hand item, never swung, yet carries weapon numbers (${stray.join(', ')}) — they do nothing. Make it a weapon, or clear them in the CMS.`);
            }
        }
    }
}

/**
 * What one piece resists of `id` (a type, or a group for a hit typed only by its group): its own
 * lines (a group's counting on its types) and its always-on Type Resistance rules at its scale.
 */
function pieceResistance(def, id, effects) {
    let total = 0;
    const lines = gearResistancesOf(def);
    for (const [line, value] of Object.entries(lines)) {
        if (line === id || (!isDamageGroupId(id) && line === groupOf(id))) total += value;
    }
    for (const ref of effectRefsOf(def)) total += rowsResistance(effects?.[ref.effectId], ref, id);
    return total;
}

/** The always-on Type Resistance rules of one library entry, at a reference's scale, on `id`. */
function rowsResistance(entry, ref, id) {
    if (!entry) return 0;
    let total = 0;
    for (const statement of statementsFromEntry(entry, ref)) {
        if (statement?.keyword !== KEYWORD.PROVIDES || statement.when?.event) continue;
        const payload = statement.payload || {};
        if (payload.type !== EFFECT_TYPES.TYPE_RESIST) continue;
        if (payload.bucket && payload.bucket !== 'flat') continue;
        const value = Number(payload.value);
        if (!Number.isFinite(value)) continue;
        const category = payload.category || TARGET_CATEGORIES.ALL;
        const counts = category === TARGET_CATEGORIES.ALL || category === id
            || (!isDamageGroupId(id) && category === groupOf(id));
        if (counts) total += value;
    }
    return total;
}

/** The hand kinds that compete for one place: one weapon, one off-hand item. */
const handKind = (def) => (isWeapon(def) ? 'weapon' : isOffHand(def) ? 'offhand' : 'tool');

/**
 * The best hands for `id`: one item, or two that fit two hands and are not two weapons (only one is
 * swung) or two off-hand items.
 * @returns {Array<{def: object, value: number}>}
 */
function bestHands(candidates) {
    let best = [];
    let bestValue = 0;
    for (let i = 0; i < candidates.length; i++) {
        const a = candidates[i];
        if (a.value > bestValue) { best = [a]; bestValue = a.value; }
        for (let j = i + 1; j < candidates.length; j++) {
            const b = candidates[j];
            if (handsOf(a.def) + handsOf(b.def) > 2) continue;
            const ka = handKind(a.def);
            if (ka !== 'tool' && ka === handKind(b.def)) continue;
            if (a.value + b.value > bestValue) { best = [a, b]; bestValue = a.value + b.value; }
        }
    }
    return best;
}

/**
 * The best stack of worn gear and perks for each damage type and group.
 * @param {{ items?: object, effects?: object, skillPerks?: object }} content
 * @returns {Array<{ id: string, total: number, pieces: Array<{ itemId: string, name: string, value: number }>, perks: number }>}
 */
export function bestResistanceStacks({ items, effects, skillPerks } = {}) {
    const gear = asList(items).filter(def => def && typeof def === 'object' && isWornGear(def));
    const perkRefs = [];
    for (const record of asList(skillPerks)) {
        for (const row of Array.isArray(record?.perks) ? record.perks : []) {
            if (row?.effectId) perkRefs.push({ effectId: row.effectId, scale: row.scale ?? 1 });
        }
    }
    const out = [];
    for (const { id } of [...DAMAGE_GROUPS, ...DAMAGE_TYPES]) {
        const byCategory = new Map();
        const hands = [];
        for (const def of gear) {
            const value = pieceResistance(def, id, effects);
            if (!(value > 0)) continue;
            if (def.equipSlot === HAND_CATEGORY) hands.push({ def, value });
            else {
                if (!byCategory.has(def.equipSlot)) byCategory.set(def.equipSlot, []);
                byCategory.get(def.equipSlot).push({ def, value });
            }
        }
        const pieces = [];
        for (const [category, list] of byCategory) {
            list.sort((a, b) => b.value - a.value);
            pieces.push(...list.slice(0, getCategoryCap(category)));
        }
        pieces.push(...bestHands(hands));
        let perks = 0;
        for (const ref of perkRefs) perks += Math.max(0, rowsResistance(effects?.[ref.effectId], ref, id));
        const total = pieces.reduce((n, p) => n + p.value, 0) + perks;
        out.push({
            id, total, perks,
            pieces: pieces.map(p => ({ itemId: p.def.id, name: p.def.name || p.def.id, value: p.value }))
        });
    }
    return out;
}

/**
 * Every finding about gear's defence: each piece's unreadable lines, then each type or group whose
 * best stack reaches {@link GEAR_RESIST_STACK_LIMIT}.
 * @param {{ items?: object, effects?: object, skillPerks?: object }} content
 */
export function gearDefenceFindings({ items, effects, skillPerks } = {}) {
    const out = [];
    for (const def of asList(items)) {
        if (!def || typeof def !== 'object') continue;
        itemFieldFindings(def, (field, message) => out.push({
            entityType: 'Item', entityId: def.id, entityName: def.name || def.id, field, message
        }));
    }
    for (const stack of bestResistanceStacks({ items, effects, skillPerks })) {
        if (stack.total < GEAR_RESIST_STACK_LIMIT) continue;
        const top = [...stack.pieces].sort((a, b) => b.value - a.value)[0];
        const parts = stack.pieces.map(p => `${p.name} ${p.value}`);
        if (stack.perks) parts.push(`milestone perks ${stack.perks}`);
        out.push({
            entityType: 'Item',
            entityId: top?.itemId ?? null,
            entityName: top?.name ?? '',
            field: 'resistances',
            message: `lets a hero's best stack resist ${damageTypeLabel(stack.id)} ${stack.total}% (${parts.join(', ')}): no hero may reach ${GEAR_RESIST_STACK_LIMIT}% in any type (owner). Lower one of these pieces in the CMS.`
        });
    }
    return out;
}
