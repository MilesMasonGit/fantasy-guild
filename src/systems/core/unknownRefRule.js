// Content that names a skill, a job or a damage type the game does not have, or a rule, style or number it no longer reads; an enemy's malformed moves.

import { isSkillId, COMBAT_SKILL_IDS, getSkill } from '../../config/registries/skillRegistry.js';
import { MAX_ENEMY_KINDS } from '../../config/registries/enemyKinds.js';
import { isWeapon, authoredWeaponStyles, weaponStyleOf, weaponMoteOf } from '../../config/registries/weaponStyles.js';
import { getPaletteEntry, isCombatStyleScope } from '../../config/registries/modifierPalette.js';
import { isDamageTypeId, isDamageGroupId, groupLineAdvice, resistanceProblems } from '../../config/registries/damageTypes.js';
import { RETIRED_ENEMY_FIELDS } from '../../config/registries/enemyProfile.js';
import { moveProblems } from '../../config/registries/enemyMoves.js';
import { statusBlockOf } from '../effects/effectLibrary.js';
import { isConsumableCategory } from '../../config/registries/equipmentCategories.js';
import { isCarriedKind } from '../../config/registries/carriedKinds.js';
import { statementsOf, stationSkillOf, KEYWORD } from '../effects/statements.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';

/**
 * The one rule behind "this names a skill or job that does not exist", shared
 * by the game's boot audit (`ContentAudit`) and the CMS Economy Audit
 * (`connectivityAuditor`), so the two name the same things in the same words.
 *
 * A renamed or dropped skill (Logging, Explore) or job loads silently: the
 * registries return null and every reader survives it, so the content just
 * stops doing anything. This makes it visible.
 *
 * ⚠️ **It only reports.** Nothing here changes how the game runs. A blank
 * field is "not set", never a finding.
 *
 * ## Input
 * A pure function over `{ tokens, items, recipes }` (keyed by id, or lists).
 * Tokens must be **expanded** (effect references resolved into statements):
 * a Promotes rule or a station's `Works as` lives in the effect library.
 *
 * ## Output
 * `[{ entityType, entityId, entityName, field, message }]`, `entityType` being
 * `'Effect'`, `'Token'`, `'Item'` or `'Recipe'`, and `message` a sentence that
 * does not repeat the entity's name.
 */

/** Shop entries without a skill section fall under this one (`Shop.GENERAL_SECTION`). */
const GENERAL_SHOP_SECTION = 'general';

const hasValue = (v) => typeof v === 'string' && v.trim() !== '';
const asList = (collection) => (Array.isArray(collection) ? collection : Object.values(collection || {}));

/** A rule's narrowing may also name the combat parent or "all", which match more than one skill. */
function isScopeCategory(category) {
    return isSkillId(category) || category === TARGET_CATEGORIES.COMBAT || category === TARGET_CATEGORIES.ALL;
}

/**
 * Findings for one bearer's statements (a Token or an item). `isItemId` answers whether an item
 * exists, or is null when the caller gave no items (an item narrowing is then not checked).
 */
function statementFindings(def, push, isItemId = null) {
    for (const statement of statementsOf(def)) {
        const payload = statement?.payload || {};
        if (statement?.keyword === KEYWORD.PROMOTES) {
            const job = hasValue(payload.jobId) ? ` to "${payload.jobId}"` : '';
            push('statements', `one of its rules promotes the hero${job}: jobs are retired (every hero holds every skill), so it does nothing. Delete the rule in the CMS, or the Token if it has no other use.`);
        }
        const vocabulary = hasValue(payload.category) ? getPaletteEntry(payload.type)?.categories : null;
        if (vocabulary === 'skill' && !isScopeCategory(payload.category)) {
            push('statements', `one of its rules is narrowed to the skill "${payload.category}", which does not exist — the rule matches nothing. Pick the skill again in the CMS.`);
        }
        if (vocabulary === 'combatStyle' && !isCombatStyleScope(payload.category)) {
            push('statements', `one of its rules is narrowed to "${payload.category}", which is no combat style — the rule helps no fighter. Pick Melee, Ranged, Magic or Stealth, or no style, in the CMS.`);
        }
        if (vocabulary === 'skillOrCarried' && isItemId && !isScopeCategory(payload.category)
            && !isCarriedKind(payload.category) && !isItemId(payload.category)) {
            push('statements', `one of its rules is narrowed to "${payload.category}", which is no skill, kind of carried thing or item — the rule matches nothing. Pick it again in the CMS.`);
        }
    }
}

/**
 * Findings for a library effect's rows: a number the game has no row for (flat Armor, Resistance and
 * Pierce, gone with damage types), or a Type row aimed at a type that does not exist. Read off the library, not each bearer, so an effect carried by six
 * pieces of armour is named once.
 */
function effectRowFindings(entry, push) {
    for (const statement of statementsOf(entry)) {
        const payload = statement?.payload || {};
        const provides = statement?.keyword === KEYWORD.PROVIDES;
        const row = provides ? getPaletteEntry(payload.type) : null;
        if (provides && hasValue(payload.type) && !row) {
            push('statements', `provides "${payload.type}", which the game does not have: it does nothing. Delete the rule in the CMS.`);
        }
        if (row?.categories === 'damageType' && hasValue(payload.category) && !isDamageTypeId(payload.category)) {
            if (isDamageGroupId(payload.category)) {
                push('statements', `provides ${row.label} ${groupLineAdvice(payload.category, { rule: true })} in the CMS.`);
            } else {
                push('statements', `has a rule aimed at the damage type "${payload.category}", which does not exist — the rule matches nothing. Pick the type again in the CMS.`);
            }
        }
    }
}

/** Findings for an enemy's resistances, and numbers it carries that the fight no longer reads. */
function enemyResistanceFindings(def, push) {
    if (!def?.enemy || typeof def.enemy !== 'object') return;
    for (const problem of resistanceProblems(def.enemy.resistances)) {
        push('enemy.resistances', `${problem}.`);
    }
    for (const field of RETIRED_ENEMY_FIELDS) {
        const value = def.enemy[field];
        if (value != null && value !== '') {
            const what = field === 'armor' ? 'Armour' : 'Pierce';
            push(`enemy.${field}`, `has ${what} ${value}, retired with damage types: the fight ignores it. Give it Slash, Crush and Stab resistances instead, or remove the number in the CMS.`);
        }
    }
}

/**
 * Findings for an enemy's moves (`enemyMoves.js`): one that is not a move, has no name, hits with an
 * unknown type, does nothing, lands an effect the library does not hold, or aims or lasts in a way
 * the fight cannot read. Effects are checked only when the library is given.
 */
function enemyMoveFindings(def, push, library) {
    if (!def?.enemy || typeof def.enemy !== 'object') return;
    for (const problem of moveProblems(def.enemy.moves, library)) push('enemy.moves', `${problem}.`);
}

/** Findings for a weapon's damage type and an arrow's block. */
function damageTypeFindings(def, push) {
    if (hasValue(def.damageType) && !isDamageTypeId(def.damageType)) {
        push('damageType', `hits with the damage type "${def.damageType}", which does not exist — it hits with its style's default. Pick its type again in the CMS.`);
    } else if (hasValue(def.damageType) && !isWeapon(def)) {
        push('damageType', 'names a damage type but is not a weapon — only weapons and arrows give a hit its type, so it is ignored.');
    }
    const arrow = def.arrow;
    if (arrow == null) return;
    if (typeof arrow !== 'object' || Array.isArray(arrow)) {
        push('arrow', 'has an arrow block that is not one — it is not an arrow. Tick Arrow again in the CMS.');
        return;
    }
    if (!isConsumableCategory(def.equipSlot)) {
        push('arrow', 'is an arrow but not a Consumable, so no hero can carry it to shoot. Make it a Consumable in the CMS.');
    }
    if (hasValue(arrow.damageType) && !isDamageTypeId(arrow.damageType)) {
        push('arrow', `is an arrow of the damage type "${arrow.damageType}", which does not exist — it shoots as Stab. Pick its type again in the CMS.`);
    }
    const n = Number(arrow.damage);
    if (!(Number.isFinite(n) && n > 0)) {
        push('arrow', 'is an arrow with no damage of its own — it adds nothing to a shot. Give it a damage in the CMS.');
    }
}

/**
 * Findings for what a weapon spends: a Magic weapon naming no Mote (it casts free) or one that is no
 * Consumable item, a Mote on a weapon that is not Magic, and a thrown flag on anything but a Stealth
 * weapon. `itemOf` looks an item up when the caller gave items; without, the Mote is taken on trust.
 */
function ammoFindings(def, push, itemOf) {
    if (!isWeapon(def)) {
        if (def.thrown === true) push('thrown', 'is marked thrown but is not a weapon — only a Stealth weapon (a Kunai) spends itself, so it is ignored.');
        return;
    }
    const style = weaponStyleOf(def);
    if (style === 'magic') {
        const mote = weaponMoteOf(def);
        if (!mote) {
            push('mote', 'is a Magic weapon naming no Mote — it casts free, at full damage. Pick the Mote it burns in the CMS.');
        } else if (itemOf) {
            const item = itemOf(mote);
            if (!item) push('mote', `burns the Mote "${mote}", which is no item — it casts at half damage for want of it. Pick its Mote again in the CMS.`);
            else if (!isConsumableCategory(item.equipSlot)) push('mote', `burns ${item.name || mote}, which is not a Consumable — no hero can carry it, so it casts at half damage. Make it a Consumable in the CMS.`);
        }
    } else if (hasValue(def.mote)) {
        push('mote', `names a Mote but fights as ${getSkill(style)?.name || style} — only a Magic weapon burns one, so it is ignored.`);
    }
    if (def.thrown === true && style !== 'stealth') {
        push('thrown', `is marked thrown but fights as ${getSkill(style)?.name || style} — only a Stealth weapon (a Kunai) spends itself, so it is ignored.`);
    }
}

/** The kind that landed Venom on every hit, before a poisoning move carried Venom itself. */
const RETIRED_VENOMOUS_KIND = 'venomous';

/**
 * Findings for an enemy's kinds: one that is no library effect, or more than two. Effects are looked
 * up only when the library is given; without it a kind is taken on trust.
 */
function enemyKindFindings(def, push, effectById) {
    const kinds = Array.isArray(def?.enemy?.kinds) ? def.enemy.kinds : [];
    const known = [];
    for (const id of kinds) {
        if (id === RETIRED_VENOMOUS_KIND) {
            push('enemy.kinds', `has the enemy kind "${id}", which is retired — it lands nothing. Give the moves that poison the Venom effect instead, and untick it in the CMS.`);
            continue;
        }
        if (typeof id === 'string' && id && (!effectById || effectById.has(id))) {
            known.push(id);
            continue;
        }
        push('enemy.kinds', `has the enemy kind "${id}", which is no effect in the library — it changes nothing. Pick its kinds again in the CMS.`);
    }
    if (known.length > MAX_ENEMY_KINDS) {
        push('enemy.kinds', `has ${known.length} enemy kinds; an enemy carries at most ${MAX_ENEMY_KINDS}, so only the first ${MAX_ENEMY_KINDS} count.`);
    }
}

/**
 * Every skill and job reference in the content that does not resolve.
 *
 * @param {{ tokens?: object, items?: object, recipes?: object, effects?: object }} content
 * @returns {Array<{ entityType: string, entityId: string, entityName: string, field: string, message: string }>}
 */
export function findUnknownRefs({ tokens, items, recipes, effects } = {}) {
    const out = [];
    const effectById = !effects ? null : Array.isArray(effects)
        ? new Map(effects.filter(e => e?.id).map(e => [e.id, e]))
        : new Map(Object.entries(effects));
    const library = effectById
        ? { hasEffect: (id) => effectById.has(id), isStatus: (id) => !!statusBlockOf(effectById.get(id)) }
        : {};
    const itemIds = !items ? null : new Set(Array.isArray(items) ? items.map(i => i?.id).filter(Boolean) : Object.keys(items));
    const isItemId = itemIds ? (id) => itemIds.has(id) : null;
    const itemById = !items ? null : new Map(asList(items).filter(i => i?.id).map(i => [i.id, i]));
    const itemOf = itemById ? (id) => itemById.get(id) || null : null;

    for (const entry of asList(effects)) {
        if (!entry || typeof entry !== 'object') continue;
        effectRowFindings(entry, (field, message) => out.push({
            entityType: 'Effect', entityId: entry.id, entityName: entry.name || entry.id, field, message
        }));
    }

    for (const def of asList(tokens)) {
        if (!def || typeof def !== 'object') continue;
        const push = (field, message) => out.push({
            entityType: 'Token', entityId: def.id, entityName: def.name || def.id, field, message
        });

        const skill = def.config?.skill;
        if (hasValue(skill) && !isSkillId(skill)) {
            push('config.skill', `is worked with the skill "${skill}", which does not exist — no hero holds it, so nobody can work it. Pick its skill in the CMS, under Work Cycle → Skill.`);
        }
        const station = stationSkillOf(def);
        if (hasValue(station) && !isSkillId(station)) {
            push('statements', `works as the skill "${station}", which does not exist — no hero holds it, so nobody can work it. Pick the skill again in the CMS.`);
        }
        const section = def.shop?.section;
        if (hasValue(section) && section !== GENERAL_SHOP_SECTION && !isSkillId(section)) {
            push('shop.section', `is sold in the Shop section "${section}", which is neither a skill nor General — the Shop heads it with that raw id. Pick its section again in the CMS.`);
        }
        enemyKindFindings(def, push, effectById);
        enemyResistanceFindings(def, push);
        enemyMoveFindings(def, push, library);
        statementFindings(def, push, isItemId);
    }

    for (const def of asList(items)) {
        if (!def || typeof def !== 'object') continue;
        const push = (field, message) => out.push({
            entityType: 'Item', entityId: def.id, entityName: def.name || def.id, field, message
        });
        const needs = [
            ...(Array.isArray(def.requirements) ? def.requirements.map(r => r?.skill) : []),
            def.skillRequired
        ];
        for (const skill of needs) {
            if (hasValue(skill) && !isSkillId(skill)) {
                push('requirements', `needs the skill "${skill}", which does not exist — no hero can equip it.`);
            }
        }
        for (const style of Array.isArray(def.styles) ? def.styles : []) {
            if (!COMBAT_SKILL_IDS.includes(style)) {
                push('styles', `names the weapon style "${style}", which is not a combat style — it is ignored. Pick its style again in the CMS.`);
            }
        }
        if (isWeapon(def) && authoredWeaponStyles(def).length > 1) {
            const first = getSkill(weaponStyleOf(def))?.name || weaponStyleOf(def);
            push('styles', `names ${authoredWeaponStyles(def).length} styles; a weapon has one, so it fights as ${first} (the first). Pick its one style in the CMS.`);
        }
        damageTypeFindings(def, push);
        ammoFindings(def, push, itemOf);
        statementFindings(def, push, isItemId);
    }

    for (const recipe of asList(recipes)) {
        if (!recipe || typeof recipe !== 'object') continue;
        if (hasValue(recipe.skill) && !isSkillId(recipe.skill)) {
            out.push({
                entityType: 'Recipe', entityId: recipe.id, entityName: recipe.name || recipe.id, field: 'skill',
                message: `belongs to the skill "${recipe.skill}", which does not exist — no station can make it.`
            });
        }
    }

    return out;
}
