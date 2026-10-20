// the Atlas tome's pictures and where its pages' parchment lies: the one place to point at new art

/**
 * `page`: the owner's right-hand page (spine on its left edge), drawn mirrored for the left page.
 * The book lies on the same wood as the mat (the background chosen in Settings), not a table of its own.
 */
export const TOME_ART = Object.freeze({
    page: '/assets/playmat/atlas_book_gold.png',
    pageArtPx: 128
});

/** The book is drawn at exactly this many screen pixels per art pixel, never scaled. */
export const TOME_SCALE = 4;

/** One page in screen pixels; the spread is two of them side by side. */
export const PAGE_PX = TOME_ART.pageArtPx * TOME_SCALE;
export const SPREAD_W = PAGE_PX * 2;
export const SPREAD_H = PAGE_PX;

/**
 * The right page's parchment inside its gold border, in art pixels of the page picture (a little
 * in from the torn edge). Measured from `atlas_book_gold.png`; a redrawn page needs it measured again.
 */
export const PARCHMENT_ART = Object.freeze({ x0: 5, y0: 12, x1: 94, y1: 106 });

/** The book's covers across the spread, in art pixels of one page (its opaque part, spine at 0). */
export const COVER_ART = Object.freeze({ x1: 110, y0: 2, y1: 126 });

/** Where each page's parchment lies on the spread, in screen pixels: the left page mirrors the right. */
export function parchmentRects(art = PARCHMENT_ART, scale = TOME_SCALE, pagePx = PAGE_PX) {
    const width = (art.x1 - art.x0) * scale;
    const height = (art.y1 - art.y0) * scale;
    const top = art.y0 * scale;
    return {
        left: { left: pagePx - art.x1 * scale, top, width, height },
        right: { left: pagePx + art.x0 * scale, top, width, height }
    };
}
