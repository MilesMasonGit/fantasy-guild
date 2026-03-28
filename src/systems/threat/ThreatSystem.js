import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getInvasion } from '../../config/registries/invasionRegistry.js';
import { THREATS } from '../../config/registries/threatRegistry.js';
import { ensureAreaState } from '../area/AreaStateManager.js';

/**
 * ThreatSystem.js
 * 
 * Manages Regional Chaos and Invasion Threat.
 * Chaos builds while an area is active and no invasion is present.
 * Threat builds while an invasion is active in the area.
 */

const CHAOS_MAX = 1000;
const CHAOS_STAGES = [250, 500, 750, 1000];
const CHAOS_PER_MS = 250 / (3600 * 1000); // 250 pts per game hour (1 milestone/hour)

export class ThreatSystemClass {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('ThreatSystem', 'Threat System initialized');
    }

    /**
     * Main tick called from GameLoop for the active area
     * @param {number} deltaTime - Time since last tick in ms
     */
    tick(deltaTime) {
        const activeAreaId = GameState.state.ui.activeAreaId;
        const areaState = ensureAreaState(activeAreaId);

        if (areaState.activeInvasionId) {
            this.processInvasionThreat(activeAreaId, areaState, deltaTime);
        } else {
            this.processRegionalChaos(activeAreaId, areaState, deltaTime);
        }
    }

    /**
     * Accumulate Chaos points and trigger milestones
     */
    processRegionalChaos(areaId, areaState, deltaTime) {
        // Increment points
        const amount = CHAOS_PER_MS * deltaTime;
        areaState.chaosPoints = Math.min(CHAOS_MAX, (areaState.chaosPoints || 0) + amount);
        EventBus.publish('chaos_updated', { areaId, points: areaState.chaosPoints });

        // Check stages [250=1, 500=2, 750=3, 1000=4]
        const currentStage = areaState.chaosStage || 0;
        
        for (let i = 0; i < CHAOS_STAGES.length; i++) {
            const milestone = CHAOS_STAGES[i];
            const milestoneStage = i + 1;

            if (areaState.chaosPoints >= milestone && currentStage < milestoneStage) {
                areaState.chaosStage = milestoneStage;
                this.triggerMilestone(areaId, milestoneStage);
            }
        }
    }

    /**
     * Trigger events or invasions based on milestone reached
     */
    triggerMilestone(areaId, stage) {
        logger.info('ThreatSystem', `Area "${areaId}" reached Chaos Stage ${stage}`);

        if (stage < 4) {
            // Spawn an Area Event
            EventBus.publish('spawn_area_event', { areaId, stage });
        } else {
            // Spawn an Invasion
            EventBus.publish('spawn_invasion', { areaId });
        }
    }

    /**
     * Accelerate threat growth during an active invasion
     */
    processInvasionThreat(areaId, areaState, deltaTime) {
        const invasion = getInvasion(areaState.activeInvasionId);
        if (!invasion) return;

        // threatRate is in pts/sec, convert to pts/ms
        const ratePerMs = invasion.threatRate / 1000;
        const growth = ratePerMs * deltaTime;

        const oldThreat = areaState.invasionThreat || 0;
        areaState.invasionThreat = Math.min(100, oldThreat + growth);
        EventBus.publish('invasion_threat_updated', { areaId, threat: areaState.invasionThreat });

        // Check milestones for debuffs
        if (invasion.milestones) {
            this.checkInvasionMilestones(areaId, areaState, invasion, oldThreat);
        }
    }

    /**
     * Apply debuffs as threat crosses thresholds
     */
    checkInvasionMilestones(areaId, areaState, invasion, oldThreat) {
        const currentThreat = areaState.invasionThreat;

        for (const milestone of invasion.milestones) {
            if (currentThreat >= milestone.threat && oldThreat < milestone.threat) {
                this.applyThreatDebuff(areaId, milestone.debuffId, milestone.stacks);
            }
        }
    }

    /**
     * Push global debuff to the active threats list
     */
    applyThreatDebuff(areaId, debuffId, stacks) {
        logger.info('ThreatSystem', `Applying ${debuffId} (x${stacks}) due to Invasion Threat in ${areaId}`);
        
        // Ensure threats structure exists
        if (!GameState.state.threats) {
            GameState.state.threats = { activeDebuffs: [] };
        }

        // Add or update debuff
        const activeDebuffs = GameState.state.threats.activeDebuffs;
        const existing = activeDebuffs.find(d => d.id === debuffId && d.areaId === areaId);

        if (existing) {
            existing.stacks = Math.max(existing.stacks, stacks);
        } else {
            activeDebuffs.push({
                id: debuffId,
                areaId: areaId,
                stacks: stacks,
                startTime: Date.now()
            });
        }

        EventBus.publish('threats_updated', { areaId });
    }

    /**
     * Resolve and clear an invasion
     * Called by CardManager when the horde is defeated
     */
    clearInvasion(areaId) {
        const areaState = GameState.state.areaStates[areaId];
        if (!areaState) return;

        logger.info('ThreatSystem', `Invasion cleared in ${areaId}. Resetting metrics.`);

        areaState.activeInvasionId = null;
        areaState.chaosPoints = 0;
        areaState.chaosStage = 0;
        areaState.invasionThreat = 0;

        // Clear local debuffs
        if (GameState.state.threats?.activeDebuffs) {
            GameState.state.threats.activeDebuffs = GameState.state.threats.activeDebuffs.filter(d => d.areaId !== areaId);
        }

        EventBus.publish('invasion_cleared', { areaId });
        EventBus.publish('threats_updated', { areaId });
    }

    /**
     * Modify Chaos points externally (e.g. from special cards)
     */
    modifyChaosPoints(areaId, amount) {
        const areaState = GameState.state.areaStates[areaId];
        if (!areaState) return;

        areaState.chaosPoints = Math.max(0, Math.min(CHAOS_MAX, (areaState.chaosPoints || 0) + amount));
        // Note: This doesn't trigger stage evaluations immediately to avoid complex out-of-order spawns.
        // It will be caught on the next tick.
    }

    /**
     * Get the combined multiplier for a specific effect and category from global active debuffs
     * @param {string} effectType 
     * @param {string} category 
     * @returns {number} The combined multiplier (e.g. 0.8 for a 20% penalty)
     */
    getGlobalMultiplier(effectType, category) {
        const activeAreaId = GameState.state.ui.activeAreaId;
        const debuffs = GameState.state.threats?.activeDebuffs || [];
        
        let multiplier = 1.0;
        
        for (const debuff of debuffs) {
            // Only apply debuffs from the current area
            if (debuff.areaId !== activeAreaId) continue;

            // In a real implementation, we'd look up the debuff definition in threatRegistry.js
            // For now, we'll assume the debuff object in activeDebuffs carries its value or we'd fetch it.
            // Let's assume a simplified lookup for Phase 11.
            const def = THREATS[debuff.id];
            if (!def) continue;

            const targetCategory = (def.targetCategory || 'all').toLowerCase();
            const matches = 
                targetCategory === 'all' || 
                targetCategory === category.toLowerCase();

            if (matches && def.effectType === effectType) {
                // Apply additive building of multipliers
                multiplier += (def.value * (debuff.stacks || 1));
            }
        }

        return Math.max(0.1, multiplier); // Cap at 10% speed/yield minimum
    }
}

export const ThreatSystem = new ThreatSystemClass();
