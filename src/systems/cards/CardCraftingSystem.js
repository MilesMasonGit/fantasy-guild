// Fantasy Guild - Card Crafting System
// Manages the card library and crafting from discovered Tasks and Combat cards

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from './CardManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getCard, CARD_TYPES, CARD_RARITIES } from '../../config/registries/cardRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * CardCraftingSystem - Tracks discovered cards (Tasks + Combat) and enables crafting
 * 
 * Responsibilities:
 * - Track discovered templateIds in library.tasks (includes both Task and Combat)
 * - O(1) lookups via Set cache
 * - Craft new Cards with Guild Hall biome and Basic rarity
 */

// Runtime Set cache for O(1) discovery checks (not persisted)
// Named 'discoveredCache' but backwards compatible with 'library.tasks' storage
let discoveredCache = new Set();

const CardCraftingSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the system and cache
     * Called on game start/load
     */
    init() {
        if (this.initialized) return;

        // Initialize library if missing (save migration)
        if (!GameState.library) {
            GameState.library = { tasks: [] };
        }

        // Build Set cache from persisted array
        discoveredCache = new Set(GameState.library.tasks);

        // Subscribe to card creation events for auto-discovery (both Task and Combat)
        EventBus.subscribe('task_card_created', ({ templateId }) => {
            this.discoverCard(templateId);
        });
        EventBus.subscribe('combat_card_created', ({ templateId }) => {
            this.discoverCard(templateId);
        });

        this.initialized = true;
        logger.info('CardCraftingSystem', `Initialized with ${discoveredCache.size} discovered cards`);
    },

    /**
     * Rebuild cache (call after save load)
     */
    rebuildCache() {
        if (GameState.library?.tasks) {
            discoveredCache = new Set(GameState.library.tasks);
        } else {
            discoveredCache = new Set();
        }
        logger.debug('CardCraftingSystem', `Cache rebuilt with ${discoveredCache.size} cards`);
    },

    /**
     * Check if a card (Task or Combat) is discovered (O(1))
     * @param {string} templateId - Template ID
     * @returns {boolean}
     */
    isDiscovered(templateId) {
        return discoveredCache.has(templateId);
    },

    /**
     * Discover a new card (Task or Combat) - add to library
     * @param {string} templateId - Template ID to discover
     * @returns {boolean} True if newly discovered, false if already known
     */
    discoverCard(templateId) {
        // Already discovered
        if (discoveredCache.has(templateId)) {
            return false;
        }

        // Add to persistent array and cache
        if (!GameState.library) {
            GameState.library = { tasks: [] };
        }
        GameState.library.tasks.push(templateId);
        discoveredCache.add(templateId);

        // Get card info for notification
        const template = getCard(templateId);
        const cardName = template?.name || templateId;
        const isCombat = template?.cardType === CARD_TYPES.COMBAT;
        const icon = isCombat ? '⚔️' : '📖';

        NotificationSystem.notify(`${icon} New ${isCombat ? 'combat' : 'task'} discovered: ${cardName}!`, 'info');
        EventBus.publish('card_discovered', { templateId, cardName, cardType: template?.cardType });

        logger.info('CardCraftingSystem', `Discovered new ${isCombat ? 'combat' : 'task'}: ${templateId}`);
        return true;
    },

    /**
     * @deprecated Use discoverCard instead
     */
    discoverTask(taskId) {
        return this.discoverCard(taskId);
    },

    /**
     * Get all discovered cards (Tasks and Combat) with their template data
     * @param {Object} options - Sorting/filtering options
     * @param {string} options.sortBy - 'name', 'skill', 'category', 'type'
     * @param {string} options.filter - Filter string for search
     * @param {string} options.cardType - 'task', 'combat', or null for all
     * @returns {Array} Array of card templates
     */
    getDiscoveredCards(options = {}) {
        const { sortBy = 'name', filter = '', cardType = null } = options;
        const filterLower = filter.toLowerCase();

        // Get templates for all discovered cards
        let cards = GameState.library?.tasks
            ?.map(templateId => getCard(templateId))
            .filter(t => t !== null) || [];

        // Filter by card type if specified
        if (cardType) {
            cards = cards.filter(c => c.cardType === cardType);
        }

        // Apply search filter
        if (filterLower) {
            cards = cards.filter(t =>
                t.name.toLowerCase().includes(filterLower) ||
                t.skill?.toLowerCase().includes(filterLower) ||
                t.taskCategory?.toLowerCase().includes(filterLower) ||
                t.cardType?.toLowerCase().includes(filterLower)
            );
        }

        // Sort
        switch (sortBy) {
            case 'skill':
                cards.sort((a, b) => (a.skill || '').localeCompare(b.skill || ''));
                break;
            case 'category':
                cards.sort((a, b) => (a.taskCategory || '').localeCompare(b.taskCategory || ''));
                break;
            case 'type':
                cards.sort((a, b) => (a.cardType || '').localeCompare(b.cardType || ''));
                break;
            case 'name':
            default:
                cards.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return cards;
    },

    /**
     * @deprecated Use getDiscoveredCards instead
     */
    getDiscoveredTasks(options = {}) {
        return this.getDiscoveredCards({ ...options, cardType: CARD_TYPES.TASK });
    },

    /**
     * Get count of discovered cards (Tasks + Combat)
     * @returns {number}
     */
    getDiscoveredCount() {
        return discoveredCache.size;
    },

    /**
     * Check if player can craft a new card
     * @returns {{ canCraft: boolean, reason?: string }}
     */
    canCraft() {
        const currentCount = GameState.cards?.limits?.currentCount || 0;
        const maxCards = GameState.cards?.limits?.max || 10;

        if (currentCount >= maxCards) {
            return { canCraft: false, reason: 'Card limit reached' };
        }

        return { canCraft: true };
    },

    /**
     * Craft a new Card (Task or Combat) from a discovered template
     * @param {string} templateId - Template ID to craft
     * @returns {{ success: boolean, card?: Object, error?: string }}
     */
    craftCard(templateId) {
        // Check if card is discovered
        if (!this.isDiscovered(templateId)) {
            return { success: false, error: 'CARD_NOT_DISCOVERED' };
        }

        // Check card limit
        const craftCheck = this.canCraft();
        if (!craftCheck.canCraft) {
            return { success: false, error: 'CARD_LIMIT_REACHED' };
        }

        // Create card with Guild Hall biome and Basic rarity
        const result = CardManager.createCard(templateId, {
            overrides: {
                biomeId: 'guild_hall',
                modifierId: null,       // No modifier for crafted cards
                rarity: CARD_RARITIES.BASIC,
                isCrafted: true         // Mark as crafted for future reference
            }
        });

        if (result.success) {
            const template = getCard(templateId);
            const isCombat = template?.cardType === CARD_TYPES.COMBAT;
            NotificationSystem.notify(`✨ Crafted: ${template?.name || templateId}`, 'success');
            EventBus.publish('card_crafted', {
                cardId: result.card.id,
                templateId,
                cardType: template?.cardType
            });
            logger.info('CardCraftingSystem', `Crafted ${isCombat ? 'combat' : 'task'} card: ${templateId}`);
        }

        return result;
    }
};

export { CardCraftingSystem };
