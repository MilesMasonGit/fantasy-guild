// Fantasy Guild — Timed changes: the one clock system for Tokens (Token Lifecycle slice 3.2, DP-2)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
// ⚠️ A cycle: SpawnerSystem imports this module for `pickWeighted`. Both sides
// touch the other only inside functions, so either may load first.
import * as SpawnerSystem from './SpawnerSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * ⭐ **Everything on the mat that happens on a clock rather than a hero's work**
 * (roadmap DP-2, §3.1). This slice builds two blocks:
 *
 * * `grows: { into, afterMs }` — after `afterMs` the Token **becomes** `into`
 *   (a Sapling becomes a Tree).
 * * `turns: { into: [{ typeId, weight }], everyMs, lastsMs }` — after `everyMs`
 *   as itself the Token becomes a weighted pick from `into`, which carries
 *   `turnedFrom`; after the ORIGINAL type's `turns.lastsMs` it turns back
 *   (a Coast becomes a Shrimp Coast for a while). The timing is read from the
 *   `turnedFrom` type, so it is authored in one place.
 *
 * Spawner intervals (slice 3.3) are one more row of the {@link HANDLERS}
 * table; the attempt itself lives in `SpawnerSystem.js`.
 *
 * ## State (saved, on the instance)
 * `instance.clocks = { growMs, turnMs, … }` — elapsed ms, created only on a
 * Token that has a timed block, and absent reads as 0. A change is a transform
 * (`EffectActions.transformInstance`): the new instance **keeps `origin`** and
 * starts with fresh clocks.
 *
 * ## ⚠️ Every clock advances by the tick's `delta`
 * Offline time is replayed by the time bank speeding up the live engine
 * (`TimeManager.setTimeScale`), so a clock that counted anything else would
 * not fast-forward. This module never reads the wall clock.
 *
 * ## One big tick equals many small ones
 * A change that falls due part-way through a tick hands the rest of that tick
 * to the Token it became, and that one may change in turn (bounded by
 * {@link MAX_CHANGES_PER_TICK}). So ten minutes in one tick end in the same
 * state as ten minutes in 100 ms ticks.
 *
 * ## A change with nowhere to stand
 * A transform that has no legal spot does not happen (`transformInstance`
 * returns null). The clock is then held **full** and the change is retried on
 * the next tick — once per tick, never looped within one.
 *
 * ## A cycle in progress is lost (SP-51)
 * The work-cycle progress (`cycleElapsedMs`) belongs to the old instance, which
 * leaves the mat; nothing completes it. The hero's claim was on that instance,
 * so `Flags` releases it on its next pass and the hero moves to the next thing
 * in range, or idles (SP-52). `BoardRunner` ticks this module before `Flags`,
 * so that happens in the same tick.
 */

/** Most changes one Token may go through in one tick — a guard, not a design number. */
export const MAX_CHANGES_PER_TICK = 64;

/** A weighted pick from `[{ typeId, weight }]`, skipping unknown types and non-positive weights. */
export function pickWeighted(entries, random = Math.random) {
    const usable = (Array.isArray(entries) ? entries : [])
        .filter(e => e?.typeId && getTokenType(e.typeId) && Number(e.weight) > 0);
    if (!usable.length) return null;
    // One choice rolls nothing, so a single-entry list never moves the random stream.
    if (usable.length === 1) return usable[0].typeId;
    const total = usable.reduce((sum, e) => sum + Number(e.weight), 0);
    let roll = random() * total;
    for (const e of usable) {
        roll -= Number(e.weight);
        if (roll < 0) return e.typeId;
    }
    return usable[usable.length - 1].typeId;
}

/** The ms after which a Token turned from `turnedFrom` turns back (0 when unauthored: at once). */
function turnBackAfter(instance) {
    return Number(getTokenType(instance.turnedFrom)?.turns?.lastsMs) || 0;
}

/**
 * ⭐ The handler table. Each entry is one kind of clock:
 *
 * * `clock` — the key in `instance.clocks` it counts on;
 * * `applies(instance, def)` — whether this Token runs it;
 * * `dueMs(instance, def)` — when it fires;
 * * `fire(instance, def, random, ctx)` — what happens. `ctx` is
 *   `{ overMs, advance }`: how long ago it fell due, and {@link advance}, so a
 *   Token a handler creates can live the rest of the tick. Returns the instance that
 *   now stands there (a new one after a transform, or the same one for a
 *   handler that acts without replacing), or null when it could not happen
 *   (the clock is held full and retried next tick).
 *
 * A turned instance runs only its turn back: it is a temporary state of the
 * Token it came from.
 */
export const HANDLERS = [
    {
        id: 'turn_back',
        clock: 'turnMs',
        applies: (instance) => !!instance.turnedFrom && !!getTokenType(instance.turnedFrom),
        dueMs: (instance) => turnBackAfter(instance),
        fire: (instance) => EffectActions.transformInstance(instance, instance.turnedFrom, { fixPlaced: true })
    },
    {
        id: 'grows',
        clock: 'growMs',
        applies: (instance, def) => !instance.turnedFrom && !!def?.grows?.into && Number(def.grows.afterMs) >= 0,
        dueMs: (instance, def) => Number(def.grows.afterMs) || 0,
        fire: (instance, def) => EffectActions.transformInstance(instance, def.grows.into, { fixPlaced: true })
    },
    {
        id: 'turns',
        clock: 'turnMs',
        applies: (instance, def) => !instance.turnedFrom && Array.isArray(def?.turns?.into) && def.turns.into.length > 0,
        dueMs: (instance, def) => Number(def.turns.everyMs) || 0,
        fire: (instance, def, random) => {
            const into = pickWeighted(def.turns.into, random);
            if (!into || into === instance.typeId) return null;
            return EffectActions.transformInstance(instance, into, {
                fixPlaced: true,
                extra: { turnedFrom: instance.typeId }
            });
        }
    },
    {
        // A spawner's interval (slice 3.3). Acts without replacing the Token:
        // a spawn returns the spawner itself; a blocked attempt returns null.
        id: 'spawner',
        clock: 'spawnMs',
        applies: (instance, def) => !instance.turnedFrom && SpawnerSystem.isSpawner(def),
        dueMs: (instance, def) => SpawnerSystem.intervalOf(def),
        fire: (instance, def, random, ctx) => SpawnerSystem.attemptSpawn(instance, def, random, ctx)
    }
];

/** The handlers a Token runs right now. */
function activeHandlers(instance) {
    const def = getTokenType(instance.typeId);
    return { def, active: HANDLERS.filter(h => h.applies(instance, def)) };
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
        for (const h of active) {
            if (advanced.has(h.clock)) continue;
            clocks[h.clock] = (Number(clocks[h.clock]) || 0) + remaining;
            advanced.add(h.clock);
        }
        remaining = 0;

        // The change that fell due FIRST is the one with the most time past due.
        let due = null;
        for (const h of active) {
            const at = h.dueMs(current, def);
            const over = clocks[h.clock] - at;
            if (over >= 0 && (!due || over > due.over)) due = { h, at, over };
        }
        if (!due) return;

        const next = due.h.fire(current, def, random, { overMs: due.over, advance });
        if (!next) {
            // Nowhere to stand (or nothing to become): held full, retried next tick.
            clocks[due.h.clock] = due.at;
            return;
        }

        if (next === current) {
            // Acted without replacing the Token: this clock starts its next lap.
            clocks[due.h.clock] -= Math.max(due.at, 1);
            continue;
        }

        // Replaced: the Token it became lives the rest of this tick.
        logger.debug('TimedChanges', `${current.typeId} → ${next.typeId} (${due.h.id})`);
        current = next;
        remaining = due.over;
    }
}

/**
 * Advance every Token on the mat. Called from `BoardRunner.tick` with the
 * tick's (time-scaled) `delta`.
 *
 * @param {number} delta game ms since the last tick
 * @param {() => number} [random] for the weighted picks; tests pass a seeded one
 */
export function tick(delta, random = Math.random) {
    if (!(delta > 0)) return;
    for (const instance of BoardState.tokens()) {
        // A Token taken off the mat earlier in this same pass is skipped.
        if (!BoardState.getTokenById(instance.id)) continue;
        advance(instance, delta, random);
    }
}
