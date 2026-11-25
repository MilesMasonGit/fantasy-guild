// the content rules for fish, lures and Bait: shared by the boot audit and the CMS audit

import { catchPoolsOf, poolFits, BAIT_FREE_TOOL } from '../../config/registries/catchPools.js';
import { spotOf, arrivesByItself, RETIRED_WATER_TOKENS } from '../../config/registries/fishingSpots.js';
import { lureOf, badFishXp } from '../../config/registries/fishRules.js';
import { takesLure, toolKindLabel } from '../../config/registries/toolKinds.js';
import { isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { BIOMES } from '../../config/biomeTerrain.js';

/**
 * Where fishing's catch rules are written in a way that cannot work as the plan says
 * (`fishRules.js`, `catchPools.js`, `Fishing.js`):
 * - **One Bait for all fishing**: a pool spending a bait other than the one most pools spend.
 * - **One Trap catch per water**: a Trap pool landing more than one item.
 * - **A lure**: one naming a fish that is no item, or that no lure-taking tool (a rod) catches
 *   anywhere, or a lure no hero can carry (not a Consumable).
 * - **One fish per lure per map**: in a Region of one biome, the spot kinds that arrive by
 *   themselves there could give two of one lure's fish, so the lure would not mean one fish.
 *   (A kind landed only by an event, the Fish Shoal, is not counted: it can come anywhere.)
 * - **A catch's XP**: a fish's `xp` written as anything but a whole number of 0 or more.
 *
 * Pure: the caller hands in the Tokens and the items.
 *
 * @param {{ tokens?: Record<string, object>, items?: Record<string, object> }} content
 * @returns {{ entityType: 'Token'|'Item', entityId: string, entityName: string, message: string }[]}
 */
export function fishFindings({ tokens = {}, items = {} } = {}) {
    const out = [];
    const nameOf = (id) => items?.[id]?.name || id;
    const listOf = (ids) => (ids.length < 2 ? ids.map(nameOf).join('') : `${ids.slice(0, -1).map(nameOf).join(', ')} and ${nameOf(ids[ids.length - 1])}`);
    // A retired fixed water is the spot audit's to name, and the game never loads it.
    const tokenList = Object.entries(tokens || {}).map(([key, def]) => ({ id: def?.id || key, def }))
        .filter(t => !RETIRED_WATER_TOKENS.includes(t.id));

    // One Bait: the one most pools spend is the Bait; every other is named where it is spent.
    const uses = new Map();
    for (const { def } of tokenList) {
        for (const pool of catchPoolsOf(def)) if (pool.bait) uses.set(pool.bait, (uses.get(pool.bait) || 0) + 1);
    }
    const bait = [...uses].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || null;

    // What lure-taking tools catch anywhere, and what any tool does.
    const lured = new Set();
    const landed = new Set();

    for (const { id, def } of tokenList) {
        const say = (message) => out.push({ entityType: 'Token', entityId: id, entityName: def?.name || id, message });
        catchPoolsOf(def).forEach((pool) => {
            for (const c of pool.catches) {
                landed.add(c.itemId);
                if (takesLure(pool.tool)) lured.add(c.itemId);
            }
            if (pool.bait && bait && pool.bait !== bait) {
                say(`its catch pool for a ${toolKindLabel(pool.tool)} spends ${nameOf(pool.bait)}, but fishing has one Bait (${nameOf(bait)}, the one most pools spend): name it instead`);
            }
            if (pool.tool === BAIT_FREE_TOOL && pool.catches.length > 1) {
                say(`its catch pool for a ${toolKindLabel(pool.tool)} lands ${listOf(pool.catches.map(c => c.itemId))}: a water holds one Trap catch, so keep one`);
            }
        });
    }

    const lures = Object.entries(items || {})
        .map(([key, item]) => ({ id: item?.id || key, item, lure: lureOf(item) }))
        .filter(l => l.lure);
    for (const { id, item, lure } of lures) {
        const say = (message) => out.push({ entityType: 'Item', entityId: id, entityName: item?.name || id, message });
        if (!isConsumableCategory(item?.equipSlot)) say('is a lure but not a Consumable, so no hero can carry it');
        for (const fishId of lure.fish) {
            if (!items?.[fishId]) say(`its lure names "${fishId}", which is not an item`);
            else if (!lured.has(fishId)) {
                say(landed.has(fishId)
                    ? `its lure names ${nameOf(fishId)}, which no rod catches: only a rod takes a lure, so it never picks it`
                    : `its lure names ${nameOf(fishId)}, which no water lands`);
            }
        }
    }

    for (const [key, item] of Object.entries(items || {})) {
        if (!badFishXp(item)) continue;
        const id = item?.id || key;
        out.push({
            entityType: 'Item', entityId: id, entityName: item?.name || id,
            message: `its catch XP is "${item.fish.xp}": write a whole number of 0 or more, or leave it blank for the spot's own`
        });
    }

    // One fish per lure per map, biome by biome.
    const spots = tokenList.map(({ def }) => ({ def, spot: spotOf(def) })).filter(s => arrivesByItself(s.spot));
    for (const biome of BIOMES) {
        const here = new Set();
        for (const { def, spot } of spots) {
            if (spot.biomes.length && !spot.biomes.includes(biome)) continue;
            for (const water of spot.water) {
                const place = { water, biomes: [biome] };
                // Only the first pool for a tool that fits is fished there (`catchPools.poolForTool`).
                const fished = new Set();
                for (const pool of catchPoolsOf(def)) {
                    if (!takesLure(pool.tool) || fished.has(pool.tool) || !poolFits(pool, place)) continue;
                    fished.add(pool.tool);
                    for (const c of pool.catches) here.add(c.itemId);
                }
            }
        }
        for (const { id, item, lure } of lures) {
            const both = lure.fish.filter(f => here.has(f));
            if (both.length < 2) continue;
            out.push({
                entityType: 'Item', entityId: id, entityName: item?.name || id,
                message: `in a ${biome} Region a map could hold ${listOf(both)}, which the ${item?.name || id} all picks: a map holds at most one fish per lure, so move one to another biome or lure`
            });
        }
    }
    return out;
}
