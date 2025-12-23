/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 * 
 * Used for Icons, Portraits, and UI assets across:
 * Items, Skills, Biomes, Heroes, and Cards.
 */

let spriteManifest = { sprites: {} };

/**
 * Initializes the Asset Manager by loading the sprite manifest.
 * This should be called once at application startup.
 */
export async function initializeAssets() {
    try {
        const response = await fetch('assets/sprite_manifest.json');
        if (!response.ok) throw new Error('Manifest not found');
        spriteManifest = await response.json();
        console.log(`[AssetManager] Loaded ${Object.keys(spriteManifest.sprites).length} sprites.`);
    } catch (err) {
        console.warn('[AssetManager] Failed to load sprite manifest, falling back to emojis/hardcoded paths.', err);
    }
}

/**
 * Resolve a sprite path for a given ID.
 * Priority: 
 * 1. Hardcoded .sprite property (legacy/override)
 * 2. Automated manifest match (id.png)
 * @param {Object|string} entity - The object to resolve
 * @returns {string|null}
 */
export function resolveSpritePath(entity) {
    if (!entity) return null;

    // Handle string inputs (direct paths)
    if (typeof entity === 'string') return entity;

    // 1. Explicit Override
    if (entity.sprite) return entity.sprite;

    // 2. Automated lookup by ID
    if (entity.id && spriteManifest.sprites[entity.id]) {
        return spriteManifest.sprites[entity.id];
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

    let content = '';
    if (spritePath) {
        const tagClass = isTag ? 'pixel-art--tag' : '';
        content = `
            <img src="${spritePath}" 
                 class="pixel-art ${tagClass}" 
                 style="width: ${size}px; height: ${size}px;" 
                 onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"
                 alt="${titleText}"
            >
            <span class="emoji-art" style="display:none;">${emojiFallback}</span>
        `;
    } else {
        content = `<span class="emoji-art">${emojiFallback}</span>`;
    }

    return `
        <div class="asset-container ${className}" 
             style="width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; position: relative;" 
             title="${titleText}"
        >
            ${content}
        </div>
    `;
}

export default {
    initializeAssets,
    renderIcon,
    resolveSpritePath
};
