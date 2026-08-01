// Fantasy Guild — Binder Mastery (Area Deck Rework, C-19)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getAreaAggregator } from '../loop/AreaModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { BinderManager } from './BinderManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * BinderMastery — a permanent per-area bonus for completing that area's binder
 * (D-66).
 *
 * ## Why this exists
 * Under D-13 a maxed card leaves the pool, so an area's packs eventually stop
 * selling. Without a reward, "binder complete" is purely the absence of
 * something to buy. This gives finishing a mechanical payoff, and gives a
 * completed area a second reason to keep running alongside raw resource demand
 * (D-30).
 *
 * ## Not a revival of MasterySystem
 * The old system read `areaState.collectionProgress`, `setDef.deckList` and
 * quest mastery — all structures this rework replaced — and delivered bonuses
 * through a bespoke `getEffectiveBonuses` shape that nothing else used. This is
 * a rewrite against per-area binders (C-2) that delivers through the **area's
 * ModifierAggregator**, the same path in-deck Boost auras already ride. Quest
 * mastery is deliberately NOT revived.
 *
 * ## Rewarding FINISHING, not REPETITION
 * D-5 and D-12 cut bonuses for stacking identical cards and for card levelling.
 * This is not a reversal of that: it rewards completing a *collection*, which
 * is a one-time act, not a grind multiplier.
 *
 * ## The unlock is persisted; the modifier is not
 * `areaState.binderMasteryUnlocked` is a save-backed latch, so the bonus fires
 * exactly once and survives a reload. The aggregator it feeds is runtime-only
 * (like every other aura), so `rehydrate()` replays the latch on load. Without
 * that the bonus would silently vanish on every load — the same failure C-11
 * hit with station buffs.
 */

/** Default bonus when an area doesn't author its own. Tuning is authored (D-71). */
export const DEFAULT_MASTERY_BONUS = { type: EFFECT_TYPES.SPEED, value: 0.1, bucket: 'percentage' };

/** The modifier source id for an area's mastery bonus. */
const sourceFor = (areaId) => `binder_mastery:${areaId}`;

/**
 * The bonus an area grants on completion.
 *
 * Authored as `masteryBonus` on the area (one modifier or a list, the same
 * shape Outpost auras use). Tuning is the designer's — but keep watch item
 * **W-9** in mind: this must not make a completed low-tier area better than
 * moving up a tier.
 */
export function getMasteryBonus(areaId) {
    const authored = getAreaSet(areaId)?.masteryBonus;
    if (!authored) return [DEFAULT_MASTERY_BONUS];
    return Array.isArray(authored) ? authored : [authored];
}

/** Has this area's binder mastery been earned? */
export function isUnlocked(areaId) {
    return GameState.areaStates?.[areaId]?.binderMasteryUnlocked === true;
}

/** Put an unlocked area's bonus onto its aggregator. Idempotent. */
function register(areaId) {
    const agg = getAreaAggregator(areaId);
    const source = sourceFor(areaId);
    agg.removeModifiersBySource(source);
    for (const modifier of getMasteryBonus(areaId)) {
        agg.addModifier({ ...modifier, source });
    }
}

/**
 * Check one area and grant mastery if its binder is now complete.
 *
 * Safe to call on every collection change — the latch makes re-entry a no-op,
 * which is what stops the notification firing on every subsequent pack.
 *
 * @returns {boolean} true only on the transition into mastery.
 */
export function evaluate(areaId) {
    const areaState = GameState.areaStates?.[areaId];
    if (!areaState) return false;
    if (areaState.binderMasteryUnlocked) return false;

    const { total, complete } = BinderManager.getCompletion(areaId);
    // An area with nothing authored yet reports "complete" vacuously; requiring
    // a non-empty pool stops empty regions handing out a free permanent bonus.
    if (total === 0 || !complete) return false;

    areaState.binderMasteryUnlocked = true;
    register(areaId);
    areaState._dirtyStats = true;

    const name = getAreaSet(areaId)?.name || areaId;
    NotificationSystem.success(`${name} binder complete — Area Mastery unlocked!`);
    // Deliberately NOT `collection_updated`: this runs from that event's own
    // handler, and re-publishing it would re-enter evaluateAll. The latch would
    // stop it running away, but the UI subscribes to the dedicated event below.
    EventBus.publish('binder_mastery_unlocked', { areaId });
    EventBus.publish('state_changed', {});
    logger.info('BinderMastery', `Binder mastery unlocked for ${areaId}`);
    return true;
}

/** Check every unlocked area — the hook for "a card was just claimed". */
export function evaluateAll() {
    for (const areaId of GameState.collection?.unlockedAreaSets || []) evaluate(areaId);
}

/**
 * Replay every earned mastery onto the aggregators after a load.
 *
 * The latch is saved but the modifier is not, so without this the bonus is
 * silently absent for the whole session.
 */
export function rehydrate() {
    let restored = 0;
    for (const [areaId, areaState] of Object.entries(GameState.areaStates || {})) {
        if (!areaState?.binderMasteryUnlocked) continue;
        register(areaId);
        areaState._dirtyStats = true;
        restored++;
    }
    if (restored) logger.info('BinderMastery', `Restored ${restored} binder mastery bonus(es)`);
}

export function init() {
    EventBus.subscribe('collection_updated', () => evaluateAll());
    EventBus.subscribe('game_loaded', () => rehydrate());
    logger.info('BinderMastery', 'Binder mastery ready');
}

export const BinderMastery = {
    DEFAULT_MASTERY_BONUS, getMasteryBonus, isUnlocked, evaluate, evaluateAll, rehydrate, init
};

export default BinderMastery;
