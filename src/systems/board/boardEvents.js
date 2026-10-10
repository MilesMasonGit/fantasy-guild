// board event names

/**
 * Board event naming convention: `board:<event_name>`. Every event names the thing it happened to,
 * so subscribers can filter on it and ignore the rest rather than recalculating the whole board.
 *
 * Events are by Token instance id and mat point, never by tile. An event about a Token names it by
 * `instanceId`. An event with no Token to name (a spot that ran dry, a refused drop) names the mat
 * point `x`, `y`; so does an event about a Token that has just left the mat, beside its
 * `instanceId`. A `tile` field in any payload published from `src/systems` fails
 * `FreeMatGuards.test.js`.
 *
 * Truly global changes (`inventory_updated`, `state_changed`, …) keep their global names. Those
 * must never trigger per-tile stat recalculation: only the events below do that.
 *
 * Always by constant, never by raw string: a raw `'board:…'` string outside this file fails
 * `BoardEventNames.test.js`, because a typo in one is a subscription that silently never fires. The
 * payloads below are what the publishers actually send.
 */
export const BOARD_EVENTS = {
    /**
     * A Token completed one work cycle. This is the board's universal unit of work: one kill counts
     * as one cycle too, so combat feeds this exactly as production does.
     *
     * Everything that happens per cycle hangs off this: context and buff Token wear, status decay,
     * and cycle counting.
     *
     * Payload: `{ instanceId, typeId, heroId, failed, produced }`. ⚠️ Only the work runner
     * (`BoardRunner`) sends `produced`; combat's kill and a promotion's training cycle omit it, so
     * a reader must default it.
     */
    CYCLE_COMPLETE: 'board:cycle_complete',

    /**
     * A Token began a new cycle: `{ instanceId, typeId, heroId }`.
     *
     * ⚠️ The moment work actually starts, not the moment a tick runs. Fired when `cycleElapsedMs`
     * is still zero and every guard above it has already passed: a hero is present, the inputs are
     * in the Bank, and the charges are affordable. A Token stalled for want of ore does not say it
     * is starting; it fires once when it genuinely resumes.
     *
     * Its mirror, `CYCLE_COMPLETE`, is for rules that care that work happened. This one is for
     * rules that act on the work about to be done: the buff that should already be up while the
     * hero swings.
     */
    CYCLE_START: 'board:cycle_start',

    /** A Token was placed, moved, removed or displaced. Payload: `{ instanceId, typeId }`, plus `x`, `y` for a Token that left (`typeId: null`) or a spot with none. */
    TILE_CHANGED: 'board:tile_changed',

    /**
     * A Token was placed on the mat: the player action, as opposed to `TILE_CHANGED`, which is
     * every redraw reason a Token has (cleared, depleted, pushed, restocked). Payload: `{
     * instanceId, typeId }`
     *
     * ⚠️ This one deliberately keeps a global name rather than the `board:` prefix: the event
     * already existed as the bare string `'token_placed'` with publishers in `Placement.js` and
     * subscribers across the UI. A second `board:token_placed` would mean two announcements of one
     * action.
     */
    TOKEN_PLACED: 'token_placed',

    /** A hero's drawn place changed. Payload: `{ heroId, instanceId?, x?, y?, reason? }` — the Token they work and the point they are drawn at (neither in the Dock). */
    HERO_MOVED: 'board:hero_moved',

    /**
     * Heroes took a step. No payload: read positions from `HeroMotion.heroPointOf`. Published at
     * most once per engine tick, and only when somebody moved.
     *
     * ⚠️ Deliberately NOT `HERO_MOVED`: that one makes `TileModifiers` rebuild neighbourhoods,
     * which must happen when a hero's job changes or they arrive, never on every step of a walk.
     */
    HEROES_WALKED: 'board:heroes_walked',

    /**
     * Enemies took a step by their spawner. No payload: read positions off the Tokens, or
     * `EnemyMotion.bodyOf`. Published at most once per engine tick, and only when an enemy moved,
     * set off or stopped.
     *
     * ⚠️ Deliberately NOT `TILE_CHANGED` (every Token redraws and bounces, idle flags look again)
     * nor `ADJACENCY_DIRTY` (rebuilds neighbourhoods): `EnemyMotion` raises that one once per walk,
     * when the enemy stops.
     */
    ENEMIES_WALKED: 'board:enemies_walked',

    /**
     * A flag dropped on a Token was NOT pinned to it because its hero cannot work it: it stands
     * there as a normal area flag instead. Payload: `{ heroId, instanceId, reason }`, `reason` a
     * skip reason (`ALERT.UNSKILLED`, `ALERT.ACCESS`, `disallowed`, `rule_off`). The hero's speech
     * bubble says why (`HeroBubbleLayer`). Published by `Flags.plant`.
     */
    PIN_REFUSED: 'board:pin_refused',

    /**
     * A Foundation finished its build and became the Token it built, in place (Farmland planted by
     * Farming included). Payload: `{ instanceId, typeId, fromTypeId, heroId }`: the new Token, what
     * it was built as, the Foundation's type, and the hero who built it.
     *
     * Published once by `BoardRunner`, after the transform has succeeded. `TILE_CHANGED` fires for
     * the same transform, but also for grows, turns and every redraw, so it cannot say something
     * was built.
     */
    TOKEN_BUILT: 'board:token_built',

    /**
     * The discard bin changed: a Token went in, came back out, or the bin was emptied by Discard
     * all. Payload: `{ action, instanceId?, typeId?, count, refunded? }`. `action` is `'binned'`,
     * `'unbinned'` or `'discarded'`; `count` is how many Tokens the bin holds now; `refunded` (on
     * `'discarded'`) is what was paid, `[{ itemId, quantity }]`.
     */
    BIN_CHANGED: 'board:bin_changed',

    /**
     * A Token ran out of charges and left the board. Payload: `{ instanceId, x, y, typeId,
     * instance?, heroId?, exhaustedBy? }`; `exhaustedBy` is the hero whose work spent the last
     * charge (the one who says "{name} Depleted"), null when no hero did.
     */
    TOKEN_DEPLETED: 'board:token_depleted',

    /**
     * A Token whose type respawns ran out of charges and stays, resting (`Respawn.js`), instead
     * of leaving the board. Payload: `{ instanceId, typeId, mode, x, y, heroId, exhaustedBy }`,
     * `mode` `'refill'` or `'regrow'`. ⚠️ Never with `TOKEN_DEPLETED`: a resting Token is not
     * used up.
     */
    TOKEN_RESTING: 'board:token_resting',

    /**
     * A resting Token came back. Payload: `{ instanceId, typeId, mode, x, y }`. A refill names the
     * same Token, full again; a regrow names the Token it became (`instanceId`, `typeId`) and adds
     * `fromInstanceId`, `fromTypeId`, the one that rested.
     */
    TOKEN_RESPAWNED: 'board:token_respawned',

    /**
     * A hero finished demolishing a marked Token and it left the board (`Demolition.js`). Payload:
     * `{ instanceId, typeId, x, y, heroId }`. ⚠️ Never with `TOKEN_DEPLETED`: nothing ran out, and
     * nothing is refunded or dropped.
     */
    TOKEN_DEMOLISHED: 'board:token_demolished',

    /** A neighbourhood changed, so modifiers need recomputing. Payload: `{ points }` — the mat points the change touched. */
    ADJACENCY_DIRTY: 'board:adjacency_dirty',

    /**
     * A Token's alert state changed: staffed-but-stuck, or resolved. Payload: `{ instanceId, alert
     * }`.
     */
    ALERT_CHANGED: 'board:alert_changed',

    /**
     * A spawner's waiting alert changed: `{ instanceId, alert, needs }`, where `alert` is
     * `ALERT.SPAWN_NEEDS_ITEM`, `ALERT.SPAWN_NO_ROOM`, `ALERT.SPAWN_MAT_FULL` or null, and `needs` lists the item ids the
     * Bank is short of. Published by `SpawnerSystem.syncAlerts` on a change only.
     *
     * ⚠️ Deliberately NOT `ALERT_CHANGED`: that one carries a hero-worked Token's `instance.alert`,
     * which the runner rewrites every tick, and its progress-bar subscriber draws a red bar for any
     * value it is given. A spawner has no hero, and a spawner a hero also works would have the two
     * marks fighting over one field.
     */
    SPAWNER_ALERT_CHANGED: 'board:spawner_alert_changed',

    /**
     * A spawner (or the Guild Hall, for a quest) put a new Token on the mat. Payload: `{
     * spawnerId, instanceId, typeId, name }`: the callout "! Spawned {name}" is said from the
     * spawner.
     */
    TOKEN_SPAWNED: 'board:token_spawned',

    /** Combat on an enemy Token resolved. Payload: `{ instanceId, outcome: 'victory'|'defeat', heroId, typeId }` */
    COMBAT_RESOLVED: 'board:combat_resolved',

    /**
     * High-frequency cycle progress, for ref-based UI updates only.
     * Payload: `{ instanceId, percent }`, plus `elapsedMs, cycleTimeMs` from the
     * work runner, or `combat: true, enemyHp, enemyMaxHp` from a fight. A reset
     * to zero (a promotion answered, a flag moved) sends `percent: 0` alone.
     */
    PROGRESS: 'board:progress',

    /** A loot sprite was dropped, merged, collected or consumed. Payload: `{ spriteId? }` */
    SPRITES_CHANGED: 'board:sprites_changed',

    /**
     * A sprite was successfully taken off the floor and into storage. Payload: `{ kind, refId,
     * quantity, x, y, destination }`, where `x`/`y` are board coordinates (the point it flew from)
     * and `destination` is where it went (`'bank'` for an item; `'dock'` for a recalled hero). A
     * hero picked up off the mat by drag (`DndKit`, a UI publisher) adds `heroId`, `toScreenX`,
     * `toScreenY` and `destination: 'cursor'`; a hero recall adds `heroId`.
     *
     * ⚠️ Fires on success only, and that is load-bearing. Collection can legitimately fail: a full
     * Bank leaves the item on the floor as a visible-litter signal, and a Token with nowhere to go
     * waits. A particle that flew away while the sprite stayed put would be a lie about where the
     * player's things are.
     *
     * `SPRITES_CHANGED` cannot serve this purpose: it also fires on drops, merges and partial fits,
     * and carries no position.
     */
    SPRITE_COLLECTED: 'board:sprite_collected',

    /** A lingering loot sprite was absorbed into its parent stack. Payload: `{ parentId, absorbedId, quantity }` */
    SPRITE_ABSORBED: 'board:sprite_absorbed',

    /**
     * On-board event notification alert (missing items, missing tokens, token
     * exhausted, a skill level-up). Payload: `{ instanceId?, x?, y?, severity,
     * type, name, message }`, plus, by publisher: a `title` (a missing Token, a
     * restock, a refused drop), a `rulesText` (a refused drop, and the UI's
     * Guild Hall refusal in `MatToken`), or a level-up's `heroId, heroName,
     * skillId, skillName, startLevel, newLevel` (`NotificationSubscriptions`).
     */
    TILE_EVENT_ALERT: 'board:tile_event_alert',

    /** A token's charges changed (consumed cycle, support wear, or restocked). Payload: `{ instanceId, delta, remaining, typeId }` */
    TOKEN_CHARGES_CHANGED: 'board:token_charges_changed',

    /**
     * A hero finished training on a Token with a Promotes rule, and the game is asking whether to
     * go through with it. Payload: `{ instanceId, heroId, jobId, typeId }`
     *
     * ⚠️ Nothing has happened yet when this fires. No skills have moved and nothing has been spent:
     * the tile is holding. `BoardPromotion.accept` and `.decline` are the two ways out, and the
     * offer survives a reload because it lives on the Token instance.
     */
    PROMOTION_READY: 'board:promotion_ready',

    /**
     * A named effect just did something on a Token — `{ instanceId, title }`.
     *
     * ⚠️ **Not an alert.** `TILE_EVENT_ALERT` is for problems a player has to
     * act on (no inputs, no charges, a refused placement). An effect firing is
     * neither a problem nor persistent: it is a thing that happened, said once as
     * a quick callout and gone. Mixing them would spam the alert channel.
     */
    EFFECT_FIRED: 'board:effect_fired',

    /**
     * A hero engaged an enemy: `{ instanceId, typeId, heroId }`.
     *
     * ⚠️ Every engagement, including the ones after a kill. An enemy Token holds charges, each kill
     * spends one, and the enemy returns to full HP for the next fight, so one engagement is one
     * fight in the same sense that one cycle is one piece of work. Firing only on arrival would
     * mean a hero parked on a Bear for twenty kills procs once, which reads as broken.
     *
     * Detected as a transition INTO `active`, which catches the first engagement (idle → active)
     * and each post-intermission respawn with one rule rather than two.
     */
    COMBAT_ENGAGED: 'board:combat_engaged',

    /**
     * A hero was defeated: `{ heroId }`.
     *
     * Published by `BoardCombat.resolveDefeat` instead of a direct call into `Flags`, which would
     * make a `BoardCombat ↔ Flags` import cycle. `Flags.init` subscribes and furls the hero's flag;
     * `EventBus.publish` is synchronous, so the furl happens before
     * `TILE_CHANGED`/`COMBAT_RESOLVED`. `hero_downed` decouples `StatusEffectSystem` from
     * `BoardCombat` the same way.
     */
    HERO_DEFEATED: 'board:hero_defeated'
};

/**
 * Why a staffed Token cannot work: the payload vocabulary of `ALERT_CHANGED`, and what drives a
 * tile's single alert mark.
 *
 * Lives beside `BOARD_EVENTS` rather than in `BoardRunner` because other board systems publish it
 * too, and the enum could not live in the runner without either a cycle or a second hardcoded copy
 * of the string.
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
     * The station cannot run the recipe it is set to, because the context Tokens that recipe names
     * are not beside it. (A station with nothing picked says `CHOOSE_RECIPE` instead.)
     */
    NO_RECIPE: 'no_recipe',
    /**
     * The cycle is affordable in items but not in charges: the station itself, or a nearby context
     * Token the recipe draws on, holds fewer charges than one cycle costs. Nothing is deducted
     * while this is showing.
     */
    CHARGES: 'charges',
    /**
     * A Foundation with no recipe picked. A Foundation is never given a default: the player chooses
     * what it becomes, and until they do nobody works it.
     */
    CHOOSE_BUILD: 'choose_build',
    /**
     * A station with no recipe picked. Every station, however it arrives, waits for the player to
     * choose; until they do nobody works it. The station twin of `CHOOSE_BUILD`.
     */
    CHOOSE_RECIPE: 'choose_recipe',
    /**
     * A finished cycle's Token has nowhere to go: a Foundation's build has nowhere legal to stand,
     * or a station's recipe makes a Token and the mat is full or crowded around it. It keeps its
     * full progress and nothing is spent; it tries again every tick.
     */
    NO_ROOM: 'no_room',
    /**
     * A spawner cannot pay one spawn's upkeep from the Bank. Carried by `SPAWNER_ALERT_CHANGED`,
     * never by `instance.alert`: no hero is involved, so it is an on-Token icon and never a speech
     * bubble.
     */
    SPAWN_NEEDS_ITEM: 'spawn_needs_item',
    /**
     * A spawner's last attempt found nowhere free to land, and it is waiting with its clock full.
     * Same channel as `SPAWN_NEEDS_ITEM`. A spawner at its cap raises nothing: that is its normal
     * resting state, not a problem.
     */
    SPAWN_NO_ROOM: 'spawn_no_room',
    /**
     * A spawner is waiting because the mat is at its Token cap (`MatCap`): spawned Tokens count
     * toward it. Same channel as `SPAWN_NEEDS_ITEM`.
     */
    SPAWN_MAT_FULL: 'spawn_mat_full',
    /**
     * The Token ran out and is resting until it respawns (`Respawn.js`). `WorkCheck`'s first
     * answer, so a flag skips it and its hero lets go, but ⚠️ never written as a Token's alert:
     * resting is not a problem the player fixes, so it draws no badge and stays out of
     * `WorkCheck.FIXABLE`.
     */
    RESTING: 'resting'
};
