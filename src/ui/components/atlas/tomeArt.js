// the Atlas tome's pictures: the one place to point at the owner's art once it is drawn

/**
 * `spread`: the open book (both pages, the spine, the cover's edge) as one picture; while it is
 * null the book is drawn in code. `table`: the wood the book lies on, tiled at 2×.
 */
export const TOME_ART = Object.freeze({
    spread: null,
    table: '/assets/ui/u_table_wood_planks_oak.png',
    tableArtPx: 128
});

/** The book's share of the Atlas's area, each way. */
export const TOME_FILL = 0.9;
