/**
 * Fantasy Guild - Game Constants
 * 
 * Centralized configuration for magic numbers and game-wide settings.
 * Values here can be tuned for balancing without searching the codebase.
 */

// ==============================================
// CORE GAME LOOP
// ==============================================

/** Milliseconds between game ticks (100 = 10 ticks/sec) */
export const TICK_INTERVAL_MS = 100;

/** How often to publish progress UI updates (in ticks) */
export const PROGRESS_UI_UPDATE_INTERVAL = 5;

// ==============================================
// SAVE SYSTEM
// ==============================================

/** Auto-save interval in milliseconds (60000 = 1 minute) */
export const AUTO_SAVE_INTERVAL_MS = 60000;

/** Maximum number of save slots */
export const MAX_SAVE_SLOTS = 5;

// ==============================================
// HERO SYSTEM
// ==============================================

/** Starting skill level bonus from class/trait affinity */
export const AFFINITY_STARTING_LEVEL_BONUS = 10;

/** XP multiplier bonus from class/trait affinity (0.10 = 10%) */
export const AFFINITY_XP_BONUS = 0.10;

/** Default maximum HP for heroes */
export const DEFAULT_MAX_HP = 100;

/** Default maximum energy for heroes */
export const DEFAULT_MAX_ENERGY = 100;

/** Energy regeneration rate per second */
export const ENERGY_REGEN_PER_SECOND = 0.5;

// ==============================================
// CARD SYSTEM
// ==============================================

/** Maximum number of active cards */
export const MAX_ACTIVE_CARDS = 10;

/** Default task duration in milliseconds */
export const DEFAULT_TASK_DURATION_MS = 10000;

/** Default duration for work cycles (Explore, Area Projects) in milliseconds */
export const WORK_CYCLE_DURATION = 1000;

// ==============================================
// INVENTORY SYSTEM
// ==============================================

/** Default maximum inventory slots */
export const DEFAULT_MAX_INVENTORY_SLOTS = 20;

/** Default stack size for stackable items */
export const DEFAULT_MAX_STACK_SIZE = 999;

// ==============================================
// AREA SYSTEM
// ==============================================

/** Quest points required to complete an area */
export const QUEST_POINTS_TO_COMPLETE_AREA = 5;

// ==============================================
// XP AND LEVELING
// ==============================================

/** Number of skills used to calculate hero level (total skill levels / this) */
export const SKILLS_FOR_LEVEL_CALCULATION = 11;
