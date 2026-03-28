/**
 * Effect & Modifier Engine Constants
 */

export const EFFECT_TYPES = {
    SPEED: 'SPEED',           // Task tick speed, combat attack speed
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage
    DEFENSE: 'DEFENSE',       // Damage reduction
    XP_BONUS: 'XP_BONUS',     // Bonus XP gain
    LOOT_MULT: 'LOOT_MULT',   // Chance for double loot
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    HP_REGEN: 'HP_REGEN',     // Health regeneration
    LOGIC_OVERRIDE: 'LOGIC_OVERRIDE' // Complex logic triggers (e.g., ignore_defense)
};

export const TARGET_CATEGORIES = {
    ALL: 'ALL',
    // Parent Categories / Skills
    INDUSTRY: 'industry',
    NATURE: 'nature',
    NAUTICAL: 'nautical',
    CRAFTING: 'crafting',
    CULINARY: 'culinary',
    SOCIAL: 'social',
    CRIME: 'crime',
    OCCULT: 'occult',
    SCIENCE: 'science',
    COMBAT: 'combat',
    
    // Combat Specifics
    MELEE: 'melee',
    RANGED: 'ranged',
    MAGIC: 'magic',
    DEFENCE: 'defence',

    // Gathering Specifics
    MINING: 'mining',
    SMELTING: 'smelting',
    SMITHING: 'smithing',
    LOGGING: 'logging',
    FORAGING: 'foraging',
    HERBALISM: 'herbalism',
    HARVESTING: 'harvesting',
    HUNTING: 'hunting',
    FISHING: 'fishing',

    // special specifics
    INTRIGUE: 'intrigue',
    COOKING: 'cooking'
};

export const SCOPES = {
    SELF: 'SELF',
    ADJACENT: 'ADJACENT',
    GLOBAL: 'GLOBAL'
};

export const MODIFIER_SOURCE_TYPES = {
    TRAIT: 'TRAIT',
    CLASS: 'CLASS',
    EQUIPMENT: 'EQUIPMENT',
    TILE: 'TILE',
    AURA: 'AURA',
    CONSUMABLE: 'CONSUMABLE'
};
