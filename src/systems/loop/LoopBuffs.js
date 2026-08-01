// Fantasy Guild — In-Loop Buff Effects (Area Deck Rework, C-4)

import { getAreaAggregator } from './AreaModifiers.js';
import { EFFECT_REACH } from '../../config/cards/effectRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * LoopBuffs — the lifecycle of buff effects a card applies to OTHER cards in
 * the loop (D-10).
 *
 * Two archetypes, distinguished by the effect's `reach`:
 *
 *   **Aura** (`reach: 'loop'`) — switches on when the hero reaches the card
 *   and stays active until the loop wraps. Placed in slot 1 it covers the
 *   whole deck; placed in slot 4 it does nothing, which is the placement
 *   decision D-10 exists to create.
 *
 *   **Next-Card** (`reach: 'next_card'`) — buffs only the card immediately
 *   after it. Pure sequencing play.
 *
 * Neither buffs the card carrying it: an aura covers the *remainder* of the
 * loop, so it registers only after the current card's stats are already
 * computed. A card that wants to buff itself should just have better numbers.
 *
 * ## Why runtime-only
 * Same reasoning as `SlotTokens`, `SlotFailures` and `AreaModifiers`: derived
 * state with a hard reset boundary (the loop wrap). Persisting it would freeze
 * a half-finished loop's buffs into the save for no benefit.
 *
 * ## The failure mode to watch
 * A buff that fails to clear silently compounds every loop — the area just
 * gets quietly faster forever. Every registration here is paired with a
 * removal, and `clearLoopBuffs` is the backstop at the wrap.
 */

/** Pending next-card buffs, per area: `{ effect, sourceId }` awaiting the next slot. */
const pendingNextCard = new Map();

/** Source ids currently registered per area, so every one can be removed. */
const activeSources = new Map();

/** A stable, unique source id for one card's buff in one slot. */
function sourceIdFor(templateId, slotIndex, reach) {
    return `buff:${reach}:${templateId}:${slotIndex}`;
}

function trackSource(areaId, sourceId) {
    if (!activeSources.has(areaId)) activeSources.set(areaId, new Set());
    activeSources.get(areaId).add(sourceId);
}

/**
 * Register a buff's modifiers on the area aggregator.
 * Each authored modifier is a UMI minus its `source`, which is supplied here.
 */
function register(areaId, effect, sourceId) {
    const agg = getAreaAggregator(areaId);
    agg.removeModifiersBySource(sourceId);          // idempotent re-register
    for (const modifier of effect.modifiers || []) {
        agg.addModifier({ ...modifier, source: sourceId });
    }
    trackSource(areaId, sourceId);
}

/** Remove one source's modifiers from an area. */
function unregister(areaId, sourceId) {
    getAreaAggregator(areaId).removeModifiersBySource(sourceId);
    activeSources.get(areaId)?.delete(sourceId);
}

/**
 * Apply the buff effects a card carries, at the moment the hero reaches it.
 *
 * Call this AFTER the card's own stats are computed — neither archetype
 * buffs its own card.
 *
 * @param {string} areaId
 * @param {string} templateId
 * @param {number} slotIndex
 * @param {object[]} buffEffects Buff effects from the card (may be empty).
 */
export function applyCardBuffs(areaId, templateId, slotIndex, buffEffects) {
    for (const effect of buffEffects || []) {
        if (effect.reach === EFFECT_REACH.LOOP) {
            const sourceId = sourceIdFor(templateId, slotIndex, 'aura');
            register(areaId, effect, sourceId);
            logger.debug('LoopBuffs', `Aura from "${templateId}" active on ${areaId} until the loop wraps`);
        } else if (effect.reach === EFFECT_REACH.NEXT_CARD) {
            // Armed now, registered when the NEXT slot activates — registering
            // it here would buff the current card too.
            pendingNextCard.set(areaId, {
                effect,
                sourceId: sourceIdFor(templateId, slotIndex, 'next')
            });
            logger.debug('LoopBuffs', `Next-card buff from "${templateId}" armed on ${areaId}`);
        }
        // EFFECT_REACH.SELF is rejected at authoring time (validateCardEffects).
    }
}

/** The next-card buff currently applied to the active card, per area. */
const appliedNextCard = new Map();

/**
 * Register any armed next-card buff, just before the incoming card's stats are
 * computed. The source id is tracked here rather than handed back, so the
 * caller doesn't have to carry it across methods — and so it can never be
 * accidentally persisted onto `areaState`.
 *
 * @returns {boolean} whether a buff was applied.
 */
export function consumePendingNextCardBuff(areaId) {
    const pending = pendingNextCard.get(areaId);
    if (!pending) return false;

    pendingNextCard.delete(areaId);
    register(areaId, pending.effect, pending.sourceId);
    appliedNextCard.set(areaId, pending.sourceId);
    return true;
}

/** Retire the next-card buff once the card it was buffing has finished. */
export function releaseNextCardBuff(areaId) {
    const sourceId = appliedNextCard.get(areaId);
    if (!sourceId) return;
    appliedNextCard.delete(areaId);
    unregister(areaId, sourceId);
}

/**
 * Drop every in-loop buff for an area — the loop wrapped, or was reset.
 *
 * This is the single reset point that lets buffs stay out of GameState, and
 * the backstop against a modifier compounding forever.
 */
export function clearLoopBuffs(areaId) {
    pendingNextCard.delete(areaId);
    appliedNextCard.delete(areaId);
    const sources = activeSources.get(areaId);
    if (sources) {
        const agg = getAreaAggregator(areaId);
        for (const sourceId of sources) agg.removeModifiersBySource(sourceId);
        sources.clear();
    }
}

/** Drop in-loop buffs for every area (used on a full teardown). */
export function clearAllLoopBuffs() {
    for (const areaId of new Set([...pendingNextCard.keys(), ...activeSources.keys()])) {
        clearLoopBuffs(areaId);
    }
}

/** Test/debug view: the source ids currently registered for an area. */
export function getActiveBuffSources(areaId) {
    return [...(activeSources.get(areaId) || [])];
}

/** Test/debug view: whether a next-card buff is armed for an area. */
export function hasPendingNextCardBuff(areaId) {
    return pendingNextCard.has(areaId);
}
