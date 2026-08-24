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

// Class Registry and Trait Registry — retired 2026-08-18 (owner decision).
// Classes are replaced by the job registry above; traits are gone entirely.
// Both were already inert: they granted no skills, and their `bonusSkills`
// named skill ids that no longer exist. The `classId` / `traitId` fields on
// saved heroes are deliberately left in place as inert labels so that existing
// saves keep loading.

// Name Registry
export {
    FIRST_NAMES,
    TITLE_PREFIXES,
    EPITHETS,
    getRandomName,
    getRandomFullName,
    getNameCount
} from './nameRegistry.js';

// Card Registry — retired 2026-08-18 with the card system.

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

// Biome Registry — retired 2026-08-18 with the card system.

// Area Set Registry — retired 2026-08-18. Areas were deleted by the playmat
// rework and the archived `data/cards/area/` copies were deleted 2026-08-24,
// so the registry loaded 0 area sets and only this barrel referenced it.

// Recipe Registry
export {
    RECIPES,
    getRecipe,
    getAllRecipes,
    getRecipesBySubskill
} from './recipeRegistry.js';

