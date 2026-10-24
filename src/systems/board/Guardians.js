// guardians: an enemy a Token keeps beside it, and a boss's lair

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef, isBossEnemy } from '../../config/registries/enemyProfile.js';
import { guardianBlockOf, defaultGuardianReturnMs } from '../../config/registries/tokenConstants.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
import * as MatCap from './MatCap.js';

/**
 * A Token type with a `guardian` block keeps one enemy beside it (`tokenConstants.guardianBlockOf`).
 *
 * - **On a Token heroes work** (a rich vein, a treasure) the enemy is its **guardian**: while it
 *   stands, nobody works the Token (`WorkCheck` says `guarded`, a flag skips it, a hero on it lets
 *   go). Beat it and the Token is free until it comes back.
 * - **On a Token with no work** the enemy simply lives there: a boss's **lair**.
 *
 * Either way it comes back `returnMs` after it is beaten (a boss sooner), to be beaten again, and
 * it drops its loot every time: a kill is a kill. It potters around its Token like a camp's enemy
 * around its camp (`EnemyMotion`), and attacks only if its own type is hostile (a boss never is).
 *
 * The first one appears on the first tick the Token stands on the mat, so a map's guarded node or
 * lair arrives with its enemy. Like a spawner's, a return waits while the mat is at its Token cap
 * or there is no room beside the Token, and tries again every tick.
 *
 * State, all saved on the instances:
 * - the Token's `guardianId`: the enemy it keeps, while it stands and after it is beaten, until a
 *   new one replaces it;
 * - the enemy's `guards` and `tether`: the Token it guards and potters around;
 * - the Token's `clocks.guardianMs`: the return clock, a row of `TimedChanges.HANDLERS`, so it runs
 *   on the tick's `delta` and a catch-up plays it like every other clock.
 *
 * A guardian is beaten in one kill (it carries 1 use, whatever its type says). One that outlives its
 * Token (the Token was demolished or turned into something else) stays until beaten and never
 * comes back.
 */

/** The return clock, in `instance.clocks`. */
export const CLOCK = 'guardianMs';

/**
 * A Token type's guardian as `{ typeId, returnMs, boss }`, or null: no block, a block naming no
 * enemy, or a Token that is an enemy itself (the content audit reports those).
 */
export function guardianOf(def) {
    const block = guardianBlockOf(def);
    if (!block || isEnemyDef(def)) return null;
    const enemyDef = getTokenType(block.typeId);
    if (!isEnemyDef(enemyDef)) return null;
    const boss = isBossEnemy(enemyDef);
    return { typeId: block.typeId, returnMs: block.returnMs ?? defaultGuardianReturnMs(boss), boss };
}

/** The guardian standing for `instance` right now, or null. */
export function standingGuardianOf(instance) {
    const id = instance?.guardianId;
    if (typeof id !== 'string' || !id) return null;
    const enemy = BoardState.getTokenById(id);
    return enemy && enemy.guards === instance.id ? enemy : null;
}

/** Whether a guardian stands beside `instance`, so nobody may work it. */
export function isGuarded(instance) {
    return standingGuardianOf(instance) != null;
}

/** Whether `instance` (of type `def`) keeps a guardian that is not on the mat right now. */
export function isAway(instance, def = getTokenType(instance?.typeId)) {
    return !!instance && guardianOf(def) != null && !isGuarded(instance);
}

/**
 * When the guardian comes back, on the Token's return clock: at once the first time (the Token
 * has never had one), else its return time after it was beaten.
 */
export function dueMs(instance, def = getTokenType(instance?.typeId)) {
    const guardian = guardianOf(def);
    if (!guardian) return 0;
    return instance?.guardianId ? guardian.returnMs : 0;
}

/**
 * `TimedChanges`' handler `fire`: put the guardian beside its Token. Returns the Token itself, or
 * null when it could not land (the mat at its cap, or no room), so the clock is held and the return
 * is tried again next tick.
 */
export function bringBack(instance, def, random = Math.random) {
    const guardian = guardianOf(def);
    if (!guardian || !BoardState.getTokenById(instance?.id)) return null;
    if (!MatCap.canPlaceMore(1)) return null;

    const landed = EffectActions.spawn(
        { payload: { typeId: guardian.typeId, placement: PLACEMENT.NEAREST_FREE } },
        { self: instance.id },
        random
    );
    const enemy = landed ? BoardState.getTokenById(landed.instanceId) : null;
    if (!enemy) return null;

    enemy.tether = instance.id;
    enemy.guards = instance.id;
    // Beaten in one kill, whatever its type's uses: then it is gone until its return.
    enemy.usesRemaining = 1;
    instance.guardianId = enemy.id;

    // Said from the Token it keeps, and the enemy hops out of it, as a spawner's do.
    EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, {
        spawnerId: instance.id,
        instanceId: enemy.id,
        typeId: guardian.typeId,
        name: tokenName(guardian.typeId) || guardian.typeId
    });
    // The Token is guarded now: its own look, and any flag that wanted it, look again.
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    return instance;
}

/**
 * What a Token's guardian is doing, for the inspection and the timer bubble: `{ typeId, boss,
 * standing, guardianId, returnMs, inMs }`. `inMs` is the time to its return while it is away (0
 * while a return waits for room), null while it stands. Null for a Token that keeps none.
 */
export function guardianState(instance) {
    const def = getTokenType(instance?.typeId);
    const guardian = guardianOf(def);
    if (!guardian) return null;
    const standing = standingGuardianOf(instance);
    const clock = Number(instance?.clocks?.[CLOCK]) || 0;
    return {
        typeId: guardian.typeId,
        boss: guardian.boss,
        standing: !!standing,
        guardianId: standing?.id ?? null,
        returnMs: guardian.returnMs,
        // Beaten, it is on its way back; never yet placed, it arrives on the next tick.
        inMs: standing ? null : Math.max(0, dueMs(instance, def) - clock),
        // Whether it has ever stood here: the first one is not "returning".
        beaten: !standing && !!instance?.guardianId,
        // Whether the Token has work of its own (a guarded node) or is a lair.
        lair: !def?.config && !def?.foundation
    };
}

/** The Token a guardian enemy keeps watch over, while it is on the mat; else null. */
export function guardedBy(enemyInstance) {
    const id = enemyInstance?.guards;
    if (typeof id !== 'string' || !id) return null;
    const token = BoardState.getTokenById(id);
    return token && token.guardianId === enemyInstance.id ? token : null;
}

/** The Token whose guardian was the enemy instance `enemyId`, or null. One pass over the mat. */
function keeperOf(enemyId) {
    if (!enemyId) return null;
    for (const t of BoardState.tokens()) if (t.guardianId === enemyId) return t;
    return null;
}

let unsubscribe = null;

/**
 * A guardian that falls is announced on its Token: its look turns to "returning", and a flag that
 * was waiting for the Token claims it at once (`Flags` looks again on `TILE_CHANGED`).
 * Idempotent.
 */
export function init() {
    unsubscribe?.();
    unsubscribe = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p = {}) => {
        const keeper = keeperOf(p.instanceId);
        if (keeper) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: keeper.id, typeId: keeper.typeId });
    });
}
