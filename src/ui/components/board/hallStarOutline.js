// The item outline drawn over each Guild Hall star, so stars read apart in the sky.

import { CONSTELLATIONS, rankEffectOf } from '../../../config/guildUpgrades.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../../../systems/effects/constants.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/** The built-in tracks' outlines, by id. */
const BUILT_IN = {
    roster_size: 't_bunk_bed',
    bank_tabs: 'i_key_gold',
    wishing_well: 'i_water'
};

/** A skill's tool, for a work-speed star. */
const SPEED_BY_SKILL = {
    forestry: 'i_woodaxe_copper',
    mining: 'i_pick_copper',
    smithing: 'i_tongs',
    fishing: 'i_rod_wood',
    farming: 'i_seed_pile',
    cooking: 'i_coal',
    crafting: 'i_chisel_copper',
    construction: 'i_stone_brick',
    alchemy: 'i_potion_bottle'
};

/** A skill's product, for a yield star. */
const YIELD_BY_SKILL = {
    forestry: 'i_wood_oak',
    mining: 'i_ore_copper',
    smithing: 'i_ingot_copper',
    fishing: 'i_trout_raw',
    farming: 'i_wheat',
    cooking: 'i_pie_cherry',
    crafting: 'i_plank_oak',
    construction: 'i_stone_brick',
    alchemy: 'i_potion_tube_green'
};

/** What grows back, for a regrowth star, by its constellation's skill. */
const GROW_BY_SKILL = {
    forestry: 'i_seedling_oak',
    mining: 'i_ore_iron',
    farming: 'i_apple',
    alchemy: 'i_lavender'
};

/** A loadout kind's item, for a loadout-slot star. */
const SLOT_BY_KIND = {
    food: 'i_bread',
    trinket: 'i_ring_gold_ruby'
};

/**
 * Which sprite a star's outline is drawn from: the star's own `outline` (an item id or a sprite
 * name) when it names one, else one picked by the star's kind from its first rank, or null for a
 * kind with no pick (a plain star).
 */
export function outlineSpriteName(def) {
    if (!def) return null;
    if (def.star?.outline) return def.star.outline;
    if (BUILT_IN[def.id]) return BUILT_IN[def.id];
    const first = rankEffectOf(def, 1);
    if (!first) return null;
    if (first.lines.length) return first.lines[0].itemId;
    const payload = first.rules[0]?.payload || {};
    const skill = CONSTELLATIONS.find(c => c.id === def.constellation)?.skill;
    switch (payload.type) {
        case EFFECT_TYPES.WORK_TIME: return SPEED_BY_SKILL[payload.category || skill] || null;
        case EFFECT_TYPES.YIELD: return YIELD_BY_SKILL[payload.category || skill] || null;
        case EFFECT_TYPES.XP_BONUS: return 'i_feather';
        case EFFECT_TYPES.CAMP_REACH: return 'i_torch';
        case EFFECT_TYPES.GROW_TIME: return GROW_BY_SKILL[payload.category || skill] || null;
        case EFFECT_TYPES.WOUND_TIME: return 'i_potion_round_red';
        case EFFECT_TYPES.LOADOUT_SLOTS: return SLOT_BY_KIND[payload.category] || null;
        default: return null;
    }
}

/** The outline's picture as a URL: an item id goes through its item's sprite. */
export function outlineSrc(def) {
    const name = outlineSpriteName(def);
    if (!name) return null;
    const path = resolveSpritePath(getItem(name) || name);
    if (!path) return null;
    return path.startsWith('/') ? path : `/${path}`;
}

/** The silhouette is read on a grid this many art pixels square (a bigger sprite is fitted to it). */
export const OUTLINE_GRID = 32;
/** One art pixel of dark edge around the bright line, each side. */
export const OUTLINE_ART_PX = OUTLINE_GRID + 2;
/** The outline draws at 2×, the sky's art pixel. */
export const OUTLINE_SCALE = 2;
export const OUTLINE_PX = OUTLINE_ART_PX * OUTLINE_SCALE;

const COLOUR = { grey: [170, 178, 200], blue: [138, 180, 255], gold: [255, 216, 74] };
const ALPHA = { locked: 0.32, buyable: 0.6, bought: 0.85, maxed: 1 };
const DARK = 'rgba(8,6,26,0.9)';

/** The bright line's colour for a star's look and state. */
export function outlineColour(look, state) {
    const c = COLOUR[look] || COLOUR.grey;
    return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0.55, ALPHA[state] ?? 0.5)})`;
}

/**
 * The edge of a silhouette: its filled cells with an empty 4-neighbour, as `[x, y]` pairs.
 * `filled(x, y)` says whether a cell is filled; outside the grid is empty.
 */
export function edgeCells(filled, n = OUTLINE_GRID) {
    const at = (x, y) => x >= 0 && y >= 0 && x < n && y < n && filled(x, y);
    const out = [];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) out.push([x, y]);
        }
    }
    return out;
}

const edgeCache = new Map();

/** A sprite's edge cells, read once per sprite for the session; null when it cannot be read. */
function edgeOf(src) {
    if (!edgeCache.has(src)) {
        edgeCache.set(src, new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = OUTLINE_GRID;
                canvas.height = OUTLINE_GRID;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) { resolve(null); return; }
                ctx.imageSmoothingEnabled = false;
                const s = Math.min(OUTLINE_GRID / img.width, OUTLINE_GRID / img.height);
                const w = Math.round(img.width * s);
                const h = Math.round(img.height * s);
                ctx.drawImage(img, Math.floor((OUTLINE_GRID - w) / 2), Math.floor((OUTLINE_GRID - h) / 2), w, h);
                const data = ctx.getImageData(0, 0, OUTLINE_GRID, OUTLINE_GRID).data;
                resolve(edgeCells((x, y) => data[(y * OUTLINE_GRID + x) * 4 + 3] > 96));
            };
            img.onerror = () => resolve(null);
            img.src = src;
        }));
    }
    return edgeCache.get(src);
}

/**
 * Draw a star's outline on its canvas (`OUTLINE_ART_PX` square): a dark edge one art pixel round
 * the bright line, so it reads over the star and the sky alike.
 */
export async function drawOutline(canvas, src, colour) {
    const edge = await edgeOf(src);
    const ctx = canvas?.getContext?.('2d');
    if (!edge || !ctx) return false;
    ctx.clearRect(0, 0, OUTLINE_ART_PX, OUTLINE_ART_PX);
    ctx.fillStyle = DARK;
    for (const [x, y] of edge) {
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillRect(x + 2, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + 2, 1, 1);
    }
    ctx.fillStyle = colour;
    for (const [x, y] of edge) ctx.fillRect(x + 1, y + 1, 1, 1);
    return true;
}
