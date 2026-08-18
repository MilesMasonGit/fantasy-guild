// Fantasy Guild - Registry Index
// Phase 12: Card Registry

/**
 * Central export for all registries
 * Import from here instead of individual files
 */

// Skill Registry
export {
    SKILLS,
    SKILL_LAYERS,
    SKILL_CATEGORIES,
    SKILL_COUNT,
    HERO_SKILL_SLOTS,
    FOUNDATION_SKILL_IDS,
    COMBAT_SKILL_IDS,
    SHARED_SKILL_IDS,
    SIGNATURE_SKILL_IDS,
    getAllSkillIds,
    getSkillIdsByLayer,
    isSkillId,
    isCombatSkill,
    getSkill
} from './skillRegistry.js';

// Job Registry — the class tree, and the source of truth for what a hero holds.
export {
    JOBS,
    JOB_TIERS,
    PROMOTION_COSTS,
    STARTING_JOB_ID,
    getAllJobIds,
    getJob,
    getJobsByTier,
    getPromotionsFrom,
    getJobSkills,
    getJobSkillsByLayer,
    getJobCombatSkill,
    getJobSignatureSkill,
    jobCanFight,
    grantsOf,
    removesOf,
    getPromotionCost,
    getPromotionGateSkills,
    getJobLineage
} from './jobRegistry.js';

// Class Registry
// ⚠️ **Superseded by the job registry above for anything skill-related.** What
// survives here is cosmetic only — `assetPath`, `color`, `icon` — because hero
// sprites and the Dock still read `classId`. Phase 7/9 retires the last of it
// along with `traitRegistry`; until then the two coexist and `bonusSkills` in
// this file is dead data naming ids that no longer exist.
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
    getSetTotal
} from './areaSetRegistry.js';

// Recipe Registry
export {
    RECIPES,
    getRecipe,
    getAllRecipes,
    getRecipesBySubskill
} from './recipeRegistry.js';

