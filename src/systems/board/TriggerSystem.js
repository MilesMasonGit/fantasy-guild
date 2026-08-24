// Fantasy Guild — Triggered Tokens (CMS rework Phase 6)

import { EventBus } from '../core/EventBus.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { statementsOf } from '../effects/statements.js';
import { TRIGGER_EVENTS, TRIGGER_SCOPES, getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { neighboursOf } from './adjacency.js';
import { matchesTokenTarget } from './TileModifiers.js';
import { KEYWORD } from '../effects/statements.js';
import * as StatusApplication from './StatusApplication.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { logger } from '../../utils/Logger.js';

/**
 * The fifth Token category: things that **wait and react** (CMS-29).
 *
 * A Producer runs a cycle. A Context Token defines what a neighbour makes. A
 * Buff Token nudges numbers. A Triggered Token does none of those — it listens
 * for something to happen and acts, rate-limited by a cooldown rather than a
 * cycle time, with no hero and no work of its own.
 *
 * ## Two worked examples this was built to
 * * **Masonry Wheelbarrow** — reacts to a *neighbour's* cycle completing (an
 *   Ore Vein being mined) and grants an extra item. Everything before Phase 6
 *   assumed a Token reacts to its *own* cycle.
 * * **Stoneshaper Sigil** — no work cycle and no hero at all. Watches for a
 *   condition (Stone existing in the Bank) and converts on a cooldown.
 *
 * ## The rules that shape this file
 * * **Success only** (CMS-34). A failed cycle does not fire a listener: a chain
 *   reaction should cascade because something actually happened, and reacting
 *   to a stuck neighbour reads as a bug rather than a feature.
 * * **The charge burns on service, not on luck** (D-126/CMS-26). A Triggered
 *   Token that fires spends a charge whether or not its proc rolled a hit, so a
 *   Token serving 100 events wears out in 100 events regardless of luck. One
 *   predictable rule for every support Token.
 * * **Scope is per Token** (CMS-30), not a single global rule — the Sigil wants
 *   adjacency, other Tokens legitimately want the whole economy.
 */

/** Live subscriptions, so `init` is idempotent across reloads and tests. */
let unsubscribers = [];

/**
 * ## ⚠️ The loop guard, and why cooldowns were not enough
 *
 * Every trigger before Phase 2 listened **outward** — at a neighbour, or at the
 * Bank. `SELF_CYCLE_COMPLETE` lets a Token react to its own completion, which
 * is the shape that can eat itself: a Token whose reaction causes a cycle to
 * complete would fire again, and again.
 *
 * **Is the cooldown sufficient?** No, and the reason is worth writing down
 * rather than discovering later. A cooldown is a *rate* limit. It is set from
 * `statement.when.cooldownMs`, which an author may leave at **zero** — the
 * editor's own default for a fresh trigger is 5000ms but nothing forces it, and
 * a zero-cooldown self-trigger has no rate limit at all. Relying on it would
 * mean a runaway loop in the tick path is one empty number box away.
 *
 * As it happens nothing a statement can *do* today publishes `CYCLE_COMPLETE`
 * — item grants, conversions and status applications all publish something
 * else — so the loop is currently unreachable. That is safety by accident, and
 * it lasts exactly until someone adds an action that completes a cycle.
 *
 * So the guard is structural and does not depend on either fact:
 *
 * 1. **Re-entrancy.** A statement already in flight on a tile cannot be
 *    re-entered. This alone makes a Token-eats-itself loop impossible.
 * 2. **Cascade depth.** A chain of *different* Tokens setting each other off
 *    is bounded, so a long ring cannot spin either. When the cap is reached the
 *    cascade stops and says so once, loudly, rather than freezing the game.
 *
 * Both are cheap: a `Set` add and a counter per fire.
 */
const inFlight = new Set();

/**
 * How deep one board event may cascade.
 *
 * Eight is far past anything a real board does — the longest authored chain is
 * a Vein feeding a Wheelbarrow — and far short of a stack overflow. It is a
 * circuit breaker, not a design limit.
 */
export const MAX_CASCADE_DEPTH = 8;

let cascadeDepth = 0;
let warnedAboutDepth = false;

/** Reset the guard. For tests, and for a board teardown mid-cascade. */
export function resetCascadeGuard() {
    inFlight.clear();
    cascadeDepth = 0;
    warnedAboutDepth = false;
}

/**
 * Per-instance cooldown state, created on first use.
 *
 * ⚠️ Keyed by the statement's **stable id**, not by its position in the array.
 * Positional keys meant reordering a Token's rules in the CMS silently remapped
 * a live save's cooldowns onto the wrong rule. Numeric leftovers from the old
 * shape are dropped rather than remapped — see the note in `BlockUpkeep.js`.
 */
function cooldowns(instance) {
    if (!instance.blockCooldowns) instance.blockCooldowns = {};
    for (const key of Object.keys(instance.blockCooldowns)) {
        if (/^\d+$/.test(key)) delete instance.blockCooldowns[key];
    }
    return instance.blockCooldowns;
}

/** Statements on a Token whose `When` clause names the given event. */
function triggeredStatements(def, triggerId) {
    return statementsOf(def).filter(s => s?.when?.event === triggerId);
}

/**
 * Advance every cooldown on one Token.
 *
 * Called from the board tick. Cooldowns count DOWN in real time rather than
 * being compared against a timestamp, so they behave identically whether the
 * game ran continuously or was resumed.
 */
export function tickCooldowns(instance, delta) {
    const state = instance.blockCooldowns;
    if (!state) return;
    for (const key of Object.keys(state)) {
        if (state[key] > 0) state[key] = Math.max(0, state[key] - delta);
    }
}

/** Whether a statement is off cooldown and may fire. */
function isReady(instance, statementId) {
    return !(instance.blockCooldowns?.[statementId] > 0);
}

/**
 * Run one triggered statement's action.
 *
 * Returns true if the statement actually fired, which is what spends the charge —
 * see CMS-26 above. A statement that was on cooldown, or whose condition was not
 * met, has not served and costs nothing.
 */
function fireStatement(tile, instance, statement) {
    if (!isReady(instance, statement.id)) return false;

    // --- The loop guard (see the note at the top of this file) --------------
    const key = `${tile}:${statement.id}`;
    if (inFlight.has(key)) return false;
    if (cascadeDepth >= MAX_CASCADE_DEPTH) {
        if (!warnedAboutDepth) {
            warnedAboutDepth = true;
            logger.warn('TriggerSystem',
                `A chain of triggered Tokens ran ${MAX_CASCADE_DEPTH} deep and was stopped. ` +
                'Something on the board is setting itself off in a circle.');
        }
        return false;
    }

    // Set the cooldown BEFORE running actions. An action that publishes an
    // event this same Token listens for would otherwise re-enter and fire
    // again — a Sigil converting Stone while watching for Stone is exactly the
    // shape that loops forever. The guard above covers the case where the
    // author left the cooldown at zero.
    cooldowns(instance)[statement.id] = statement.when?.cooldownMs || 0;

    inFlight.add(key);
    cascadeDepth += 1;
    try {
        runStatementActions(tile, instance, statement);
    } finally {
        inFlight.delete(key);
        cascadeDepth -= 1;
    }

    return true;
}

/** What a fired statement actually does. Split out so the guard can wrap it. */
function runStatementActions(tile, instance, statement) {

    /**
     * `Applies` — a status on the people working the neighbours the filter
     * names. Handled before the item-shaped payloads below because it is the
     * one keyword whose payload carries no `type` at all, and because its own
     * targeting question is answered by `StatusApplication` rather than here.
     */
    if (statement.keyword === KEYWORD.APPLIES) {
        StatusApplication.applyToNeighbours(tile, statement);
    }

    for (const modifier of [statement.payload].filter(Boolean)) {
        const chance = modifier.chance ?? 100;
        const hit = chance >= 100 || Math.random() * 100 < chance;
        if (!hit) continue;

        if (modifier.type === EFFECT_TYPES.BONUS_DROP && modifier.itemId) {
            SpriteLayer.addSprite('item', modifier.itemId, Math.max(1, modifier.quantity || 1), tile);
        }

        if (modifier.type === EFFECT_TYPES.CONVERT) {
            const consumes = modifier.consumes || [];
            // All-or-nothing, the same discipline production and upkeep use: a
            // conversion never half-consumes and then fails to produce.
            const affordable = consumes.every(
                c => InventoryManager.getItemCount(c.itemId) >= (c.quantity || 1)
            );
            if (!affordable) continue;

            for (const c of consumes) {
                InventoryManager.removeItem(c.itemId, c.quantity || 1);
            }
            for (const p of modifier.produces || []) {
                // Onto the board, not into the Bank (D-40) — the same place
                // every other yield lands, so it reads as one economy.
                SpriteLayer.addSprite('item', p.itemId, Math.max(1, p.quantity || 1), tile);
            }
        }
    }

    // The charge burns because the Token SERVED, regardless of whether any proc
    // above actually hit (CMS-26).
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            tile,
            delta: -1,
            remaining: instance.usesRemaining,
            typeId: instance.typeId
        });
        if (instance.usesRemaining <= 0) {
            BoardState.setToken(tile, null);
            BoardState.setVacancy(tile, instance.typeId);
            const trigName = getTokenType(instance.typeId)?.name || instance.typeId;
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                tile,
                severity: 'red',
                type: 'token_exhausted',
                name: trigName,
                message: `Token Exhausted: ${trigName}`
            });
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile, typeId: instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: null });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile });
        }
    }
}

/** Does this adjacency-scoped trigger care about the Token that fired it? */
function sourceMatches(when, sourceTypeId) {
    if (!when.source?.mode) return true;                // any neighbour
    return matchesTokenTarget(when.source, getTokenType(sourceTypeId));
}

/**
 * Does this trigger care about *what* the source made?
 *
 * Only `ITEM_PRODUCED` asks. Everything else ignores the list entirely, so the
 * coarse "a neighbour completed a cycle" trigger keeps firing on every
 * completion including one that produced nothing at all.
 *
 * ⚠️ An `ITEM_PRODUCED` with no item named matches **nothing**, not everything.
 * A half-authored trigger that fired on every cycle would be indistinguishable
 * from the coarse trigger sitting right above it in the picker, which is
 * exactly the kind of quiet wrong behaviour the audit exists to catch — and it
 * does, by name.
 */
function producedMatches(definition, when, payload) {
    if (!definition?.needsItem) return true;
    if (!when.watchItemId) return false;
    return (payload?.produced || []).includes(when.watchItemId);
}

/** Handle an adjacency-scoped board event. */
function handleAdjacent(triggerId, payload) {
    const originTile = payload?.tile;
    if (originTile == null) return;

    const definition = getTriggerEvent(triggerId);

    for (const neighbour of neighboursOf(originTile)) {
        const instance = BoardState.getToken(neighbour);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, triggerId)) {
            if ((statement.when.scope || TRIGGER_SCOPES.ADJACENT) !== TRIGGER_SCOPES.ADJACENT) continue;
            if (!sourceMatches(statement.when, payload.typeId)) continue;
            if (!producedMatches(definition, statement.when, payload)) continue;
            fireStatement(neighbour, instance, statement);
        }
    }
}

/**
 * Handle a **self**-scoped board event: the Token that fired it is the Token
 * that reacts.
 *
 * Deliberately its own function rather than a flag inside `handleAdjacent`.
 * The two differ in the thing that matters most — *which tile the statement
 * runs on* — and a self-scoped statement has no "from which neighbour" filter
 * to apply, because there is no neighbour involved in the firing at all. Its
 * `to` filter still works normally: the rule reaches outward from here exactly
 * as any other statement does.
 */
function handleSelf(triggerId, payload) {
    const tile = payload?.tile;
    if (tile == null) return;

    const instance = BoardState.getToken(tile);
    if (!instance) return;

    const def = getTokenType(instance.typeId);
    for (const statement of triggeredStatements(def, triggerId)) {
        if (statement.when.scope !== TRIGGER_SCOPES.SELF) continue;
        fireStatement(tile, instance, statement);
    }
}

/**
 * Handle a global-scoped condition (CMS-35).
 *
 * Evaluated against the Bank each time the coarse `inventory_updated` fires.
 * Every Triggered Token on the board is considered, wherever it sits.
 */
function handleGlobalItemThreshold() {
    for (const [tile, instance] of BoardState.occupiedTiles()) {
        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, 'ITEM_THRESHOLD')) {
            const { watchItemId, threshold } = statement.when;
            if (!watchItemId) continue;
            if (InventoryManager.getItemCount(watchItemId) < (threshold || 1)) continue;
            fireStatement(tile, instance, statement);
        }
    }
}

/**
 * Subscribe every trigger type. Idempotent — calling it twice replaces the
 * previous subscriptions rather than doubling them, which matters in tests and
 * after a save load.
 */
export function init() {
    teardown();

    resetCascadeGuard();

    for (const definition of TRIGGER_EVENTS) {
        const { id, event, scopes } = definition;

        if (scopes.includes(TRIGGER_SCOPES.GLOBAL)) {
            unsubscribers.push(EventBus.subscribe(event, () => handleGlobalItemThreshold()));
            continue;
        }

        const isSelf = scopes.includes(TRIGGER_SCOPES.SELF);

        unsubscribers.push(EventBus.subscribe(event, (payload) => {
            // CMS-34: a failed cycle produced nothing, so nothing reacts to it.
            if (payload?.failed) return;
            // COMBAT_RESOLVED fires on defeat too; only a win is an event worth
            // cascading from — a lost fight is the same "nothing happened".
            if (id === 'COMBAT_RESOLVED' && payload?.outcome !== 'victory') return;
            if (isSelf) handleSelf(id, payload);
            else handleAdjacent(id, payload);
        }));
    }
}

/** Drop every subscription. */
export function teardown() {
    for (const unsub of unsubscribers) {
        if (typeof unsub === 'function') unsub();
    }
    unsubscribers = [];
    resetCascadeGuard();
}

/** Whether a Token is purely triggered — no staffed production at all (CMS-80). */
export function isPurelyTriggered(def) {
    if (!def) return false;
    const hasTrigger = statementsOf(def).some(s => s?.when?.event);
    return hasTrigger && !def.config && !def.recipes?.length && !def.recipePool;
}

/** Every trigger event id a Token listens for. Used by content validation. */
export function triggersOf(def) {
    return statementsOf(def)
        .map(s => s?.when?.event)
        .filter(Boolean);
}

/** @see getTriggerEvent — re-exported so callers need one import. */
export { getTriggerEvent };
