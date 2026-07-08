
// Fantasy Guild - Card Constants

/**
 * Card Types:
 * - task: Standard resource gathering
 * - recipe: Item crafting
 * - combat: Enemy encounters
 * - station: Outpost station (crafting queue and/or passive area buff)
 * - dungeon: Challenging combat with boss
 * - quest: One-time objectives rewarding Map Fragments or Chests
 * - chest: Loot containers
 * - blueprint: Guide cards attached to crafting tasks
 * - invasion: Threat events
 * - recruit: Hero recruitment
 * - pack: Unopened booster pack (stored in a Deck)
 * - pack_deck: Deck container for packs on the playmat
 * - quest_deck: Deck container for quests on the playmat
 * - chest_deck: Deck container for chests on the playmat
 *
 */
export const CARD_TYPES = {
    TASK: 'task',
    RECIPE: 'recipe',
    COMBAT: 'combat',
    STATION: 'station',
    DUNGEON: 'dungeon',
    QUEST: 'quest',
    CHEST: 'chest',
    BLUEPRINT: 'blueprint',
    INVASION: 'invasion',
    RECRUIT: 'recruit',
    PACK: 'pack',
    PACK_DECK: 'pack_deck',
    QUEST_DECK: 'quest_deck',
    CHEST_DECK: 'chest_deck',
    PROJECT: 'project',
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
// Kept for visual display (e.g., Unique card borders) only.
// Per-card rarity no longer affects productivity or spawn weights.
export const CARD_RARITIES = {
    BASIC: 'basic',
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary'
};


// Rarity display info (colors and labels)
export const RARITY_INFO = {
    [CARD_RARITIES.BASIC]: {
        label: 'Basic',
        color: '#8b7355',
        borderColor: '#6b5344'
    },
    [CARD_RARITIES.COMMON]: {
        label: 'Common',
        color: '#9ca3af',
        borderColor: '#6b7280'
    },
    [CARD_RARITIES.UNCOMMON]: {
        label: 'Uncommon',
        color: '#22c55e',
        borderColor: '#16a34a'
    },
    [CARD_RARITIES.RARE]: {
        label: 'Rare',
        color: '#3b82f6',
        borderColor: '#2563eb'
    },
    [CARD_RARITIES.EPIC]: {
        label: 'Epic',
        color: '#a855f7',
        borderColor: '#9333ea'
    },
    [CARD_RARITIES.LEGENDARY]: {
        label: 'Legendary',
        color: '#f59e0b',
        borderColor: '#d97706'
    }
};
