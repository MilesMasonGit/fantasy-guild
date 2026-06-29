import { SPRITE_MANIFEST } from '../config/registries/sprite-manifest.js';

/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 */

/**
 * Legacy support for main.jsx
 */
export function initializeAssets() {
    // No-op legacy support
}

/**
 * Resolve a sprite path for a given ID using Manifest Lookups.
 * Priority: 
 * 1. Explicit .sprite property on entity
 * 2. Static Manifest (SPRITE_MANIFEST)
 * 3. Smart Path Guessing (Fallbacks)
 */
export function resolveSpritePath(entity) {
    if (!entity) return null;

    // 1. If it's already a full path, return it (safety check, translating playmat legacy paths)
    if (typeof entity === 'string' && entity.startsWith('assets/')) {
        let path = entity;
        if (path.startsWith('assets/backgrounds/playmat/')) {
            const fileName = path.substring(path.lastIndexOf('/') + 1);
            if (fileName.startsWith('pm_table_')) {
                path = `assets/playmat/tables/${fileName}`;
            } else if (fileName.startsWith('pm_board_')) {
                path = `assets/playmat/tiles/${fileName}`;
            }
        }
        return path;
    }

    // 2. Resolve ID for Manifest Lookup
    // Priority: spriteId (New) > classId (Legacy) > templateId > ID
    let id = null;
    if (typeof entity === 'object') {
        id = entity.spriteId || entity.sprite || entity.background || entity.classId || entity.templateId || entity.id || entity.itemId;
    } else {
        id = entity;
    }

    // CMS Area Art translation
    const AREA_ART_MAP = {
        bg_area_guild_hall: 'bg_guild_hall',
        bg_area_whispering_woods: 'bg_lush_forest',
        bg_area_misty_mountains: 'bg_mountains_snowy',
        bg_area_sunken_bog: 'bg_swamp'
    };

    if (id && AREA_ART_MAP[id]) {
        id = AREA_ART_MAP[id];
    }

    let spritePath = null;

    // Direct Hero Sprite & Class ID Mapping (Bypass broken static manifests)
    if (id && typeof id === 'string') {
        const HERO_MAP = {
            // Classes
            fighter: 'hm_fighter',
            ranger: 'hn_range',
            wizard: 'hm_wizard',
            rogue: 'hn_sneak',
            paladin: 'hm_cleric',
            cleric: 'hm_cleric',
            bard: 'hm_bard',
            alchemist: 'hf_alchemist',
            engineer: 'hm_blacksmith',
            adventure: 'hn_adventure1',

            // Custom Selectors
            hero_adventure: 'hn_adventure1',
            hero_knight: 'hm_fighter',
            hero_rogue: 'hn_sneak',
            hero_warlock: 'hm_wizard',
            hero_wizard: 'hm_wizard',
            hero_wizard_arcane: 'hm_wizard',
        };

        if (HERO_MAP[id]) {
            spritePath = `assets/heroes/${HERO_MAP[id]}.png`;
        } else if (id.startsWith('hf_') || id.startsWith('hm_') || id.startsWith('hn_')) {
            spritePath = `assets/heroes/${id}.png`;
        }
    }

    // Direct Playmat ID mapping
    if (!spritePath && id && typeof id === 'string') {
        if (id.startsWith('pm_table_')) {
            spritePath = `assets/playmat/tables/${id}.png`;
        } else if (id.startsWith('pm_board_')) {
            spritePath = `assets/playmat/tiles/${id}.png`;
        }
    }

    // 3. Static Manifest (O1 Lookup)
    if (!spritePath && id && SPRITE_MANIFEST[id]) {
        spritePath = SPRITE_MANIFEST[id];
    }

    // 4. Explicit Path check (Fallback if not in manifest)
    if (!spritePath && typeof entity === 'object') {
        if (entity.sprite && typeof entity.sprite === 'string' && entity.sprite.startsWith('assets/')) spritePath = entity.sprite;
        else if (entity.background && typeof entity.background === 'string' && entity.background.startsWith('assets/')) spritePath = entity.background;
    }

    // 5. Smart Item Guessing (Restricted to non-hero items)
    if (!spritePath && id && typeof id === 'string' && !id.startsWith('hero_')) {
        let folder = '';
        if (id.startsWith('ore_')) folder = 'mining/ore/';
        else if (id.startsWith('ingot_')) folder = 'mining/ingot/';
        else if (id.startsWith('battleaxe_')) folder = 'equipment/battleaxe/';
        else if (id.startsWith('longsword_')) folder = 'equipment/longsword/';
        else if (id.startsWith('staff_')) folder = 'equipment/staff/';
        else if (id.startsWith('key_')) folder = 'crime/key/';
        else if (id.startsWith('drink_')) folder = 'drink/';
        else if (id.startsWith('wood_')) folder = 'wood/';

        if (folder) {
            spritePath = `assets/sprites/implemented/items/${folder}${id}.png`;
        } else if (id.startsWith('bg_') || id.startsWith('scene_')) {
            if (id.includes('.')) {
                const baseId = id.split('.')[0];
                if (SPRITE_MANIFEST[baseId]) {
                    spritePath = SPRITE_MANIFEST[baseId];
                } else {
                    spritePath = `assets/sprites/implemented/biomes/${id}`;
                }
            } else {
                spritePath = `assets/sprites/implemented/biomes/${id}.png`;
            }
        }
    }

    // Runtime path translation for reorganized assets
    if (spritePath && typeof spritePath === 'string') {
        if (spritePath.startsWith('assets/sprites/implemented/biomes/')) {
            const fileName = spritePath.substring('assets/sprites/implemented/biomes/'.length);
            spritePath = `assets/backgrounds/area/${fileName}`;
        } else if (spritePath.startsWith('assets/sprites/implemented/tasks/')) {
            const fileName = spritePath.substring('assets/sprites/implemented/tasks/'.length);
            if (fileName === 'bg_wishing_well.png') {
                spritePath = `assets/backgrounds/cards/guild_hall/${fileName}`;
            } else {
                spritePath = `assets/backgrounds/area/${fileName}`;
            }
        } else if (spritePath.startsWith('assets/sprites/implemented/items/')) {
            let rest = spritePath.substring('assets/sprites/implemented/items/'.length);
            // Translate intermediate legacy path segments to match reorganized disk locations
            if (rest.startsWith('mining/ore/')) {
                rest = rest.substring('mining/'.length);
            } else if (rest.startsWith('mining/ingot/')) {
                rest = rest.substring('mining/'.length);
            } else if (rest.startsWith('crime/key/')) {
                rest = rest.substring('crime/'.length);
            } else if (rest.startsWith('equipment/battleaxe/')) {
                rest = rest.replace('equipment/battleaxe/battleaxe_', 'weapon/axe/w_axe_');
            } else if (rest.startsWith('equipment/longsword/')) {
                rest = rest.replace('equipment/longsword/longsword_', 'weapon/sword/w_sword_');
            } else if (rest.startsWith('equipment/staff/')) {
                rest = rest.replace('equipment/staff/staff_', 'weapon/staff/w_staff_');
            } else if (rest.startsWith('drink/drink_')) {
                rest = rest.replace('drink/drink_', 'drink/d_');
            }
            spritePath = `assets/items/${rest}`;
        } else if (spritePath.startsWith('assets/sprites/implemented/enemies/')) {
            const rest = spritePath.substring('assets/sprites/implemented/enemies/'.length);
            spritePath = `assets/enemies/${rest}`;
        } else if (spritePath.startsWith('assets/sprites/implemented/heroes/')) {
            const rest = spritePath.substring('assets/sprites/implemented/heroes/'.length);
            spritePath = `assets/heroes/${rest}`;
        } else if (spritePath.startsWith('assets/sprites/implemented/skills/')) {
            const rest = spritePath.substring('assets/sprites/implemented/skills/'.length);
            spritePath = `assets/skills/${rest}`;
        } else if (spritePath.startsWith('assets/sprites/playmat/')) {
            const rest = spritePath.substring('assets/sprites/playmat/'.length);
            spritePath = `assets/playmat/${rest}`;
        } else if (spritePath.startsWith('assets/backgrounds/playmat/')) {
            const fileName = spritePath.substring(spritePath.lastIndexOf('/') + 1);
            if (fileName.startsWith('pm_table_')) {
                spritePath = `assets/playmat/tables/${fileName}`;
            } else if (fileName.startsWith('pm_board_')) {
                spritePath = `assets/playmat/tiles/${fileName}`;
            }
        }
    }

    return spritePath;
}

export function renderIcon(entityOrSprite, className = '', options = {}) {
    const size = options.size || 64;
    const isTag = options.isTag || false;

    let spritePath = resolveSpritePath(entityOrSprite);
    let titleText = options.name || '';

    // Resolve Title
    if (typeof entityOrSprite === 'object' && entityOrSprite !== null) {
        if (!titleText && entityOrSprite.name) titleText = entityOrSprite.name;
    }

    const tagClass = isTag ? 'pixel-art--tag' : '';

    const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 50%; height: 50%; opacity: 0.4; color: currentColor;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>
    `;

    if (spritePath) {
        return `
            <div class="asset-container ${className}" 
                 style="width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; position: relative; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; background: rgba(0,0,0,0.15);" 
                 title="${titleText}"
            >
                <img src="${spritePath}" 
                     class="pixel-art ${tagClass}" 
                     style="width: ${size}px; height: ${size}px;" 
                     onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';"
                     alt="${titleText}"
                >
                <div class="placeholder-art" style="display:none; width: 100%; height: 100%; align-items: center; justify-content: center;">
                    ${placeholderSvg}
                </div>
            </div>
        `;
    }

    return `
        <div class="asset-container ${className}" 
             style="width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; position: relative; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; background: rgba(0,0,0,0.15);" 
             title="${titleText}"
        >
            <div class="placeholder-art" style="width: 100%; height: 100%; display: inline-flex; align-items: center; justify-content: center;">
                ${placeholderSvg}
            </div>
        </div>
    `;
}

export default {
    renderIcon,
    resolveSpritePath
};
