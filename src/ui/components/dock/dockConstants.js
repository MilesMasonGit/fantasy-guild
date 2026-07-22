// Fantasy Guild — Hero Dock layout constants (Hero Dock rework, Phase 4)

/**
 * Height of an unpinned dock tab (concept §3 State A: ~70–80px). This is the
 * card's top header section, and the pinned card in Phase 5 reuses the exact
 * same header so the "pull the card up out of your hand" metaphor holds.
 */
export const DOCK_TAB_H = 76;

/** Width of an unpinned tab before overlap. */
export const DOCK_TAB_W = 168;

/**
 * How much of each tab the next one covers (concept §1: "flat overlapping
 * horizontal card strip"). The visible stride per tab is DOCK_TAB_W minus
 * this, so a roster of 5 occupies 4 strides plus one full tab.
 */
export const DOCK_OVERLAP = 28;

/** Square face-only tab used in Small Mode (concept §3 State C). Phase 8. */
export const DOCK_TAB_W_SMALL = 48;

/**
 * Vertical space the dock occupies at the bottom of the screen, including its
 * lift and border. The banner list and the Bank drawer pad their scroll areas
 * by this so their last row can still scroll clear of the dock, which floats
 * over them rather than displacing them (roadmap D9/D10).
 */
export const DOCK_RESERVED_H = DOCK_TAB_H + 12;

/** Z-layers (concept §2). The dock sits above the Bank drawer and banners. */
export const DOCK_Z = 200;
export const DOCK_PINNED_Z = 300;
