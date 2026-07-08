// Fantasy Guild - Adventure/Stationed Mode Toggle (Deck Loop rework, Phase 4 §4H)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as HeroManager from '../hero/HeroManager.js';
import { LoopRunner } from './LoopRunner.js';
import { logger } from '../../utils/Logger.js';

/**
 * ModeManager — the player-driven switch between an area's two modes:
 *
 *   adventure → stationed: the hero retreats from the wilds to the outpost.
 *     The adventure loop pauses (position kept, in-flight card discarded —
 *     the current slot re-draws on return). Requires a slotted station card.
 *     Refused mid-combat: retreating from a fight you're losing is exactly
 *     what the Forced Retreat penalty (§3F) exists to price.
 *
 *   stationed → adventure: the hero heads back into the wilds. Crafting
 *     freezes with its progress preserved (StationManager simply stops
 *     ticking the area); the loop auto-resumes from its kept position.
 *     Refused while the hero is injured (§3F/§4H) — heal first.
 *
 * The Forced Retreat defeat path (§3F) switches to Stationed Mode directly
 * in LoopRunner and does not come through here.
 */

/**
 * @returns {{ success: boolean, mode?: string, error?: string }}
 */
export function toggleMode(areaId) {
    const areaState = GameState.areaStates?.[areaId];
    if (!areaState) {
        return { success: false, error: `Unknown area "${areaId}"` };
    }

    const heroId = areaState.assignedHeroId;
    if (!heroId) {
        // Both modes require a hero (§4H) — the toggle has no effect.
        return { success: false, error: 'No hero assigned to this area' };
    }

    if (areaState.mode === 'adventure') {
        return _toStationed(areaId, areaState);
    }
    return _toAdventure(areaId, areaState, heroId);
}

function _toStationed(areaId, areaState) {
    if (!areaState.stationState?.activeStationCardId) {
        NotificationSystem.warning('No station is built at this outpost yet.');
        return { success: false, error: 'No station card slotted' };
    }
    if (areaState.status === 'in_combat') {
        NotificationSystem.warning('Cannot retreat to the outpost mid-fight!');
        return { success: false, error: 'Area is in combat' };
    }

    // Pause the adventure loop, keeping the cursor. The in-flight ephemeral
    // card is discarded; the same slot re-draws when the hero returns.
    LoopRunner._discardActiveCard(areaId);
    const currentSlot = areaState.deckSlots?.[areaState.activeCardIndex];
    if (currentSlot) {
        currentSlot.status = 'idle';
        currentSlot.progress = 0;
    }
    areaState.mode = 'stationed';
    areaState.status = 'paused';
    areaState.pausedReason = null;
    areaState.executionTimer = 0;

    EventBus.publish(AREA_EVENTS.MODE_SWITCHED, { areaId, mode: 'stationed' });
    logger.info('ModeManager', `${areaId} → Stationed Mode`);
    return { success: true, mode: 'stationed' };
}

function _toAdventure(areaId, areaState, heroId) {
    const hero = HeroManager.getHero(heroId);
    if (areaState.status === 'injured' || hero?.status === 'wounded') {
        NotificationSystem.warning(`${hero?.name || 'The hero'} is injured and must recover at the outpost first.`);
        return { success: false, error: 'Hero is injured' };
    }

    // Crafting progress is preserved as-is — StationManager just stops
    // ticking this area while mode is 'adventure'.
    areaState.mode = 'adventure';
    areaState.status = 'paused';
    areaState.pausedReason = null; // LoopRunner auto-starts from the kept position

    EventBus.publish(AREA_EVENTS.MODE_SWITCHED, { areaId, mode: 'adventure' });
    logger.info('ModeManager', `${areaId} → Adventure Mode`);
    return { success: true, mode: 'adventure' };
}
