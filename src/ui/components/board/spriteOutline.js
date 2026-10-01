// Fantasy Guild — which coloured outline a sprite on the mat wears (Wave 5).

/**
 * ⭐ **Outlines replace the glow** (owner rulings, Z §11, 2026-09-30):
 * **white = hovered or selected, red = alert, green = working**, in that
 * order when more than one is true. The picture itself is generated from the
 * art (`scripts/spriteFx.mjs`) and drawn by `PixelArt` / the sheet animators.
 *
 * - **A Token** is green while a hero works it — the old green glow's rule,
 *   which also went dark on an alert; an alert now says so in red.
 * - **A hero** is green while working productively — not while their Token is
 *   stuck (FB-50: that hero stood unlit; the Token's red outline and badge
 *   say it). Hovered or inspected: white.
 * - **A flag** is white while it or its hero is hovered, or the hero is
 *   inspected; it has no working or alert state of its own.
 *
 * @returns {'hover'|'alert'|'work'|null}
 */
export function tokenOutline({ hovered = false, selected = false, alert = false, working = false } = {}) {
    if (hovered || selected) return 'hover';
    if (alert) return 'alert';
    if (working) return 'work';
    return null;
}

/** A hero on the mat: white hovered or inspected, green working (not stuck). */
export function heroOutline({ hovered = false, selected = false, working = false, stuck = false } = {}) {
    if (hovered || selected) return 'hover';
    if (working && !stuck) return 'work';
    return null;
}

/** A flag on the mat: white while it or its hero is hovered or inspected. */
export function flagOutline({ hovered = false, selected = false, carried = false } = {}) {
    if (carried) return null;
    return hovered || selected ? 'hover' : null;
}
