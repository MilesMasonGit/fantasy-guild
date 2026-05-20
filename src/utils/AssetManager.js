import { SPRITE_MANIFEST } from '../config/registries/sprite-manifest.js';

/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 */

/**
 * Legacy support for main.jsx
 */
export async function initializeAssets() {
    return Promise.resolve();
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

    // 1. If it's already a full path, return it (safety check)
    if (typeof entity === 'string' && entity.startsWith('assets/')) return entity;

    // 2. Resolve ID for Manifest Lookup
    // Priority: spriteId (New) > classId (Legacy) > templateId > ID
    let id = null;
    if (typeof entity === 'object') {
        id = entity.spriteId || entity.sprite || entity.classId || entity.templateId || entity.id || entity.itemId;
    } else {
        id = entity;
    }

    // 3. Static Manifest (O1 Lookup)
    if (id && SPRITE_MANIFEST[id]) {
        return SPRITE_MANIFEST[id];
    }

    // 4. Explicit Path check (Fallback if not in manifest)
    if (typeof entity === 'object' && entity.sprite && typeof entity.sprite === 'string') {
        if (entity.sprite.startsWith('assets/')) return entity.sprite;
    }

    // 5. Smart Item Guessing (Restricted to non-hero items)
    if (!id || typeof id !== 'string') return null;
    if (id.startsWith('hero_')) return null; // Heroes must be in manifest or have explicit paths

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
        return `assets/sprites/implemented/items/${folder}${id}.png`;
    }

    // Background/Scene Detection
    if (id.startsWith('bg_') || id.startsWith('scene_')) {
        if (id.includes('.')) {
            const baseId = id.split('.')[0];
            if (SPRITE_MANIFEST[baseId]) return SPRITE_MANIFEST[baseId];
            return `assets/sprites/implemented/biomes/${id}`;
        }
        return `assets/sprites/implemented/biomes/${id}.png`;
    }

    return null;
}

/**
 * Renders an icon with a consistent frame.
 */
export function renderIcon(entityOrSprite, className = '', options = {}) {
    const size = options.size || 64;
    const isTag = options.isTag || false;

    let spritePath = resolveSpritePath(entityOrSprite);
    let emojiFallback = '📦';
    let titleText = options.name || '';

    // Resolve Fallback and Title
    if (typeof entityOrSprite === 'object' && entityOrSprite !== null) {
        emojiFallback = entityOrSprite.icon || options.icon || '📦';
        if (!titleText && entityOrSprite.name) titleText = entityOrSprite.name;
    } else {
        emojiFallback = options.icon || '📦';
    }

    const tagClass = isTag ? 'pixel-art--tag' : '';

    if (spritePath) {
        return `
            <div class="asset-container ${className}" 
                 style="width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; position: relative;" 
                 title="${titleText}"
            >
                <img src="${spritePath}" 
                     class="pixel-art ${tagClass}" 
                     style="width: ${size}px; height: ${size}px;" 
                     onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"
                     alt="${titleText}"
                >
                <span class="emoji-art" style="display:none;">${emojiFallback}</span>
            </div>
        `;
    }

    return `
        <div class="asset-container ${className}" 
             style="width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; position: relative;" 
             title="${titleText}"
        >
            <span class="emoji-art">${emojiFallback}</span>
        </div>
    `;
}

export default {
    renderIcon,
    resolveSpritePath
};
