// Fantasy Guild - Asset Manager
// Phase 3: Core Utilities

/**
 * AssetManager - Handles icon and image path resolution
 * Provides consistent paths for all game assets
 */

// Base paths for asset directories
const ASSET_BASE = '/src/assets';
const ICON_PATH = `${ASSET_BASE}/icons`;
const IMAGE_PATH = `${ASSET_BASE}/images`;

/**
 * Get the path to an icon
 * @param {string} category - Icon category (e.g., 'items', 'skills', 'classes')
 * @param {string} name - Icon name (without extension)
 * @param {string} extension - File extension (default: 'png')
 * @returns {string} Full path to the icon
 */
export function getIconPath(category, name, extension = 'png') {
    return `${ICON_PATH}/${category}/${name}.${extension}`;
}

/**
 * Get the path to an image
 * @param {string} category - Image category (e.g., 'backgrounds', 'cards')
 * @param {string} name - Image name (without extension)
 * @param {string} extension - File extension (default: 'png')
 * @returns {string} Full path to the image
 */
export function getImagePath(category, name, extension = 'png') {
    return `${IMAGE_PATH}/${category}/${name}.${extension}`;
}

/**
 * Get item icon path
 * @param {string} itemId - Item ID (snake_case)
 * @returns {string} Path to item icon
 */
export function getItemIcon(itemId) {
    return getIconPath('items', itemId);
}

/**
 * Get skill icon path
 * @param {string} skillId - Skill ID (camelCase)
 * @returns {string} Path to skill icon
 */
export function getSkillIcon(skillId) {
    return getIconPath('skills', skillId);
}

/**
 * Get class icon path
 * @param {string} classId - Class ID
 * @returns {string} Path to class icon
 */
export function getClassIcon(classId) {
    return getIconPath('classes', classId.toLowerCase());
}

/**
 * Get trait icon path
 * @param {string} traitId - Trait ID
 * @returns {string} Path to trait icon
 */
export function getTraitIcon(traitId) {
    return getIconPath('traits', traitId.toLowerCase());
}

/**
 * Get a placeholder icon for missing assets
 * @returns {string} Path to placeholder icon
 */
export function getPlaceholderIcon() {
    return getIconPath('ui', 'placeholder');
}

/**
 * Preload an image (for performance)
 * @param {string} path - Image path
 * @returns {Promise<HTMLImageElement>}
 */
export function preloadImage(path) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = path;
    });
}
