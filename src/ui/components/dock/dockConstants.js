
/**
 * Height of an unpinned dock tab: the card's top header section, which the pinned card reuses
 * so the pull-the-card-up-out-of-your-hand metaphor holds.
 */
export const DOCK_TAB_H = 76;

/**
 * Tab width: 200px, the historical `md` playmat card width, so a dock card reads as the same
 * object as a hero card on a banner. A plain literal; nothing tunes it.
 */
export const DOCK_TAB_W = 200;

/**
 * Height of the pinned card's body, revealed below the header when a card is pulled up out of
 * the hand.
 * Sized to the TALLER of the two sections it can show: the 3×3 loadout grid needs ~194px at
 * this width on top of the ~24px view toggle; the skills grid is shorter and leaves slack
 * below. Fixed rather than auto on purpose: a card that changes height under the cursor as the
 * player flips between Gear and Skills reads as a glitch.
 * ⚠️ 224 is the ceiling, not a preference: DOCK_TAB_H + this must stay inside the 260–300px
 * expanded card, which the dock test asserts.
 */
export const DOCK_CARD_BODY_H = 224;

/**
 * How much of each tab the next one covers. The visible stride per tab is DOCK_TAB_W minus
 * this, so a roster of 5 occupies 4 strides plus one full tab.
 */
export const DOCK_OVERLAP = 28;

/**
 * Square face-only tab used in Small Mode, which triggers when the roster genuinely doesn't
 * fit; see `dockNeedsSmallMode` below.
 */
export const DOCK_TAB_W_SMALL = 48;

export const DOCK_OVERLAP_SMALL = 8;

/** SFX clips for pulling a card open and pushing it back. */
export const DOCK_SFX = { pin: 'dock_pin', unpin: 'dock_unpin' };

export function dockStripWidth(count, small = false) {
    if (count <= 0) return 0;
    const w = small ? DOCK_TAB_W_SMALL : DOCK_TAB_W;
    const overlap = small ? DOCK_OVERLAP_SMALL : DOCK_OVERLAP;
    return w + (count - 1) * (w - overlap);
}

/**
 * Whether the dock must collapse to Small Mode.
 * This deliberately does NOT follow the banner card tier. The two answer different questions:
 * the banner tier asks whether six 200px cards fit in a row, which is already false at
 * 1280×800, while a four-hero dock fits with room to spare, so following it collapsed the dock
 * needlessly. Measuring the dock's own need against its own space also scales with roster
 * size, which a shared tier can never account for.
 */
export function dockNeedsSmallMode(availableWidth, heroCount) {
    if (!availableWidth || heroCount <= 0) return false;
    // `- 16` leaves the strip's own horizontal padding.
    return dockStripWidth(heroCount) > availableWidth - 16;
}

/**
 * Whether the strip needs a real horizontal scrollbar even after Small Mode, i.e. the roster
 * still doesn't fit.
 * ⚠️ This has to stay false (and the strip has to stay `overflow-x: visible`) whenever
 * possible: per the CSS overflow spec, pairing a non-`visible` overflow-x with `overflow-y:
 * visible` forces the y-axis to compute as `auto` too, which clips a popped-open pinned card
 * to the strip's own resting height instead of letting it spill upward. Small Mode covers all
 * but extreme roster/width combinations; when this is true, a pinned card can clip during that
 * scroll.
 */
export function dockNeedsHScroll(availableWidth, heroCount, small = false) {
    if (!availableWidth || heroCount <= 0) return false;
    return dockStripWidth(heroCount, small) > availableWidth - 16;
}

/**
 * How many hero cards can be pinned open at once: a strict two-card comparison. Pinning a
 * third closes the oldest.
 */
export const DOCK_MAX_PINNED = 2;

/**
 * Vertical space the dock occupies at the bottom of the screen, including its lift and border.
 * The dock floats over what is below it rather than displacing it.
 */
export const DOCK_RESERVED_H = DOCK_TAB_H + 12;

/** Z-layers: the dock sits above the Bank drawer. */
export const DOCK_Z = 200;
export const DOCK_PINNED_Z = 300;
