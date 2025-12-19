
// Fantasy Guild - Card Constants

/**
 * Card Types:
 * - task: Standard resource gathering
 * - recipe: Item crafting
 * - explore: Area discovery
 * - area: Project selection
 * - combat: Enemy encounters
 * - invasion: Threat events
 * - recruit: Hero recruitment
 */
export const CARD_TYPES = {
    TASK: 'task',
    RECIPE: 'recipe',
    EXPLORE: 'explore',
    AREA: 'area',
    COMBAT: 'combat',
    INVASION: 'invasion',
    RECRUIT: 'recruit'
};

// === Task Category Constants ===
// Used for project bonuses that apply to specific task types
export const TASK_CATEGORIES = {
    WATER: 'water',           // Well, water collection
    LOGGING: 'logging',       // Tree cutting, wood gathering
    MINING: 'mining',         // Ore extraction, stone quarrying
    FISHING: 'fishing',       // Catching fish
    FORAGING: 'foraging',     // Herbs, berries gathering
    HUNTING: 'hunting',       // Animal hunting
    SMELTING: 'smelting',     // Ore processing
    CRAFTING: 'crafting',     // General item creation
    COOKING: 'cooking',       // Food preparation
    COMBAT: 'combat',         // Fighting enemies
    INTRIGUE: 'intrigue'      // Social manipulation, rumors, spying
};

// === Card Rarity Constants ===
// Defines rarity tiers for task cards, used for Trade Up mechanics
export const CARD_RARITIES = {
    BASIC: 'basic',           // Guild Hall only - not part of Trade Up
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary'
};

// Rarity spawn weights (used when rolling rarity for new task cards)
// Higher weights = more likely to spawn. Rare+ unlocked via Projects.
export const RARITY_SPAWN_WEIGHTS = {
    [CARD_RARITIES.COMMON]: 70,
    [CARD_RARITIES.UNCOMMON]: 30,
    [CARD_RARITIES.RARE]: 0,      // Unlocked via Projects
    [CARD_RARITIES.EPIC]: 0,      // Unlocked via Projects
    [CARD_RARITIES.LEGENDARY]: 0  // Unlocked via Projects
};

// Rarity display info (colors and labels)
export const RARITY_INFO = {
    [CARD_RARITIES.BASIC]: {
        label: 'Basic',
        color: '#8b7355',      // Brown/tan (matches Guild Hall)
        borderColor: '#6b5344'
    },
    [CARD_RARITIES.COMMON]: {
        label: 'Common',
        color: '#9ca3af',      // Gray
        borderColor: '#6b7280'
    },
    [CARD_RARITIES.UNCOMMON]: {
        label: 'Uncommon',
        color: '#22c55e',      // Green
        borderColor: '#16a34a'
    },
    [CARD_RARITIES.RARE]: {
        label: 'Rare',
        color: '#3b82f6',      // Blue
        borderColor: '#2563eb'
    },
    [CARD_RARITIES.EPIC]: {
        label: 'Epic',
        color: '#a855f7',      // Purple
        borderColor: '#9333ea'
    },
    [CARD_RARITIES.LEGENDARY]: {
        label: 'Legendary',
        color: '#f59e0b',      // Orange/Gold
        borderColor: '#d97706'
    }
};

/**
 * Roll a random rarity for a new task card based on spawn weights
 * @returns {string} - The rolled rarity (e.g., 'common', 'uncommon')
 */
export function rollRarity() {
    const totalWeight = Object.values(RARITY_SPAWN_WEIGHTS).reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
        return CARD_RARITIES.COMMON; // Fallback if no weights
    }

    let roll = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(RARITY_SPAWN_WEIGHTS)) {
        roll -= weight;
        if (roll <= 0) {
            return rarity;
        }
    }

    return CARD_RARITIES.COMMON; // Fallback
}
