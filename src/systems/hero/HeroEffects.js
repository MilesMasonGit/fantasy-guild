import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import {
    effectRefsOf, statementsFromEntry, normaliseScale, MAX_SCALE
} from '../effects/effectLibrary.js';
import { KEYWORD } from '../effects/statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';

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
 * ⚠️ The inventory stack is the charge pool. A hero's slot holds only an item id and
 * items live in one fungible stack, so a statement's charge cost is spent as units of
 * the item itself (cost 0 means never consumed). An item whose stack is empty
 * contributes nothing but stays in its slot, greyed.
 */

/**
 * Whether an equipped item can currently do anything: one that is not in the
 * Bank is not really in the hero's hands.
 */
function inStock(itemId) {
    return InventoryManager.hasItem(itemId, 1);
}

/**
 * Every effect reference a hero is carrying, merged by effect.
 *
 * @returns {Map<string, {scale: number, itemIds: string[]}>}
 */
export function loadoutRefs(hero) {
    const merged = new Map();
    if (!hero) return merged;

    for (const itemId of getGrid(hero)) {
        if (!itemId || !inStock(itemId)) continue;
        const def = getItem(itemId);
        if (!def) continue;

        for (const { effectId, scale } of effectRefsOf(def)) {
            const current = merged.get(effectId);
            if (current) {
                // Scales add; the cap stops a build maxing one effect by carrying six of a thing.
                current.scale = Math.min(MAX_SCALE, current.scale + scale);
                current.itemIds.push(itemId);
            } else {
                merged.set(effectId, { scale: normaliseScale(scale), itemIds: [itemId] });
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
 */
export function loadoutStatements(hero) {
    const out = [];

    for (const [effectId, { scale, itemIds }] of loadoutRefs(hero)) {
        const entry = EFFECTS[effectId];
        if (!entry) continue;                       // ContentAudit reports it by name
        for (const statement of statementsFromEntry(entry, { effectId, scale })) {
            out.push({ ...statement, sourceItemIds: itemIds });
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
 * and `inStock` silences the item from the next firing, so it stays in its slot, greyed.
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
