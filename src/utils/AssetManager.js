import { SPRITE_MANIFEST } from '../config/registries/sprite-manifest.js';
import { LEGACY_SPRITE_NAMES } from '../config/registries/legacySpriteNames.js';

/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 *
 * A sprite name is its file's name (`docs/reference/ASSET_NAMING.md`). Names from before the art
 * was renamed still resolve through `LEGACY_SPRITE_NAMES`, because content and saves may hold them.
 */

// ⚠️ ART ALIASES, not live concepts. `AREA_ART_MAP` keys are area ids and
// `HERO_MAP` keys are class names; areas and classes are retired. Both survive
// only so old ids still find a picture.
//
// Module scope on purpose: `resolveSpritePath` runs once per visible sprite per
// render, so declaring them inside would allocate two objects per icon.

/** CMS area-background id → art name. */
const AREA_ART_MAP = {
    bg_area_guild_hall: 'b_guild_hall',
    bg_area_whispering_woods: 'b_lush_forest',
    bg_area_misty_mountains: 'b_mountains_snowy',
    bg_area_sunken_bog: 'b_swamp'
};

/** Retired class name → hero portrait name. */
const HERO_MAP = {
    fighter: 'hm_fighter_por',
    ranger: 'hn_range_por',
    wizard: 'hm_wizard_por',
    rogue: 'hn_sneak_por',
    paladin: 'hm_cleric_por',
    cleric: 'hm_cleric_por',
    bard: 'hm_bard_por',
    alchemist: 'hf_alchemist_por',
    engineer: 'hm_blacksmith_por',
    adventure: 'hn_adventure_por'
};

/** Skill id → skill icon name, for a skill asked for by its id. */
const SKILL_MAP = {
    mining: 's_mining',
    forestry: 's_logging',
    fishing: 's_fishing',
    smithing: 's_smithing',
    crafting: 's_crafting',
    cooking: 's_cooking',
    melee: 's_melee',
    ranged: 's_ranged',
    magic: 's_magic',
    crime: 's_crime'
};

/**
 * A hero's portrait or class name → its animation sheet. Only these heroes animate; any other
 * draws its still portrait.
 */
const ANIMATION_MAP = {
    hn_recruit_por: 'hn_recruit_sheet',
    hn_recruit_icon_por: 'hn_recruit_sheet',
    recruit: 'hn_recruit_sheet',
    hm_fighter_por: 'hn_fighter_sheet',
    fighter: 'hn_fighter_sheet',
    hn_sneak_por: 'hn_rogue_sheet',
    rogue: 'hn_rogue_sheet',
    hm_wizard_por: 'hn_wizard_sheet',
    wizard: 'hn_wizard_sheet',
    hn_range_por: 'hn_ranger_sheet',
    ranger: 'hn_ranger_sheet'
};

/**
 * Enemy Token sprite name → animation sheet path. Only a Token whose sprite is
 * listed animates; every other enemy keeps its static art.
 *
 * ⚠️ A different grid from a hero's sheet: 4 columns × 4 rows of 64px frames,
 * not 8×3. See `AnimatedEnemySprite.jsx`.
 */
const ENEMY_ANIMATION_MAP = {
    e_cow: 'assets/enemies/animal/e_cow_sheet.png'
};

/** The current name for a sprite name, which may be one from before the art was renamed. */
export function currentSpriteName(name) {
    if (typeof name !== 'string') return name;
    return Object.prototype.hasOwnProperty.call(LEGACY_SPRITE_NAMES, name) ? LEGACY_SPRITE_NAMES[name] : name;
}

/**
 * The animation sheet for an enemy Token's sprite, or null if it has
 * none yet. `spriteId` is the Token def's own `sprite` field.
 */
export function resolveEnemyAnimationPath(spriteId) {
    return ENEMY_ANIMATION_MAP[currentSpriteName(spriteId)] || null;
}

/**
 * Resolve a sprite path for a given ID.
 * Priority:
 * 1. A path (`assets/...`) is returned as it is
 * 2. An area id or a retired class name, through its own table
 * 3. The current name for an old one
 * 4. A hero portrait or skill icon by its prefix, a skill by its id
 * 5. The manifest
 * 6. An entity's own `sprite` or `background` path
 */
export function resolveSpritePath(entity) {
    if (!entity) return null;

    if (typeof entity === 'string' && entity.startsWith('assets/')) return entity;

    let id;
    if (typeof entity === 'object') {
        id = entity.spriteId || entity.sprite || entity.background || entity.classId || entity.templateId || entity.id || entity.itemId;
    } else {
        id = entity;
    }
    if (!id || typeof id !== 'string') return null;

    if (AREA_ART_MAP[id]) id = AREA_ART_MAP[id];
    if (HERO_MAP[id]) return `assets/heroes/${HERO_MAP[id]}.png`;
    id = currentSpriteName(id);

    if (/^h[fmn]_/.test(id)) return `assets/heroes/${id}.png`;
    if (id.startsWith('s_')) return `assets/skills/${id}.png`;
    if (SKILL_MAP[id]) return `assets/skills/${SKILL_MAP[id]}.png`;

    if (SPRITE_MANIFEST[id]) return SPRITE_MANIFEST[id];

    if (typeof entity === 'object') {
        if (typeof entity.sprite === 'string' && entity.sprite.startsWith('assets/')) return entity.sprite;
        if (typeof entity.background === 'string' && entity.background.startsWith('assets/')) return entity.background;
    }
    return null;
}

export function resolveAnimationPath(entity) {
    const id = typeof entity === 'object' && entity !== null
        ? (entity.spriteId || entity.sprite || entity.classId || entity.templateId || entity.id)
        : entity;
    if (!id || typeof id !== 'string') return null;
    const sheet = ANIMATION_MAP[id] || ANIMATION_MAP[currentSpriteName(id)];
    return sheet ? `assets/heroes/${sheet}.png` : null;
}
