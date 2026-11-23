// what bites at a water: the hero's tool, the bait they carry, and the pool those pick

import { GameState } from '../../state/GameState.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { hasCatchPools, poolFor, poolBites, baitsFor, pickCatchIndex } from '../../config/registries/catchPools.js';
import { neededToolOf } from '../../config/registries/toolKinds.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as HeroTools from '../equipment/HeroTools.js';
import * as TileModifiers from './TileModifiers.js';
import * as CycleSavings from './CycleSavings.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';

/**
 * Fishing. A water Token (one with catch pools, `catchPools.js`) never runs out and makes no Outputs
 * of its own: each finished cycle lands one catch, picked from a weighted pool chosen by
 * - the **tool kind** in the hero's hands: the first held tool the water has a pool for (a rod in
 *   the first hand and a net in the second fish with the rod where the water has a rod pool);
 *   a tool's tier never gates, a better one carries its own bonus (a Catch Weight rule);
 * - the **bait** the hero carries in a consumable cell: the first in grid order that a pool for
 *   that tool takes and the Bank still holds. One is spent per catch.
 *
 * No bait, no fishing: a hero whose tool finds no bait here does not fish ({@link baitNeededOf}
 * names what they need), except with a Trap (`catchPools.BAIT_FREE_TOOL`), whose pool with no bait
 * catches as it is. A pool another tool works with no bait is never fished.
 *
 * ⚠️ Every pick draws from `Math.random` in a fixed place of the finished cycle
 * (`BoardRunner.completeCycle`), so a catch-up catches exactly what live play does.
 */

export { hasCatchPools as isWater };

/** The hero record, read straight from state (as `HeroTools` does): asked once per catch. */
function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/**
 * The bait hero `heroId` fishes with at water `def` with a tool of `toolKind`: the first carried
 * consumable, in grid order, that a pool for that tool takes and the Bank holds. Null: no bait.
 */
export function baitOf(heroId, def, toolKind) {
    const baits = baitsFor(def, toolKind);
    if (!baits.length) return null;
    const hero = heroRecord(heroId);
    if (!hero) return null;
    for (const itemId of getGrid(hero)) {
        if (!itemId || !baits.includes(itemId)) continue;
        if (!isConsumableCategory(categoryOfItem(itemId))) continue;
        if (InventoryManager.hasItem(itemId, 1)) return itemId;
    }
    return null;
}

/** The tool hero `heroId` fishes water `def` with (`HeroTools.catchToolOf`), or null. */
function toolAt(def, heroId) {
    return HeroTools.catchToolOf(heroId, neededToolOf(def)?.kinds);
}

/**
 * How hero `heroId` would fish water `def` right now, as `{ tool, bait, pool }` (`tool` from
 * `HeroTools.catchToolOf`, `bait` an item id or null), or null when they hold no tool it takes or
 * their tool finds no pool that bites: no bait, and no Trap. Draws nothing and spends nothing.
 */
export function fishingOf(def, heroId) {
    if (!hasCatchPools(def)) return null;
    const tool = toolAt(def, heroId);
    if (!tool) return null;
    const bait = baitOf(heroId, def, tool.kind);
    const pool = poolFor(def, tool.kind, bait);
    return poolBites(pool) ? { tool, bait, pool } : null;
}

/**
 * The bait hero `heroId` needs before they fish water `def`, or null when they fish already (or
 * hold no tool it takes: that is the tool's need, not the bait's). The bait they carry that ran
 * dry, in grid order; else the first their tool's pools take. Null too when no pool for their tool
 * takes a bait, as no bait would help.
 */
export function baitNeededOf(def, heroId) {
    if (!hasCatchPools(def)) return null;
    const tool = toolAt(def, heroId);
    if (!tool || fishingOf(def, heroId)) return null;
    const baits = baitsFor(def, tool.kind);
    if (!baits.length) return null;
    const hero = heroRecord(heroId);
    const carried = hero ? getGrid(hero).find(itemId => itemId && baits.includes(itemId)
        && isConsumableCategory(categoryOfItem(itemId))) : null;
    return carried || baits[0];
}

/**
 * Whether hero `heroId` holds a tool water `def` takes and still cannot fish it: no bait, and no
 * Trap. Always false away from water.
 */
export function lacksBait(def, heroId) {
    return hasCatchPools(def) && !!toolAt(def, heroId) && !fishingOf(def, heroId);
}

/**
 * One finished cycle's catch at water Token `instanceId` (type `def`), worked by `heroId`: picks
 * the fish and spends the bait. Each fish's weight is widened by the Catch Weight rules that reach
 * it (the hero's rod, a Token in reach), with the fish as the narrowing.
 *
 * Nothing bites (null) when the hero holds no tool the water takes, or carries none of its baits
 * and holds no Trap: no bait is spent then. A Preservation hit at
 * the water keeps the bait in the Bank (`baitKept`): one more draw, after the pick, only when a rule
 * offers the chance.
 *
 * @returns {{itemId: string, tool: string, bait: string|null, baitKept: boolean}|null}
 */
export function catchOf(instanceId, def, heroId, random = Math.random) {
    const plan = fishingOf(def, heroId);
    if (!plan) return null;
    const { catches } = plan.pool;
    const weights = catches.map(c => TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.CATCH_WEIGHT, c.weight, c.itemId));
    const index = pickCatchIndex(weights, random);
    if (index == null) return null;
    const baitKept = !!plan.bait && CycleSavings.keepsCarried(instanceId, plan.bait, CARRIED_KIND.BAIT, random);
    if (plan.bait && !baitKept) InventoryManager.removeItem(plan.bait, 1);
    return { itemId: catches[index].itemId, tool: plan.tool.kind, bait: plan.bait, baitKept };
}
