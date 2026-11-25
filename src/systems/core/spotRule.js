// the content rules for fishing spots: shared by the boot audit and the CMS audit

import { spotOf, isWaterKind, WATER_KIND_CHOICES, RETIRED_WATER_TOKENS } from '../../config/registries/fishingSpots.js';
import { BIOMES } from '../../config/biomeTerrain.js';

/**
 * Where fishing content is written in a way that cannot work (`fishingSpots.js`, `catchPools.js`):
 * a retired fixed water still in the data, a spot kind that can never land or catches nothing, and
 * a spot block or catch pool naming a water or biome the game does not have.
 *
 * Pure: the caller hands in the Tokens (as authored: a retired water is seen only in the CMS's own
 * data, since the game's registry never loads one).
 *
 * @param {{ tokens?: Record<string, object> }} content
 * @returns {{ entityType: 'Token', entityId: string, entityName: string, message: string }[]}
 */
export function spotFindings({ tokens = {} } = {}) {
    const out = [];
    const waterWords = WATER_KIND_CHOICES.map(c => c.label).join(', ');
    for (const [key, def] of Object.entries(tokens || {})) {
        const id = def?.id || key;
        const say = (message) => out.push({ entityType: 'Token', entityId: id, entityName: def?.name || id, message });

        if (RETIRED_WATER_TOKENS.includes(id)) {
            say('is a fixed water, retired now that fish come from spots on the water: delete it (the game never loads it, and a save drops it from every board)');
        }

        const raw = def?.spot;
        const spot = spotOf(def);
        if (spot) {
            for (const word of Array.isArray(raw.water) ? raw.water : []) {
                if (!isWaterKind(word)) say(`its spot lands on "${word}", a water the game does not have (${waterWords})`);
            }
            for (const biome of spot.biomes) {
                if (!BIOMES.includes(biome)) say(`its spot lands in the biome "${biome}", which the game does not have`);
            }
            if (spot.everyMs > 0 && !spot.water.length) say('is a fishing spot with a rate but no water to land on, so it never arrives: tick a water');
            if (spot.everyMs > 0 && spot.most < 1) say('is a fishing spot with a rate but a most of 0, so it never arrives: allow at least 1');
            if (!(Array.isArray(def.standsOn) && def.standsOn.includes('water'))) {
                say('is a fishing spot that does not stand on Water, so it can never land: tick Water in Stands on');
            }
            if (!(Array.isArray(def.catchPools) && def.catchPools.length)) say('is a fishing spot with no catch pools, so nothing is caught there');
        }

        (Array.isArray(def?.catchPools) ? def.catchPools : []).forEach((pool, n) => {
            for (const word of Array.isArray(pool?.water) ? pool.water : []) {
                if (!isWaterKind(word)) say(`its catch pool ${n + 1} holds on "${word}", a water the game does not have (${waterWords}), so it is never fished`);
            }
            for (const biome of Array.isArray(pool?.biomes) ? pool.biomes : []) {
                if (!BIOMES.includes(biome)) say(`its catch pool ${n + 1} holds in the biome "${biome}", which the game does not have`);
            }
        });
    }
    return out;
}
