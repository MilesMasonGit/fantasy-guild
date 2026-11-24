// what bites at a water: the hero's tool, their lure, their level, and the Bait a catch spends

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { hasCatchPools, poolForTool, poolBites, pickCatchIndex, poolsAt } from '../../config/registries/catchPools.js';
import { neededToolOf, takesLure } from '../../config/registries/toolKinds.js';
import { lureOf, baitSavingOf, baitSpent, fishLevel, fishCycleMs, fishBait } from '../../config/registries/fishRules.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as HeroTools from '../equipment/HeroTools.js';
import * as TileModifiers from './TileModifiers.js';
import * as CycleSavings from './CycleSavings.js';
import * as BoardState from './BoardState.js';
import * as GroundRules from './GroundRules.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';

/**
 * Fishing. A water Token (one with catch pools, `catchPools.js`) never runs out and makes no Outputs
 * of its own: each finished cycle lands one catch.
 *
 * - **The tool kind** in the hero's hands picks the pool: the first held tool the water has a pool
 *   for, and that kind's first pool that holds where the water stands. A tool's tier never gates; a
 *   better one is faster, may carry its own bonus, and may spend less Bait (`fishRules.baitSavingOf`).
 * - **A lure** (a rod only, `toolKinds.takesLure`): the first carried in a consumable cell, in grid
 *   order, that the Bank still holds and that names a fish the pool holds picks that fish, at that
 *   fish's own catch time. Above the hero's Fishing level, they do not fish ({@link levelNeededOf}).
 *   It may break each catch it picks (one used up from the Bank). A lure naming no fish here is not
 *   spent: the hero fishes as with none, and says so (`BOARD_EVENTS.LURE_FISH_ABSENT`).
 * - **No lure** (and every harpoon and Trap): a weighted roll among the pool's fish the hero's level
 *   allows, the catch taking the longest catch time of those ({@link cycleMsOf}).
 * - **Bait**: a pool naming a bait spends it each catch, the fish's amount less the tool's saving
 *   (`fishRules.baitSpent`), carried in a consumable cell with the Bank holding enough for the
 *   dearest fish the hero may land. A Trap's pool naming none catches free; any other pool naming
 *   none is never fished.
 *
 * A fish's level, time and Bait come from its item's `fish` block, else the water's own level and
 * cycle and 1 Bait (`fishRules.js`).
 *
 * Only the pools that hold where the water stands are fished ({@link placeOf}): a fishing spot's
 * catch comes from the water under it and the Region's biome (`catchPools.poolsAt`).
 *
 * ⚠️ Every draw is from `Math.random` in a fixed place of the finished cycle
 * (`BoardRunner.completeCycle`): the pick (none for one fish), then a Preservation chance on the
 * Bait when a rule offers one, then a lure's break when it has a chance. A catch-up catches exactly
 * what live play does.
 */

export { hasCatchPools as isWater };

/** Why a hero holding a tool the water takes does not fish it ({@link assess}). */
const WHY = Object.freeze({ NO_POOL: 'no_pool', LEVEL: 'level', NO_BAIT: 'no_bait' });

/** The hero record, read straight from state (as `HeroTools` does): asked once per catch. */
function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/**
 * Where water Token `instance` stands, as its catch pools read it (`GroundRules.placeAt`): the
 * water kind under it and the Region's biomes. Null with no instance: only pools for everywhere hold.
 */
export function placeOf(instance) {
    if (!instance || !Number.isFinite(instance.x) || !Number.isFinite(instance.y)) return null;
    return GroundRules.placeAt(instance.x, instance.y);
}

/** The catch pools that hold at water Token `instance` (see {@link placeOf}), in authored order. */
export function poolsHere(def, instance) {
    return poolsAt(def, placeOf(instance));
}

/** The tool hero `heroId` fishes water `def` with (`HeroTools.catchToolOf`), or null. */
function toolAt(def, heroId) {
    return HeroTools.catchToolOf(heroId, neededToolOf(def)?.kinds);
}

/** Whether `hero` carries `itemId` in a consumable cell. */
function carriesInCell(hero, itemId) {
    return getGrid(hero).some(id => id === itemId && isConsumableCategory(categoryOfItem(id)));
}

/** The lures `hero` carries in consumable cells that the Bank still holds, in grid order, each once. */
function carriedLures(hero) {
    const out = [];
    for (const itemId of getGrid(hero)) {
        if (!itemId || out.some(l => l.itemId === itemId)) continue;
        if (!isConsumableCategory(categoryOfItem(itemId))) continue;
        const lure = lureOf(getItem(itemId));
        if (lure && InventoryManager.hasItem(itemId, 1)) out.push({ itemId, lure });
    }
    return out;
}

/** The Fishing level a catch of `itemId` at water `def` asks: its fish's own, else the water's. */
export function catchLevelOf(def, itemId) {
    return fishLevel(getItem(itemId), Math.max(1, Number(def?.config?.skillRequired) || 1));
}

/** A catch's level, time and Bait, its water's standing in for what its fish leaves out. */
function catchTerms(c, def) {
    const item = getItem(c.itemId);
    return {
        level: catchLevelOf(def, c.itemId),
        cycleMs: fishCycleMs(item, Number(def?.config?.cycleTimeMs) || null),
        bait: fishBait(item)
    };
}

/**
 * Everything about how hero `heroId` would fish water `def` (standing as `instance`) right now,
 * drawing nothing and spending nothing: `{ tool, pool, bait, lure, catches, cycleMs, baitNeeded,
 * absent, why, level }`. `why` is null when they fish; else one of {@link WHY}, `level` the Fishing
 * level they need for `WHY.LEVEL`. Null when they hold no tool it takes.
 */
function assess(def, heroId, instance) {
    if (!hasCatchPools(def)) return null;
    const tool = toolAt(def, heroId);
    if (!tool) return null;
    const out = { tool, pool: null, bait: null, lure: null, catches: [], cycleMs: null, baitNeeded: 0, absent: null, why: null, level: null };
    const pool = poolForTool(def, tool.kind, placeOf(instance));
    if (!poolBites(pool)) return { ...out, why: WHY.NO_POOL };
    out.pool = pool;
    const hero = heroRecord(heroId);
    const heroLevel = Number(hero?.skills?.[def.config?.skill]?.level) || 0;

    let lured = null;
    if (takesLure(tool.kind) && hero) {
        for (const { itemId, lure } of carriedLures(hero)) {
            const c = lure.fish.map(f => pool.catches.find(x => x.itemId === f)).find(Boolean);
            if (c) { lured = c; out.lure = itemId; break; }
            if (!out.absent) out.absent = { lureId: itemId, fish: lure.fish };
        }
    }
    const terms = new Map(pool.catches.map(c => [c, catchTerms(c, def)]));
    if (lured) {
        if (terms.get(lured).level > heroLevel) return { ...out, why: WHY.LEVEL, level: terms.get(lured).level };
        out.catches = [lured];
    } else {
        out.catches = pool.catches.filter(c => terms.get(c).level <= heroLevel);
        if (!out.catches.length) {
            return { ...out, why: WHY.LEVEL, level: Math.min(...pool.catches.map(c => terms.get(c).level)) };
        }
    }
    const times = out.catches.map(c => terms.get(c).cycleMs).filter(ms => ms > 0);
    out.cycleMs = times.length === out.catches.length ? Math.max(...times) : null;
    if (pool.bait) {
        const saving = baitSavingOf(getItem(tool.itemId));
        out.bait = pool.bait;
        out.baitNeeded = Math.max(...out.catches.map(c => baitSpent(terms.get(c).bait, saving)));
        if (out.baitNeeded > 0 && !(hero && carriesInCell(hero, pool.bait) && InventoryManager.hasItem(pool.bait, out.baitNeeded))) {
            return { ...out, why: WHY.NO_BAIT };
        }
    }
    out.terms = terms;
    return out;
}

/**
 * How hero `heroId` fishes water `def` (standing as `instance`) right now, as `{ tool, pool, bait,
 * lure, catches, cycleMs }` (`tool` from `HeroTools.catchToolOf`; `bait` the Bait the pool spends or
 * null; `lure` the lure item picking the fish or null; `catches` the fish they may land, with
 * their weights), or null when they do not fish: no tool it takes, no pool that bites, a level too
 * low, or too little Bait. Draws nothing and spends nothing.
 */
export function fishingOf(def, heroId, instance = null) {
    const a = assess(def, heroId, instance);
    if (!a || a.why) return null;
    return { tool: a.tool, pool: a.pool, bait: a.bait, lure: a.lure, catches: a.catches, cycleMs: a.cycleMs };
}

/**
 * How long hero `heroId`'s next catch at water `def` takes, before any Work Time: the lured fish's
 * own time, else the longest of the fish they may land; `fallback` (the water's cycle) when they do
 * not fish or a fish names no time of its own.
 */
export function cycleMsOf(def, heroId, instance, fallback) {
    const a = assess(def, heroId, instance);
    return a && !a.why && a.cycleMs > 0 ? a.cycleMs : fallback;
}

/**
 * The Bait hero `heroId` needs before they fish water `def` (standing as `instance`), as `{ itemId,
 * needed }`, or null when that is not what stops them (they fish, hold no tool it takes, or need a
 * level first).
 */
export function baitNeedOf(def, heroId, instance = null) {
    const a = assess(def, heroId, instance);
    return a?.why === WHY.NO_BAIT ? { itemId: a.bait, needed: a.baitNeeded } : null;
}

/** {@link baitNeedOf}'s item alone: the Bait they must carry and the Bank must hold, or null. */
export function baitNeededOf(def, heroId, instance = null) {
    return baitNeedOf(def, heroId, instance)?.itemId || null;
}

/**
 * Why hero `heroId`, holding a tool water `def` (standing as `instance`) takes, does not fish it:
 * `'level'` when their level stops them ({@link levelNeededOf}), `'bait'` for anything else (too
 * little Bait, or no pool there that bites), null when they fish or hold no tool it takes.
 */
export function stopOf(def, heroId, instance = null) {
    const a = assess(def, heroId, instance);
    if (!a?.why) return null;
    return a.why === WHY.LEVEL ? 'level' : 'bait';
}

/**
 * Whether hero `heroId` holds a tool water `def` (standing as `instance`) takes and has too little
 * Bait to fish it. Always false away from water.
 */
export function lacksBait(def, heroId, instance = null) {
    const a = assess(def, heroId, instance);
    return a?.why === WHY.NO_BAIT || a?.why === WHY.NO_POOL;
}

/**
 * The Fishing level hero `heroId` needs before they fish water `def` (standing as `instance`): the
 * level of the fish their lure picks, or with no lure the lowest of the pool's fish. Null when that
 * is not what stops them.
 */
export function levelNeededOf(def, heroId, instance = null) {
    const a = assess(def, heroId, instance);
    return a?.why === WHY.LEVEL ? a.level : null;
}

/**
 * One finished cycle's catch at water Token `instanceId` (type `def`), worked by `heroId`: picks
 * the fish, spends the Bait, and may break the lure. Each fish's weight is widened by the Catch
 * Weight rules that reach it (the hero's rod, a Token in reach), with the fish as the narrowing.
 *
 * Nothing bites (null) when the hero does not fish there ({@link fishingOf}): nothing is spent then.
 * A Preservation hit at the water keeps the Bait in the Bank (`baitKept`).
 *
 * @returns {{itemId: string, tool: string, bait: string|null, baitSpent: number, baitKept: boolean,
 *   lure: string|null, lureBroke: boolean}|null}
 */
export function catchOf(instanceId, def, heroId, random = Math.random) {
    const a = assess(def, heroId, BoardState.getTokenById(instanceId));
    if (!a || a.why) return null;
    const weights = a.catches.map(c => TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.CATCH_WEIGHT, c.weight, c.itemId));
    const index = pickCatchIndex(weights, random);
    if (index == null) return null;
    const caught = a.catches[index];
    const spent = a.bait ? baitSpent(a.terms.get(caught).bait, baitSavingOf(getItem(a.tool.itemId))) : 0;
    const baitKept = spent > 0 && CycleSavings.keepsCarried(instanceId, a.bait, CARRIED_KIND.BAIT, random);
    if (spent > 0 && !baitKept) InventoryManager.removeItem(a.bait, spent);
    let lureBroke = false;
    if (a.lure) {
        const chance = lureOf(getItem(a.lure))?.breakChance || 0;
        if (chance > 0 && random() * 100 < chance) {
            InventoryManager.removeItem(a.lure, 1);
            lureBroke = true;
        }
    } else if (a.absent) {
        EventBus.publish(BOARD_EVENTS.LURE_FISH_ABSENT, { instanceId, heroId, lureId: a.absent.lureId, fish: [...a.absent.fish] });
    }
    return { itemId: caught.itemId, tool: a.tool.kind, bait: a.bait, baitSpent: spent, baitKept, lure: a.lure, lureBroke };
}
