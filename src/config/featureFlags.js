// Fantasy Guild - Feature Flags

/**
 * Master switch for the Area Deck Loop rework (see playmat_rework_roadmap_v3.md).
 *
 * false: the game boots and runs the existing playmat/grid system, unchanged.
 * true:  the game boots the new Area Deck Loop system (placeholder until the
 *        banner row UI lands in Phase 6).
 *
 * This flag is removed in Phase 9 once the new system is the only system.
 */
export const USE_DECK_LOOP = true;
