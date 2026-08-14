// Fantasy Guild — Triggered Tokens (CMS rework Phase 6)

import { EventBus } from '../core/EventBus.js';
import { getTokenType, effectBlocksOf } from '../../config/registries/tokenRegistry.js';
import { TRIGGER_EVENTS, TRIGGER_SCOPES, getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { neighboursOf } from './adjacency.js';
import { matchesTokenTarget } from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import { BOARD_EVENTS } from './boardEvents.js';

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

/** Per-instance cooldown state, created on first use. */
function cooldowns(instance) {
    if (!instance.blockCooldowns) instance.blockCooldowns = {};
    return instance.blockCooldowns;
}

/** Blocks on a Token that carry a trigger of the given event id. */
function triggeredBlocks(def, triggerId) {
    return effectBlocksOf(def)
        .map((block, blockIndex) => ({ block, blockIndex }))
        .filter(({ block }) => block?.trigger?.event === triggerId);
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

/** Whether block `i` is off cooldown and may fire. */
function isReady(instance, blockIndex) {
    return !(instance.blockCooldowns?.[blockIndex] > 0);
}

/**
 * Run one triggered block's actions.
 *
 * Returns true if the block actually fired, which is what spends the charge —
 * see CMS-26 above. A block that was on cooldown, or whose condition was not
 * met, has not served and costs nothing.
 */
function fireBlock(tile, instance, block, blockIndex) {
    if (!isReady(instance, blockIndex)) return false;

    // Set the cooldown BEFORE running actions. An action that publishes an
    // event this same Token listens for would otherwise re-enter and fire
    // again — a Sigil converting Stone while watching for Stone is exactly the
    // shape that loops forever.
    cooldowns(instance)[blockIndex] = block.cooldownMs || 0;

    for (const modifier of block.modifiers || []) {
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
        if (instance.usesRemaining <= 0) {
            BoardState.setToken(tile, null);
            BoardState.setVacancy(tile, instance.typeId);
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile, typeId: instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: null });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile });
        }
    }

    return true;
}

/** Does this adjacency-scoped trigger care about the Token that fired it? */
function sourceMatches(trigger, sourceTypeId) {
    if (!trigger.source?.mode) return true;             // any neighbour
    return matchesTokenTarget(trigger.source, getTokenType(sourceTypeId));
}

/** Handle an adjacency-scoped board event. */
function handleAdjacent(triggerId, payload) {
    const originTile = payload?.tile;
    if (originTile == null) return;

    for (const neighbour of neighboursOf(originTile)) {
        const instance = BoardState.getToken(neighbour);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        for (const { block, blockIndex } of triggeredBlocks(def, triggerId)) {
            if ((block.trigger.scope || TRIGGER_SCOPES.ADJACENT) !== TRIGGER_SCOPES.ADJACENT) continue;
            if (!sourceMatches(block.trigger, payload.typeId)) continue;
            fireBlock(neighbour, instance, block, blockIndex);
        }
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
        for (const { block, blockIndex } of triggeredBlocks(def, 'ITEM_THRESHOLD')) {
            const { watchItemId, threshold } = block.trigger;
            if (!watchItemId) continue;
            if (InventoryManager.getItemCount(watchItemId) < (threshold || 1)) continue;
            fireBlock(tile, instance, block, blockIndex);
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

    for (const definition of TRIGGER_EVENTS) {
        const { id, event, scopes } = definition;

        if (scopes.includes(TRIGGER_SCOPES.GLOBAL)) {
            unsubscribers.push(EventBus.subscribe(event, () => handleGlobalItemThreshold()));
            continue;
        }

        unsubscribers.push(EventBus.subscribe(event, (payload) => {
            // CMS-34: a failed cycle produced nothing, so nothing reacts to it.
            if (payload?.failed) return;
            // COMBAT_RESOLVED fires on defeat too; only a win is an event worth
            // cascading from — a lost fight is the same "nothing happened".
            if (id === 'COMBAT_RESOLVED' && payload?.outcome !== 'victory') return;
            handleAdjacent(id, payload);
        }));
    }
}

/** Drop every subscription. */
export function teardown() {
    for (const unsub of unsubscribers) {
        if (typeof unsub === 'function') unsub();
    }
    unsubscribers = [];
}

/** Whether a Token is purely triggered — no staffed production at all (CMS-80). */
export function isPurelyTriggered(def) {
    if (!def) return false;
    const hasTrigger = effectBlocksOf(def).some(b => b?.trigger?.event);
    return hasTrigger && !def.config && !def.recipes?.length && !def.recipePool;
}

/** Every trigger event id a Token listens for. Used by content validation. */
export function triggersOf(def) {
    return effectBlocksOf(def)
        .map(b => b?.trigger?.event)
        .filter(Boolean);
}

/** @see getTriggerEvent — re-exported so callers need one import. */
export { getTriggerEvent };
