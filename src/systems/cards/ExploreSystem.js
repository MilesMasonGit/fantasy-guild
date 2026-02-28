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
import { getItem } from '../../config/registries/itemRegistry.js';
import { getRegion, getUnexploredBiomes } from '../../config/registries/regionRegistry.js';
import { isModular } from './CardAssembler.js';
import * as GradualInputSystem from '../exploration/GradualInputSystem.js';
import { WORK_CYCLE_DURATION } from '../../config/constants.js';
import { getTagIconData } from '../../ui/components/InputSlotComponent.js';

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
        logger.info('ExploreSystem', 'Initialized (Modular Connection)');

        EventBus.subscribe('quest_completed', (data) => {
            const card = CardManager.getCard(data.cardId);
            if (card && card.cardType === 'explore') {
                // Auto-select first biome if none selected (for cards with only one option)
                if (!card.selectedBiomeId && card.traits) {
                    const selector = card.traits.find(t => t.type === 'exploreselector');
                    if (selector && selector.options && selector.options.length > 0) {
                        card.selectedBiomeId = selector.options[0];
                    }
                }

                card.awaitingDiscovery = true;
                card.pendingDiscovery = { biomeId: card.selectedBiomeId };
                card.status = 'idle'; // Stop workcycle

                // UX Polish: Unassign everything and hide relevant modules
                CardManager.unassignAllFromCard(card.id);
                if (card.traits) {
                    card.traits.forEach(trait => {
                        const type = trait.type.toLowerCase();
                        if (['heroslot', 'inputslot', 'workcycle'].includes(type)) {
                            trait.visibility = 'hidden';
                        }
                    });
                }

                EventBus.publish('cards_updated');
            }
        });

        // Listen for modular selection changes
        EventBus.subscribe('modular_select_changed', (data) => {
            if (data.type === 'exploreselector') {
                this.selectBiome(data.cardId, data.value);
            }
        });

        // Initialize newly spawned explore cards
        EventBus.subscribe('card_spawned', (data) => {
            if (data.cardType === 'explore') {
                const card = CardManager.getCard(data.cardId);
                if (card && card.selectedBiomeId) {
                    this.selectBiome(card.id, card.selectedBiomeId);
                }
            }
        });
    },

    // tick() method removed - handled by CardSystem

    /**
     * Standard tick processor for CardSystem
     * @param {Object} card 
     * @param {number} deltaTime 
     */
    processTick(card, deltaTime) {
        if (!card.assignedHeroId) return;
        // NOTE: Modular explore cards ARE processed here - the comment was incorrect
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

        const requirements = this.getExplorationRequirements(cardInstance, biome);

        // Get or initialize quest progress (unified modular state)
        if (!cardInstance.questProgress ||
            JSON.stringify(cardInstance.questProgress.requirements) !== JSON.stringify(requirements)) {

            cardInstance.questProgress = {
                inputProgress: GradualInputSystem.initInputProgress(requirements),
                requirements: requirements
            };

            // Sync trait requirements if they exist
            const questTrait = cardInstance.traits?.find(t => t.type === 'quest' && t.questType === 'collection');
            if (questTrait) questTrait.requirements = requirements;
        }

        const questProgress = cardInstance.questProgress;

        // Resolver for tag-based requirements (look up in assigned slots)
        const reqKeys = Object.keys(requirements);
        const itemResolver = (key) => {
            const index = reqKeys.indexOf(key);
            // If card has assignedItems, check the slot
            return cardInstance.assignedItems?.[index];
        };

        // Check if we can make any progress
        if (!GradualInputSystem.canMakeProgress(questProgress.inputProgress, requirements, itemResolver)) {
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

        // Calculate dynamic cycle duration based on baseTickTime
        const cycleDuration = this.getCycleDuration(cardInstance, requirements);

        // Accumulate time for tick cycle
        cardInstance.cycleProgress = (cardInstance.cycleProgress || 0) + deltaTime;

        if (cardInstance.cycleProgress >= cycleDuration) {
            cardInstance.cycleProgress -= cycleDuration;
            // ...

            // Process cycle completion
            logger.debug('ExploreSystem', 'Cycle complete! Processing consumption...');

            // Consume energy from hero
            const energyCost = 1;
            if (hero.energy.current >= energyCost) {
                HeroManager.modifyHeroEnergy(hero.id, -energyCost);
            } else {
                // Not enough energy
                logger.debug('ExploreSystem', 'Not enough energy, skipping cycle');
                return;
            }

            // Process gradual input consumption
            const result = GradualInputSystem.processGradualInputCycle(
                questProgress.inputProgress,
                questProgress.requirements,
                itemResolver
            );

            logger.debug('ExploreSystem', 'Consumption result:', {
                consumed: result.consumed,
                complete: result.complete,
                blocked: result.blocked,
                inputProgress: JSON.stringify(questProgress.inputProgress)
            });

            // Publish progress update
            EventBus.publish('exploration_progress', {
                cardId: cardInstance.id,
                biomeId: biomeId,
                inputProgress: questProgress.inputProgress,
                consumed: result.consumed
            });

            // Force UI update
            EventBus.publish('cards_updated');

            if (result.complete) {
                // Exploration complete!
                logger.debug('ExploreSystem', 'EXPLORATION COMPLETE! Calling completeExploration...');
                this.completeExploration(cardInstance, biomeId);
            } else if (result.blocked) {
                logger.debug('ExploreSystem', 'Blocked - no resources available');
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

        // Show discovery button, hide work-related modules
        if (cardInstance.traits) {
            let foundDiscovery = false;
            cardInstance.traits.forEach(t => {
                if (t.type === 'discovery') {
                    logger.debug('ExploreSystem', 'Setting discovery trait visibility to ALWAYS');
                    t.visibility = 'always';
                    foundDiscovery = true;
                } else if (['heroslot', 'inputslot', 'workcycle', 'quest'].includes(t.type)) {
                    t.visibility = 'hidden';
                }
            });
            if (!foundDiscovery) {
                logger.error('ExploreSystem', 'NO DISCOVERY TRAIT FOUND in card.traits! Types:', cardInstance.traits.map(t => t.type));
            }
        }

        logger.debug('ExploreSystem', `completeExploration finished. awaitingDiscovery: ${cardInstance.awaitingDiscovery}`);

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

        const biomeId = cardInstance.pendingDiscovery?.biomeId || cardInstance.selectedBiomeId;
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
            // Update the exploreselector trait to only show unexplored biomes
            const selectorTrait = cardInstance.traits?.find(t => t.type === 'exploreselector');
            if (selectorTrait) {
                selectorTrait.options = unexplored;
            }

            // Auto-cycle to the next available biome and regenerate traits
            this.selectBiome(cardInstance.id, unexplored[0]);

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

        if (!biome) {
            logger.error('ExploreSystem', `Failed to create Area Card: Biome "${biomeId}" not found.`);
            return;
        }

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

            // === Phase 4: Deck / Draw State ===
            seededDraws: this.initEnemyGroups(biome),
            cardsDrawn: 0,
            deck: [...(biome.startingDeck || [])],
            originalDeckSize: biome.startingDeck ? biome.startingDeck.length : 0,
            drawCost: biome.baseDrawCost || 0,

            // Legacy states (kept temporarily for safety)
            enemyGroups: this.initEnemyGroups(biome),
            currentGroupIndex: 0,
            unlockedTasks: [],
            combatState: { active: false },

            // === Projects Phase State ===
            projectChain: biome.projectChain || [],
            currentProjectIndex: 0,
            projectProgress: null,
            completedProjects: [],

            // Runtime state
            status: 'idle',
            isUnique: true,
            createdAt: Date.now()
        };

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

        // 1. Stash current path state before switching
        if (card.selectedBiomeId) {
            this.stashPathState(card, card.selectedBiomeId);
        }

        // 2. Clear current slots (ensures heroes are available for the new path or elsewhere)
        CardManager.unassignAllFromCard(cardId);

        // 3. Switch to new biome ID
        card.selectedBiomeId = biomeId;

        // 4. Try to load existing progress/state for this path
        const loaded = this.loadPathState(card, biomeId);
        const biome = getBiome(biomeId);

        if (!loaded) {
            // 5. If no saved state, initialize from scratch
            card.status = 'idle';
            card.awaitingDiscovery = false;
            card.pendingDiscovery = null;
            card.questProgress = null; // Forces re-initialization below
        }

        // 6. Get requirements for this biome
        const requirements = this.getExplorationRequirements(card, biome);

        // 7. Initialize questProgress
        if (!card.questProgress ||
            JSON.stringify(card.questProgress.requirements) !== JSON.stringify(requirements)) {

            card.questProgress = {
                inputProgress: GradualInputSystem.initInputProgress(requirements),
                requirements: requirements
            };
        }

        // 8. AUTO-GENERATE INPUT SLOTS AND QUEST TRAITS
        // Remove any existing auto-generated traits
        card.traits = card.traits.filter(t =>
            !t.autoGenerated &&
            t.type !== 'inputslot' &&
            !(t.type === 'quest' && t.questType === 'collection')
        );

        // Find insertion point (after heroslot, before workcycle)
        const workIndex = card.traits.findIndex(t => t.type === 'workcycle');
        const insertAt = workIndex >= 0 ? workIndex : card.traits.length;

        // Generate input slot traits for each requirement
        const reqEntries = Object.entries(requirements);
        const generatedTraits = [];

        reqEntries.forEach(([requirementKey, quantity], index) => {
            // Handle tag: prefixed requirements (e.g., 'tag:key')
            let item, acceptTag, acceptItemId, slotLabel;
            if (requirementKey.startsWith('tag:')) {
                const tagName = requirementKey.slice(4); // Remove 'tag:' prefix
                const tagData = getTagIconData(tagName);
                item = tagData.id ? getItem(tagData.id) : null;
                acceptTag = tagName;
                acceptItemId = null; // Tag-based, accepts any matching item
                slotLabel = `Any ${tagName}`;
            } else {
                item = getItem(requirementKey);
                acceptTag = item?.tags?.[0] || 'material';
                acceptItemId = requirementKey;
                slotLabel = item?.name || requirementKey;
            }

            generatedTraits.push({
                id: `auto_input_${index}`,
                type: 'inputslot',
                acceptTag: acceptTag,
                acceptItemId: acceptItemId,
                quantity: 1, // Per-cycle consumption
                slotLabel: slotLabel,
                slotIndex: index,
                autoGenerated: true,
                visibility: card.awaitingDiscovery ? 'hidden' : 'always'
            });
        });

        // Generate quest trait with all requirements
        generatedTraits.push({
            id: 'auto_quest',
            type: 'quest',
            questType: 'collection',
            requirements: requirements,
            autoGenerated: true,
            visibility: card.awaitingDiscovery ? 'hidden' : 'always'
        });

        // Insert generated traits at the correct position
        card.traits.splice(insertAt, 0, ...generatedTraits);

        // Update discovery button label and visibility
        const discoveryTrait = card.traits.find(t => t.type === 'discovery');
        if (discoveryTrait) {
            discoveryTrait.label = `Discover ${biome.name}`;
            // Hide discovery button until quest is complete
            discoveryTrait.visibility = card.awaitingDiscovery ? 'always' : 'hidden';
        }

        // Ensure standard modules are visible if not awaiting discovery
        if (!card.awaitingDiscovery) {
            card.traits.forEach(t => {
                const type = t.type.toLowerCase();
                if (['heroslot', 'workcycle'].includes(type)) {
                    t.visibility = 'always';
                }
            });
        }

        // Reset assigned items array to match new slot count
        card.assignedItems = {};

        EventBus.publish('biome_selected', {
            cardId: cardId,
            biomeId: biomeId
        });

        EventBus.publish('cards_updated');

        logger.debug('ExploreSystem', `Selected biome: ${biomeId} for card ${cardId} (${reqEntries.length} slots generated)`);
        return { success: true };
    },

    /**
     * Stash the current biome-specific state on the card
     * @param {Object} card 
     * @param {string} biomeId 
     */
    stashPathState(card, biomeId) {
        if (!biomeId) return;
        if (!card.explorationPaths) card.explorationPaths = {};

        card.explorationPaths[biomeId] = {
            traits: JSON.parse(JSON.stringify(card.traits || [])),
            questProgress: card.questProgress ? JSON.parse(JSON.stringify(card.questProgress)) : null,
            heroSlots: JSON.parse(JSON.stringify(card.heroSlots || {})),
            assignedHeroId: card.assignedHeroId,
            assignedItems: JSON.parse(JSON.stringify(card.assignedItems || {})),
            status: card.status,
            progress: card.progress,
            awaitingDiscovery: card.awaitingDiscovery,
            pendingDiscovery: card.pendingDiscovery ? JSON.parse(JSON.stringify(card.pendingDiscovery)) : null
        };

        logger.debug('ExploreSystem', `Stashed path state for ${biomeId}`);
    },

    /**
     * Load biome-specific state onto the card
     * @param {Object} card 
     * @param {string} biomeId 
     * @returns {boolean} True if state was restored
     */
    loadPathState(card, biomeId) {
        if (!card.explorationPaths || !card.explorationPaths[biomeId]) return false;

        const state = card.explorationPaths[biomeId];
        card.traits = state.traits;
        card.questProgress = state.questProgress;
        card.heroSlots = state.heroSlots;
        card.assignedHeroId = state.assignedHeroId;
        card.assignedItems = state.assignedItems;
        card.status = state.status;
        card.progress = state.progress;
        card.awaitingDiscovery = state.awaitingDiscovery;
        card.pendingDiscovery = state.pendingDiscovery;

        // Restore hero assignments in HeroManager (since we unassigned them during switch)
        if (card.assignedHeroId) {
            const hero = HeroManager.getHero(card.assignedHeroId);
            if (hero) hero.assignedCardId = card.id;
        }
        if (card.heroSlots) {
            Object.values(card.heroSlots).forEach(id => {
                const hero = HeroManager.getHero(id);
                if (hero) hero.assignedCardId = card.id;
            });
        }

        logger.debug('ExploreSystem', `Restored path state for ${biomeId}`);
        return true;
    },

    /**
     * Get the duration of a single consumption cycle
     * @param {Object} cardInstance 
     * @param {Object} requirements 
     * @returns {number} Duration in ms
     */
    getCycleDuration(cardInstance, requirements) {
        if (!requirements) return WORK_CYCLE_DURATION;
        const totalRequired = Object.values(requirements).reduce((sum, r) => sum + r, 0);
        const cardTickTime = cardInstance.baseTickTime || 5000; // Default 5s
        return totalRequired > 0 ? (cardTickTime / totalRequired) : WORK_CYCLE_DURATION;
    },

    /**
     * Get current exploration progress for UI display
     * @param {Object} cardInstance 
     * @returns {Object|null}
     */
    getExplorationProgress(cardInstance) {
        if (!cardInstance.questProgress) return null;

        return {
            inputProgress: cardInstance.questProgress.inputProgress,
            requirements: cardInstance.questProgress.requirements,
            percentComplete: GradualInputSystem.getTotalProgressPercent(cardInstance.questProgress.inputProgress)
        };
    }
};

export default ExploreSystem;
