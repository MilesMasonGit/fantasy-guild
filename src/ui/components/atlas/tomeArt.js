// the Atlas book's pictures and where their parchment lies: the one place to point at new art

/**
 * The owner's two pages, drawn side by side spine to spine: the left picture's spine is its right
 * edge, the right picture's its left edge. The ribbon drawn on the right page is decoration.
 */
export const TOME_ART = Object.freeze({
    left: '/assets/playmat/atlas_book_left.png',
    right: '/assets/playmat/atlas_book_right.png',
    pageArtPx: 256
});

/**
 * Each page's parchment, in art pixels of its own picture, a little in from the torn edge and the
 * cover. ⚠️ Measured from the pictures: a redrawn page needs measuring again.
 */
export const PARCHMENT_ART = Object.freeze({
    left: Object.freeze({ x0: 71, y0: 24, x1: 236, y1: 219 }),
    right: Object.freeze({ x0: 20, y0: 22, x1: 174, y1: 219 })
});

/** The covers' outer edges on the spread, in art pixels (the opaque part of both pictures). */
export const COVER_ART = Object.freeze({ x0: 39, y0: 4, x1: 256 + 238, y1: 252 });

/** The book is always drawn at a whole 4×: bigger than the screen, centred and cropped. */
export const TOME_SCALE = 4;

/** The spread's size at `scale`: two pages side by side. */
export function spreadSize(scale) {
    return { w: TOME_ART.pageArtPx * 2 * scale, h: TOME_ART.pageArtPx * scale };
}

const intersect = (a, b) => {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const bottom = Math.min(a.top + a.height, b.top + b.height);
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};

/**
 * Where each page's panels go on the spread at `scale`, in screen pixels of the spread: the page's
 * parchment, cut to `visible` (the part of the spread on screen, inset by `margin`) when the book
 * is bigger than its room.
 */
export function pageRects(scale, visible = null, margin = 8) {
    const page = TOME_ART.pageArtPx * scale;
    const rect = (art, offset) => ({
        left: offset + art.x0 * scale,
        top: art.y0 * scale,
        width: (art.x1 - art.x0) * scale,
        height: (art.y1 - art.y0) * scale
    });
    const left = rect(PARCHMENT_ART.left, 0);
    const right = rect(PARCHMENT_ART.right, page);
    if (!visible) return { left, right };
    const room = { left: visible.left + margin, top: visible.top + margin, width: visible.width - 2 * margin, height: visible.height - 2 * margin };
    return { left: intersect(left, room), right: intersect(right, room) };
}
