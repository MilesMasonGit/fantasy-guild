// Fantasy Guild - Explore System (Reworked)
// Phase 24b: Region-based exploration with gradual resource consumption

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getCard, CARD_TYPES } from '../../config/registries/index.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getRegion, getUnexploredBiomes } from '../../config/registries/regionRegistry.js';
import * as GradualInputSystem from '../exploration/GradualInputSystem.js';
import { WORK_CYCLE_DURATION } from '../../config/constants.js';

import { logger } from '../../utils/Logger.js';

const ExploreSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the explore system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('ExploreSystem', 'Initialized (Reworked)');
    },

    // tick() method removed - handled by CardSystem

    /**
     * Standard tick processor for CardSystem
     * @param {Object} card 
     * @param {number} deltaTime 
     */
    processTick(card, deltaTime) {
        if (!card.assignedHeroId) return;
        const hero = HeroManager.getHero(card.assignedHeroId);
        if (!hero) return;

        this.processExploreCard(card, hero, deltaTime);
    },

    /**
     * Process a single explore card with gradual consumption
     * @param {Object} cardInstance 
     * @param {Object} hero 
     * @param {number} deltaTime 
     */
    processExploreCard(cardInstance, hero, deltaTime) {
        const biomeId = cardInstance.selectedBiomeId;
        const biome = getBiome(biomeId);

        if (!biome) {
            logger.warn('ExploreSystem', `Unknown biome: ${biomeId}`);
            return;
        }

        // Get or initialize biome progress
        if (!cardInstance.biomeProgress) {
            cardInstance.biomeProgress = {};
        }

        if (!cardInstance.biomeProgress[biomeId]) {
            const requirements = this.getExplorationRequirements(cardInstance, biome);
            cardInstance.biomeProgress[biomeId] = {
                inputProgress: GradualInputSystem.initInputProgress(requirements),
                requirements  // Store for reference
            };
        }

        const biomeProgress = cardInstance.biomeProgress[biomeId];
        const requirements = biomeProgress.requirements;

        // Resolver for tag-based requirements (look up in assigned slots)
        const reqKeys = Object.keys(requirements);
        const itemResolver = (key) => {
            const index = reqKeys.indexOf(key);
            // If card has assignedItems, check the slot
            return cardInstance.assignedItems?.[index];
        };

        // Check if we can make any progress
        if (!GradualInputSystem.canMakeProgress(biomeProgress.inputProgress, requirements, itemResolver)) {
            if (cardInstance.status !== 'paused') {
                cardInstance.status = 'paused';
                EventBus.publish('cards_updated');
            }
            return;
        }

        // Set to active if was paused
        if (cardInstance.status !== 'active') {
            cardInstance.status = 'active';
        }

        // Accumulate time for tick cycle
        cardInstance.cycleProgress = (cardInstance.cycleProgress || 0) + deltaTime;

        if (cardInstance.cycleProgress >= WORK_CYCLE_DURATION) {
            cardInstance.cycleProgress -= WORK_CYCLE_DURATION;
            // ...

            // DEBUG: Log cycle completion
            console.log('[ExploreSystem] Cycle complete! Processing consumption...');

            // Consume energy from hero
            const energyCost = 1;
            if (hero.energy.current >= energyCost) {
                HeroManager.modifyHeroEnergy(hero.id, -energyCost);
            } else {
                // Not enough energy
                console.log('[ExploreSystem] Not enough energy, skipping cycle');
                return;
            }

            // Process gradual input consumption
            const result = GradualInputSystem.processGradualInputCycle(
                biomeProgress.inputProgress,
                biomeProgress.requirements,
                itemResolver
            );

            // DEBUG: Log consumption result
            console.log('[ExploreSystem] Consumption result:', {
                consumed: result.consumed,
                complete: result.complete,
                blocked: result.blocked,
                inputProgress: JSON.stringify(biomeProgress.inputProgress)
            });

            // Publish progress update
            EventBus.publish('exploration_progress', {
                cardId: cardInstance.id,
                biomeId: biomeId,
                inputProgress: biomeProgress.inputProgress,
                consumed: result.consumed
            });

            // Force UI update
            EventBus.publish('cards_updated');

            if (result.complete) {
                // Exploration complete!
                console.log('[ExploreSystem] EXPLORATION COMPLETE! Calling completeExploration...');
                this.completeExploration(cardInstance, biomeId);
            } else if (result.blocked) {
                console.log('[ExploreSystem] Blocked - no resources available');
                cardInstance.status = 'paused';
                EventBus.publish('cards_updated');
            }
        }
    },

    /**
     * Get exploration requirements for a biome (with global multiplier)
     * @param {Object} cardInstance 
     * @param {Object} biome 
     * @returns {Object} { itemId: requiredAmount }
     */
    getExplorationRequirements(cardInstance, biome) {
        if (!biome.explorationCost) {
            // Default fallback
            return { torch: 5 };
        }

        // Combine base and specific costs
        const baseCost = GradualInputSystem.combineRequirements(biome.explorationCost);

        // Apply global multiplier based on exploration count
        const explorationCount = GameState.exploration?.count || 0;
        const multiplier = 1 + (explorationCount * 0.2);  // +20% per previous exploration

        // Also apply region multiplier if available
        const region = getRegion(cardInstance.regionId);
        const regionMultiplier = region?.baseCostMultiplier || 1;

        return GradualInputSystem.applyMultiplier(baseCost, multiplier * regionMultiplier);
    },

    /**
     * Called when all exploration quotas are met - sets discovery state
     * @param {Object} cardInstance 
     * @param {string} biomeId 
     */
    completeExploration(cardInstance, biomeId) {
        const biome = getBiome(biomeId);

        logger.info('ExploreSystem', `Exploration complete for ${biome.name}! Awaiting discovery...`);

        // Set awaiting discovery state (like Area Card's awaitingTaskClaim)
        cardInstance.awaitingDiscovery = true;
        cardInstance.pendingDiscovery = {
            biomeId: biomeId,
            biomeName: biome.name,
            biomeIcon: biome.icon
        };

        // Unassign hero so they're free during discovery state
        if (cardInstance.assignedHeroId) {
            CardManager.unassignHero(cardInstance.id);
        }

        EventBus.publish('exploration_ready', {
            cardId: cardInstance.id,
            biomeId: biomeId
        });

        EventBus.publish('cards_updated');
    },

    /**
     * Called when player clicks "Discover [Biome]" button
     * @param {string} cardId 
     * @returns {Object} { success: boolean, error?: string }
     */
    discoverBiome(cardId) {
        const cardInstance = CardManager.getCard(cardId);
        if (!cardInstance || !cardInstance.awaitingDiscovery) {
            logger.warn('ExploreSystem', `Cannot discover biome for card: ${cardId}`);
            return { success: false, error: 'No biome to discover' };
        }

        const biomeId = cardInstance.pendingDiscovery?.biomeId;
        const biome = getBiome(biomeId);

        // Mark biome as explored
        if (!cardInstance.exploredBiomes) {
            cardInstance.exploredBiomes = [];
        }
        cardInstance.exploredBiomes.push(biomeId);

        // Increment global exploration count
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }
        GameState.exploration.count++;

        // Create Area Card for this biome
        this.createAreaCard(biomeId, cardInstance);

        // Clear discovery state
        cardInstance.awaitingDiscovery = false;
        cardInstance.pendingDiscovery = null;

        // Unassign hero
        if (cardInstance.assignedHeroId) {
            CardManager.unassignHero(cardId);
        }

        // Check for remaining biomes
        const unexplored = getUnexploredBiomes(cardInstance.regionId, cardInstance.exploredBiomes);

        if (unexplored.length > 0) {
            // More biomes to explore - reset for next exploration
            cardInstance.selectedBiomeId = unexplored[0];
            cardInstance.status = 'idle';
            cardInstance.biomeProgress = {}; // Reset progress for new biome

            NotificationSystem.success(`Discovered ${biome.name}! ${unexplored.length} biome(s) remaining.`);

            EventBus.publish('biome_discovered', {
                cardId: cardInstance.id,
                biomeId: biomeId,
                remainingBiomes: unexplored.length
            });
        } else {
            // All biomes explored - show celebration and remove card
            NotificationSystem.success(`🎉 Region Fully Explored! ${biome.name} discovered!`);

            EventBus.publish('region_complete', {
                cardId: cardInstance.id,
                regionId: cardInstance.regionId
            });

            // Remove the explore card after a brief delay
            setTimeout(() => {
                CardManager.discardCard(cardId);
                EventBus.publish('cards_updated');
            }, 500);
        }

        EventBus.publish('cards_updated');
        return { success: true };
    },

    /**
     * Create an Area Card for the explored biome
     * @param {string} biomeId 
     * @param {Object} exploreCard - The explore card that discovered this area
     */
    createAreaCard(biomeId, exploreCard) {
        const biome = getBiome(biomeId);

        const areaCard = {
            id: CardManager.generateId('area'),
            templateId: 'area_dynamic',
            name: biome.name,
            cardType: 'area',
            description: `Quest in ${biome.name} to unlock tasks.`,
            icon: biome.icon,

            // Area-specific data
            biomeId: biomeId,
            regionId: exploreCard.regionId,

            // Phase tracking: 'questing' | 'projects' | 'complete'
            phase: 'questing',

            // === Questing Phase State ===
            enemyGroups: this.initEnemyGroups(biome),
            currentGroupIndex: 0,
            unlockedTasks: [],

            // Combat state
            combatState: {
                active: false,
                enemyHp: null,
                heroTickProgress: 0,
                enemyTickProgress: 0
            },

            // === Projects Phase State ===
            projectChain: biome.projectChain || [],
            currentProjectIndex: 0,
            projectProgress: null,  // Initialized when entering projects phase
            completedProjects: [],

            // Runtime state
            assignedHeroId: null,
            status: 'idle',
            isUnique: true,
            createdAt: Date.now()
        };

        // Initialize first enemy for combat
        const firstGroup = areaCard.enemyGroups[0];
        if (firstGroup) {
            const firstEnemy = getEnemy(firstGroup.enemyId);
            if (firstEnemy) {
                areaCard.enemyId = firstGroup.enemyId;
                areaCard.enemyHp = { current: firstEnemy.hp, max: firstEnemy.hp };
                areaCard.heroTickProgress = 0;
                areaCard.enemyTickProgress = 0;
            }
        }

        // Add to card stack
        CardManager.addToStack(areaCard);
        GameState.cacheCard(areaCard);

        EventBus.publish('card_spawned', {
            cardId: areaCard.id,
            cardType: 'area',
            biomeId: biomeId
        });

        logger.info('ExploreSystem', `Created Area Card: ${biome.name}`);
    },

    /**
     * Initialize enemy groups from biome definition
     * @param {Object} biome 
     * @returns {Array}
     */
    initEnemyGroups(biome) {
        if (!biome.enemyGroups || biome.enemyGroups.length === 0) {
            // Default enemy group if none defined
            return [
                { enemyId: 'rat', total: 3, remaining: 3, unlocksTask: 'foraging' }
            ];
        }

        return biome.enemyGroups.map(group => ({
            ...group, // Preserve all properties (type, requirements, name, etc.)
            total: group.count || 1, // Default to 1 for collection/single
            remaining: group.count || 1
        }));
    },

    /**
     * Handle biome selection change from UI
     * @param {string} cardId 
     * @param {string} biomeId 
     */
    selectBiome(cardId, biomeId) {
        const card = CardManager.getCard(cardId);
        if (!card || card.cardType !== 'explore') {
            return { success: false, error: 'INVALID_CARD' };
        }

        // Validate biome is in this region and not already explored
        const unexplored = getUnexploredBiomes(card.regionId, card.exploredBiomes || []);
        if (!unexplored.includes(biomeId)) {
            return { success: false, error: 'BIOME_NOT_AVAILABLE' };
        }

        card.selectedBiomeId = biomeId;
        card.status = 'idle';

        EventBus.publish('biome_selected', {
            cardId: cardId,
            biomeId: biomeId
        });

        EventBus.publish('cards_updated');

        logger.debug('ExploreSystem', `Selected biome: ${biomeId} for card ${cardId}`);
        return { success: true };
    },

    /**
     * Get current exploration progress for UI display
     * @param {Object} cardInstance 
     * @returns {Object|null}
     */
    getExplorationProgress(cardInstance) {
        if (!cardInstance.selectedBiomeId) return null;

        const biomeProgress = cardInstance.biomeProgress?.[cardInstance.selectedBiomeId];
        if (!biomeProgress) return null;

        return {
            inputProgress: biomeProgress.inputProgress,
            requirements: biomeProgress.requirements,
            percentComplete: GradualInputSystem.getTotalProgressPercent(biomeProgress.inputProgress)
        };
    }
};

export default ExploreSystem;
