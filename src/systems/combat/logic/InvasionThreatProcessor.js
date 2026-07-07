import { GameState } from '../../../state/GameState.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { getThreat } from '../../../config/registries/threatRegistry.js';
import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import * as CardManager from '../../cards/CardManager.js';

/**
 * Invasion Threat Processor: Escalation logic and global debuff aggregation.
 */

export function processTick(deltaMs) {
    const deltaSec = deltaMs / 1000;
    let threatsChanged = false;

    for (const [cardId, state] of Object.entries(GameState.invasions.active)) {
        const template = getInvasion(state.invasionId);
        if (!template) continue;

        const oldThreat = state.threat;
        state.threat = Math.min(100, state.threat + (template.threatRate * deltaSec));

        // Milestone detection
        if (Math.floor(state.threat) > Math.floor(oldThreat)) {
            checkMilestones(cardId, state, template);
            threatsChanged = true;
        }

        // Sync threat to card for UI representation
        const card = CardManager.getCard(cardId);
        if (card) {
            card.threat = state.threat;
        }
    }

    if (threatsChanged) {
        updateGlobalThreats();
    }
}

export function checkMilestones(cardId, state, template) {
    const newMilestones = (template.milestones || []).filter(m =>
        m.threat > state.lastMilestoneThreat && m.threat <= state.threat
    );

    if (newMilestones.length > 0) {
        state.lastMilestoneThreat = state.threat;
        newMilestones.forEach(m => {
            const debuffData = getThreat(m.debuffId);
            logger.warn('InvasionThreat', `Invasion ${cardId} reached ${m.threat}% threat! Debuff: ${debuffData?.name || m.debuffId}`);
            EventBus.publish('threat_milestone_reached', { cardId, threat: m.threat, debuffId: m.debuffId });
        });
    }
}

export function updateGlobalThreats() {
    const aggregated = {};

    for (const state of Object.values(GameState.invasions.active || {})) {
        const template = getInvasion(state.invasionId);
        if (!template) continue;

        const activeMilestones = (template.milestones || []).filter(m => m.threat <= state.threat);
        activeMilestones.forEach(m => {
            aggregated[m.debuffId] = (aggregated[m.debuffId] || 0) + m.stacks;
        });
    }

    GameState.invasions.globalThreats = aggregated;
    EventBus.publish('global_threats_updated', { threats: aggregated });
    EventBus.publish('invasion_escalated'); // Triggers global modifier recalcs
}
