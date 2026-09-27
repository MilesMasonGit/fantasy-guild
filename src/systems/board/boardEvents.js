// Fantasy Guild — Board Event Names (7×7 Playmat rework, Phase 1)

/**
 * Board event naming convention: `board:<event_name>`.
 *
 * The successor to the deleted `core/areaEvents.js`. The convention it carried
 * is worth keeping and is kept: **every event names the thing it happened to**,
 * so subscribers can filter on it and ignore the rest rather than recalculating
 * the whole board.
 *
 * ## ⭐ By Token instance id and mat point — never by tile (Free Playmat 1.6b)
 * There are no tiles on the free playmat. An event about a Token names it by
 * **`instanceId`**. An event with no Token to name — a spot that ran dry, a
 * refused drop — names the **mat point** `x`, `y`; so does an event about a
 * Token that has just left the mat, beside its `instanceId`. A `tile` field in
 * any payload published from `src/systems` fails `FreeMatGuards.test.js`.
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
     * Payload: `{ instanceId, typeId, heroId, failed, produced }`
     */
    CYCLE_COMPLETE: 'board:cycle_complete',

    /**
     * A Token began a new cycle — `{ instanceId, typeId, heroId }`.
     *
     * ⚠️ **The moment work actually starts, not the moment a tick runs.** Fired
     * when `cycleElapsedMs` is still zero and every guard above it has already
     * passed: a hero is present, the inputs are in the Bank, and the charges are
     * affordable. A Token stalled for want of ore is not starting a cycle, and
     * does not say it is — it fires once when it genuinely resumes.
     *
     * Its mirror, `CYCLE_COMPLETE`, is what a rule wants when it cares that work
     * *happened*. This one is for rules that want to act on the work about to be
     * done — the buff that should already be up while the hero swings.
     *
     * ⚠️ `heroId` was added by Effects Grammar v2 V1. It was in scope at the
     * publish site all along and simply not passed, which meant a rule reacting
     * to work STARTING could not name the hero doing it while the same rule on
     * work COMPLETING could.
     */
    CYCLE_START: 'board:cycle_start',

    /** A Token was placed, moved, removed or displaced. Payload: `{ instanceId, typeId }`, plus `x`, `y` for a Token that left (`typeId: null`) or a spot with none. */
    TILE_CHANGED: 'board:tile_changed',

    /**
     * A Token **landed on a tile** — the player action, as opposed to
     * `TILE_CHANGED`, which is every redraw reason a tile has (cleared,
     * depleted, pushed, restocked). Payload: `{ instanceId, typeId }`
     *
     * ⚠️ **This one deliberately keeps a global name rather than the
     * `board:` prefix**, because the event already existed as the bare string
     * `'token_placed'` with four publishers in `Placement.js` and five
     * subscribers across the UI. Naming it here connects the constant to the
     * event that is really raised; inventing `board:token_placed` alongside it
     * would have meant **two announcements of one action**, which is exactly
     * the double-count CR2-085 is about. Added 2026-08-25 (CR2-055/CR2-177's
     * sibling). The Tray's `TRAY_CHANGED` went with the Tray, Token Lifecycle 9.3.
     */
    TOKEN_PLACED: 'token_placed',

    /** A hero's drawn place changed. Payload: `{ heroId, instanceId?, x?, y?, reason? }` — the Token they work and the point they are drawn at (neither in the Dock). */
    HERO_MOVED: 'board:hero_moved',

    /**
     * Heroes took a step (Hero Movement M1). No payload — read positions from
     * `HeroMotion.heroPointOf`. Published at most once per engine tick, and only
     * when somebody moved. ⚠️ Deliberately NOT `HERO_MOVED`: that one makes
     * `TileModifiers` rebuild neighbourhoods, which must happen when a hero's
     * job changes or they arrive — never on every step of a walk.
     */
    HEROES_WALKED: 'board:heroes_walked',

    /**
     * A Foundation finished its build and became the Token it built, in place
     * (Token Lifecycle 6.1, DP-6) — Farmland planted by Farming included.
     * Payload: `{ instanceId, typeId, fromTypeId, heroId }`: the new Token, what
     * it was built as, the Foundation's type, and the hero who built it.
     *
     * Published once by `BoardRunner`, after the transform has succeeded (slice
     * 9.5, for the tutorial's "build a Workbench"). `TILE_CHANGED` fires for the
     * same transform, but also for grows, turns and every redraw, so it cannot
     * say "something was built".
     */
    TOKEN_BUILT: 'board:token_built',

    /**
     * The discard bin changed (B3.1, FB-34): a Token went in, came back out,
     * or the bin was emptied by *Discard all*. Payload: `{ action, instanceId?,
     * typeId?, count, refunded? }` — `action` is `'binned'`, `'unbinned'` or
     * `'discarded'`; `count` is how many Tokens the bin holds now; `refunded`
     * (on `'discarded'`) is what was paid, `[{ itemId, quantity }]`.
     */
    BIN_CHANGED: 'board:bin_changed',

    /** A Token ran out of charges and left the board (D-176). Payload: `{ instanceId, x, y, typeId, instance?, heroId? }` */
    TOKEN_DEPLETED: 'board:token_depleted',

    /** A neighbourhood changed, so modifiers need recomputing. Payload: `{ points }` — the mat points the change touched. */
    ADJACENCY_DIRTY: 'board:adjacency_dirty',

    /** A Token's alert state changed — staffed-but-stuck, or resolved (D-114, D-149). Payload: `{ instanceId, alert }`. */
    ALERT_CHANGED: 'board:alert_changed',

    /**
     * A spawner's waiting alert changed (Token Lifecycle 8.3) — `{ instanceId,
     * alert, needs }`, where `alert` is `ALERT.SPAWN_NEEDS_ITEM`,
     * `ALERT.SPAWN_NO_ROOM` or null, and `needs` lists the item ids the Bank
     * is short of. Published by `SpawnerSystem.syncAlerts` on a change only.
     *
     * ⚠️ Deliberately NOT `ALERT_CHANGED`: that one carries a hero-worked
     * Token's `instance.alert`, which the runner rewrites every tick, and its
     * progress-bar subscriber draws a red bar for any value it is given. A
     * spawner has no hero, and a spawner a hero also works would have the two
     * marks fighting over one field.
     */
    SPAWNER_ALERT_CHANGED: 'board:spawner_alert_changed',

    /**
     * A Token's green notice went up or was taken down early (`TokenNotices`,
     * TL-14, FB-48) — `{ instanceId }`. The notice itself is read from
     * `TokenNotices.noticeOf`, because a freshly spawned Token is not drawn yet
     * when its notice is raised.
     */
    NOTICE_CHANGED: 'board:notice_changed',

    /** Combat on an enemy Token resolved. Payload: `{ instanceId, outcome: 'victory'|'defeat', heroId, typeId }` */
    COMBAT_RESOLVED: 'board:combat_resolved',

    /** High-frequency cycle progress, for ref-based UI updates only. Payload: `{ instanceId, percent }` */
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

    /** On-board event notification alert (missing items, missing tokens, token exhausted). Payload: `{ instanceId?, x?, y?, severity, type, name, message }` */
    TILE_EVENT_ALERT: 'board:tile_event_alert',

    /** A token's charges changed (consumed cycle, support wear, or restocked). Payload: `{ instanceId, delta, remaining, typeId }` */
    TOKEN_CHARGES_CHANGED: 'board:token_charges_changed',

    /**
     * A hero finished training on a Token with a Promotes rule, and the game is
     * asking whether to go through with it (Promotes rule P3).
     * Payload: `{ instanceId, heroId, jobId, typeId }`
     *
     * ⚠️ **Nothing has happened yet when this fires.** No skills have moved and
     * nothing has been spent — the tile is holding. `BoardPromotion.accept` and
     * `.decline` are the two ways out, and the offer survives a reload because
     * it lives on the Token instance.
     */
    PROMOTION_READY: 'board:promotion_ready',

    /**
     * A named effect just did something on a Token — `{ instanceId, title }`.
     *
     * ⚠️ **Not an alert.** `TILE_EVENT_ALERT` is for problems a player has to
     * act on (no inputs, no charges, a refused placement): it draws a persistent
     * icon, waits to be read, and can be dismissed. An effect firing is neither
     * a problem nor persistent — it is a thing that happened, said once and
     * gone. Mixing them would spam the alert channel and change what its icon
     * means.
     */
    EFFECT_FIRED: 'board:effect_fired',

    /**
     * A hero engaged an enemy — `{ instanceId, typeId, heroId }`.
     *
     * ⚠️ **Every engagement, including the ones after a kill** (UE-15). An enemy
     * Token holds charges, each kill spends one, and the enemy returns to full
     * HP for the next fight — so one engagement is one fight in the same sense
     * that one cycle is one piece of work. Firing only on arrival would mean a
     * hero parked on a Bear for twenty kills procs once, which reads as broken.
     *
     * Detected as a transition INTO `active`, which catches the first
     * engagement (idle → active) and each post-intermission respawn with one
     * rule rather than two.
     */
    COMBAT_ENGAGED: 'board:combat_engaged'
};

/**
 * Why a staffed Token cannot work — the payload vocabulary of `ALERT_CHANGED`,
 * and what drives a tile's single alert mark (D-85).
 *
 * Lives beside `BOARD_EVENTS` rather than in `BoardRunner` because it is not
 * only the runner's (CR2-060): other board systems publish it too, and the
 * enum could not live in the runner without either a cycle or a second
 * hardcoded copy of the string. Every publisher and every reader names the
 * same constant.
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
     * Tokens that recipe names are not beside it. (A station with nothing
     * picked says `CHOOSE_RECIPE` instead, TL-15.)
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
     * or a nearby context Token the recipe draws on, holds fewer charges than
     * one cycle costs. Nothing is deducted while this is showing (concept §3.3).
     */
    CHARGES: 'charges',
    /**
     * A Foundation with no recipe picked (Token Lifecycle 6.1). A Foundation is
     * never given a default: the player chooses what it becomes, and until
     * they do nobody works it.
     */
    CHOOSE_BUILD: 'choose_build',
    /**
     * A station with no recipe picked (TL-15, owner feedback FB-13). Every
     * station, however it arrives, waits for the player to choose; until
     * they do nobody works it. The station twin of `CHOOSE_BUILD`.
     */
    CHOOSE_RECIPE: 'choose_recipe',
    /**
     * A finished cycle's Token has nowhere to go: a Foundation's build has
     * nowhere legal to stand (Token Lifecycle 6.1), or a station's recipe makes
     * a Token and the mat is full or crowded around it (TL-8, 9.3). It keeps
     * its full progress and nothing is spent; it tries again every tick.
     */
    NO_ROOM: 'no_room',
    /**
     * A spawner cannot pay one spawn's upkeep from the Bank (Token Lifecycle
     * 8.3). Carried by `SPAWNER_ALERT_CHANGED`, never by `instance.alert`: no
     * hero is involved, so it is an on-Token icon and never a speech bubble.
     */
    SPAWN_NEEDS_ITEM: 'spawn_needs_item',
    /**
     * A spawner's last attempt found nowhere free to land, and it is waiting
     * with its clock full (Token Lifecycle 8.3). Same channel as
     * `SPAWN_NEEDS_ITEM`. A spawner at its cap raises nothing: that is its
     * normal resting state, not a problem.
     */
    SPAWN_NO_ROOM: 'spawn_no_room'
};
