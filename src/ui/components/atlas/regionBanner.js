// which area banner a Region shows: the Starter Camp's, else its main biome's

import * as Atlas from '../../../systems/atlas/Atlas.js';
import { authoredStarterCamp } from '../../../config/registries/starterCampRegistry.js';
import { isAreaBanner, defaultBannerFor, STARTER_CAMP_BIOME } from '../../../config/areaBanners.js';

/** The banner Region `region` (a record or a `list()` summary) shows. */
export function bannerForRegion(region) {
    const record = region?.id ? Atlas.getRegion(region.id) || region : region;
    if (!record) return null;
    if (record.kind === Atlas.REGION_KIND.STARTER) {
        const picked = authoredStarterCamp()?.banner;
        if (isAreaBanner(picked)) return picked;
        return defaultBannerFor(record.ground?.main || STARTER_CAMP_BIOME);
    }
    return defaultBannerFor(record.ground?.main || null);
}

/** The banner of the Region the guild is in, or null before a game. */
export function liveRegionBanner() {
    const region = Atlas.activeRegion();
    return region ? bannerForRegion(region) : null;
}
