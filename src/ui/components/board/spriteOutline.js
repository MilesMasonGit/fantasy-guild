
/**
 * Outlines: **white = hovered or selected, red = alert, green = working**, in that order when
 * more than one is true. The picture itself is generated from the art (`scripts/spriteFx.mjs`)
 * and drawn by `PixelArt` / the sheet animators.
 * - **A Token** is white too while a support in the hand would help it or be helped by it (`lit`,
 * `SupportLinkLayer`). It is green while a hero works it; an alert says so in red instead. While a map mode
 * is on (`mode`, `useMapMode.js`) its hover outline takes the mode's colour ({@link MODE_OUTLINE}), or muted grey on a Token the
 * mode cannot act on (`unavailable`).
 * - **A hero** is green while working productively, not while their Token is stuck (that hero
 * stands unlit; the Token's red outline and badge say it). Hovered or inspected: white.
 * - **A flag** is white while it or its hero is hovered, or the hero is inspected; it has no
 * working or alert state of its own.
 * @returns {'hover'|'alert'|'work'|'muted'|'danger'|null}
 */
export function tokenOutline({ hovered = false, selected = false, lit = false, alert = false, working = false, mode = null, unavailable = false } = {}) {
    if (hovered && mode) return unavailable ? 'muted' : (MODE_OUTLINE[mode] ?? 'hover');
    if (hovered || selected || lit) return 'hover';
    if (alert) return 'alert';
    if (working) return 'work';
    return null;
}

/** A map mode's hover outline: muted grey for Disallow, red for Demolish (UI_STYLE colours). */
export const MODE_OUTLINE = Object.freeze({ disallow: 'muted', demolish: 'danger' });

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
