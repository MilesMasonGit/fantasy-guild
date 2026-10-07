// timed changes: the one clock system for Tokens

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { turnTiming } from '../../config/registries/tokenConstants.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import { pickWeighted } from './weightedPick.js';
import { logger } from '../../utils/Logger.js';

// Re-exported for existing callers and tests; it lives in a leaf module so SpawnerSystem can use it
// without importing this one.
export { pickWeighted };

/**
 * Everything on the mat that happens on a clock rather than a hero's work.
 *
 * `grows: { into, afterMs }`: after `afterMs` the Token becomes `into` (a Sapling becomes a Tree).
 * `turns: { into: [{ typeId, weight }], everyMs, chance }`: a chance, not a timer. Once every
 * `everyMs` the Token rolls; with `chance` percent it becomes a weighted pick from `into`, which
 * carries `turnedFrom`. The turned Token rolls on the same cycle and chance, read from the
 * `turnedFrom` type, to turn back, so it is authored once, on the Coast. Defaults for absent fields
 * are `TURN_DEFAULTS` in `tokenConstants.js`.
 *
 * Spawner intervals are one more row of the {@link HANDLERS} table; the attempt itself lives in
 * `SpawnerSystem.js`. The trickle keeps one clock per line, so {@link tick} runs it beside the
 * table (`SpawnerSystem.advanceTrickle`).
 *
 * State (saved, on the instance): `instance.clocks = { growMs, turnMs, … }`, elapsed ms, created
 * only on a Token that has a timed block, absent reads as 0. `turnWon: 1` marks a `turns` roll that
 * succeeded but is still waiting to happen. A change is a transform
 * (`EffectActions.transformInstance`): the new instance keeps `origin` and starts with fresh
 * clocks.
 *
 * ⚠️ Every clock advances by the tick's `delta`. Offline time is replayed by the time bank speeding
 * up the live engine (`TimeManager.setTimeScale`), so a clock that counted anything else would not
 * fast-forward. This module never reads the wall clock.
 *
 * One big tick equals many small ones: a change that falls due part-way through a tick hands the
 * rest of that tick to the Token it became, and that one may change in turn (bounded by {@link
 * MAX_CHANGES_PER_TICK}). So ten minutes in one tick end in the same state as ten minutes in 100 ms
 * ticks.
 *
 * A roll is one lap of the clock. A roll that fails acts without replacing the Token, like a
 * spawner's attempt: the clock starts its next lap, keeping any time past due. So a ten-minute tick
 * rolls ten times, once per whole minute in it, and consumes `random` in the same order as ten
 * one-minute ticks would. A chance of 100 rolls nothing (it always succeeds), so it never moves the
 * random stream.
 *
 * A change with nowhere to stand does not happen (`transformInstance` returns null). The clock is
 * then held full and the change is retried on the next tick: once per tick, never looped within
 * one. A `turns` roll that succeeded but could not stand is remembered (`clocks.turnWon`), so the
 * retry does not roll again: a won roll is never lost to a blocked spot.
 *
 * A cycle in progress is lost: the work-cycle progress (`cycleElapsedMs`) belongs to the old
 * instance, which leaves the mat, and nothing completes it. The hero's claim was on that instance,
 * so `Flags` releases it on its next pass and the hero moves to the next thing in range, or idles.
 * `BoardRunner` ticks this module before `Flags`, so that happens in the same tick.
 */

/** Most changes one Token may go through in one tick — a guard, not a design number. */
export const MAX_CHANGES_PER_TICK = 64;

/**
 * Instance ids of Tokens the player is dragging right now. Runtime only, never saved: a drag does
 * not outlive the page.
 *
 * Why a change waits while a Token is in the hand: a change is a transform, so the Token is
 * replaced by a new instance with a new id. The drag is keyed by the old id, so a Sapling that grew
 * while carried would vanish from under the cursor and the drop would find no Token.
 *
 * So a change that falls due while its Token is in the hand is held, exactly as a change with
 * nowhere to stand is: its clock stays full and it fires on the first tick after the Token is put
 * down, where it was put down. The clock keeps counting, so a moved Sapling is not set back. Only
 * the handlers that replace the Token wait ({@link HANDLERS} `replaces`); a spawner in the hand
 * still spawns.
 */
const inHand = new Set();

/** Mark Token `id` as in the player's hand (`true`) or put down (`false`). */
export function setInHand(id, held) {
    if (id == null) return;
    if (held) inHand.add(id);
    else inHand.delete(id);
}

/** Whether Token `id` is in the player's hand. */
export function isInHand(id) {
    return inHand.has(id);
}

/**
 * The roll cycle and chance a Token turns by: its own `turns` block, or, on a turned Token, the
 * ORIGINAL type's, so both directions share one authored pair. `{ everyMs, chance }` with the
 * defaults filled in.
 */
export function turnTimingOf(instance) {
    const source = instance?.turnedFrom ? getTokenType(instance.turnedFrom) : getTokenType(instance?.typeId);
    return turnTiming(source?.turns);
}

/**
 * Roll a turn. Returns true when it succeeds. A chance of 100 always succeeds and 0 never does, and
 * neither consumes `random`. A roll that won but could not happen (nowhere to stand) is remembered
 * in `clocks.turnWon` and not rolled again on the retry.
 */
function rollTurn(instance, random) {
    const clocks = instance.clocks || (instance.clocks = {});
    if (clocks.turnWon) return true;
    const { chance } = turnTimingOf(instance);
    let won;
    if (chance >= 100) won = true;
    else if (chance <= 0) won = false;
    else won = random() * 100 < chance;
    if (won) clocks.turnWon = 1;
    return won;
}

/**
 * When a turning Token next rolls, for the mat's countdown badge and the inspection lines: `{ inMs,
 * chance, back, into }`. `back` is true on a turned Token (it rolls to turn back into
 * `turnedFrom`), `into` the type ids it may become. Null for a Token that does not turn.
 *
 * `inMs` is 0 while a roll is held (in the hand, or won with nowhere to stand).
 */
export function nextTurnRoll(instance) {
    if (!instance) return null;
    const clockMs = Number(instance.clocks?.turnMs) || 0;
    if (instance.turnedFrom) {
        const original = getTokenType(instance.turnedFrom);
        if (!original) return null;
        const { everyMs, chance } = turnTiming(original.turns);
        return { inMs: Math.max(0, everyMs - clockMs), chance, back: true, into: [instance.turnedFrom] };
    }
    const def = getTokenType(instance.typeId);
    const entries = Array.isArray(def?.turns?.into) ? def.turns.into.filter(e => e?.typeId) : [];
    if (!entries.length) return null;
    const { everyMs, chance } = turnTiming(def.turns);
    return { inMs: Math.max(0, everyMs - clockMs), chance, back: false, into: entries.map(e => e.typeId) };
}

/**
 * ⭐ The handler table. Each entry is one kind of clock:
 *
 * * `clock` — the key in `instance.clocks` it counts on;
 * * `replaces` — true when firing puts a new instance in the Token's place, so
 *   it waits while the Token is in the player's hand ({@link setInHand});
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
        replaces: true,
        applies: (instance) => !!instance.turnedFrom && !!getTokenType(instance.turnedFrom),
        dueMs: (instance) => turnTimingOf(instance).everyMs,
        // A failed roll returns the Token itself: the clock starts its next lap.
        fire: (instance, def, random) => (rollTurn(instance, random)
            ? EffectActions.transformInstance(instance, instance.turnedFrom, { fixPlaced: true })
            : instance)
    },
    {
        id: 'grows',
        clock: 'growMs',
        replaces: true,
        applies: (instance, def) => !instance.turnedFrom && !!def?.grows?.into && Number(def.grows.afterMs) >= 0,
        dueMs: (instance, def) => Number(def.grows.afterMs) || 0,
        fire: (instance, def) => EffectActions.transformInstance(instance, def.grows.into, { fixPlaced: true })
    },
    {
        id: 'turns',
        clock: 'turnMs',
        replaces: true,
        applies: (instance, def) => !instance.turnedFrom && Array.isArray(def?.turns?.into) && def.turns.into.length > 0,
        dueMs: (instance, def) => turnTiming(def.turns).everyMs,
        fire: (instance, def, random) => {
            // Roll the chance first; a failed roll is one lap, no change.
            if (!rollTurn(instance, random)) return instance;
            const into = pickWeighted(def.turns.into, random);
            if (!into || into === instance.typeId) return null;
            return EffectActions.transformInstance(instance, into, {
                fixPlaced: true,
                extra: { turnedFrom: instance.typeId }
            });
        }
    },
    {
        // A spawner's interval. Acts without replacing the Token: a spawn returns the spawner
        // itself; a blocked attempt returns null.
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

        // In the player's hand: a change that would replace it waits, clock held full, until it is
        // put down.
        if (due.h.replaces && inHand.has(current.id)) {
            clocks[due.h.clock] = due.at;
            return;
        }

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
        // The trickle first: it only grants items, and a Token that changes below starts its new
        // self with fresh clocks.
        SpawnerSystem.advanceTrickle(instance, delta);
        advance(instance, delta, random);
    }
    // Spawners' on-mat alerts, once this tick's attempts are done.
    SpawnerSystem.syncAlerts();
}
