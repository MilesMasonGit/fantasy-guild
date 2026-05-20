// Fantasy Guild - Registry Index
// Phase 12: Card Registry

/**
 * Central export for all registries
 * Import from here instead of individual files
 */

// Skill Registry
export {
    SKILLS,
    SKILL_CATEGORIES,
    SKILL_COUNT,
    HERO_TOTAL_SKILLS,
    SUB_SKILL_TO_PARENT,
    getAllSkillIds,
    getSkill
} from './skillRegistry.js';

// Class Registry
export {
    CLASSES,
    CLASS_SKILL_BONUS,
    CLASS_XP_BONUS,
    getAllClassIds,
    getClass,
    classHasSkill
} from './classRegistry.js';

// Trait Registry
export {
    TRAITS,
    TRAIT_SKILL_BONUS,
    TRAIT_XP_BONUS,
    getAllTraitIds,
    getTrait,
    traitHasSkill
} from './traitRegistry.js';

// Name Registry
export {
    FIRST_NAMES,
    TITLE_PREFIXES,
    EPITHETS,
    getRandomName,
    getRandomFullName,
    getNameCount
} from './nameRegistry.js';

// Card Registry
export {
    CARDS,
    CARD_TYPES,
    getCard,
    getAllCards,
    getCardsByType,
    getTaskCards,
    getUniqueCards,
    meetsRequirement,
    getAllCardIds,
    getCardCount
} from './cardRegistry.js';

// Item Registry
export {
    ITEMS,
    ITEM_TYPES,
    getItem,
    getAllItems,
    getItemsByType,
    itemExists,
    getItemsByTag
} from './itemRegistry.js';

// Enemy Registry
export {
    ENEMIES,
    getEnemy,
    getAllEnemies,
    getEnemiesByBiome,
    getEnemiesByTier,
    getEnemiesByBiomeAndTier,
    getRandomEnemyForBiome,
    getAllEnemyIds
} from './enemyRegistry.js';

// Drop Table Registry
export {
    DROP_TABLES,
    getDropTable,
    getAllDropTables,
    getAllDropTableIds
} from './dropTableRegistry.js';

// Biome Registry
export {
    BIOMES,
    BIOME_CATEGORIES,
    getBiome,
    getBiomesByCategory,
    getRandomBiome,
    getAllBiomeIds,
    getRandomUnlockedBiome
} from './biomeRegistry.js';

// Area Set Registry
export {
    AREA_SETS,
    getAreaSet,
    getAllAreaSets,
    getAllAreaSetIds,
    getRequiredFragments,
    getPackCost,
    getSetTotal
} from './areaSetRegistry.js';
// Layout Constants
export {
    CARD_WIDTH,
    CARD_HEIGHT,
    GRID_PITCH,
    PLAYMAT_GAP_X,
    PLAYMAT_GAP_Y,
    PLAYMAT_PADDING
} from './layoutConstants.js';

// Tile Registry
export {
    TILE_TYPES,
    getTileType
} from './tileRegistry.js';
