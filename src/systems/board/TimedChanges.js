// timed changes: the one clock system for Tokens

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import * as PassiveProduction from './PassiveProduction.js';
import * as Hand from './Hand.js';
import * as Respawn from './Respawn.js';
import * as Demolition from './Demolition.js';
import * as Growth from './Growth.js';
import * as Fields from './Fields.js';
import * as EventTokens from './EventTokens.js';
import * as FishingSpots from './FishingSpots.js';
import * as Laboratories from './Laboratories.js';
import { growTimeOf } from './TileModifiers.js';
import { ownGateMet } from './Groves.js';
import { ALERT } from './boardEvents.js';
import { logger } from '../../utils/Logger.js';

/**
 * Everything on the mat that happens on a clock rather than a hero's work.
 *
 * `grows: { into, afterMs, needsNearby?, cost? }`: after `afterMs` the Token becomes `into` (a
 * Stump becomes a Tree). A growth may need its owner to run (its clock stands still without it) or
 * pay a cost when it happens (stopped at its finish until it can): `Growth.js`.
 * Spawner intervals are one more row of the {@link HANDLERS} table; the attempt itself lives in
 * `SpawnerSystem.js`. So is a resting Token's way back (`respawn`, refill or regrow), whose rules
 * live in `Respawn.js`, and a Field's crop sowing and ripening (`Fields.js`). Passive Production pays several lines on its own clock, so {@link tick} runs
 * it beside the table (`PassiveProduction.advance`). An event Token's way out (a buff's time up, a
 * rich node's hour running out) is two more rows, and a fishing spot drifting off unworked one more
 * (`EventTokens.js`, `FishingSpots.js`): the only rows that take a Token off the mat.
 *
 * State (saved, on the instance): `instance.clocks = { growMs, spawnMs, … }`, elapsed ms, created
 * only on a Token that has a timed block, absent reads as 0. A change is a transform
 * (`EffectActions.transformInstance`): the new instance keeps `origin` and starts with fresh
 * clocks.
 *
 * ⚠️ Every clock advances by the tick's `delta`. Time away is caught up by running the real tick
 * handlers in big steps (`CatchUp`), so a clock that counted anything else would not
 * fast-forward. This module never reads the wall clock.
 *
 * One big tick equals many small ones: a change that falls due part-way through a tick hands the
 * rest of that tick to the Token it became, and that one may change in turn (bounded by {@link
 * MAX_CHANGES_PER_TICK}); a hero works it only for that rest ({@link arrivals}). So ten minutes in
 * one tick end in the same state as ten minutes in 100 ms ticks.
 *
 * A spawner's attempt that finds no room acts without replacing the Token: the clock starts its next
 * lap, keeping any time past due, so a long tick consumes `random` in the same order as many small
 * ticks would.
 *
 * A change with nowhere to stand does not happen (`transformInstance` returns null). The clock is
 * then held full and the change is retried on the next tick: once per tick, never looped within
 * one.
 *
 * A cycle in progress is lost: the work-cycle progress (`cycleElapsedMs`) belongs to the old
 * instance, which leaves the mat, and nothing completes it. The hero's claim was on that instance,
 * so `Flags` releases it on its next pass and the hero moves to the next thing in range, or idles.
 * `BoardRunner` ticks this module before `Flags`, so that happens in the same tick.
 */

/** Most changes one Token may go through in one tick — a guard, not a design number. */
export const MAX_CHANGES_PER_TICK = 64;

/**
 * How long a Token's growth takes: its authored `grows.afterMs` with the Grow Time that reaches it,
 * floored (`TileModifiers.growTimeOf`: a Hall star on its kind such as Green Thumb, a building in
 * reach). A Stump its Forest regrows reads it the same way; its Forest only decides whether it
 * grows back. The one reader of a growth's time.
 */
export function growMsOf(instance, def = getTokenType(instance?.typeId)) {
    return growTimeOf(instance, Number(def?.grows?.afterMs) || 0);
}

/**
 * When a growing Token (a Sapling) next changes, for the mat's growth bubble and the inspection
 * lines: `{ inMs, totalMs, into, paused, stopped, needsNearby, cost, short }`, `totalMs` being the
 * whole growth as sped up ({@link growMsOf}). `inMs` is 0 while the change is held (in the hand,
 * nowhere to stand, or stopped). `paused`: it needs an owner of `needsNearby` and has none, so
 * its clock stands still (`inMs` stays where it is). `stopped`: it fell due and the Bank cannot pay
 * its `cost`; `short` names the items it lacks. Null for a Token that does not grow.
 */
export function nextGrowth(instance) {
    if (!instance) return null;
    const def = getTokenType(instance.typeId);
    if (!def?.grows?.into || !(Number(def.grows.afterMs) >= 0)) return null;
    const clockMs = Number(instance.clocks?.growMs) || 0;
    const totalMs = growMsOf(instance, def);
    const { needsNearby, cost } = Growth.growsTermsOf(def);
    const paused = !Growth.gateMet(instance, def);
    const alert = paused ? null : Growth.growthAlertOf(instance.id);
    const stopped = alert?.alert === ALERT.GROW_NEEDS_ITEM;
    return {
        inMs: Math.max(0, totalMs - clockMs), totalMs, into: def.grows.into,
        paused, stopped, needsNearby, cost, short: stopped ? alert.needs : []
    };
}

/**
 * A growth falls due: pay its cost and become the Token it grows into. Short of the cost it is
 * stopped (null: held at its finish, tried again next tick) and says what it lacks; with nowhere to
 * stand it is held the same way and pays nothing, the cost being taken only once the new Token has
 * landed.
 */
function growInto(instance, def) {
    const short = Growth.shortOf(def);
    if (short.length) {
        Growth.setGrowthAlert(instance.id, ALERT.GROW_NEEDS_ITEM, short);
        return null;
    }
    const next = EffectActions.transformInstance(instance, def.grows.into, { fixPlaced: true, cause: 'grow' });
    if (Growth.anyGrowthAlert()) Growth.setGrowthAlert(instance.id, null);
    if (next) Growth.payFor(def);
    return next;
}

/**
 * Whether a growth's clock stands still: it needs its owner (a Stump, its Forest) and that is not
 * standing. Raises the Token's "needs nearby" alert while so, and drops it once it is.
 */
function growthPaused(instance, def) {
    return gatePaused(instance, Growth.growsTermsOf(def).needsNearby);
}

/**
 * Whether a refill's rest stands still: it needs its owner (a Bare apple tree, its Orchard) and that
 * is not standing. The same alert as a growth's, so the Token says what it needs the same way.
 */
function refillPaused(instance, def) {
    return gatePaused(instance, Respawn.respawnOf(def)?.needsNearby);
}

function gatePaused(instance, needsNearby) {
    if (!needsNearby?.length) return false;
    const paused = !ownGateMet(instance, needsNearby);
    const prev = Growth.growthAlertOf(instance.id);
    if (paused) {
        if (prev?.alert !== ALERT.GROW_NEEDS_NEARBY || prev.needs !== needsNearby) {
            Growth.setGrowthAlert(instance.id, ALERT.GROW_NEEDS_NEARBY, needsNearby);
        }
    } else if (prev?.alert === ALERT.GROW_NEEDS_NEARBY) {
        Growth.setGrowthAlert(instance.id, null);
    }
    return paused;
}

/**
 * ⭐ The handler table. Each entry is one kind of clock:
 *
 * * `clock` — the key in `instance.clocks` it counts on;
 * * `replaces` — true when firing puts a new instance in the Token's place or
 *   takes it off the mat, so it waits while the Token is in the player's hand
 *   ({@link Hand.setInHand});
 * * `perInstance` — true for the rows whose `applies` reads the instance (an
 *   event Token's `instance.event`); they come after the resting rows and are
 *   asked live, only of a Token that landed as an event;
 * * `idleWhile(instance, def)` — optional: while true the clock is held at zero
 *   (a full enemy camp);
 * * `pausedWhile(instance, def)` — optional: while true the clock stands still
 *   where it is and nothing falls due (a Stump whose Forest is gone);
 * * `once` — true when the clock is done once it acts (a refill), rather than
 *   starting another lap;
 * * `resting` — true for the rows whose `applies` moves with the Token's
 *   charges (they come last in the table); every other row's `applies` reads
 *   only the type, so it is asked once per type
 *   ({@link activeHandlers});
 * * `applies(instance, def)` — whether this Token runs it;
 * * `dueMs(instance, def)` — when it fires;
 * * `fire(instance, def, random, ctx)` — what happens. `ctx` is
 *   `{ overMs, advance, arrived }`: how long ago it fell due, {@link advance}, so a
 *   Token a handler creates can live the rest of the tick, and `arrived(token, overMs)`,
 *   which says that Token came to stand there `overMs` ago ({@link arrivals}). Returns the instance that
 *   now stands there (a new one after a transform, or the same one for a
 *   handler that acts without replacing), {@link REMOVED} when the Token left
 *   the mat, or null when it could not happen (the clock is held full and
 *   retried next tick).
 *
 */
export const HANDLERS = [
    {
        // A growth (`Growth.js`): it may need its owner to run, or pay a cost to happen.
        id: 'grows',
        clock: 'growMs',
        replaces: true,
        pausedWhile: growthPaused,
        applies: (instance, def) => !!def?.grows?.into && Number(def.grows.afterMs) >= 0,
        dueMs: (instance, def) => growMsOf(instance, def),
        fire: growInto
    },
    {
        // A spawner's interval. Acts without replacing the Token: a spawn, or a spawn missed for want
        // of room, returns the spawner itself and the next lap starts; a held attempt returns null.
        id: 'spawner',
        clock: 'spawnMs',
        // A full enemy camp's clock stands at zero: a beaten member comes back an interval later.
        // So does a camp on a mat its arrival still holds: it spawns an interval after it is cleared.
        idleWhile: (instance, def) => SpawnerSystem.isSleepingCamp(instance) || SpawnerSystem.isFullEnemyCamp(instance, def),
        applies: (instance, def) => SpawnerSystem.isSpawner(def),
        dueMs: (instance, def) => SpawnerSystem.intervalOf(def),
        fire: (instance, def, random, ctx) => SpawnerSystem.spawnerTurn(instance, def, random, ctx)
    },
    {
        // A Field's own crop (`Fields.js`): a growing crop ripens, an empty Field sows its pick
        // (held and tried again each tick while it is short of the seed). Acts without replacing
        // the Token. One-shot: the clock is gone once it acts, and stands at zero while ripe.
        id: 'field',
        clock: Fields.CLOCK,
        once: true,
        idleWhile: (instance, def) => Fields.clockIdle(instance, def),
        applies: (instance, def) => Fields.isField(def),
        dueMs: (instance, def) => Fields.clockDueMs(instance, def),
        fire: (instance, def, random, ctx) => {
            const ripening = Fields.stageOf(instance, def) === Fields.STAGE.GROWING;
            const next = Fields.clockFired(instance, def);
            // A crop that ripened part-way through the tick is harvested only after it ripened.
            if (ripening && next) arrivedAt(instance, ctx?.overMs);
            return next;
        }
    },
    {
        // A fishing spot drifts off after a while with nobody working it (`FishingSpots.js`): its
        // clock is held at zero while a hero works it, so the while counts from when they let go.
        id: 'spot_unworked',
        clock: FishingSpots.SPOT_CLOCK,
        replaces: true,
        // A spot a Laboratory studies is worked too (`Laboratories.isStudied`).
        idleWhile: (instance) => BoardState.workerOf(instance.id) !== null || Laboratories.isStudied(instance),
        applies: (instance, def) => FishingSpots.unworkedMsOf(def) > 0,
        dueMs: (instance, def) => FishingSpots.unworkedMsOf(def),
        fire: (instance) => (FishingSpots.leave(instance, FishingSpots.LEFT.UNWORKED) ? REMOVED : null)
    },
    {
        // A resting Token refills in place after its rest. One-shot: the clock is gone once it
        // refills, and the next rest starts it afresh (`Respawn.restInstead`). A refill that needs
        // its owner stands still without it.
        id: 'refill',
        clock: Respawn.CLOCK,
        once: true,
        resting: true,
        pausedWhile: refillPaused,
        applies: (instance, def) => !!def?.respawn && Respawn.restingMode(instance, def) === 'refill',
        dueMs: (instance, def) => Respawn.restMsOf(instance, def),
        fire: (instance, def, random, ctx) => {
            arrivedAt(instance, ctx?.overMs);
            return Respawn.refill(instance);
        }
    },
    {
        // A resting Token becomes the Token it regrows from, on the next tick, which grows back
        // into it on its own `grows` clock.
        id: 'regrow',
        clock: Respawn.CLOCK,
        replaces: true,
        resting: true,
        applies: (instance, def) => !!def?.respawn && Respawn.restingMode(instance, def) === 'regrow',
        dueMs: () => 0,
        fire: (instance, def) => {
            const next = EffectActions.transformInstance(instance, Respawn.respawnOf(def).into, { fixPlaced: true, cause: 'regrow' });
            if (next) Respawn.regrown(instance, next);
            return next;
        }
    },
    {
        // An event buff's time on the mat (`EventTokens.js`): it leaves when its time is up.
        id: 'event_time_up',
        clock: EventTokens.EVENT_CLOCK,
        replaces: true,
        perInstance: true,
        applies: (instance) => EventTokens.isEventBuff(instance),
        dueMs: (instance) => EventTokens.lastsMsOf(instance),
        fire: (instance) => (EventTokens.leave(instance, EventTokens.ENDED.TIME_UP) ? REMOVED : null)
    },
    {
        // An event's rich node leaves when its hour is up, worked or not.
        id: 'event_unworked',
        clock: EventTokens.EVENT_CLOCK,
        replaces: true,
        perInstance: true,
        applies: (instance) => EventTokens.isEventNode(instance),
        dueMs: () => EventTokens.UNWORKED_LEAVE_MS,
        fire: (instance) => (EventTokens.leave(instance, EventTokens.ENDED.TIME_UP) ? REMOVED : null)
    }
];

/** What a handler's `fire` returns when the Token left the mat: nothing stands there now. */
export const REMOVED = Object.freeze({ removed: true });

/** The rows asked of an event Token only, live ({@link HANDLERS}' `perInstance`). */
const PER_INSTANCE = HANDLERS.filter(h => h.perInstance);

/**
 * Per Token type, the handlers it may run, kept for the Token registry's version: `fixed`, whose
 * `applies` reads only the type (a growth, a spawner), and `resting`, whose answer moves with
 * the Token's charges (a refill, a regrow) and is asked live.
 *
 * ⚠️ Every timed Token asks this on every tick, and a day's catch-up is 86,400 ticks: filtering the
 * whole table each time (six `applies`, a new array) cost more than the work it chose.
 */
let plans = { version: -1, byType: new Map() };

/** This Token's type's plan, made on first ask after a content change. */
function planOf(instance, def) {
    const version = registryVersion();
    if (plans.version !== version) plans = { version, byType: new Map() };
    let plan = plans.byType.get(instance.typeId);
    if (!plan || plan.def !== def) {
        const fixed = [];
        const resting = [];
        for (const h of HANDLERS) {
            if (h.perInstance) continue;
            if (h.resting) {
                if (def?.respawn) resting.push(h);
            } else if (h.applies(instance, def)) {
                fixed.push(h);
            }
        }
        plan = { def, fixed, resting };
        plans.byType.set(instance.typeId, plan);
    }
    return plan;
}

/**
 * The handlers a Token runs right now, in `HANDLERS` order (the resting rows, then the per-instance
 * rows, are the table's last). The returned array may be shared: read it, never change it.
 */
function activeHandlers(instance) {
    const def = getTokenType(instance.typeId);
    const plan = planOf(instance, def);
    const isEvent = instance.event != null;
    if (!plan.resting.length && !isEvent) return { def, active: plan.fixed };
    const active = plan.fixed.slice();
    for (const h of plan.resting) if (h.applies(instance, def)) active.push(h);
    if (isEvent) for (const h of PER_INSTANCE) if (h.applies(instance, def)) active.push(h);
    return { def, active };
}

/**
 * Advance one Token's clocks by `delta`, carrying out whatever falls due.
 * Exported for tests; the game calls {@link tick}.
 */
export function advance(instance, delta, random = Math.random) {
    let current = instance;
    let remaining = delta;

    for (let step = 0; step < MAX_CHANGES_PER_TICK && current; step++) {
        const { def, active } = activeHandlers(current);
        if (!active.length) return;

        const clocks = current.clocks && typeof current.clocks === 'object' ? current.clocks : (current.clocks = {});
        const advanced = new Set();
        // The handler whose clock stands still this step (a Set in the unlikely case of two), kept
        // without allocating in the usual case of none or one.
        let paused = null;
        for (const h of active) {
            if (advanced.has(h.clock)) continue;
            advanced.add(h.clock);
            // ⚠️ An idle clock (`idleWhile`) is held at zero rather than paused, so the wait never
            // banks: not across a big catch-up step, and not from an older save that held it full.
            if (h.idleWhile?.(current, def)) {
                clocks[h.clock] = 0;
                continue;
            }
            // A paused clock stands where it is, and nothing on it falls due.
            if (h.pausedWhile?.(current, def)) {
                if (paused === null) paused = h;
                else if (paused instanceof Set) paused.add(h);
                else paused = new Set([paused, h]);
                continue;
            }
            clocks[h.clock] = (Number(clocks[h.clock]) || 0) + remaining;
        }
        remaining = 0;

        // The change that fell due FIRST is the one with the most time past due.
        let due = null;
        for (const h of active) {
            if (paused !== null && (paused === h || (paused instanceof Set && paused.has(h)))) continue;
            const at = h.dueMs(current, def);
            const over = clocks[h.clock] - at;
            if (over >= 0 && (!due || over > due.over)) due = { h, at, over };
        }
        if (!due) return;

        // In the player's hand: a change that would replace it waits, clock held full, until it is
        // put down.
        if (due.h.replaces && Hand.isInHand(current.id)) {
            clocks[due.h.clock] = due.at;
            return;
        }

        const next = due.h.fire(current, def, random, { overMs: due.over, advance, arrived: arrivedAt });
        if (!next) {
            // Nowhere to stand (or nothing to become): held full, retried next tick.
            clocks[due.h.clock] = due.at;
            return;
        }
        // Left the mat: nothing stands there to run the rest of the tick.
        if (next === REMOVED) return;

        if (next === current) {
            // Acted without replacing the Token: this clock starts its next lap, or, for a
            // one-shot clock, is done.
            if (due.h.once) delete clocks[due.h.clock];
            else clocks[due.h.clock] -= Math.max(due.at, 1);
            continue;
        }

        // Replaced: the Token it became lives the rest of this tick, and is worked only from the
        // moment it stood there.
        logger.debug('TimedChanges', `${current.typeId} → ${next.typeId} (${due.h.id})`);
        arrivals.delete(current.id);
        arrivedAt(next, due.over);
        current = next;
        remaining = due.over;
    }
}

/**
 * The Tokens a timed change put in place or brought back during this tick, by instance id: how
 * long before the tick's end each came (0 when it fell due at the very end). A refill, a ripened
 * crop, the Token a growth or a regrow became (a Sapling's Oak), a spawner's new Token. The clocks
 * are advanced before any Token works, so the runner would otherwise work such a Token for the
 * whole tick, the part before it stood there included: a 1000 ms step would give it up to a second
 * more than ten 100 ms steps. It works only the part after it came instead. Filled by {@link tick},
 * read by `BoardRunner.tick` straight after.
 */
const arrivals = new Map();

function arrivedAt(token, overMs) {
    if (token?.id) arrivals.set(token.id, Math.max(0, Number(overMs) || 0));
}

/** This tick's arrivals (see {@link arrivals}); empty until the next {@link tick}. */
export function arrivalsThisTick() {
    return arrivals;
}

/**
 * Advance every Token on the mat. Called from `BoardRunner.tick` with the
 * tick's `delta`.
 *
 * @param {number} delta game ms since the last tick
 * @param {() => number} [random] for the weighted picks; tests pass a seeded one
 */
export function tick(delta, random = Math.random) {
    arrivals.clear();
    if (!(delta > 0)) return;
    // A stopped growth reads what the Bank and the mat hold afresh each tick, once per item.
    Growth.supplyChanged();
    for (const instance of BoardState.tokens()) {
        // A Token taken off the mat earlier in this same pass is skipped.
        if (!BoardState.getTokenById(instance.id)) continue;
        // ⚠️ A Token marked for demolition stands still, its clocks held where they are: a growth
        // would put a new, unmarked instance in its place, and a spawner, refill or Passive
        // Production would keep working a Token the player asked to be rid of. What it was waiting
        // for is no longer a problem, so its growth alert drops.
        if (Demolition.isMarked(instance)) {
            if (Growth.anyGrowthAlert()) Growth.setGrowthAlert(instance.id, null);
            continue;
        }
        // Passive Production first: it only grants items, and a Token that changes below starts its
        // new self with fresh clocks.
        PassiveProduction.advance(instance, delta);
        advance(instance, delta, random);
    }
    // Spawners' on-mat alerts, once this tick's attempts are done; a growing Token's alert goes
    // with it when it leaves the mat.
    SpawnerSystem.syncAlerts();
    Growth.pruneGrowthAlerts();
}

/** The growth alerts belong to the board they were raised on. Idempotent. */
export function init() {
    Growth.init();
}
