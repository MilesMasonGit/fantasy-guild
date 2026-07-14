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
    THORNS_REFLECT: 'THORNS_REFLECT', // Reflect damage to attacker
    STAT_BONUS: 'STAT_BONUS', // Generic stat bonus (for skills/combat)
    LOGIC_OVERRIDE: 'LOGIC_OVERRIDE' // Complex logic triggers (e.g., ignore_defense)
};

export const TARGET_CATEGORIES = {
    ALL: 'ALL',
    // Parent Categories / Skills (15-skill system)
    LABOR: 'labor',
    FORGE: 'forge',
    AQUATIC: 'aquatic',
    NATURE: 'nature',
    COOKING: 'cooking',
    ALCHEMY: 'alchemy',
    SCIENCE: 'science',
    OCCULT: 'occult',
    CRIME: 'crime',
    EXPLORE: 'explore',
    SOCIAL: 'social',
    COMBAT: 'combat',

    // Legacy parent ids (pre-15-skill content may still reference these)
    INDUSTRY: 'industry',
    NAUTICAL: 'nautical',
    CRAFTING: 'crafting',
    CULINARY: 'culinary',

    // Combat Specifics
    MELEE: 'melee',
    RANGED: 'ranged',
    MAGIC: 'magic',
    DEFENSE: 'defense',

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
    INTRIGUE: 'intrigue'
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
