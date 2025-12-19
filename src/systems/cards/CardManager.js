// Fantasy Guild - Card Manager
// Phase 16: Card Stack Management

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getCard as getCardTemplate, rollRarity, CARD_TYPES, CARD_RARITIES } from '../../config/registries/cardRegistry.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { calculateSpeedModifier } from '../effects/EffectProcessor.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { logger } from '../../utils/Logger.js';
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
    } else if (type === CARD_TYPES.EXPLORE || type === CARD_TYPES.AREA) {
        // Explore/Area: insert after all recruit cards
        const lastRecruitIndex = cards.findLastIndex(c => c.cardType === CARD_TYPES.RECRUIT);
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
    const template = getCardTemplate(templateId);
    if (!template) {
        return { success: false, error: 'TEMPLATE_NOT_FOUND' };
    }

    const cards = GameState.cards;

    // Check card limit (unless card is unique)
    if (!template.isUnique && cards.limits.currentCount >= cards.limits.max) {
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

        // Card-specific data from template
        skill: template.skill,
        skillRequirement: template.skillRequirement || 0,
        taskCategory: template.taskCategory || null,  // For category-specific bonuses
        biomeId: template.biomeId || null,
        isUnique: template.isUnique || false,

        // Rarity (rolled at spawn for task and combat cards, null for other types)
        rarity: (template.cardType === CARD_TYPES.TASK || template.cardType === CARD_TYPES.COMBAT) ? rollRarity() : null,

        // Task/Activity data
        baseTickTime: template.baseTickTime || 0,
        baseEnergyCost: template.baseEnergyCost || 0,
        toolRequired: template.toolRequired || null,
        inputs: template.inputs ? [...template.inputs] : [],
        outputs: template.outputs ? [...template.outputs] : [],
        outputMap: template.outputMap || null,
        xpAwarded: template.xpAwarded || 0,

        // Runtime state
        progress: 0,              // Current progress (0 to baseTickTime)
        assignedHeroId: null,     // Hero working on this card
        assignedItems: {},        // Items assigned to open input slots { slotIndex: itemId }
        explorePoints: 0,         // Explore card: points earned (0 to explorePointsRequired)
        status: 'idle',           // 'idle', 'active', 'paused', 'completed'
        createdAt: Date.now(),

        // Optional overrides from options
        ...options.overrides
    };

    // Guild Hall cards get 'basic' rarity (not part of Trade Up - applies to both Task and Combat)
    if (card.biomeId === 'guild_hall' && (card.cardType === CARD_TYPES.TASK || card.cardType === CARD_TYPES.COMBAT)) {
        card.rarity = CARD_RARITIES.BASIC;
    }

    // Apply biome effects if card has a biomeId (from template or override)
    if (card.biomeId && card.cardType === CARD_TYPES.TASK) {
        const biome = getBiome(card.biomeId);

        if (biome && biome.effects && biome.effects.length > 0) {
            // Store original base time before modifications
            const originalBaseTime = template.baseTickTime || 10000;

            // Separate speed effects from completion effects
            const speedEffects = biome.effects.filter(e => e.type === 'speed_skill');
            const completionEffects = biome.effects.filter(e => e.type !== 'speed_skill');

            // Initialize speed metadata
            const speedMetadata = {
                templateBaseTime: originalBaseTime,
                biomeEffects: []
            };

            // Apply speed modifier to baseTickTime
            if (speedEffects.length > 0) {
                const multiplier = calculateSpeedModifier(speedEffects, card.skill);
                card.baseTickTime = Math.round(card.baseTickTime * multiplier);

                // Store metadata for each speed effect
                speedEffects.forEach(effect => {
                    if (effect.skills.includes('all') || effect.skills.includes(card.skill)) {
                        speedMetadata.biomeEffects.push({
                            source: biome.name,
                            type: 'biome',
                            value: effect.bonus
                        });
                    }
                });
            }

            // Store speed metadata on card
            if (speedMetadata.biomeEffects.length > 0) {
                card.speedMetadata = speedMetadata;
            }

            // Store completion effects (output_fail_chance, xp_bonus, etc.)
            if (completionEffects.length > 0) {
                card.sourceEffects = completionEffects;
            }

            // Cache the card modifier for future reference
            card.cachedCardModifier = card.baseTickTime / (template.baseTickTime || 10000);
        }
    }

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

    // Use centralized stack positioning
    addToStack(card);

    // Add to card lookup cache for O(1) lookups
    GameState.cacheCard(card);

    // Update count (unless unique)
    if (!card.isUnique) {
        cards.limits.currentCount++;
    }

    EventBus.publish('card_spawned', {
        cardId: card.id,
        cardType: card.cardType,
        templateId: card.templateId
    });

    // Publish event for card discovery (CardCraftingSystem subscribes to these)
    if (card.cardType === CARD_TYPES.TASK) {
        EventBus.publish('task_card_created', { templateId: card.templateId });
    } else if (card.cardType === CARD_TYPES.COMBAT) {
        EventBus.publish('combat_card_created', { templateId: card.templateId });
    }

    logger.info('CardManager', `Created card "${card.name}" (${card.id})`);
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
 * Get cards assigned to a specific hero
 * @param {string} heroId 
 * @returns {Object|null}
 */
export function getCardByHero(heroId) {
    return GameState.cards.active.find(c => c.assignedHeroId === heroId) || null;
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

    // Remove from active
    cards.active.splice(index, 1);

    // Remove from card lookup cache
    GameState.uncacheCard(cardId);

    // Update count (unless unique)
    if (!card.isUnique) {
        cards.limits.currentCount = Math.max(0, cards.limits.currentCount - 1);
    }

    EventBus.publish('card_discarded', { cardId, templateId: card.templateId });
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
    EventBus.publish('cards_updated', { cardId, status });
    return { success: true };
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

    EventBus.publish('item_assigned_to_slot', { cardId, slotIndex, itemId });
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

        EventBus.publish('item_unassigned_from_slot', { cardId, slotIndex, itemId });
        logger.debug('CardManager', `Unassigned ${itemId} from slot ${slotIndex} on card ${cardId}`);
    }

    return { success: true };
}

// ========================================
// Hero Assignment
// ========================================

/**
 * Assign a hero to a card
 * @param {string} cardId 
 * @param {string} heroId 
 * @returns {{ success: boolean, error?: string }}
 */
export function assignHero(cardId, heroId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Check if card already has a hero assigned
    if (card.assignedHeroId !== null) {
        return { success: false, error: 'CARD_SLOT_OCCUPIED' };
    }

    // Check if hero is already assigned elsewhere
    const existingCard = getCardByHero(heroId);
    if (existingCard) {
        return { success: false, error: 'HERO_ALREADY_ASSIGNED' };
    }

    // Check skill requirement
    const template = getCardTemplate(card.templateId);
    if (template && template.skill && template.skillRequirement > 0) {
        const requirement = { skill: template.skill, level: template.skillRequirement };
        if (!SkillSystem.meetsRequirement(heroId, requirement)) {
            const heroLevel = SkillSystem.getSkillLevel(heroId, template.skill) || 0;
            return {
                success: false,
                error: 'SKILL_REQUIREMENT_NOT_MET',
                required: requirement,
                heroLevel
            };
        }
    }

    // Assign hero - set to 'idle' and let TaskSystem verify resources and activate
    card.assignedHeroId = heroId;
    card.status = 'idle';

    // Set default combat style based on hero's highest skill
    const skills = HeroManager.getHero(heroId)?.skills;
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

    EventBus.publish('hero_assigned_to_card', { cardId, heroId });
    logger.info('CardManager', `Hero ${heroId} assigned to card ${cardId}`);

    return { success: true };
}

/**
 * Unassign a hero from a card
 * @param {string} cardId 
 * @returns {{ success: boolean, error?: string }}
 */
export function unassignHero(cardId) {
    const card = getCard(cardId);
    if (!card) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    if (card.assignedHeroId === null) {
        return { success: false, error: 'NO_HERO_ASSIGNED' };
    }

    const heroId = card.assignedHeroId;
    card.assignedHeroId = null;
    card.status = 'idle';

    // Reset progress when hero is removed
    card.progress = 0;

    // Reset hero status to idle
    HeroManager.unassignHero(heroId);

    // If this was a combat card or an active Area card, reset it fully (enemy HP, etc.)
    if (card.cardType === CARD_TYPES.COMBAT || (card.cardType === CARD_TYPES.AREA && card.phase === 'questing')) {
        resetCombatCard(card.id);
    }

    EventBus.publish('hero_unassigned_from_card', { cardId, heroId });
    logger.info('CardManager', `Hero ${heroId} unassigned from card ${cardId}`);

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
 * @returns {boolean}
 */
export function canCreateCard() {
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
    const isActiveArea = card.cardType === CARD_TYPES.AREA && card.phase === 'questing';

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
    return GameState.cards.active.filter(
        c => c.cardType === CARD_TYPES.COMBAT && c.assignedHeroId
    );
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
    EventBus.publish('cards_updated', { cardId, status: card.status });

    return { success: true };
}
