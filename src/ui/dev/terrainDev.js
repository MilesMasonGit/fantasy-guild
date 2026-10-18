// The QA panel's Terrain tools: a dev Region of each biome, one click away, for the ground's eye-check
// ⚠️ DEV BUILDS ONLY: TestDashboard renders the section behind `import.meta.env.DEV`.

import * as Atlas from '../../systems/atlas/Atlas.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { getTokenType, registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { grant } from '../../systems/atlas/Cartography.js';
import { DEV_MAPS } from '../../systems/atlas/devMaps.js';
import { nextSeed, seedFromText } from '../../systems/atlas/seededRandom.js';

/**
 * Every view of the ground the eye-check needs is a click: each button settles a Region from the
 * dev console's placeholder maps, for free (the maps are granted to the dev stock and taken at
 * once), and takes the guild there. The same button gives the same Region every time (its seed
 * follows from its name); **Reroll it** gives the Region the guild is in a new seed; **Back to the
 * Starter Camp** goes home. The dev Region the guild leaves is removed, so the Atlas does not fill
 * up with them.
 */

/**
 * The views: each first biome alone and each pair of them, three newer biomes beside another for
 * the blends at their borders, then each newer biome alone.
 */
export const TERRAIN_DEV_REGIONS = Object.freeze([
    { id: 'meadow', label: 'Meadow', maps: ['meadow'] },
    { id: 'forest', label: 'Forest', maps: ['forest'] },
    { id: 'mountain', label: 'Mountain', maps: ['mountain'] },
    { id: 'coast', label: 'Coast', maps: ['coast'] },
    { id: 'forest_mountain', label: 'Forest + Mountain', maps: ['forest', 'mountain'] },
    { id: 'forest_coast', label: 'Forest + Coast', maps: ['forest', 'coast'] },
    { id: 'mountain_coast', label: 'Mountain + Coast', maps: ['mountain', 'coast'] },
    { id: 'yellowstone_mountain', label: 'Yellowstone + Mountain', maps: ['yellowstone', 'mountain'] },
    { id: 'cherry_mountain', label: 'Cherry grove + Mountain', maps: ['cherry_grove', 'mountain'] },
    { id: 'volcano_forest', label: 'Volcano + Forest', maps: ['volcano', 'forest'] },
    { id: 'flower_meadow', label: 'Flower meadow', maps: ['flower_meadow'] },
    { id: 'cherry_grove', label: 'Cherry grove', maps: ['cherry_grove'] },
    { id: 'yellowstone', label: 'Yellowstone', maps: ['yellowstone'] },
    { id: 'volcano', label: 'Volcano', maps: ['volcano'] }
].map(Object.freeze));

/** The water views: a Region with each kind of water, its biome's own ground round it. */
export const TERRAIN_DEV_WATER = Object.freeze([
    { id: 'water_lake_river', label: 'Lake and river', maps: ['water_lake_river'] },
    { id: 'water_lake', label: 'Lake', maps: ['water_lake'] },
    { id: 'water_river', label: 'River across', maps: ['water_river'] },
    { id: 'water_split', label: 'Split river', maps: ['water_split'] },
    { id: 'water_spring', label: 'Spring river', maps: ['water_spring'] },
    { id: 'water_mountain_river', label: 'Mountain river', maps: ['water_mountain_river'] },
    { id: 'water_pond', label: 'Pond', maps: ['water_pond'] },
    { id: 'water_tarn', label: 'Tarn', maps: ['water_tarn'] },
    { id: 'water_sulphur', label: 'Sulphur springs', maps: ['water_sulphur'] },
    { id: 'water_sea', label: 'Sea', maps: ['water_sea'] }
].map(Object.freeze));

/** How many seeds are tried for a layout in which every node fits. */
const MAX_TRIES = 12;

const nameById = new Map(Object.entries(DEV_MAPS).map(([name, recipe]) => [recipe.id, name]));

/** The dev map names a Region was settled from, or null when it is not a dev Region. */
export function devMapsOf(region) {
    const ids = region?.ingredients;
    if (region?.kind !== Atlas.REGION_KIND.SETTLED || !Array.isArray(ids) || ids.length === 0) return null;
    if (!ids.every(id => nameById.has(id))) return null;
    return ids.map(id => nameById.get(id));
}

/** Whether a Region was settled from the dev maps alone. */
export function isDevRegion(region) {
    return devMapsOf(region) !== null;
}

/** The seed a button starts from: the same every time, so its Region is too. */
export function firstSeedOf(maps) {
    return seedFromText(`terrain-dev:${maps.join('+')}`);
}

/** Which of the views a Region is, by its maps; null for any other. */
export function viewOf(region) {
    const maps = devMapsOf(region);
    if (!maps) return null;
    const key = maps.join('+');
    return [...TERRAIN_DEV_REGIONS, ...TERRAIN_DEV_WATER].find(v => v.maps.join('+') === key) || null;
}

/** Settle `maps` for free with the first seed from `seed` whose layout fits every node. */
function settleFree(maps, seed) {
    const recipes = maps.map(name => DEV_MAPS[name]);
    let tried = seed >>> 0;
    for (let i = 0; i < MAX_TRIES; i++) {
        // Asked with a seed, a preview changes nothing (not even the guild seed).
        if (Atlas.preview(recipes, { seed: tried }).fits) {
            grant(recipes, 1);
            return Atlas.settle({ ingredients: recipes, seed: tried });
        }
        tried = nextSeed(tried);
    }
    return { success: false, reason: `No layout of ${maps.join(' + ')} fitted in ${MAX_TRIES} seeds` };
}

/** Leave `region` behind for good, if it is a dev Region (never the one the guild is in). */
function removeIfDev(region) {
    if (region && isDevRegion(region) && region.id !== Atlas.activeRegionId()) Atlas.abandon(region.id);
}

/**
 * Settle a dev Region of `maps` and travel there; the dev Region left behind is removed.
 *
 * @param {string[]} maps  dev map names (`DEV_MAPS`): 'forest', 'mountain', 'coast', ...
 * @param {{seed?: number}} [options]  the seed to start from; else the view's own
 * @returns {{success: boolean, reason?: string, region?: object}}
 */
export function goToDevRegion(maps, { seed } = {}) {
    const from = Atlas.activeRegion();
    const settled = settleFree(maps, Number.isFinite(seed) ? seed : firstSeedOf(maps));
    if (!settled.success) return settled;
    const trip = Atlas.travel(settled.region.id);
    if (!trip.success) {
        Atlas.abandon(settled.region.id);
        return trip;
    }
    removeIfDev(from);
    return { success: true, region: settled.region };
}

/** The dev Region the guild is in again, with the next seed. Refused anywhere else. */
export function rerollDevRegion() {
    const here = Atlas.activeRegion();
    const maps = devMapsOf(here);
    if (!maps) return { success: false, reason: 'Go to one of the dev Regions first' };
    return goToDevRegion(maps, { seed: nextSeed(here.seed) });
}

/** Back to the Starter Camp; the dev Region left behind is removed. */
export function backToStarterCamp() {
    const here = Atlas.activeRegion();
    const starter = [...Atlas.list(), ...Atlas.list({ archived: true })].find(r => r.kind === Atlas.REGION_KIND.STARTER);
    if (!starter) return { success: false, reason: 'There is no Starter Camp in this game' };
    if (starter.active) return { success: false, reason: 'The guild is at the Starter Camp' };
    if (starter.archived) Atlas.restore(starter.id);
    const trip = Atlas.travel(starter.id);
    if (trip.success) removeIfDev(here);
    return trip;
}

/**
 * Three dev-only test Tokens for the grid while placing: one needs water, one the shore, one rock.
 * Nothing authored has a "Stands on" yet, so the eye-check gets its own.
 *
 * ⚠️ Registered in memory (`registerTokenTypes`) for this page only, the same seam the stress
 * boards use; `data/` is never read or written for them. A save that holds them and is loaded after
 * a reload shows them as unknown Tokens until the button is pressed again.
 */
export const DEV_GROUND_TOKENS = Object.freeze([
    { id: 'dev_ground_boat', name: 'Test Boat (needs water)', looksLike: 'token_fishing_net', standsOn: ['water'] },
    { id: 'dev_ground_dock', name: 'Test Dock (needs the shore)', looksLike: 'token_coast', standsOn: ['shore'] },
    { id: 'dev_ground_mineshaft', name: 'Test Mineshaft (needs rock)', looksLike: 'token_copper_mine', standsOn: ['rock'] }
].map(Object.freeze));

function registerDevGroundTokens() {
    if (DEV_GROUND_TOKENS.every(t => getTokenType(t.id))) return;
    registerTokenTypes(Object.fromEntries(DEV_GROUND_TOKENS.map(t => [t.id, {
        id: t.id,
        name: t.name,
        description: `Dev only: ${t.name}.`,
        // Borrowed art: a shipped Token's picture.
        sprite: getTokenType(t.looksLike)?.sprite ?? null,
        tokenType: 'resource',
        tags: [],
        size: 1,
        uses: null,
        requiresHero: false,
        config: null,
        standsOn: [...t.standsOn]
    }])));
}

/**
 * Put one of each dev test Token on the mat, each on ground it may stand on near the Guild Hall
 * (`Placement.placeArrivalNear`, which honours the ground). One that has no such ground here (the
 * Boat in a Region with no water) is refused with its reason.
 *
 * @returns {{success: boolean, reason?: string, placed: string[]}}
 */
export function placeGroundTestTokens() {
    registerDevGroundTokens();
    const placed = [];
    const refused = [];
    for (const t of DEV_GROUND_TOKENS) {
        const instance = BoardState.createTokenInstance(t.id, null);
        const res = Placement.placeArrivalNear(instance, Placement.centreOfBoard());
        if (res?.success) placed.push(t.name);
        else refused.push(`${t.name}: ${res?.reason || 'refused'}`);
    }
    return refused.length
        ? { success: false, reason: refused.join(' '), placed }
        : { success: true, placed };
}
