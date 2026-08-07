// Fantasy Guild — Board Event Names (7×7 Playmat rework, Phase 1)

/**
 * Tile-scoped event naming convention: `board:<event_name>`.
 *
 * The successor to the deleted `core/areaEvents.js`. The convention it carried
 * is worth keeping and is kept: **every event names the thing it happened to**,
 * so subscribers can filter on `payload.tile` and ignore the rest rather than
 * recalculating the whole board. With up to 48 live tiles that matters more than
 * it did with 12 areas, not less.
 *
 * Truly global changes (`inventory_updated`, `state_changed`, …) keep their
 * existing global names. Those must never trigger per-tile stat recalculation —
 * only the events below do that.
 *
 * ## Status: declared ahead of their publishers
 * Phase 1 introduces this file so that surviving systems (`StatusEffectSystem`)
 * have something to subscribe to once `areaEvents.js` is deleted. **The
 * publishers land later** — the board runner in Phase 4, combat in Phase 6. A
 * subscriber registered against an event nobody publishes yet is inert, which is
 * the intended state until then.
 *
 * @see playmat_roadmap_v1.md Phase 1 §A, Phase 4 §B
 */
export const BOARD_EVENTS = {
    /**
     * A Token completed one work cycle. **This is the board's universal unit of
     * work** — one kill counts as one cycle too (D-129), so combat feeds this
     * exactly as production does.
     *
     * Everything that "happens per cycle" hangs off this: context and buff Token
     * wear (D-126), status decay, and cycle counting.
     *
     * Payload: `{ tile, typeId, heroId, failed }`
     */
    CYCLE_COMPLETE: 'board:cycle_complete',

    /** A Token was placed, moved, removed or displaced. Payload: `{ tile, typeId }` */
    TILE_CHANGED: 'board:tile_changed',

    /** A hero was placed on, moved between, or knocked off tiles. Payload: `{ tile, heroId }` */
    HERO_MOVED: 'board:hero_moved',

    /** A Token ran out of charges and left the board (D-176). Payload: `{ tile, typeId }` */
    TOKEN_DEPLETED: 'board:token_depleted',

    /** This tile's neighbourhood changed, so its recipe/modifiers need recomputing. Payload: `{ tile }` */
    ADJACENCY_DIRTY: 'board:adjacency_dirty',

    /** A tile's alert state changed — staffed-but-stuck, or resolved (D-114, D-149). Payload: `{ tile, alert }` */
    ALERT_CHANGED: 'board:alert_changed',

    /** Combat on an enemy Token resolved. Payload: `{ tile, outcome: 'victory'|'defeat' }` */
    COMBAT_RESOLVED: 'board:combat_resolved',

    /** High-frequency cycle progress, for ref-based UI updates only. Payload: `{ tile, percent }` */
    PROGRESS: 'board:progress',

    /** A loot sprite was dropped, merged, collected or consumed. Payload: `{ spriteId? }` */
    SPRITES_CHANGED: 'board:sprites_changed'
};
