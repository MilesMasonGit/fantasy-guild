// Loot's extra effects, each behind one switch. All off: they looked wrong and cost frames, and
// they are kept (not deleted) so a better look can be built on them later. The hop itself, its
// ground shadow, joining a pile and the flight to the Bank are not here: those always play.

/** White afterimages trailing loot as it hops out of its Token (`lootArc.playLootArc`). */
export const LOOT_HOP_AFTERIMAGES = false;

/** A rare find's gold flash and flickering star once it has landed (`fx/rareTwinkle.js`). */
export const LOOT_RARE_TWINKLE = false;

/**
 * Collected loot's flight: the 2 px trail behind the item and the four-pixel plink where it lands
 * (`ParticleOverlay`). A hero lifted from the dock keeps its trail.
 */
export const LOOT_FLIGHT_SPARKLES = false;
