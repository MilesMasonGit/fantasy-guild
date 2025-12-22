/**
 * Fantasy Guild - Asset Manager
 * Universal utility for resolving visual assets (Sprites vs Emojis)
 * with consistent scaling and framing.
 * 
 * Used for Icons, Portraits, and UI assets across:
 * Items, Skills, Biomes, Heroes, and Cards.
 */

/**
 * Renders an icon with a consistent frame.
 * @param {Object|string} entityOrSprite - The object with .sprite/.icon or a direct sprite path
 * @param {string} className - Additional CSS class for the frame
 * @param {Object} options - { size: 64, isTag: false, icon: 'fallback emoji', name: 'title' }
 * @returns {string} HTML string
 */
export function renderIcon(entityOrSprite, className = '', options = {}) {
    const size = options.size || 64;
    const isTag = options.isTag || false;

    let spritePath = null;
    let emojiFallback = '📦';
    let titleText = options.name || '';

    // 1. Resolve Path and Fallback
    if (typeof entityOrSprite === 'string') {
        spritePath = entityOrSprite;
        emojiFallback = options.icon || '📦';
    } else if (entityOrSprite && typeof entityOrSprite === 'object') {
        spritePath = entityOrSprite.sprite;
        emojiFallback = entityOrSprite.icon || options.icon || '📦';
        if (!titleText && entityOrSprite.name) titleText = entityOrSprite.name;
    }

    // 2. Build Content
    let content = '';
    if (spritePath) {
        const tagClass = isTag ? 'pixel-art--tag' : '';
        // We use an onerror handler to fallback to emoji if the image fails to load
        // This handles cases where a sprite path is defined but the file is missing/broken
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

    // 3. Return Content (Naked elements)
    // We use a simple data attribute to allow for minimal styling if needed
    // but the visible "frame" is removed as requested.
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
    renderIcon
};
