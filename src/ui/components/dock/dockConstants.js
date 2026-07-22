// Fantasy Guild — Hero Dock layout constants (Hero Dock rework, Phase 4)

/**
 * Height of an unpinned dock tab (concept §3 State A: ~70–80px). This is the
 * card's top header section, and the pinned card in Phase 5 reuses the exact
 * same header so the "pull the card up out of your hand" metaphor holds.
 */
export const DOCK_TAB_H = 76;

/**
 * Tab width. Matched to the `md` playmat card tier (CARD_TIERS.md.w = 200) so
 * a dock card reads as the same object as a hero card on a banner — the
 * concept's "matching the shape and layout of playmat hero cards".
 */
export const DOCK_TAB_W = 200;

/**
 * Height of the pinned card's body: the equipment grid plus the skills grid,
 * revealed below the header when a card is pulled up out of the hand. Header
 * + body lands inside the concept's ~260–300px expanded card.
 */
export const DOCK_CARD_BODY_H = 218;

/**
 * How much of each tab the next one covers (concept §1: "flat overlapping
 * horizontal card strip"). The visible stride per tab is DOCK_TAB_W minus
 * this, so a roster of 5 occupies 4 strides plus one full tab.
 */
export const DOCK_OVERLAP = 28;

/** Square face-only tab used in Small Mode (concept §3 State C). Phase 8. */
export const DOCK_TAB_W_SMALL = 48;

/**
 * How many hero cards can be pinned open at once (concept §3: "Strict 2-Card
 * Comparison Limit" — Hero A vs Hero B). Pinning a third closes the oldest.
 */
export const DOCK_MAX_PINNED = 2;

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
