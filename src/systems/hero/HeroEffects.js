import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { slotBacked } from '../equipment/heldCopies.js';
import {
    effectRefsOf, statementsFromEntry, normaliseScale, MAX_SCALE
} from '../effects/effectLibrary.js';
import { KEYWORD } from '../effects/statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { isWeapon, meetsGearRequirements, gearRequirements } from '../../config/registries/weaponStyles.js';
import { arrowOf } from '../../config/registries/damageTypes.js';
import { gearResistancesOf, gearDamageCutOf } from '../../config/registries/gearDefence.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getHeroWeaponSlot } from '../../utils/CombatFormulas.js';
import { isSpentCategory, isAlwaysOn } from '../core/consumableRule.js';
import { earnedPerkRefs } from './HeroPerks.js';
import { skillsWithPerks, perkRowsFor } from '../../config/registries/perkRegistry.js';

/**
 * A hero's equipped items are bearers, like a Token: the same grammar and effect
 * library, but a rule reaches the hero and its cost is spent from the item stack.
 *
 * ⚠️ The loadout is ONE bearer, not nine. Two items referencing the same effect
 * apply it once: scales add, capped at MAX_SCALE. Expanding the same entry twice
 * would produce two statements with the same statement id, and per-statement state
 * (an upkeep clock, a cooldown) is keyed by that id, so it would be shared between
 * two rules meant to be separate. A Token naming one entry twice is refused for this
 * reason (`duplicateRefsOf`); a loadout can't refuse, so it merges.
 *
 * ⚠️ The inventory stack is the charge pool. A statement's charge cost is spent as units
 * of the item from the Bank (cost 0 means never consumed). A shared item (food, drink,
 * potions) whose stack is empty contributes nothing but stays in its slot, greyed; a
 * copy the hero holds always contributes (`heldCopies.slotBacked`).
 */

/**
 * The loadout's items that lend the hero anything, in grid order, as `{ slot, itemId, def }`: held
 * (a copy, or a shared item the Bank still has), at the level they ask.
 *
 * ⚠️ Of the weapons in the hands only the one swung lends (`CombatFormulas.getHeroWeaponSlot`): a
 * weapon in the second hand is not swung, and its ability, resistances and cuts stay off whatever
 * its style. The second hand is for an off-hand item, which lends like armour. An arrow lends
 * nothing by being carried: its rules count on the shot that spends it (`board/FightMoments.js`).
 */
function lendingEntries(hero) {
    const out = [];
    const grid = getGrid(hero);
    const swung = getHeroWeaponSlot(hero);
    for (let slot = 0; slot < grid.length; slot++) {
        const itemId = grid[slot];
        if (!itemId || !slotBacked(hero, slot)) continue;
        const def = getItem(itemId);
        if (!def) continue;
        if (!meetsGearRequirements(def, hero)) continue;
        if (isWeapon(def) && slot !== swung) continue;
        if (arrowOf(def)) continue;
        out.push({ slot, itemId, def });
    }
    return out;
}

/**
 * Every effect reference a hero is carrying, merged by effect.
 *
 * `worn` is the same merge over the items that are not spent from the Bank (gear, weapons, tools):
 * the only ones whose always-on rules count (`consumableRule.isSpentCategory`).
 *
 * @returns {Map<string, {scale: number, itemIds: string[], worn: {scale: number, itemIds: string[]}}>}
 */
export function loadoutRefs(hero) {
    const merged = new Map();
    if (!hero) return merged;

    for (const { itemId, def } of lendingEntries(hero)) {
        const worn = !isSpentCategory(def.equipSlot);

        for (const { effectId, scale } of effectRefsOf(def)) {
            let current = merged.get(effectId);
            if (!current) {
                current = { scale: 0, itemIds: [], worn: { scale: 0, itemIds: [] } };
                merged.set(effectId, current);
            }
            // Scales add; the cap stops a build maxing one effect by carrying six of a thing.
            current.scale = current.itemIds.length ? Math.min(MAX_SCALE, current.scale + scale) : normaliseScale(scale);
            current.itemIds.push(itemId);
            if (worn) {
                current.worn.scale = current.worn.itemIds.length
                    ? Math.min(MAX_SCALE, current.worn.scale + scale) : normaliseScale(scale);
                current.worn.itemIds.push(itemId);
            }
        }
    }

    return merged;
}

/**
 * The statements a hero's loadout contributes, already scaled and stamped.
 *
 * Each carries `sourceItemIds` because paying its cost consumes one of those
 * items, and by the time a rule fires which items they were is no longer derivable.
 *
 * ⚠️ An always-on rule (no moment) counts only from worn items. A food, drink or potion acts only
 * through its moment and its dose (`consumableRule.js`): its standing rules would otherwise be a
 * free buff for as long as the Bank held one, never spent. Where gear and a potion share an
 * effect, the always-on rule counts at the gear's own scale, from the gear.
 *
 * The hero's milestone perks ride at the end ({@link perkStatements}), so every reader of what a
 * hero carries (work, fights, moments, the combat numbers) reads them through this one door.
 */
export function loadoutStatements(hero) {
    if (!hero || typeof hero !== 'object') return expandLoadout(hero, null);
    let entry = kept.get(hero);
    if (!entry || !stillStands(entry, hero)) {
        entry = keepLoadout(hero);
        kept.set(hero, entry);
    }
    return entry.statements;
}

/**
 * ⚠️ Kept per hero, not expanded on every read: the work time reads the loadout of every worked
 * Token's hero on every tick, and a catch-up plays a day as 86,400 ticks. A kept answer is handed
 * back only while everything it was built from still reads the same, checked on every call
 * ({@link stillStands}): each slot's item, that item's definition and whether the slot lends
 * (`slotBacked`: a copy held, or a Bank holding one), the levels the perks and the items'
 * requirements read, the perk tables, every library entry expanded, and the villager mark. So it is
 * exactly as fresh as expanding every time, whoever made the change (the equip rules, a level-up, a
 * load, a dev button or a test writing the state straight), and nothing has to remember to say so.
 * The Bank is read as `slotBacked` reads it, for the slots alone, so loot coming in keeps the answer.
 *
 * The answer is shared between callers, so it is frozen: a caller copies before it changes anything.
 */
const kept = new WeakMap();

/** A skill record's level field, as the readers find it (a bare number is its own level). */
function levelField(record) {
    return record !== null && typeof record === 'object' ? record.level : undefined;
}

function keepLoadout(hero) {
    const grid = getGrid(hero);
    const slots = grid.slice();
    const defs = new Array(grid.length).fill(null);
    const backed = new Array(grid.length).fill(false);
    const perkSkills = skillsWithPerks();
    const skillIds = [...perkSkills];
    for (let slot = 0; slot < grid.length; slot++) {
        const itemId = grid[slot];
        if (!itemId) continue;
        defs[slot] = getItem(itemId);
        backed[slot] = slotBacked(hero, slot);
        for (const { skill } of gearRequirements(defs[slot])) {
            if (!skillIds.includes(skill)) skillIds.push(skill);
        }
    }
    const skillRecords = skillIds.map(id => hero.skills?.[id]);

    const library = new Map();
    const statements = expandLoadout(hero, library);
    for (const statement of statements) {
        Object.freeze(statement.sourceItemIds);
        Object.freeze(statement);
    }
    Object.freeze(statements);

    return {
        villager: hero.isVillager,
        slots, defs, backed,
        skillIds, skillRecords, skillLevels: skillRecords.map(levelField),
        perkSkills, perkTables: perkSkills.map(perkRowsFor),
        effectIds: [...library.keys()], effectEntries: [...library.values()],
        statements
    };
}

/** Whether everything a kept loadout was built from still reads the same. */
function stillStands(entry, hero) {
    if (hero.isVillager !== entry.villager) return false;

    const grid = getGrid(hero);
    const { slots, defs, backed } = entry;
    if (grid.length !== slots.length) return false;
    for (let slot = 0; slot < slots.length; slot++) {
        const itemId = grid[slot];
        if (itemId !== slots[slot]) return false;
        if (!itemId) continue;
        if (getItem(itemId) !== defs[slot] || slotBacked(hero, slot) !== backed[slot]) return false;
    }

    const { skillIds, skillRecords, skillLevels } = entry;
    for (let i = 0; i < skillIds.length; i++) {
        const record = hero.skills?.[skillIds[i]];
        if (record !== skillRecords[i] || levelField(record) !== skillLevels[i]) return false;
    }

    const { perkSkills, perkTables } = entry;
    if (skillsWithPerks() !== perkSkills) return false;
    for (let i = 0; i < perkSkills.length; i++) {
        if (perkRowsFor(perkSkills[i]) !== perkTables[i]) return false;
    }

    const { effectIds, effectEntries } = entry;
    for (let i = 0; i < effectIds.length; i++) {
        if (EFFECTS[effectIds[i]] !== effectEntries[i]) return false;
    }
    return true;
}

/** The loadout's statements expanded afresh; `library`, when given, records each entry looked up. */
function expandLoadout(hero, library) {
    const out = [];

    for (const [effectId, { scale, itemIds, worn }] of loadoutRefs(hero)) {
        const entry = EFFECTS[effectId];
        library?.set(effectId, entry);
        if (!entry) continue;                       // ContentAudit reports it by name
        const allWorn = worn.itemIds.length === itemIds.length;
        // Only when some, not all, of the items are worn: the always-on rules at the worn scale.
        const wornOnes = !allWorn && worn.itemIds.length
            ? statementsFromEntry(entry, { effectId, scale: worn.scale }) : null;
        statementsFromEntry(entry, { effectId, scale }).forEach((statement, i) => {
            if (!isAlwaysOn(statement) || allWorn) {
                out.push({ ...statement, sourceItemIds: itemIds });
            } else if (wornOnes) {
                out.push({ ...wornOnes[i], sourceItemIds: worn.itemIds });
            }
        });
    }

    const perks = expandPerks(hero, library);
    return perks.length ? out.concat(perks) : out;
}

/**
 * The statements a hero's milestone perks contribute, stamped `perk: true`.
 *
 * ⚠️ Kept apart from the items' merge: an item and a perk naming one effect each give their own
 * statements (two Provides add up), so an item's cost, worn rule and dose behave exactly as before.
 * A perk has nothing to spend: its rules are free whatever cost the effect carries, and it names
 * no item (`sourceItemIds` empty), so no dose ever stands in for it.
 */
export function perkStatements(hero) {
    return expandPerks(hero, null);
}

function expandPerks(hero, library) {
    const refs = earnedPerkRefs(hero);
    if (!refs.length) return refs;
    const out = [];
    for (const ref of refs) {
        const entry = EFFECTS[ref.effectId];
        library?.set(ref.effectId, entry);
        if (!entry) continue;                       // ContentAudit reports it by name
        for (const statement of statementsFromEntry(entry, ref)) {
            out.push({ ...statement, chargeDelta: 0, sourceItemIds: [], perk: true });
        }
    }
    return out;
}

/**
 * One item's own statements, stamped like `loadoutStatements`' (`sourceItemIds` is just this
 * item), whether or not any of it is in the Bank: an elixir drunk earlier still works after its
 * stack runs out.
 */
export function itemStatements(itemId) {
    const def = getItem(itemId);
    if (!def) return [];
    const out = [];
    for (const ref of effectRefsOf(def)) {
        const entry = EFFECTS[ref.effectId];
        if (!entry) continue;
        for (const statement of statementsFromEntry(entry, ref)) {
            out.push({ ...statement, sourceItemIds: [itemId] });
        }
    }
    return out;
}

/** A hero's loadout statements of one keyword. */
export function loadoutStatementsWith(hero, keyword) {
    return loadoutStatements(hero).filter(statement => statement?.keyword === keyword);
}

/**
 * Pay a loadout statement's cost, in units of the items that granted it. A rule
 * costing 0 (every weapon and armour piece) spends nothing.
 *
 * When two items granted the merged effect only the first in grid order pays;
 * charging both would make carrying a spare worse than carrying none.
 *
 * ⚠️ Nothing is unequipped when the stack empties: the last unit fires normally
 * and `slotBacked` silences a shared item from the next firing, so it stays in its slot, greyed.
 *
 * ⚠️ Pay only once the rule has actually done something. `canPayLoadoutCost`
 * answers the same question without spending, so a caller whose roll happens
 * inside another function can check first, act, and pay only on success.
 *
 * @returns {boolean} whether the cost was paid (a free rule is always paid)
 */
export function canPayLoadoutCost(statement) {
    const cost = -Number(statement?.chargeDelta || 0);
    if (!(cost > 0)) return true;
    return (statement?.sourceItemIds || []).some(id => InventoryManager.hasItem(id, cost));
}

export function payLoadoutCost(statement) {
    const cost = -Number(statement?.chargeDelta || 0);
    if (!(cost > 0)) return true;

    for (const itemId of statement?.sourceItemIds || []) {
        if (InventoryManager.hasItem(itemId, cost)) {
            InventoryManager.removeItem(itemId, cost);
            return true;
        }
    }

    // Nothing left to spend: the rule does not fire on credit.
    return false;
}

/**
 * The combat-axis numbers a set of statements contributes.
 *
 * Combat reads an aggregator rather than resolving the loadout live like the
 * board: `CombatFormulas` is a pure calculation module that already queries
 * `hero.aggregator`, and reaching from it into item registries and the Bank
 * would invert that dependency and risk an import cycle. `EquipmentManager`
 * refreshes the registration whenever equipment changes.
 *
 * ⚠️ Flat bucket only. `ModifierAggregator.query` sums flats and skips
 * percentage and multiplier entries, so anything else would be registered and
 * never read. The palette refuses to author other buckets on these axes, and
 * this mirrors that refusal.
 *
 * @param {Array<object>} statements expanded statements from any bearer
 * @returns {Array<{type: string, value: number}>}
 */
export function combatContributions(statements) {
    const out = [];

    for (const statement of statements || []) {
        if (statement?.keyword !== KEYWORD.PROVIDES) continue;

        const payload = statement.payload || {};
        const entry = getPaletteEntry(payload.type);
        // ⚠️ `heroOnly`, not `group === 'Combat'`: `STATUS_IMMUNITY` is read off a
        // hero's aggregator too and is not combat, so keying on a group label would
        // leave it registered by nobody.
        if (!entry?.heroOnly) continue;
        if (payload.bucket && payload.bucket !== 'flat') continue;

        const value = Number(payload.value);
        if (!Number.isFinite(value) || value === 0) continue;

        // `STATUS_IMMUNITY` is meaningless without it: an immunity naming no status
        // would block everything.
        out.push(payload.category
            ? { type: payload.type, value, category: payload.category }
            : { type: payload.type, value });
    }

    return out;
}

/** The combat numbers a hero's own loadout contributes. */
export function loadoutCombatContributions(hero) {
    return combatContributions(loadoutStatements(hero));
}

/**
 * What a hero's worn gear lends as fields of its own rather than rules (`gearDefence.js`): each
 * piece's resistances as Type Resistance by type or group, and its damage cuts by style. Only from
 * items that lend at all (held, at their level, the weapon swung), and only worn ones.
 * @returns {Array<{type: string, value: number, category: string}>}
 */
export function loadoutDefenceContributions(hero) {
    const out = [];
    if (!hero) return out;
    for (const { def } of lendingEntries(hero)) {
        if (isSpentCategory(def.equipSlot)) continue;
        for (const [id, value] of Object.entries(gearResistancesOf(def))) {
            out.push({ type: EFFECT_TYPES.TYPE_RESIST, value, category: id });
        }
        for (const [style, value] of Object.entries(gearDamageCutOf(def))) {
            out.push({ type: EFFECT_TYPES.STYLE_DAMAGE_CUT, value, category: style });
        }
    }
    return out;
}
