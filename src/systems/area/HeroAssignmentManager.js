import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { ensureAreaState } from './AreaStateManager.js';
import { clearAll as clearAllStatuses } from '../effects/StatusEffectSystem.js';
import { QuestTracker } from '../progression/QuestTracker.js';
import { logger } from '../../utils/Logger.js';

/**
 * HeroAssignmentManager (Deck Loop rework, Phase 2 §2D)
 *
 * Owns the hero ↔ area binding for the Area Deck Loop system: heroes are
 * assigned to an Area (one hero per area), not to individual cards.
 *
 * Loop Reset Rule (locked design decision): any change to an area's deck
 * contents, assigned hero, or hero equipment triggers a full loop reset for
 * that area. This keeps loop execution deterministic.
 */

/**
 * Find the areaId a hero is currently assigned to, or null.
 */
export function getAreaForHero(heroId) {
    if (!heroId) return null;
    const areaStates = GameState.areaStates;
    for (const [areaId, areaState] of Object.entries(areaStates)) {
        if (areaState.assignedHeroId === heroId) return areaId;
    }
    return null;
}

/**
 * Reset an area's loop to its deterministic starting point:
 * first slot, zero timer, all slot runtime progress cleared.
 */
export function resetAreaLoop(areaId) {
    const areaState = GameState.areaStates[areaId];
    if (!areaState || !Array.isArray(areaState.deckSlots)) return;

    areaState.activeCardIndex = 0;
    areaState.executionTimer = 0;
    areaState.deckSlots.forEach(slot => {
        slot.progress = 0;
        slot.status = 'idle';
    });
    areaState._dirtyStats = true;

    EventBus.publish(AREA_EVENTS.STATS_DIRTY, { areaId });
    logger.debug('HeroAssignment', `Loop reset for "${areaId}"`);
}

/**
 * Assign a hero to an area. Auto-swaps: if the hero is already assigned
 * elsewhere they are unassigned from the old area first; if the target area
 * already has a different hero, that hero becomes unassigned.
 *
 * @returns {{ success: boolean, error?: string }}
 */
export function assignHeroToArea(heroId, areaId) {
    const hero = GameState.heroes.find(h => h.id === heroId);
    if (!hero) {
        return { success: false, error: `Unknown hero "${heroId}"` };
    }
    if (!getAreaSet(areaId)) {
        return { success: false, error: `Unknown area "${areaId}"` };
    }

    const targetState = ensureAreaState(areaId);

    // Already assigned here — nothing to do (avoid a pointless loop reset).
    if (targetState.assignedHeroId === heroId) {
        return { success: true };
    }

    // Auto-swap 1: pull the hero out of their previous area, if any.
    const previousAreaId = getAreaForHero(heroId);
    if (previousAreaId) {
        unassignHero(previousAreaId);
    }

    // Auto-swap 2: displace the hero currently occupying the target area.
    if (targetState.assignedHeroId) {
        const displacedId = targetState.assignedHeroId;
        targetState.assignedHeroId = null;
        logger.info('HeroAssignment', `Hero "${displacedId}" displaced from "${areaId}"`);
    }

    targetState.assignedHeroId = heroId;
    targetState.status = 'paused'; // The loop starts paused; LoopRunner (Phase 3) owns the running state.
    resetAreaLoop(areaId);

    EventBus.publish(AREA_EVENTS.HERO_CHANGED, { areaId, heroId });
    // Action-quest hook (quest_system_concept.md §5): tutorial MSQs like
    // "Deploy a Hero" track this.
    QuestTracker.processEvent('ON_HERO_ASSIGNED', { areaId, heroId });
    logger.info('HeroAssignment', `Hero "${heroId}" assigned to "${areaId}"`);
    return { success: true };
}

/**
 * Clear the hero assignment for an area and pause its loop.
 */
export function unassignHero(areaId) {
    const areaState = GameState.areaStates[areaId];
    if (!areaState || !areaState.assignedHeroId) return { success: false, error: 'No hero assigned' };

    const heroId = areaState.assignedHeroId;
    areaState.assignedHeroId = null;
    areaState.status = 'paused';
    resetAreaLoop(areaId);

    // Exiting the run clears all temporary statuses, buffs and debuffs alike
    // (status_effects_concept.md §3B).
    clearAllStatuses(heroId);

    EventBus.publish(AREA_EVENTS.HERO_CHANGED, { areaId, heroId: null });
    logger.info('HeroAssignment', `Hero "${heroId}" unassigned from "${areaId}"`);
    return { success: true };
}

/**
 * Wire up the Loop Reset Rule's equipment leg: when an assigned hero's
 * equipment changes, their area's loop resets. Called from EngineBootstrap.
 */
export function init() {
    EventBus.subscribe('hero_equipment_changed', ({ heroId }) => {
        const areaId = getAreaForHero(heroId);
        if (!areaId) return;
        resetAreaLoop(areaId);
        EventBus.publish(AREA_EVENTS.HERO_CHANGED, { areaId, heroId });
    });
    logger.info('HeroAssignment', 'Subscriptions ready (equipment-change loop reset).');
}
