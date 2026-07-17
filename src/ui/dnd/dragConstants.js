// Fantasy Guild — Deck-loop drag system constants (DnD rework, 2026-07-15)
//
// The deck-loop drag-and-drop is a fresh, pointer-tracked system built on
// dnd-kit (see DndKit.jsx). These are the shared vocabulary bits: payload
// kinds, the surfaces the pointer can be over (drives the "bloom" ghost),
// and the SFX clip names (all already present in AudioSystem's map).

/** Payload kinds a draggable can carry. */
export const DRAG_KIND = {
    CARD: 'card',
    HERO: 'hero',
    ITEM: 'item'
};

/**
 * Surfaces the pointer can hover over during a drag. The ghost is compact
 * over a drawer (you're sorting) and blooms bold over the board (you're
 * placing) — "bloom on cross-over" (owner design 2026-07-15). Containers tag
 * themselves with `data-dnd-surface="drawer|board"`; the provider hit-tests
 * the pointer against the nearest tagged ancestor each move.
 */
export const DND_SURFACE = {
    DRAWER: 'drawer',
    BOARD: 'board'
};

/**
 * SFX clips (keys into AudioSystem._getSfxPath). Fired via the `audio:play`
 * EventBus channel. There's no dedicated "error" clip, so invalid reuses the
 * soft cloth `unassign` sound (owner-approved fallback, 2026-07-15).
 */
export const DRAG_SFX = {
    pickup: 'drag',
    invalid: 'unassign',
    dropDefault: 'drop',
    dropByKind: {
        [DRAG_KIND.CARD]: 'card_place',
        [DRAG_KIND.HERO]: 'hero_assign',
        [DRAG_KIND.ITEM]: 'item_equip'
    }
};
