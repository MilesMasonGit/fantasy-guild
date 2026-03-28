// Fantasy Guild - Invasion Manager
// Phase 33: Invasion System - Core Logic

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getInvasion } from '../../config/registries/invasionRegistry.js';
import { getThreat } from '../../config/registries/threatRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as CardManager from '../cards/CardManager.js';
import { CARD_TYPES } from '../../config/registries/cardRegistry.js';
import * as ModifierAggregator from '../global/ModifierAggregator.js';

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as HeroManager from '../hero/HeroManager.js';

/**
 * InvasionManager - Handles the lifecycle and escalation of invasion events.
 * 
 * Functions:
 * - Spawning invasions as modular cards
 * - Incrementing threat levels over time
 * - Tracking horde casualties
 * - Aggregating global debuffs (Threats)
 * - Handling victory/defeat
 */

const InvasionManager = {
    initialized: false,

    init() {
        if (this.initialized) return;

        // Initialize state if missing
        if (!GameState.invasions) {
            GameState.invasions = {
                active: {}, // { cardId: { threat: 0, count: 50, invasionId: '...' } }
                globalThreats: {} // { debuffId: totalStacks }
            };
        }

        // Subscribe to enemy defeat events (from modular combat)
        EventBus.subscribe('combat_victory', (data) => {
            this.handleEnemyDefeated(data);
        });

        this.initialized = true;
        logger.info('InvasionManager', 'Initialized');
    },

    /**
     * Start a new invasion
     * @param {string} invasionId - Template ID
     * @returns {string|null} - The ID of the created card
     */
    startInvasion(invasionId) {
        const template = getInvasion(invasionId);
        if (!template) {
            logger.error('InvasionManager', `Template not found: ${invasionId}`);
            return null;
        }

        // Create the card
        // Note: For now we'll use a standard modular combat setup but with an 'invasion' cardType
        const cardData = {
            cardType: CARD_TYPES.INVASION,
            invasionId: invasionId,
            name: template.name,
            description: template.description,
            threat: 0,
            hordeCount: template.count,
            hordeTotal: template.count,
            enemyId: template.enemyId,
            // Traits for multi-hero combat
            traits: [
                { type: 'heroslot', label: 'Defender', count: 3 },
                { type: 'combat', enemyId: template.enemyId }
            ]
        };

        const result = CardManager.createCard(cardData);
        if (!result.success) {
            logger.error('InvasionManager', `Failed to create invasion card: ${result.error}`);
            return null;
        }

        const card = result.card;

        // --- Phase 6: Localized Spawning ---
        // Find a valid adjacent empty cell near any player-placed card
        const playerCard = GameState.state.cards.active.find(c =>
            c.cardType !== CARD_TYPES.INVASION && c.position && c.position.x !== null
        );

        let spawnPos = null;
        if (playerCard) {
            const emptyNeighbors = GameState.getValidAdjacentEmptyCells(playerCard.position.x, playerCard.position.y);
            if (emptyNeighbors.length > 0) {
                spawnPos = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
            }
        }

        // Fallback: use first empty cell
        if (!spawnPos) {
            spawnPos = CardManager.findFirstEmptyCell();
        }

        if (spawnPos) {
            CardManager.updateCardPosition(card.id, spawnPos.x, spawnPos.y);
        }

        const cardId = card.id;

        // Track invasion state in GameState
        GameState.invasions.active[cardId] = {
            threat: 0,
            count: template.count,
            total: template.count,
            invasionId: invasionId,
            lastMilestoneThreat: 0
        };

        logger.info('InvasionManager', `Started Invasion: ${template.name} (Horde: ${template.count})`);
        EventBus.publish('invasion_started', { cardId, invasionId, name: template.name });

        return cardId;
    },

    /**
     * Increment threat for all active invasions
     * @param {number} deltaMs - Time since last tick
     */
    processTick(deltaMs) {
        const deltaSec = deltaMs / 1000;
        let threatsChanged = false;

        for (const [cardId, state] of Object.entries(GameState.invasions.active)) {
            const template = getInvasion(state.invasionId);
            if (!template) continue;

            const oldThreat = state.threat;
            state.threat = Math.min(100, state.threat + (template.threatRate * deltaSec));

            // Check for milestones
            if (Math.floor(state.threat) > Math.floor(oldThreat)) {
                this.checkMilestones(cardId, state, template);
                threatsChanged = true;
            }

            // Sync threat to card for UI
            const card = CardManager.getCard(cardId);
            if (card) {
                card.threat = state.threat;
            }
        }

        if (threatsChanged) {
            this.updateGlobalThreats();
        }
    },

    /**
     * Check if any threat milestones were crossed
     */
    checkMilestones(cardId, state, template) {
        const newMilestones = template.milestones.filter(m =>
            m.threat > state.lastMilestoneThreat && m.threat <= state.threat
        );

        if (newMilestones.length > 0) {
            state.lastMilestoneThreat = state.threat;
            newMilestones.forEach(m => {
                const debuff = getThreat(m.debuffId);
                logger.warn('InvasionManager', `Invasion ${cardId} reached ${m.threat}% threat! Debuff applied: ${debuff?.name || m.debuffId}`);
                EventBus.publish('threat_milestone_reached', { cardId, threat: m.threat, debuffId: m.debuffId });
            });
        }
    },

    /**
     * Aggregates all active debuffs from all invasions
     */
    updateGlobalThreats() {
        const aggregated = {};

        for (const state of Object.values(GameState.invasions.active)) {
            const template = getInvasion(state.invasionId);
            if (!template) continue;

            // Find all reached milestones
            const activeMilestones = template.milestones.filter(m => m.threat <= state.threat);

            activeMilestones.forEach(m => {
                aggregated[m.debuffId] = (aggregated[m.debuffId] || 0) + m.stacks;
            });
        }

        GameState.invasions.globalThreats = aggregated;
        EventBus.publish('global_threats_updated', { threats: aggregated });
        EventBus.publish('invasion_escalated'); // Trigger global recalculation

        // Explicitly trigger recalculation
        ModifierAggregator.recalculateGlobalModifiers();
    },

    /**
     * Handle an enemy being defeated in an invasion card
     */
    handleEnemyDefeated(data) {
        const { cardId } = data;
        const state = GameState.invasions.active[cardId];
        if (!state) return;

        state.count--;

        // Sync to card for UI
        const card = CardManager.getCard(cardId);
        if (card) {
            card.hordeCount = state.count;
        }

        logger.debug('InvasionManager', `Horde member defeated! ${state.count}/${state.total} remaining.`);

        if (state.count <= 0) {
            this.completeInvasion(cardId);
        }
    },

    /**
     * Finish an invasion
     */
    completeInvasion(cardId) {
        const state = GameState.invasions.active[cardId];
        if (!state) return;

        const template = getInvasion(state.invasionId);
        logger.info('InvasionManager', `Invasion Defeated: ${template?.name || state.invasionId}`);

        // Get assigned heroes to give XP
        const card = CardManager.getCard(cardId);
        const assignedHeroIds = card
            ? card.traits.filter(t => t.type === 'heroslot')
                .map((t, idx) => card.heroSlots?.[idx] || (idx === 0 ? card.assignedHeroId : null))
                .filter(id => !!id)
            : [];

        // 1. Grant Rewards (Items)
        if (template?.rewards) {
            template.rewards.forEach(r => {
                InventoryManager.addItem(r.itemId, r.count);
                logger.debug('InvasionManager', `Granted ${r.count}x ${r.itemId}`);
            });
        }

        // 2. Grant XP
        if (template?.xpRewards) {
            template.xpRewards.forEach(xp => {
                assignedHeroIds.forEach(heroId => {
                    SkillSystem.addXP(heroId, xp.skill, xp.amount);
                    logger.debug('InvasionManager', `Granted ${xp.amount} ${xp.skill} XP to hero ${heroId}`);
                });
            });
        }

        // Cleanup state
        delete GameState.invasions.active[cardId];
        this.updateGlobalThreats();

        // Discard card
        CardManager.discardCard(cardId);

        EventBus.publish('invasion_completed', {
            cardId,
            invasionId: state.invasionId,
            rewards: template?.rewards,
            xpRewards: template?.xpRewards
        });
    }
};

export { InvasionManager };
