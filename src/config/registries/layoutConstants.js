/**
 * Playmat Layout Constants
 * Centralized dimensions for the card grid.
 */
export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 440;

/**
 * LEGACY (deck loop rework, Phase 1): 2D spatial grid constants below are only
 * consumed by components gated behind !USE_DECK_LOOP (PlaymatViewport,
 * StaticGridLayer, CardView). Deleted with the grid system in Phase 9.
 * Banner row dimension constants are added alongside the new UI in Phase 6.
 */
export const GRID_PITCH = 512;
export const PLAYMAT_GAP_X = GRID_PITCH - CARD_WIDTH;
export const PLAYMAT_GAP_Y = GRID_PITCH - CARD_HEIGHT;
export const PLAYMAT_PADDING = 512;
