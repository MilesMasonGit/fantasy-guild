// what bites at a water: the hero's tool, the bait they carry, and the pool those pick

import { GameState } from '../../state/GameState.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { hasCatchPools, poolFor, baitsFor, pickCatchIndex } from '../../config/registries/catchPools.js';
import { neededToolOf } from '../../config/registries/toolKinds.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as HeroTools from '../equipment/HeroTools.js';
import * as TileModifiers from './TileModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';

/**
 * Fishing (brief 230 S5, owner rulings 2026-10-24). A water Token (one with catch pools,
 * `catchPools.js`) never runs out and makes no Outputs of its own: each finished cycle lands one
 * catch, picked from a weighted pool chosen by
 * - the **tool kind** in the hero's hands: the first held tool the water has a pool for (a rod in
 *   the first hand and a net in the second fish with the rod where the water has a rod pool);
 *   a tool's tier never gates, a better one carries its own bonus (a Catch Weight rule);
 * - the **bait** the hero carries in a consumable cell: the first in grid order that a pool for
 *   that tool takes and the Bank still holds. One is spent per catch; with none left the hero
 *   fishes the water's basic pool for the tool (no bait).
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

/**
 * How hero `heroId` would fish water `def` right now, as `{ tool, bait, pool }` (`tool` from
 * `HeroTools.catchToolOf`, `bait` an item id or null), or null when they hold no tool it takes or
 * no pool fits. Draws nothing and spends nothing.
 */
export function fishingOf(def, heroId) {
    if (!hasCatchPools(def)) return null;
    const tool = HeroTools.catchToolOf(heroId, neededToolOf(def)?.kinds);
    if (!tool) return null;
    const bait = baitOf(heroId, def, tool.kind);
    const pool = poolFor(def, tool.kind, bait);
    return pool ? { tool, bait, pool } : null;
}

/**
 * One finished cycle's catch at water Token `instanceId` (type `def`), worked by `heroId`: picks
 * the fish and spends the bait. Each fish's weight is widened by the Catch Weight rules that reach
 * it (the hero's rod, a Token in reach), with the fish as the narrowing.
 *
 * Nothing bites (null) when the hero holds no tool the water takes, or when their tool has no
 * basic pool here and they carry none of its baits: no bait is spent then.
 *
 * @returns {{itemId: string, tool: string, bait: string|null}|null}
 */
export function catchOf(instanceId, def, heroId, random = Math.random) {
    const plan = fishingOf(def, heroId);
    if (!plan) return null;
    const { catches } = plan.pool;
    const weights = catches.map(c => TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.CATCH_WEIGHT, c.weight, c.itemId));
    const index = pickCatchIndex(weights, random);
    if (index == null) return null;
    if (plan.bait) InventoryManager.removeItem(plan.bait, 1);
    return { itemId: catches[index].itemId, tool: plan.tool.kind, bait: plan.bait };
}
