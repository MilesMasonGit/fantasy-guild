/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 * 
 * Used for Icons, Portraits, and UI assets across:
 * Items, Skills, Biomes, Heroes, and Cards.
 */

// No longer using a static manifest. Handled via categorized discovery.
// const spriteManifest = { sprites: {} }; 

/**
 * Initializes the Asset Manager.
 * (Deprecated: Manifest loading removed in v2)
 */
export async function initializeAssets() {
    console.log('[AssetManager] Discovery System v2 Active (No manifest needed).');
}

/**
 * Priority search folders for discovery.
 * Sorted from most specific to least specific.
 */
const SEARCH_PATHS = [
    'assets/sprites/implemented/items/mining/ore/',
    'assets/sprites/implemented/items/mining/ingot/',
    'assets/sprites/implemented/items/equipment/battleaxe/',
    'assets/sprites/implemented/items/equipment/longsword/',
    'assets/sprites/implemented/items/equipment/staff/',
    'assets/sprites/implemented/items/crime/key/',
    'assets/sprites/implemented/items/drink/',
    'assets/sprites/implemented/items/wood/',
    'assets/sprites/implemented/biomes/',
    'assets/sprites/implemented/heroes/',
    'assets/sprites/implemented/skills/'
];

/**
 * Resolve a sprite path for a given ID using Discovery v2.
 */
export function resolveSpritePath(entity) {
    if (!entity) return null;
    if (typeof entity === 'string') return entity;

    const id = entity.id || entity;
    if (!id || typeof id !== 'string') return null;

    // 1. Explicit Override
    if (entity.sprite) return entity.sprite;

    // 2. Smart Path Guessing
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

    // 3. Fallback: Systematic Probe (Return list for renderer)
    return { id: id, isDiscovery: true };
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
    const tagClass = isTag ? 'pixel-art--tag' : '';

    if (spritePath && typeof spritePath === 'string') {
        // Standard String Path
        content = `
            <img src="${spritePath}" 
                 class="pixel-art ${tagClass}" 
                 style="width: ${size}px; height: ${size}px;" 
                 onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"
                 alt="${titleText}"
            >
            <span class="emoji-art" style="display:none;">${emojiFallback}</span>
        `;
    } else if (spritePath && spritePath.isDiscovery) {
        // Discovery v2 Probing
        const id = spritePath.id;
        const possiblePaths = SEARCH_PATHS.map(p => `${p}${id}.png`);

        content = possiblePaths.map((path, index) => `
            <img src="${path}" 
                 class="pixel-art ${tagClass} discovery-probe" 
                 style="width: ${size}px; height: ${size}px; display: none;" 
                 onload="this.style.display='block'; this.parentNode.querySelectorAll('.discovery-probe').forEach(img => { if(img !== this) img.remove(); });"
                 onerror="this.remove();"
                 alt="${titleText}"
            >
        `).join('') + `<span class="emoji-art">${emojiFallback}</span>`;
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
