// Fantasy Guild - Card Manager
// Phase 16: Card Stack Management

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getCard as getCardTemplate, CARD_TYPES, CARD_RARITIES } from '../../config/registries/cardRegistry.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getRegionBiomes } from '../../config/registries/regionRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getAreaEvents, getRandomEvent, getEventDef } from '../../config/registries/eventRegistry.js';
import { getInvasion } from '../../config/registries/invasionRegistry.js';
import { calculateSpeedModifier } from '../effects/EffectProcessor.js';
import { isDeckType } from './DeckSystem.js';
import { ensureModular } from './CardAssembler.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { effectEngine } from '../effects/EffectEngine.js';
// Note: CardCraftingSystem subscribes to 'task_card_created' event for discovery

/**
 * CardManager - Manages card lifecycle and hero assignment
 * 
 * Responsibilities:
 * - Create/discard cards from templates
 * - Track active cards in GameState
 * - Assign/unassign heroes to card slots
 */

/**
 * Bump the revision counter on a card to signal UI that it changed.
 * @param {Object} card - The card object to stamp
 */
export function bumpCardRev(card) {
    if (card) card._rev = (card._rev || 0) + 1;
}

/**
 * Helper: bump a card's _rev and publish 'cards_updated' with the cardId.
 * Centralizes the pattern so every mutation site stays consistent.
 * @param {string} cardId
 * @param {Object} [extraData] - Additional event payload
 */
function publishCardUpdate(cardId, extraData = {}) {
    const card = GameState.getCardById(cardId);
    bumpCardRev(card);
    EventBus.publish('cards_updated', { cardId, ...extraData });
}

/**
 * Generate a unique card ID
 * Uses persisted counter from GameState to survive save/load cycles
 * @param {string} prefix 
 * @returns {string}
 */
export function generateId(prefix = 'card') {
    // Increment and store in GameState (persisted across saves)
    const counter = (GameState.cards?.idCounter || 0) + 1;
    if (GameState.cards) {
        GameState.cards.idCounter = counter;
    }
    return `${prefix}_${Date.now()}_${counter}`;
}

/**
 * Add a card to the active stack with correct positioning
 * Priority order: recruit (top) > explore/area (middle) > tasks (bottom)
 * 
 * @param {Object} card - Card instance to add
 */
export function addToStack(card) {
    const cards = GameState.cards.active;
    const type = card.cardType;

    if (type === CARD_TYPES.RECRUIT) {
        // Recruit cards: always at absolute top
        cards.unshift(card);
    } else if (isDeckType(type)) {
        // Deck types: insert after all recruit cards
        let lastRecruitIndex = -1;
        for (let i = cards.length - 1; i >= 0; i--) {
            if (cards[i].cardType === CARD_TYPES.RECRUIT) {
                lastRecruitIndex = i;
                break;
            }
        }

        if (lastRecruitIndex === -1) {
            // No recruit cards, put at top
            cards.unshift(card);
        } else {
            // Insert right after the last recruit card
            cards.splice(lastRecruitIndex + 1, 0, card);
        }
    } else {
        // Tasks and other cards: add to bottom
        cards.push(card);
    }
}

// ========================================
// Card CRUD Operations
// ========================================

/**
 * Create a new card instance from a template
 * @param {string} templateId - ID from cardRegistry
 * @param {Object} [options] - Additional options
 * @returns {{ success: boolean, card?: Object, error?: string }}
 */
export function createCard(templateId, options = {}) {
    let template;
    if (typeof templateId === 'object' && templateId !== null) {
        template = templateId;
        // Ensure template has an ID if it's dynamic
        if (!template.id) template.id = templateId.templateId || 'dynamic_card';
    } else {
        template = getCardTemplate(templateId);
    }

    if (!template) {
        return { success: false, error: 'TEMPLATE_NOT_FOUND' };
    }

    const cards = GameState.cards;

    // Check card limit (unless card is unique or a deck type)
    if (!template.isUnique && !isDeckType(template.cardType) && cards.limits.currentCount >= cards.limits.max) {
        return { success: false, error: 'CARD_LIMIT_REACHED' };
    }

    // Create card instance
    const card = {
        id: generateId('card'),
        templateId: template.id,
        name: template.name,
        cardType: template.cardType,
        description: template.description || '',
        icon: template.icon || '📜',
        position: { x: null, y: null }, // Will be assigned by Board logic or Spawn helpers

        // NEW: Centralized modifier pool
        aggregator: new ModifierAggregator(null),

        // Card-specific data from template (check config for Task cards)
        skill: template.skill || template.config?.skill,
        skillRequirement: template.skillRequirement || template.config?.skillRequirement || 0,
        taskCategory: template.taskCategory || template.config?.taskCategory || null,
        biomeId: template.biomeId || template.config?.biomeId || null,
        isUnique: template.isUnique || false,
        traits: template.traits ? JSON.parse(JSON.stringify(template.traits)) : null,

        // Preserve config object for modular trait generation
        config: template.config ? JSON.parse(JSON.stringify(template.config)) : null,

        // Explore card data
        regionId: template.regionId || null,
        selectedBiomeId: template.selectedBiomeId || null,

        // Rarity — deprecated, always null. Drop rates are Area Set-level.
        rarity: null,

        // Task/Activity data
        baseTickTime: template.baseTickTime || template.config?.baseTickTime || 0,
        baseEnergyCost: template.baseEnergyCost || template.config?.baseEnergyCost || 0,
        toolRequired: template.toolRequired || template.config?.toolRequired || null,
        inputs: Array.isArray(template.inputs) ? [...template.inputs] : (Array.isArray(template.config?.inputs) ? [...template.config.inputs] : []),
        outputs: Array.isArray(template.outputs) ? [...template.outputs] : (Array.isArray(template.config?.outputs) ? [...template.config.outputs] : []),
        outputMap: template.outputMap || null,
        xpAwarded: template.xpAwarded || 0,

        // Runtime state
        location: 'board',        // 'board' or 'library'
        stack: [],                // Unified stack of dropped entities { type: 'hero'|'item', id }
        progress: 0,              // Current progress (0 to baseTickTime)
        assignedHeroId: null,     // [DEPRECATED in Phase 1] Legacy primary/first hero
        hordeCount: template.hordeCount || 0,
        hordeTotal: template.hordeTotal || 0,
        enemyId: template.enemyId || null,
        heroSlots: {},            // [DEPRECATED in Phase 1] New multi-hero tracking { slotIndex: heroId }
        assignedItems: {},        // [DEPRECATED in Phase 1] Items assigned to open input slots { slotIndex: itemId }
        explorePoints: 0,         // Explore card: points earned (0 to explorePointsRequired)
        status: 'idle',           // 'idle', 'active', 'paused', 'completed'
        createdAt: Date.now(),

        // Optional overrides from options
        ...options.overrides
    };

    // NOTE: Guild Hall rarity override and biome effects have been removed.
    // Per-card rarity and biome modifiers are no longer features.
    // Drop rates and card stats are now driven by Area Sets.

    // Initialize combat card state
    if (card.cardType === CARD_TYPES.COMBAT) {
        const enemy = getEnemy(template.enemyId);
        if (enemy) {
            // Store enemy reference
            card.enemyId = template.enemyId;

            // Initialize enemy HP (resets on each combat)
            card.enemyHp = {
                current: enemy.hp,
                max: enemy.hp
            };

            // Tick progress tracking (0 to attackSpeed)
            card.heroTickProgress = 0;    // Hero attack progress
            card.enemyTickProgress = 0;   // Enemy attack progress

            // Combat state flags
            card.combatState = {
                isHeroConsuming: false,   // Hero is eating/drinking (skips attack)
                lastHeroHit: false,       // Did hero hit on last attack?
                lastEnemyHit: false,      // Did enemy hit on last attack?
                lastHeroDamage: 0,        // Damage dealt by hero last attack
                lastEnemyDamage: 0        // Damage dealt by enemy last attack
            };
        } else {
            logger.warn('CardManager', `Combat card created with unknown enemyId: ${template.enemyId}`);
        }
    }

    // Initialize dungeon card state
    if (card.cardType === CARD_TYPES.DUNGEON) {
        // Clone the enemy list from the template to create a queue
        card.enemyQueue = template.enemies ? [...template.enemies] : [];
        card.totalCount = card.enemyQueue.length;
        card.completedCount = 0;
        card.finalRewards = template.rewards ? [...template.rewards] : [];
        card.finalXpRewards = template.xpRewards ? [...template.xpRewards] : [];

        // Set the initial enemy if the queue isn't empty
        if (card.enemyQueue.length > 0) {
            const firstEnemyId = card.enemyQueue.shift();
            const enemy = getEnemy(firstEnemyId);
            if (enemy) {
                card.enemyId = firstEnemyId;
                card.enemyHp = {
                    current: enemy.hp,
                    max: enemy.hp
                };
                card.heroTickProgress = 0;
                card.enemyTickProgress = 0;
                card.combatState = {
                    isHeroConsuming: false,
                    lastHeroHit: false,
                    lastEnemyHit: false,
                    lastHeroDamage: 0,
                    lastEnemyDamage: 0,
                    intermissionTimer: 0
                };
            }
        }
    }


    // Generate modular traits if the card doesn't already have them
    ensureModular(card, template);

    // Use centralized stack positioning
    addToStack(card);


    // Add to card lookup cache for O(1) lookups
    GameState.cacheCard(card);

    // --- Phase 6: Standard Position Assignment ---
    // If card is on board and still lacks a 2D position, find the first available spot.
    if (card.location === 'board' && (!card.position || card.position.x === null)) {
        const spawnPos = findFirstEmptyCell();
        if (spawnPos) {
            // Now that it's cached, we can use the formal update method
            updateCardPosition(card.id, spawnPos.x, spawnPos.y);
        }
    }

    // Update count (unless unique or deck type)
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount++;
    }

    EventBus.publish('card_spawned', {
        cardId: card.id,
        cardType: card.cardType,
        templateId: card.templateId,
        enemyId: card.enemyId // Added for encounter-based discovery
    });

    // Publish event for card discovery (CardCraftingSystem subscribes to these)
    if (card.cardType === CARD_TYPES.TASK) {
        EventBus.publish('task_card_created', { templateId: card.templateId });
    } else if (card.cardType === CARD_TYPES.COMBAT) {
        EventBus.publish('combat_card_created', { templateId: card.templateId });
    }

    logger.info('CardManager', `Created card "${card.name}" (${card.id})`);

    // Recalculate grid bonuses after new card is placed
    effectEngine.pulse();

    publishCardUpdate(card.id); // Ensure UI and Library are notified
    return { success: true, card };
}

/**
 * Get a card by ID (O(1) via cache)
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getCard(cardId) {
    return GameState.getCardById(cardId);
}

/**
 * Get all active cards
 * @returns {Array}
 */
export function getActiveCards() {
    return GameState.cards.active;
}

/**
 * Get cards by type
 * @param {string} cardType 
 * @returns {Array}
 */
export function getCardsByType(cardType) {
    return GameState.cards.active.filter(c => c.cardType === cardType);
}

/**
 * Find the first card matching a template ID
 * @param {string} templateId 
 * @returns {Object|null}
 */
export function getCardByTemplate(templateId) {
    if (!GameState.cards?.active) return null;
    return GameState.cards.active.find(c => c.templateId === templateId) || null;
}

/**
 * Get cards assigned to a specific hero
 * @param {string} heroId 
 * @returns {Object|null}
 */
export function getCardByHero(heroId) {
    return GameState.cards.active.find(c =>
        c.assignedHeroId === heroId ||
        (c.heroSlots && Object.values(c.heroSlots).includes(heroId))
    ) || null;
}

/**
 * Discard a card (remove from active)
 * @param {string} cardId 
 * @returns {{ success: boolean, error?: string }}
 */
export function discardCard(cardId) {
    const cards = GameState.cards;
    const index = cards.active.findIndex(c => c.id === cardId);

    if (index === -1) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    const card = cards.active[index];

    // Unassign hero if assigned
    if (card.assignedHeroId) {
        unassignHero(cardId);
    }

    // NEW: If this is a blueprint card, unassign it from any building it's in
    if (card.cardType === CARD_TYPES.BLUEPRINT) {
        const host = GameState.cards.active.find(c => c.assignedBlueprintId === cardId);
        if (host) {
            unassignBlueprint(host.id);
        }
    }

    // NEW: If this is a building with a blueprint, remove the blueprint card too?
    // User hasn't specified this, but usually buildings being discarded should return the blueprint to the player.
    if (card.assignedBlueprintId) {
        unassignBlueprint(cardId);
    }

    // Remove from active
    cards.active.splice(index, 1);

    // Remove from card lookup cache
    GameState.uncacheCard(cardId);

    // Recalculate grid bonuses after card is removed
    effectEngine.pulse();

    // NEW: Trigger EffectEngine pulse
    effectEngine.pulse();

    // Update count (unless unique or deck type)
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount = Math.max(0, cards.limits.currentCount - 1);
    }

    EventBus.publish('card_discarded', { cardId, templateId: card.templateId });
    publishCardUpdate(cardId); // This bumps _rev and publishes 'cards_updated' properly
    logger.info('CardManager', `Discarded card "${card.name}" (${card.id})`);

    return { success: true };
}

/**
 * Set card status
 * @param {string} cardId 
 * @param {string} status - 'idle', 'active', 'paused', 'completed'
 * @returns {{ success: boolean, error?: string }}
 */
export function setCardStatus(cardId, status) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    card.status = status;
    publishCardUpdate(cardId, { status });
    return { success: true };
}

/**
 * Transform a task card into a combat card temporarily.
 * Saves original traits to originalTraits and replaces them with a combat trait.
 * @param {string} cardId 
 * @param {string} enemyId 
 * @returns {{ success: boolean, error?: string }}
 */
export function transformToCombat(cardId, enemyId) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    const enemy = getEnemy(enemyId);
    if (!enemy) return { success: false, error: 'ENEMY_NOT_FOUND' };

    logger.info('CardManager', `Transforming card ${cardId} into combat against ${enemyId}`);

    // Save state for reversion
    card.originalTraits = JSON.parse(JSON.stringify(card.traits));
    card.originalCardType = card.cardType;

    // Transition to combat
    card.cardType = CARD_TYPES.COMBAT;

    // Replace traits with combat trait
    card.traits = [
        { type: 'header' },
        { type: 'heroslot', slots: (card.originalTraits?.find(t => t.type === 'heroslot')?.slots || 1) },
        {
            type: 'combat',
            enemyId: enemyId,
            combatType: enemy.combatType || 'melee'
        }
    ];

    // Initialize combat state (same as createCard logic)
    card.enemyId = enemyId;
    card.enemyHp = {
        current: enemy.hp,
        max: enemy.hp
    };
    card.heroTickProgress = 0;
    card.enemyTickProgress = 0;
    card.combatState = {
        isHeroConsuming: false,
        lastHeroHit: false,
        lastEnemyHit: false,
        lastHeroDamage: 0,
        lastEnemyDamage: 0
    };

    card.status = 'active'; // Immediately start combat if a hero is assigned

    // Ensure modular components update
    ensureModular(card);

    publishCardUpdate(cardId, { source: 'transformation' });
    EventBus.publish('card_transformed', { cardId, enemyId });

    return { success: true };
}

/**
 * Revert a combat card back to its original task state.
 * @param {string} cardId 
 * @returns {{ success: boolean, error?: string }}
 */
export function revertFromCombat(cardId) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    if (!card.originalTraits) {
        logger.warn('CardManager', `Attempted to revert card ${cardId} but no originalTraits found.`);
        return { success: false, error: 'NO_ORIGINAL_STATE' };
    }

    logger.info('CardManager', `Reverting card ${cardId} from combat back to ${card.originalCardType}`);

    // Restore state
    card.cardType = card.originalCardType;
    card.traits = card.originalTraits;

    // Cleanup
    delete card.originalTraits;
    delete card.originalCardType;
    delete card.enemyId;
    delete card.enemyHp;
    delete card.heroTickProgress;
    delete card.enemyTickProgress;
    delete card.combatState;

    // Resume gathering if heroes are still assigned
    const hasHeroes = !!card.assignedHeroId || (card.heroSlots && Object.values(card.heroSlots).some(id => id));
    card.status = hasHeroes ? 'active' : 'idle';
    card.progress = 0; // Reset task progress

    ensureModular(card);

    publishCardUpdate(cardId, { source: 'reversion' });
    EventBus.publish('card_reverted', { cardId });

    return { success: true };
}

// ========================================
// Recipe Evaluator (Generic Slots)
// ========================================

export function evaluateBuildingRecipe(cardId) {
    const building = getCard(cardId);
    if (!building) return;

    const template = getCardTemplate(building.templateId);
    if (!template) return;

    // Safety: If no genericSlots are defined, this system is legacy, skip evaluation
    if (!template.config?.genericSlots && !building.config?.genericSlots) return;

    // Build Recipe Pool
    const recipePool = [];

    // 1. Spec Recipe
    if (building.assignedBlueprintId) {
        const blueprintInstance = getCard(building.assignedBlueprintId);
        const blueprint = blueprintInstance ? getCardTemplate(blueprintInstance.templateId) : null;
        if (blueprint && blueprint.grantedRecipeTraits) {
            recipePool.push({
                type: 'blueprint',
                recipe: blueprint.grantedRecipeTraits,
                priority: 1
            });
        }
    }

    // 2. Native Recipe
    if (template.nativeRecipeTraits) {
        recipePool.push({
            type: 'native',
            recipe: template.nativeRecipeTraits,
            priority: 2
        });
    }

    // Evaluate current items
    const currentItems = building.assignedItems ? Object.values(building.assignedItems).filter(Boolean) : [];

    let matchedRecipe = null;
    let matchedRecipeType = null;

    for (const entry of recipePool) {
        const reqs = entry.recipe.inputs || [];

        let isMatch = true;
        const availableItems = [...currentItems].map(id => getCard(id)?.itemId || id);

        for (const req of reqs) {
            const index = availableItems.indexOf(req.itemId);
            if (index !== -1) {
                availableItems.splice(index, 1);
            } else {
                isMatch = false;
                break;
            }
        }

        if (isMatch && reqs.length > 0) {
            matchedRecipe = entry.recipe;
            matchedRecipeType = entry.type;
            break;
        }
    }

    building.activeRecipe = matchedRecipe;
    ensureModular(building, template);
    publishCardUpdate(cardId, { source: 'evaluateBuildingRecipe' });
    logger.debug('CardManager', `Evaluated recipe for ${cardId}: ${matchedRecipeType || 'None'} matched.`);
}

// ========================================
// Item Slot Assignment (for open input slots)
// ========================================

/**
 * Assign an item to an open input slot
 * @param {string} cardId 
 * @param {number} slotIndex - Index of the input slot
 * @param {string} itemId - Item to assign
 * @returns {{ success: boolean, error?: string }}
 */
export function assignItemToSlot(cardId, slotIndex, itemId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    if (!card.assignedItems) {
        card.assignedItems = {};
    }

    card.assignedItems[slotIndex] = itemId;

    // Reset durability metadata for this slot so new item starts fresh
    if (card.inputMetadata && card.inputMetadata[slotIndex]) {
        delete card.inputMetadata[slotIndex];
    }

    evaluateBuildingRecipe(cardId);

    EventBus.publish('item_assigned_to_slot', { cardId, slotIndex, itemId });
    publishCardUpdate(cardId, { source: 'item_assigned' });
    logger.debug('CardManager', `Assigned ${itemId} to slot ${slotIndex} on card ${cardId}`);

    return { success: true };
}

/**
 * Unassign an item from an open input slot
 * @param {string} cardId 
 * @param {number} slotIndex - Index of the input slot
 * @returns {{ success: boolean, error?: string }}
 */
export function unassignItemFromSlot(cardId, slotIndex) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    if (card.assignedItems && card.assignedItems[slotIndex]) {
        const itemId = card.assignedItems[slotIndex];
        delete card.assignedItems[slotIndex];

        // Clear durability metadata
        if (card.inputMetadata && card.inputMetadata[slotIndex]) {
            delete card.inputMetadata[slotIndex];
        }

        // Reset progress when items are removed
        card.progress = 0;
        card.status = 'idle';

        evaluateBuildingRecipe(cardId);

        EventBus.publish('item_unassigned_from_slot', { cardId, slotIndex, itemId });
        publishCardUpdate(cardId, { source: 'item_unassigned' });
        logger.debug('CardManager', `Unassigned ${itemId} from slot ${slotIndex} on card ${cardId}`);
    }

    return { success: true };
}

/**
 * Assign a blueprint card to a facility
 * @param {string} buildingCardId - The host building
 * @param {string} blueprintCardId - The blueprint card instance ID
 * @returns {{ success: boolean, error?: string }}
 */
export function assignBlueprint(buildingCardId, blueprintCardId) {
    const building = getCard(buildingCardId);
    const blueprint = getCard(blueprintCardId);

    if (!building || !blueprint) return { success: false, error: 'CARD_NOT_FOUND' };

    // Check if blueprint is already assigned elsewhere
    const existingHost = GameState.cards.active.find(c => c.assignedBlueprintId === blueprintCardId);
    if (existingHost) {
        if (existingHost.id === buildingCardId) {
            return { success: true }; // Already assigned here
        } else {
            unassignBlueprint(existingHost.id); // Unassign from previous host automatically
        }
    }

    // Validation: Does building accept this blueprint?
    const blueprintTemplate = getCardTemplate(blueprint.templateId);

    // Skill-based validation
    if (blueprintTemplate && blueprintTemplate.requiredSkill && building.skill !== blueprintTemplate.requiredSkill) {
        return { success: false, error: 'BLUEPRINT_SKILL_MISMATCH' };
    }

    // Fallback: Legacy explicit validation
    const template = getCardTemplate(building.templateId);
    const accepted = template?.acceptedBlueprints || building.acceptedBlueprints || [];
    if (!blueprintTemplate.requiredSkill && accepted.length > 0 && !accepted.includes(blueprint.templateId)) {
        return { success: false, error: 'BLUEPRINT_NOT_ACCEPTED' };
    }

    // Check if building even has a slot
    const blueprintSlot = building.traits?.find(t => t.type === 'blueprintslot');
    if (!blueprintSlot) {
        return { success: false, error: 'NO_BLUEPRINT_SLOT' };
    }

    // SAFETY: Refund any existing items before swapping
    unassignBlueprint(buildingCardId);

    // Assign
    building.assignedBlueprintId = blueprintCardId;
    blueprint.isHidden = true;
    blueprint.position = { x: null, y: null };

    // Trigger trait re-generation or evaluator
    evaluateBuildingRecipe(buildingCardId);
    ensureModular(building, template);

    publishCardUpdate(buildingCardId, { source: 'blueprint_assigned' });
    logger.info('CardManager', `Assigned blueprint ${blueprintCardId} to building ${buildingCardId}`);

    return { success: true };
}

/**
 * Remove a blueprint from a facility and refund items
 * @param {string} buildingCardId 
 * @returns {{ success: boolean }}
 */
export function unassignBlueprint(buildingCardId) {
    const building = getCard(buildingCardId);
    if (!building) return { success: false, error: 'CARD_NOT_FOUND' };

    // REFUND LOGIC: If items were in slots, give them back to inventory
    if (building.assignedItems) {
        Object.values(building.assignedItems).forEach(itemId => {
            if (itemId) InventoryManager.addItem(itemId, 1);
        });
        building.assignedItems = {};
    }

    // Reset progress
    building.progress = 0;
    building.status = 'idle';
    const blueprintId = building.assignedBlueprintId;
    building.assignedBlueprintId = null;

    if (blueprintId) {
        const blueprint = getCard(blueprintId);
        if (blueprint) {
            blueprint.isHidden = false;
            // Provide a physical spot on the board so CardView renders it immediately
            const spawnPos = findFirstEmptyCell();
            if (spawnPos) {
                updateCardPosition(blueprintId, spawnPos.x, spawnPos.y);
            } else {
                publishCardUpdate(blueprintId, { source: 'blueprint_unassigned' });
            }
        }
    }

    // Trigger trait re-generation (returns to native recipe)
    const template = getCardTemplate(building.templateId);
    ensureModular(building, template);

    publishCardUpdate(buildingCardId, { source: 'blueprint_unassigned' });
    logger.info('CardManager', `Unassigned blueprint from building ${buildingCardId} (Refunded items)`);

    return { success: true };
}

// ========================================
// Tool Assignment (Inventory Placement)
// ========================================

/**
 * Assign a tool template ID to a card's tool slot.
 * Note: Tools remain in inventory, this just references which one is "active".
 * @param {string} cardId 
 * @param {string} itemId 
 * @returns {{ success: boolean, error?: string }}
 */
export function assignTool(cardId, itemId) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    const tool = getItem(itemId);
    if (!tool) return { success: false, error: 'ITEM_NOT_FOUND' };

    // Validation logic is partially handled by the UI (ToolSlotModule),
    // but we enforce it here for engine parity.
    const toolSlot = card.traits?.find(t => t.type === 'toolslot');
    if (!toolSlot) return { success: false, error: 'NO_TOOL_SLOT' };

    if (tool.toolType !== toolSlot.toolType && tool.type !== 'tool') {
         // Some tools use 'type: tool' and might have 'axe' tag rather than toolType property
         // We check both for robustness
         const hasCorrectTag = tool.tags?.includes(toolSlot.toolType);
         if (!hasCorrectTag && tool.toolType !== toolSlot.toolType) {
             return { success: false, error: 'TOOL_TYPE_MISMATCH' };
         }
    }

    if ((tool.tier || 0) < (toolSlot.minTier || 0)) {
        return { success: false, error: 'TOOL_TIER_TOO_LOW' };
    }

    // Assign
    card.assignedToolId = itemId;

    publishCardUpdate(cardId, { source: 'tool_assigned' });
    EventBus.publish('tool_assigned', { cardId, itemId });
    logger.info('CardManager', `Referenced tool ${itemId} on card ${cardId}`);

    return { success: true };
}

/**
 * Unassign tool from a card
 * @param {string} cardId 
 */
export function unassignTool(cardId) {
    const card = getCard(cardId);
    if (!card || !card.assignedToolId) return { success: true };

    const itemId = card.assignedToolId;
    card.assignedToolId = null;

    // Reset progress on unassign
    card.progress = 0;
    card.status = 'idle';

    publishCardUpdate(cardId, { source: 'tool_unassigned' });
    EventBus.publish('tool_unassigned', { cardId, itemId });
    logger.info('CardManager', `Unassigned tool from card ${cardId}`);

    return { success: true };
}

// ========================================
// Smart Assignment (Auto-routing)
// ========================================

/**
 * Intelligently route an entity to the best available slot on a card.
 * If all matching slots are occupied, replaces the first matching slot.
 * @param {string} cardId 
 * @param {string} entityType - 'hero' or 'item'
 * @param {string} entityId 
 * @returns {{ success: boolean, error?: string }}
 */
export function smartAssignEntity(cardId, entityType, entityId) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    if (entityType === 'hero') {
        const heroslotTrait = card.traits?.find(t => t.type === 'heroslot');
        if (heroslotTrait) {
            const slots = heroslotTrait.slots || heroslotTrait.requirements || [];

            // First pass: try empty slots
            for (let i = 0; i < slots.length; i++) {
                const isOccupied = card.heroSlots?.[i] || (i === 0 && card.assignedHeroId);
                if (!isOccupied) {
                    const result = assignHero(cardId, entityId, i);
                    if (result.success) return result;
                }
            }

            // Second pass: replace the first occupied slot (swap)
            for (let i = 0; i < slots.length; i++) {
                const occupantId = card.heroSlots?.[i] || (i === 0 ? card.assignedHeroId : null);
                if (occupantId && occupantId !== entityId) {
                    unassignHero(cardId, i);
                    const result = assignHero(cardId, entityId, i);
                    if (result.success) return result;
                }
            }
        }
        // Fallback to stack if no specific slot matches or is available
        return assignEntityToStack(cardId, 'hero', entityId);
    }

    if (entityType === 'blueprint') {
        const blueprintSlot = card.traits?.find(t => t.type === 'blueprintslot');
        if (blueprintSlot) {
            return assignBlueprint(cardId, entityId);
        }
        return { success: false, error: 'NO_BLUEPRINT_SLOT' };
    }

    if (entityType === 'item') {
        const itemDef = getItem(entityId);
        if (!itemDef) return { success: false, error: 'ITEM_NOT_FOUND' };

        // Scan for matching input slots
        const inputTraits = card.traits?.filter(t => t.type === 'inputslot') || [];
        let firstMatchingOccupiedSlot = null;
        let firstMatchingOccupiedTrait = null;

        for (const trait of inputTraits) {
            const inputs = trait.inputs || (trait.itemId || trait.acceptTag ? [trait] : []);
            for (let i = 0; i < inputs.length; i++) {
                const slotIndex = trait.inputs ? i : (trait.slotIndex ?? 0);
                const req = inputs[i];
                const matchesId = req.itemId && req.itemId === entityId;
                const matchesLegacyTag = req.acceptTag && itemDef.tags?.includes(req.acceptTag);
                const matchesTags = req.acceptTags && req.acceptTags.length > 0 && itemDef.tags?.some(tag => req.acceptTags.includes(tag));

                if (matchesId || matchesLegacyTag || matchesTags) {
                    const isOccupied = card.assignedItems?.[slotIndex];
                    if (!isOccupied) {
                        // Empty matching slot — assign immediately
                        return assignItemToSlot(cardId, slotIndex, entityId);
                    } else if (!firstMatchingOccupiedSlot) {
                        // Track the first matching occupied slot for replacement
                        firstMatchingOccupiedSlot = slotIndex;
                        firstMatchingOccupiedTrait = trait;
                    }
                }
            }
        }

        // If all matching slots are full, replace the first one
        if (firstMatchingOccupiedSlot !== null) {
            unassignItemFromSlot(cardId, firstMatchingOccupiedSlot);
            return assignItemToSlot(cardId, firstMatchingOccupiedSlot, entityId);
        }

        // Fallback to stack
        return assignEntityToStack(cardId, 'item', entityId);
    }

    return { success: false, error: 'INVALID_ENTITY_TYPE' };
}

// ========================================
// Stack Assignment (Generic Entities)
// ========================================

/**
 * Add an entity (hero or item) to a card's stack
 * @param {string} cardId 
 * @param {string} entityType - 'hero' or 'item'
 * @param {string} entityId 
 * @returns {{ success: boolean, error?: string }}
 */
export function assignEntityToStack(cardId, entityType, entityId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    if (!card.stack) card.stack = [];

    // --- Validation Logic ---
    if (entityType === 'hero') {
        const hero = HeroManager.getHero(entityId);
        if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

        // Max Hero Limits
        const heroCount = card.stack.filter(e => e.type === 'hero').length;
        const maxHeroes = card.maxHeroes || 1; // Default to 1 if not specified
        if (heroCount >= maxHeroes) {
            return { success: false, error: 'MAX_HEROES_REACHED' };
        }

        // Hero Skill Requirements
        if (card.skill && card.level) {
            const skillLevel = hero.skills[card.skill]?.level || 0;
            if (skillLevel < card.level) {
                return { success: false, error: 'SKILL_REQUIREMENT_NOT_MET', required: { skill: card.skill, level: card.level }, heroLevel: skillLevel };
            }
        }

        // Villager restrictions
        if (hero.isVillager && card.cardType === CARD_TYPES.COMBAT) {
            if (card.config?.allowsVillager !== true && card.allowsVillager !== true) {
                return { success: false, error: 'VILLAGERS_CANNOT_FIGHT' };
            }
        }
    } else if (entityType === 'item') {
        // Validation logic for dropping items directly onto the stack
        // For now, we allow dropping items if they match ANY requirement tags on the card
        const itemDef = getItem(entityId);
        if (!itemDef) return { success: false, error: 'ITEM_NOT_FOUND' };

        // In this architecture, cards define what tools they consume/require.
        // We will expand on specific tool requirements in Phase 3.
    }

    // --- Assignment execution ---
    if (entityType === 'hero') {
        const heroResult = HeroManager.assignHeroToCard(entityId, cardId);
        if (!heroResult.success) {
            return { success: false, error: heroResult.error };
        }
        // Legacy backend sync for progress systems
        if (!card.assignedHeroId) {
            card.assignedHeroId = entityId;
        }
    } else if (entityType === 'item') {
        // Items are not removed from inventory when assigned to a card, they just point to it.
        if (!InventoryManager.hasItem(entityId, 1)) {
            return { success: false, error: 'ITEM_NOT_AVAILABLE' };
        }
    }

    card.stack.push({
        type: entityType,
        id: entityId,
        assignedAt: Date.now()
    });

    EventBus.publish('stack_updated', { cardId, entityType, entityId, action: 'add' });
    publishCardUpdate(cardId, { source: 'stack_updated' });
    logger.debug('CardManager', `Added ${entityType} ${entityId} to stack on card ${cardId}`);

    return { success: true };
}

/**
 * Remove the top-most unassigned entity from a card's stack
 * @param {string} cardId 
 * @returns {{ success: boolean, removed?: object, error?: string }}
 */
export function unassignTopFromStack(cardId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    if (!card.stack || card.stack.length === 0) {
        return { success: false, error: 'STACK_EMPTY' };
    }

    // Pop the topmost item
    const entity = card.stack.pop();

    if (entity.type === 'hero') {
        HeroManager.unassignHero(entity.id);
        if (card.assignedHeroId === entity.id) {
            card.assignedHeroId = null;
        }
    } else if (entity.type === 'item') {
        // Items are not removed from inventory, so no need to return them
    }

    // Reset progress if stack changes (simplest rule for now)
    card.progress = 0;
    card.status = 'idle';

    EventBus.publish('stack_updated', { cardId, entityType: entity.type, entityId: entity.id, action: 'remove' });
    publishCardUpdate(cardId, { source: 'stack_updated' });
    logger.debug('CardManager', `Removed ${entity.type} ${entity.id} from stack on card ${cardId}`);

    return { success: true, removed: entity };
}

// ========================================
// Hero Assignment (Legacy Array slots - DEPRECATED)
// ========================================

/**
 * Assign a hero to a card (DEPRECATED: Use addToStack)
 * @param {string} cardId 
 * @param {string} heroId 
 * @returns {{ success: boolean, error?: string }}
 */
export function assignHero(cardId, heroId, slotIndex = 0) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Initialize slots if missing
    if (!card.heroSlots) card.heroSlots = {};

    // Check if slot is already occupied
    if (card.heroSlots[slotIndex] || (slotIndex === 0 && card.assignedHeroId)) {
        return { success: false, error: 'CARD_SLOT_OCCUPIED' };
    }

    // Check if hero is already assigned elsewhere
    const existingCard = getCardByHero(heroId);
    if (existingCard) {
        return { success: false, error: 'HERO_ALREADY_ASSIGNED' };
    }

    // Check skill and stat requirements for THIS slot
    const template = getCardTemplate(card.templateId);
    const heroslotTrait = card.traits?.find(t => t.type === 'heroslot');
    const heroSlotsConfig = heroslotTrait?.slots || heroslotTrait?.requirements || [];
    const slotConfig = heroSlotsConfig[slotIndex] || template; // Fallback to template for legacy cards

    if (slotConfig && slotConfig.skill && slotConfig.skillRequirement > 0) {
        const req = { skill: slotConfig.skill, level: slotConfig.skillRequirement };
        if (!SkillSystem.meetsRequirement(heroId, req)) {
            const heroLevel = SkillSystem.getSkillLevel(heroId, req.skill) || 0;
            return {
                success: false,
                error: 'SKILL_REQUIREMENT_NOT_MET',
                required: req,
                heroLevel
            };
        }
    }

    // Update hero side first
    const heroResult = HeroManager.assignHeroToCard(heroId, cardId);
    if (!heroResult.success) {
        return { success: false, error: heroResult.error };
    }

    // Assign hero to slot
    card.heroSlots[slotIndex] = heroId;

    // Legacy sync: if index is 0, update assignedHeroId
    if (slotIndex === 0) {
        card.assignedHeroId = heroId;
    }

    // Stack consistency
    if (!card.stack) card.stack = [];
    if (!card.stack.some(e => e.type === 'hero' && e.id === heroId)) {
        card.stack.push({
            type: 'hero',
            id: heroId,
            assignedAt: Date.now()
        });
    }

    card.status = 'idle';

    // Set default combat style based on hero's highest skill
    const hero = HeroManager.getHero(heroId);
    const skills = hero?.skills;
    if (skills) {
        const melee = skills.melee?.level || 0;
        const ranged = skills.ranged?.level || 0;
        const magic = skills.magic?.level || 0;

        if (melee >= ranged && melee >= magic) card.selectedStyle = 'melee';
        else if (ranged >= melee && ranged >= magic) card.selectedStyle = 'ranged';
        else card.selectedStyle = 'magic';
    } else {
        card.selectedStyle = 'melee';
    }

    EventBus.publish('hero_assigned_to_card', { cardId, heroId, slotIndex });
    publishCardUpdate(cardId, { source: 'hero_assignment' });
    logger.info('CardManager', `Hero ${heroId} assigned to card ${cardId} slot ${slotIndex}`);

    return { success: true };
}

/**
 * Unassign a hero from a card
 * @param {string} cardId 
 * @param {number} [slotIndex=null]
 * @param {boolean} [force=false] - If true, bypasses fleeing logic (used by system)
 * @returns {{ success: boolean, error?: string, fleeing?: boolean }}
 */
export function unassignHero(cardId, slotIndex = null, force = false) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Phase 2: Fleeing Logic - REMOVED


    if (slotIndex !== null) {
        // Unassign specific slot
        const heroId = card.heroSlots?.[slotIndex] || (slotIndex === 0 ? card.assignedHeroId : null);
        if (!heroId) return { success: false, error: 'NO_HERO_IN_SLOT' };

        delete card.heroSlots[slotIndex];
        if (slotIndex === 0) card.assignedHeroId = null;

        // Redundancy: Remove from stack too
        if (card.stack) {
            card.stack = card.stack.filter(e => !(e.type === 'hero' && e.id === heroId));
        }

        HeroManager.unassignHero(heroId);
        EventBus.publish('hero_unassigned_from_card', { cardId, heroId, slotIndex });
    } else {
        // Unassign ALL heroes (legacy behavior or full clear)
        const heroIds = new Set();
        if (card.assignedHeroId) heroIds.add(card.assignedHeroId);
        if (card.heroSlots) {
            Object.values(card.heroSlots).forEach(id => heroIds.add(id));
        }

        heroIds.forEach(id => {
            HeroManager.unassignHero(id);
            // Redundancy: Remove from stack too
            if (card.stack) {
                card.stack = card.stack.filter(e => !(e.type === 'hero' && e.id === id));
            }
        });

        card.assignedHeroId = null;
        card.heroSlots = {};

        EventBus.publish('hero_unassigned_from_card', { cardId, all: true });
    }

    card.status = 'idle';
    card.progress = 0;

    publishCardUpdate(cardId, { source: 'hero_unassigned' });

    // Phase 9: Handle Transformative Reversion on unassign
    if (card.originalTraits) {
        const hasHeroes = !!card.assignedHeroId || (card.heroSlots && Object.values(card.heroSlots).some(id => id));
        if (!hasHeroes) {
            logger.info('CardManager', `Combat cancelled on transformative card ${card.id} (Hero unassigned). Reverting state.`);
            revertFromCombat(card.id);
            return { success: true };
        }
    }

    // If this was a combat card or an active Area card, reset it fully (enemy HP, etc.)
    if (card.cardType === CARD_TYPES.COMBAT) {
        resetCombatCard(card.id);
    }

    return { success: true };
}

/**
 * Fully unassign everything from a card (heroes and items)
 * @param {string} cardId 
 */
export function unassignAllFromCard(cardId) {
    const card = getCard(cardId);
    if (!card) return;

    // 1. Unassign all heroes
    unassignHero(cardId);

    // 2. Unassign all items (for open input slots)
    if (card.assignedItems) {
        card.assignedItems = {};
        EventBus.publish('item_unassigned_from_slot', { cardId, all: true });
    }
}

// ========================================
// Card Reordering (Drag & Drop)
// ========================================

/**
 * Reorder a card within the active stack by moving it to a new index.
 * Used by the Unified DnD system for drag-and-drop card reordering on the playmat.
 * @param {string} cardId - The card to move
 * @param {number} newIndex - The target index in the active array
 * @returns {{ success: boolean, error?: string }}
 */
export function reorderCard(cardId, newIndex) {
    const cards = GameState.cards.active;
    const oldIndex = cards.findIndex(c => c.id === cardId);

    if (oldIndex === -1) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Clamp newIndex to valid range
    const clampedIndex = Math.max(0, Math.min(newIndex, cards.length - 1));

    if (oldIndex === clampedIndex) {
        return { success: true }; // No-op, already in position
    }

    // Splice out and re-insert
    const [card] = cards.splice(oldIndex, 1);
    cards.splice(clampedIndex, 0, card);

    EventBus.publish('cards_updated', { source: 'reorder' });
    logger.debug('CardManager', `Reordered card "${card.name}" from index ${oldIndex} to ${clampedIndex}`);

    // NEW: Trigger EffectEngine pulse
    effectEngine.pulse();

    return { success: true };
}

/**
 * Returns the first valid cell that doesn't have a card.
 * @returns {{x: number, y: number}|null}
 */
export function findFirstEmptyCell() {
    const state = GameState.state;
    const grid = state.grid;
    const activeCards = state.cards.active;

    // Build a set of occupied cell keys "x,y"
    // We check BOTH the formal position object and the potentially mutated state
    const occupied = new Set();

    for (const c of activeCards) {
        if (c.position && c.position.x !== null) {
            occupied.add(`${c.position.x},${c.position.y}`);
        }
    }

    // Hub center for distance sorting
    const hubPos = grid.hubPosition || grid.center || { x: 0, y: 0 };
    occupied.add(`${hubPos.x},${hubPos.y}`);

    // Iterate through validCells and find the first one not in the set
    if (!grid.validCells) return null;

    // Phase 2 Improvement: Sort available cells by distance from Hub to prevent "strange corner" spawns
    const sortedCells = [...grid.validCells]
        .map(cell => ({
            ...cell,
            distance: Math.sqrt(Math.pow(cell.x - hubPos.x, 2) + Math.pow(cell.y - hubPos.y, 2))
        }))
        .sort((a, b) => a.distance - b.distance);

    for (const cell of sortedCells) {
        if (!occupied.has(`${cell.x},${cell.y}`)) {
            return { x: cell.x, y: cell.y };
        }
    }

    return null;
}

/**
 * Updates a card's 2D position.
 * @param {string} cardId 
 * @param {number} x 
 * @param {number} y 
 */
export function updateCardPosition(cardId, x, y) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    card.position = { x, y };
    card.location = 'board';
    card._rev = (card._rev || 0) + 1;

    // Trigger EffectEngine pulse
    effectEngine.pulse();

    EventBus.publish('cards_updated', { source: 'updateCardPosition', cardId });
    return { success: true };
}

// ========================================
// Card State Updates
// ========================================

/**
 * Update card progress
 * @param {string} cardId 
 * @param {number} amount 
 */
export function updateProgress(cardId, amount) {
    const card = getCard(cardId);
    if (!card) return;

    // Initialize progress to 0 if undefined to prevent NaN
    if (card.progress === undefined || card.progress === null) {
        card.progress = 0;
    }
    card.progress += amount;
}

/**
 * Reset card progress to zero
 * @param {string} cardId 
 */
export function resetProgress(cardId) {
    const card = getCard(cardId);
    if (!card) return;

    card.progress = 0;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Get current card count (excluding unique cards)
 * @returns {number}
 */
export function getCardCount() {
    return GameState.cards.limits.currentCount;
}

/**
 * Get max card limit
 * @returns {number}
 */
export function getCardLimit() {
    return GameState.cards.limits.max;
}

/**
 * Check if we can create more cards
 * @param {string} [cardType] - Optional card type to check. Deck types always return true.
 * @returns {boolean}
 */
export function canCreateCard(cardType = null) {
    if (cardType && isDeckType(cardType)) return true;
    return GameState.cards.limits.currentCount < GameState.cards.limits.max;
}

// ========================================
// Combat Card Functions
// ========================================

/**
 * Reset combat card state for a new battle
 * Called after victory to allow repeating the combat
 * @param {string} cardId 
 * @returns {{ success: boolean, error?: string }}
 */
export function resetCombatCard(cardId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Validate card type (Combat or Area in Questing)
    const isCombat = card.cardType === CARD_TYPES.COMBAT;
    const isActiveArea = false; // Legacy AREA card type removed

    if (!isCombat && !isActiveArea) {
        return { success: false, error: 'NOT_A_COMBAT_CARD' };
    }

    let enemyId = card.enemyId;
    if (isActiveArea && card.enemyGroups) {
        const group = card.enemyGroups[card.currentGroupIndex || 0];
        if (group) {
            enemyId = group.enemyId;
        }
    }

    const enemy = getEnemy(enemyId);
    if (!enemy) {
        return { success: false, error: 'ENEMY_NOT_FOUND' };
    }

    // Reset enemy HP to full
    card.enemyHp = {
        current: enemy.hp,
        max: enemy.hp
    };

    // Reset tick progress
    card.heroTickProgress = 0;
    card.heroTickProcesses = {}; // Multi-hero attack progress
    card.enemyTickProgress = 0;

    // Reset combat state flags
    card.combatState = {
        isHeroConsuming: false,
        lastHeroHit: false,
        lastEnemyHit: false,
        lastHeroDamage: 0,
        lastEnemyDamage: 0
    };

    // Reset card status
    card.status = 'idle';

    logger.info('CardManager', `Reset combat card ${cardId} for new battle`);
    EventBus.publish('combat_card_reset', { cardId });

    return { success: true };
}

export function getActiveCombatCards() {
    return GameState.cards.active.filter(c => {
        const hasHero = c.assignedHeroId || (c.heroSlots && Object.values(c.heroSlots).some(id => !!id));
        if (!hasHero) return false;

        // Regular combat cards
        if (c.cardType === CARD_TYPES.COMBAT) return true;

        // Area cards in questing phase
        if (c.cardType === 'area' && c.phase === 'questing') return true;

        return false;
    });
}

/**
 * Update the selected combat style for a card
 * @param {string} cardId 
 * @param {string} style - 'melee', 'ranged', 'magic'
 * @returns {{ success: boolean, error?: string }}
 */
export function updateCombatStyle(cardId, style) {
    const card = getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    // Validate style
    if (!['melee', 'ranged', 'magic'].includes(style)) {
        return { success: false, error: 'INVALID_STYLE' };
    }

    card.selectedStyle = style;
    // Force a UI refresh by simulating a status update (or just use EventBus if UI listens)
    publishCardUpdate(cardId, { status: card.status });

    return { success: true };
}

/**
 * Restore all persistent modifiers after loading a save
 * (Hero skills, Auras, Environmental bonuses)
 */
export function reapplyAllPersistentModifiers() {
    logger.info('CardManager', 'Re-applying persistent modifiers for all cards');

    // 1. Hero Skills
    for (const card of GameState.cards.active) {
        // Multi-hero slots
        if (card.heroSlots) {
            for (const [slotIndex, heroId] of Object.entries(card.heroSlots)) {
                if (heroId) HeroManager.reapplyHeroModifiers(heroId, card.id);
            }
        }
        // Legacy primary hero
        if (card.assignedHeroId) {
            HeroManager.reapplyHeroModifiers(card.assignedHeroId, card.id);
        }
        // Stack entities
        if (card.stack) {
            for (const entity of card.stack) {
                if (entity.type === 'hero') {
                    HeroManager.reapplyHeroModifiers(entity.id, card.id);
                }
            }
        }
    }

    // 2. Auras and Spatial logic (Tiles, neighboring cards)
    effectEngine.pulse();
}

// --- Initialization Hooks ---

// --- Phase 11: Regional Events & Invasions ---

/**
 * Handle spawning an area event card
 */
export function spawnEventCard(areaId, stage = 1, eventId = null) {
    const eventDef = eventId ? getEventDef(eventId) : getRandomEvent(areaId);
    if (!eventDef) {
        logger.warn('CardManager', `No events found for area "${areaId}"`);
        return null;
    }

    logger.info('CardManager', `Spawning event "${eventDef.name}" (Stage ${stage}) in ${areaId}`);

    const cardData = {
        templateId: `event_${eventDef.id}`,
        name: eventDef.name,
        icon: eventDef.icon || '✨',
        description: eventDef.description,
        cardType: 'event', // Use string literal or constant if available
        status: 'active',
        location: 'board',
        areaId: areaId,
        timeRemainingMs: eventDef.durationMs || 300000,
        traits: [
            { type: 'header' },
            { type: 'expiration', durationMs: eventDef.durationMs },
            ...(eventDef.traits || [])
        ]
    };

    // Create the card (createCard handles positioning)
    const result = createCard(cardData);
    if (result.success) {
        NotificationSystem.info(`New Event: ${eventDef.name}!`);
    }
    return result.card || null;
}

/**
 * Handle spawning an invasion card
 */
export function spawnInvasionCard(areaId, invasionIdOverride = null) {
    // Pick requested invasion, or area-specific default, or generic fallback
    const invasionId = invasionIdOverride ||
        (areaId === 'farmland' ? 'chicken_raid' :
            areaId === 'forest' ? 'wolf_pack_siege' : 'skeleton_onslaught');

    const template = getInvasion(invasionId);
    if (!template) {
        logger.warn('CardManager', `Invasion template "${invasionId}" not found`);
        return null;
    }

    logger.info('CardManager', `Spawning invasion "${template.name}" in ${areaId}`);

    const cardData = {
        templateId: `invasion_${template.id}`,
        name: template.name,
        icon: '⚔️',
        description: template.description,
        cardType: 'invasion',
        status: 'active',
        location: 'board',
        areaId: areaId,
        invasionId: invasionId,
        hordeCount: template.count || 20,
        hordeTotal: template.count || 20,
        enemyId: template.enemyId,
        traits: [
            { type: 'header' },
            { type: 'threat' },
            { type: 'horde' },
            { type: 'heroslot', label: 'Defender', count: 3, slots: [{}, {}, {}] },
            { type: 'combat', enemyId: template.enemyId }
        ]
    };

    const result = createCard(cardData);
    if (result.success) {
        // Set the activeInvasionId in areaState so ThreatSystem knows to grow Threat
        const areaState = GameState.state.areaStates[areaId];
        if (areaState) areaState.activeInvasionId = invasionId;

        NotificationSystem.error(`INVASION: ${template.name}!`);
    }
    return result.card || null;
}

// Re-apply modifiers whenever a game is loaded
EventBus.subscribe('game_loaded', () => {
    reapplyAllPersistentModifiers();
});

// Phase 11: ThreatSystem Subscriptions
EventBus.subscribe('spawn_area_event', (data) => {
    spawnEventCard(data.areaId, data.stage, data.eventId);
});

EventBus.subscribe('spawn_invasion', (data) => {
    spawnInvasionCard(data.areaId, data.invasionId);
});
