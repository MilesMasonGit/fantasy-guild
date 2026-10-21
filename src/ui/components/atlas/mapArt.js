// a map's picture on the Cartography table, and what it adds in words

import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getItem, ITEM_TYPES } from '../../../config/registries/itemRegistry.js';
import { whatItWrites, MAP_TEXT } from '../../../systems/atlas/mapItems.js';

/** A map with no picture of its own: the plain scroll. */
export const FALLBACK_MAP_SPRITE = 't_map_base';

/**
 * Pictures for the dev console's placeholder maps (`devMaps.js`), which are recipes, not items, so
 * no CMS sprite: by id first, else by biome. Placeholders only; real maps name theirs in the CMS.
 */
export const DEV_MAP_SPRITES = Object.freeze({
    byId: Object.freeze({
        dev_mod_overgrown: 't_map_jungle',
        dev_mod_fir_grove: 't_map_frozenpeak',
        dev_mod_goblin_camp: 't_map_pirate',
        dev_mod_chest: 't_map_guild',
        dev_map_place_copper: 't_map_mountain_copper',
        dev_map_place_lake: 't_map_archipeligo',
        dev_map_water_lake: 't_map_archipeligo',
        dev_map_water_lake_river: 't_map_islands',
        dev_map_water_split: 't_map_islands',
        dev_map_water_spring: 't_map_archipeligo',
        dev_map_water_tarn: 't_map_frozenpeak',
        dev_map_water_sea: 't_map_sandbar'
    }),
    byBiome: Object.freeze({
        forest: 't_map_forest',
        mountain: 't_map_mountain',
        coast: 't_map_shore',
        meadow: 't_map_farmland',
        flower_meadow: 't_map_flowers',
        cherry_grove: 't_map_village',
        yellowstone: 't_map_swamp',
        volcano: 't_map_volcano'
    })
});

const absolute = (path) => (path && !path.startsWith('/') ? `/${path}` : path);

/**
 * The picture a map shows: its item's sprite (set in the CMS), else a dev placeholder's, else the
 * plain scroll. Never null.
 *
 * @param {{id: string, biome?: string}} recipe  a held map's recipe (`Atlas.held()`)
 */
export function mapSpritePath(recipe) {
    const item = getItem(recipe?.id);
    const own = item ? resolveSpritePath(item) : null;
    if (own) return absolute(own);
    const name = DEV_MAP_SPRITES.byId[recipe?.id] || DEV_MAP_SPRITES.byBiome[recipe?.biome] || FALLBACK_MAP_SPRITE;
    return absolute(resolveSpritePath(name) || resolveSpritePath(FALLBACK_MAP_SPRITE));
}

/** What a map is called on the table: its item's name, else its recipe's. */
export function mapName(recipe) {
    return getItem(recipe?.id)?.name || recipe?.name || recipe?.id || '';
}

/**
 * A map's hover lines: its kind, then what it adds under the Token cap `cap`
 * (`mapItems.whatItWrites`). A dev recipe is read as the item it stands in for.
 */
export function mapHoverLines(recipe, cap) {
    const modifier = recipe?.kind === 'modifier';
    const def = getItem(recipe?.id) || {
        id: recipe?.id,
        type: modifier ? ITEM_TYPES.MODIFIER : ITEM_TYPES.MAP,
        cartography: recipe
    };
    const writes = whatItWrites(def, { cap });
    return [
        MAP_TEXT.typeLabel[def.type] || null,
        writes?.headline || null,
        ...(writes?.lines || []).map(line => line.text)
    ].filter(Boolean);
}

/**
 * An empty slot's dashed outline: the map pictures' tilted sheet, in their 64-pixel art's own
 * pixels (`tokens/map/`).
 */
export const MAP_OUTLINE_POINTS = '16,7 61,15 51,55 2,43';
