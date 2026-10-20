// which area banner a Region shows: its Base Map's pick, the Starter Camp's, else its main biome's

import * as Atlas from '../../../systems/atlas/Atlas.js';
import { isBaseMap } from '../../../systems/atlas/mapItems.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { authoredStarterCamp } from '../../../config/registries/starterCampRegistry.js';
import { isAreaBanner, defaultBannerFor, STARTER_CAMP_BIOME } from '../../../config/areaBanners.js';

/**
 * The banner the Base Maps among `ingredients` picked (item ids, in slot order): the one of the
 * main biome's map first, else the first map with a pick. Modifiers never change it. Null when
 * none picked one the game has.
 */
export function pickedBanner(ingredients, mainBiome = null) {
    const maps = (ingredients || []).map(id => getItem(id)).filter(def => isBaseMap(def) && isAreaBanner(def.banner));
    const main = mainBiome ? maps.find(def => def.cartography?.biome === mainBiome) : null;
    return (main || maps[0])?.banner || null;
}

/** The banner for a layout about to be settled: what its maps would write (`plan.ingredients`, `plan.summary.ground.main`). */
export function bannerForPlan(plan) {
    if (!plan) return null;
    const main = plan.summary?.ground?.main || null;
    return pickedBanner(plan.ingredients, main) || defaultBannerFor(main);
}

/** The banner Region `region` (a record or a `list()` summary) shows. */
export function bannerForRegion(region) {
    const record = region?.id ? Atlas.getRegion(region.id) || region : region;
    if (!record) return null;
    if (record.kind === Atlas.REGION_KIND.STARTER) {
        const picked = authoredStarterCamp()?.banner;
        if (isAreaBanner(picked)) return picked;
        return defaultBannerFor(record.ground?.main || STARTER_CAMP_BIOME);
    }
    const main = record.ground?.main || null;
    return pickedBanner(record.ingredients, main) || defaultBannerFor(main);
}

/** The banner of the Region the guild is in, or null before a game. */
export function liveRegionBanner() {
    const region = Atlas.activeRegion();
    return region ? bannerForRegion(region) : null;
}
