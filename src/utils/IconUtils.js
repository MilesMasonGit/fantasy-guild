/**
 * getTagIconData
 * Returns representative data for an item tag (sprite ID or emoji).
 * 
 * @param {string} tag - The item tag (e.g., 'ore', 'wood', 'fuel')
 * @returns {Object} icon data { id: string, icon: string }
 */
export function getTagIconData(tag) {
    const tagData = {
        'ore': { id: 'ore_copper', icon: '⛏️' },
        'fuel': { id: 'ore_coal', icon: '🔥' },
        'wood': { id: 'wood_oak', icon: '🪵' },
        'stone': { icon: '🪨' },
        'metal': { id: 'ingot_copper', icon: '⚙️' },
        'tool': { icon: '🔨' },
        'weapon': { icon: '⚔️' },
        'armor': { icon: '🛡️' },
        'consumable': { icon: '🧪' },
        'material': { icon: '📦' },
        'gem': { icon: '💎' },
        'key': { id: 'key_copper', icon: '🗝️' },
        'water': { id: 'drink_water', icon: '💧' },
        'drink': { id: 'drink_water', icon: '💧' },
    };
    return tagData[tag.toLowerCase()] || { icon: '📦' };
}

export default {
    getTagIconData
};
