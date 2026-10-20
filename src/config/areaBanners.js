// the area banners: the owner's environment pictures that stand for a Region (pure, the CMS reads it too)

import { SPRITE_MANIFEST } from './registries/sprite-manifest.js';

/** Where the banners live: every sprite in this folder is one. */
const AREA_DIR = 'assets/backgrounds/area/';

/** Every banner's sprite name, in name order (the CMS picker's choices). */
export function areaBannerIds(manifest = SPRITE_MANIFEST) {
    return Object.keys(manifest).filter(id => String(manifest[id]).startsWith(AREA_DIR)).sort();
}

/** Whether `id` names a banner the game has. */
export function isAreaBanner(id, manifest = SPRITE_MANIFEST) {
    return typeof id === 'string' && String(manifest[id] || '').startsWith(AREA_DIR);
}

/** A banner's picture as a page path, or null. */
export function areaBannerSrc(id, manifest = SPRITE_MANIFEST) {
    return isAreaBanner(id, manifest) ? `/${manifest[id]}` : null;
}

/** "b_lush_forest" → "Lush forest", for pickers and alt text. */
export function areaBannerLabel(id) {
    const words = String(id || '').replace(/^b_/, '').replace(/_/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/**
 * The banner a Region shows when nothing picked one, by its main biome (owner, 2026-10-20: one
 * default per biome). A biome missing here, or a Region with none, shows the fallback.
 */
export const DEFAULT_BANNER_BY_BIOME = Object.freeze({
    forest: 'b_lush_forest',
    coast: 'b_beach',
    mountain: 'b_mountains_snowy',
    meadow: 'b_golden_plains',
    flower_meadow: 'b_farmland',
    cherry_grove: 'b_hidden_valley',
    yellowstone: 'b_desert_oasis',
    volcano: 'b_desert_monolith',
    swamp: 'b_swamp',
    desert: 'b_desert'
});

/** The Starter Camp's ground when it keeps none of its own. */
export const STARTER_CAMP_BIOME = 'meadow';

export const FALLBACK_BANNER = 'b_village';

/** The default banner for a main biome. */
export function defaultBannerFor(biome) {
    return DEFAULT_BANNER_BY_BIOME[biome] || FALLBACK_BANNER;
}
