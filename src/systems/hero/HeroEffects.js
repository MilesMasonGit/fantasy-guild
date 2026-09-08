// Fantasy Guild — what a hero's loadout does (Unified Effects P4)

import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import {
    effectRefsOf, statementsFromEntry, normaliseScale, MAX_SCALE
} from '../effects/effectLibrary.js';

/**
 * A hero's equipped items are **bearers**, exactly like a Token (UE-1).
 *
 * The grammar, the library and the sentence are unchanged; what differs is what
 * a rule reaches and what its cost is spent from.
 *
 * ## ⚠️ The loadout is ONE bearer, not nine
 * Two items referencing the same effect do **not** apply it twice. Their scales
 * add and the total is capped at 5 (UE-19), and the effect is applied once.
 *
 * That is not only a balance rule, it is the only version that works. Expanding
 * the same entry twice produces two statements carrying the **same statement
 * id**, and per-statement state is keyed by that id — so an upkeep clock or a
 * cooldown would be shared between two rules meant to be separate. A Token
 * naming one entry twice is refused for exactly this reason (`duplicateRefsOf`);
 * a loadout cannot refuse it, because the player is holding two different
 * things, so it merges instead.
 *
 * ## ⚠️ The inventory stack is the charge pool (UE-21)
 * An item has no `usesRemaining`, and cannot: `EquipmentManager`'s Shared
 * Reference model keeps items in one fungible stack and a hero's slot holds only
 * an **id**. So a statement's authored charge cost is spent as units of the item
 * itself — a potion costing 1 eats one potion per firing, and a sword costing 0
 * is never consumed. No per-copy state exists, and none is needed.
 *
 * An item whose stack has run dry contributes nothing (UE-22). It stays in the
 * slot, greyed, rather than being taken out of a loadout the player arranged.
 */

/**
 * Whether an equipped item can currently do anything.
 *
 * Mirrors `EquipmentManager.syncEquipmentModifiers`, which switches a hero's
 * gear bonus off when the shared stack runs out. An item that is not in the
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
                // UE-19: scales add, and the cap is what stops a build maxing
                // one effect by carrying six of a thing.
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
 * Each statement carries `sourceItemIds` on top of the usual stamps, because
 * paying a statement's cost means consuming one of the items that granted it —
 * and by the time a rule fires, which items those were is no longer derivable.
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
 * Pay a loadout statement's cost, in units of the items that granted it (UE-21).
 *
 * ## What "cost" means here
 * The same authored number P2 gave every statement. On a Token it comes out of
 * the charge pool; on an item it comes out of the **stack**, because that is the
 * only pool an item has. A rule costing 0 — every weapon and every piece of
 * armour — spends nothing and this returns immediately.
 *
 * ## Why only one item pays
 * When two items granted the merged effect, exactly one of them is consumed, not
 * both. The player is holding two of something that does one thing; charging
 * them twice for one firing would make carrying a spare strictly worse than
 * carrying none.
 *
 * The **first in grid order** pays, so consumption is deterministic rather than
 * arbitrary, and a player who wants a particular one spent first can arrange it.
 *
 * ## ⚠️ Nothing is unequipped when the stack empties (UE-22)
 * The last unit fires normally and the slot keeps the item, greyed — `inStock`
 * is what silences it from the next firing onward. A loadout the player arranged
 * is not rearranged under them.
 *
 * ## ⚠️ Pay only once the rule has actually done something
 * `canPayLoadoutCost` answers the same question without spending, so a caller
 * whose roll happens inside another function can check first, act, and pay only
 * on success. A potion spent on a chance that missed would teach the player the
 * opposite of how often it works — the same reason P3 announces after the roll.
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

    // Nothing left to spend: the rule does not fire, and it does not fire on
    // credit either — the same gate `Charges.canFireStatement` applies to a
    // Token that cannot afford its own effect.
    return false;
}
