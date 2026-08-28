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

    /**
     * A Token **landed on a tile** — the player action, as opposed to
     * `TILE_CHANGED`, which is every redraw reason a tile has (cleared,
     * depleted, pushed, restocked, vault moved). Payload: `{ tile, typeId }`
     *
     * ⚠️ **This one deliberately keeps a global name rather than the
     * `board:` prefix**, because the event already existed as the bare string
     * `'token_placed'` with four publishers in `Placement.js` and five
     * subscribers across the UI. Naming it here connects the constant to the
     * event that is really raised; inventing `board:token_placed` alongside it
     * would have meant **two announcements of one action**, which is exactly
     * the double-count CR2-085 is about. Added 2026-08-25 (CR2-055/CR2-177's
     * sibling — the Tray's `TRAY_CHANGED` had the same shape).
     */
    TOKEN_PLACED: 'token_placed',

    /**
     * The Tray's contents or arrangement changed — something added, taken, or
     * dragged to a new spot. Payload: `{ reason }`.
     *
     * Published from `BoardState`'s three tray mutators, so every one of the
     * ~10 engine routes into the Tray (placement, displacement, map burst,
     * sprite collection, purchase) announces itself without each having to
     * remember to. Before 2026-08-25 this constant did not exist and `Tray.jsx`
     * subscribed to `undefined`, refreshing off the `state_changed` firehose
     * instead (CR2-055, CR2-177).
     */
    TRAY_CHANGED: 'board:tray_changed',

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
    SPRITES_CHANGED: 'board:sprites_changed',

    /** A token was smoothly pushed from one tile to another by a 2x2 cascade. Payload: `{ fromTile, toTile, typeId, heroId, durationMs }` */
    TILE_PUSHED: 'board:tile_pushed',

    /**
     * A sprite was **successfully** taken off the floor and into storage
     * (D-236). Payload: `{ kind, refId, quantity, x, y }`, where `x`/`y` are
     * board coordinates — the point it flew from.
     *
     * ⚠️ **Fires on success only, and that is load-bearing.** Collection can
     * legitimately fail: a full Bank leaves the item on the floor as D-138's
     * visible-litter signal, and a Token with nowhere to go waits. A particle
     * that flew away while the sprite stayed put would be a lie about where the
     * player's things are.
     *
     * `SPRITES_CHANGED` cannot serve this purpose — it also fires on drops,
     * merges and partial fits, and carries no position.
     */
    SPRITE_COLLECTED: 'board:sprite_collected',

    /** A lingering loot sprite was absorbed into its parent stack. Payload: `{ parentId, absorbedId, quantity }` */
    SPRITE_ABSORBED: 'board:sprite_absorbed',

    /** On-board event notification alert (missing items, missing tokens, token exhausted). Payload: `{ tile, severity, type, name, message }` */
    TILE_EVENT_ALERT: 'board:tile_event_alert',

    /** A token's charges changed (consumed cycle, support wear, or restocked). Payload: `{ tile, delta, remaining, typeId }` */
    TOKEN_CHARGES_CHANGED: 'board:token_charges_changed'
};

/**
 * Why a staffed Token cannot work — the payload vocabulary of `ALERT_CHANGED`,
 * and what drives a tile's single alert mark (D-85).
 *
 * Lives beside `BOARD_EVENTS` rather than in `BoardRunner` because it is not
 * only the runner's (CR2-060): `Managers` publishes `UNSTOCKED` too, and
 * `BoardRunner` already imports `Managers`, so the enum could not live in the
 * runner without either a cycle or a second hardcoded copy of the string. Every
 * publisher and every reader now names the same constant.
 */
export const ALERT = {
    INPUTS: 'inputs',
    /** The hero holds the skill but is not high enough level yet. */
    ACCESS: 'access',
    /**
     * The hero does not hold the required skill at all, so no amount of
     * levelling fixes it. A different hero, or a promotion, is the answer.
     */
    UNSKILLED: 'unskilled',
    /**
     * The station cannot run the recipe it is set to, because the context
     * Tokens that recipe names are not beside it — or, on a Token whose skill
     * pool is empty, because there is nothing to set it to at all.
     *
     * ⚠️ Its meaning changed with the Recipe & Charges rework (P2). It used to
     * mean "nothing beside this station tells it what to make", which stopped
     * being possible when stations gained an explicit selection (R-5). Its
     * sibling `CONFLICT` — two context Tokens wanting different things (D-20) —
     * was deleted in the same phase: an explicit selection cannot be ambiguous.
     */
    NO_RECIPE: 'no_recipe',
    /**
     * The cycle is affordable in items but not in charges — the station itself,
     * or an adjacent context Token the recipe draws on, holds fewer charges than
     * one cycle costs. Nothing is deducted while this is showing (concept §3.3).
     */
    CHARGES: 'charges',
    /**
     * The tile ran dry and its Manager found nothing in the Vault to restock it
     * with — D-133's silent failure. Published by `Managers.restockTile`, not by
     * the runner, and carried on the vacancy rather than on a Token instance:
     * there is no Token left on the tile to hang it from.
     */
    UNSTOCKED: 'unstocked'
};
