// Fantasy Guild - UI Constants
// Central location for all UI-related magic numbers and constants

/**
 * UI Layout Constants
 */
export const UI_LAYOUT = {
    // Hero-related sizes
    HERO_SLOT_SIZE: 64,              // px - Size of hero slots on cards
    HERO_CARD_PORTRAIT_SIZE: 64,     // px - Size of hero portrait on hero cards

    // Skill grid layout
    SKILL_GRID_COLS: 3,
    SKILL_GRID_ROWS: 4,

    // Panel sizing
    PANEL_MIN_WIDTH: 220,            // px
    PANEL_MAX_WIDTH: 280,            // px
};

/**
 * Game Limits and Caps
 */
export const LIMITS = {
    MAX_HERO_ROSTER: 10,
    MAX_ACTIVE_CARDS: 20,
};

/**
 * Timing and Performance Constants
 */
export const TIMING = {
    // Display thresholds
    SPEED_DISPLAY_THRESHOLD_MS: 100,  // Only show speed info if difference > 100ms

    // Animation durations (for future use)
    CARD_TRANSITION_MS: 200,
    TOAST_DURATION_MS: 3000,
};

/**
 * UI Text Constants
 */
export const UI_TEXT = {
    EMPTY_HERO_SLOT: 'Drag hero here',
    EMPTY_ITEM_SLOT: 'Drop item here',
    RIGHT_CLICK_TO_REMOVE: 'Right-click to remove',
};

/**
 * CSS Class Names (for consistency)
 */
export const CSS_CLASSES = {
    HERO_SLOT_FILLED: 'card__hero-slot--filled',
    HERO_SLOT_EMPTY: 'card__hero-slot--empty',
    CARD_EXPANDED: 'hero-card--expanded',
};
