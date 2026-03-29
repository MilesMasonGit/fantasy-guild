// Fantasy Guild - Game State
// Phase 5: State Foundation

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';

import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { getCard as getCardTemplate } from '../config/registries/cardRegistry.js';
import { ensureModular } from '../systems/cards/CardAssembler.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';

/**
 * Static card properties that come from the template registry.
 * These are stripped on save and re-attached from the registry on load.
 */
const STATIC_CARD_PROPS = [
    'name', 'description', 'icon', 'traits', 'config',
    'skill', 'skillRequirement', 'taskCategory', 'biomeId', 'isUnique',
    'baseTickTime', 'baseEnergyCost', 'toolRequired',
    'inputs', 'outputs', 'outputMap', 'xpAwarded',
    'hordeCount', 'hordeTotal', 'regionId', 'selectedBiomeId',
    'rarity',
];

/**
 * Volatile card properties that are recalculated on load.
 * These are stripped on save.
 */
const VOLATILE_CARD_PROPS = [
    '_rev', 'aggregator', 'currentTickTime', 'adjacencyEffects',
    'progress', 'slots',
];

/**
 * GameState - Central state container for all game data
 * 
 * This is the single source of truth for game state.
 * Systems read from and write to this object.
 * UI reads from this object (never writes directly).
 */
class GameStateClass {
    constructor() {
        this.state = null;
        this.isInitialized = false;
    }

    /**
     * Initialize with a fresh new game state
     */
    initNew() {
        this.state = createInitialState();
        this.isInitialized = true;
        logger.info('GameState', 'Initialized new game');
    }

    /**
     * Initialize from loaded save data
     * @param {Object} savedState - State from save file
     */
    initFromSave(savedState) {
        this.state = savedState;

        // Rehydrate cards from the CardRegistry (re-attach static template data)
        this._rehydrateCards();

        // Rehydrate aggregators for all entities
        this.rehydrateAggregators();

        // Rebuild the card lookup cache
        this.rebuildCardCache();

        this.isInitialized = true;
        logger.info('GameState', 'Loaded from save and rehydrated');
    }

    /**
     * Rehydrate all cards from the CardRegistry.
     * Re-attaches static template data that was stripped during flyweight serialization.
     */
    _rehydrateCards() {
        const cardLists = [
            this.state.cards?.active,
            this.state.cards?.library,
        ].filter(Boolean);

        let rehydratedCount = 0;

        for (const list of cardLists) {
            for (let i = 0; i < list.length; i++) {
                const card = list[i];
                const templateId = card.templateId;
                if (!templateId) {
                    logger.warn('GameState', `Card ${card.id} missing templateId, skipping rehydration`);
                    continue;
                }

                const template = getCardTemplate(templateId);
                if (!template) {
                    logger.warn('GameState', `Template not found for ${templateId}, card ${card.id} may be broken`);
                    continue;
                }

                // Re-attach all static properties from the template
                card.name = template.name;
                card.description = template.description || '';
                card.icon = template.icon || '📜';
                card.cardType = card.cardType || template.cardType;
                card.skill = template.skill || template.config?.skill;
                card.skillRequirement = template.skillRequirement || template.config?.skillRequirement || 0;
                card.taskCategory = template.taskCategory || template.config?.taskCategory || null;
                card.biomeId = template.biomeId || template.config?.biomeId || null;
                card.isUnique = template.isUnique || false;
                card.baseTickTime = template.baseTickTime || template.config?.baseTickTime || 0;
                card.baseEnergyCost = template.baseEnergyCost || template.config?.baseEnergyCost || 0;
                card.toolRequired = template.toolRequired || template.config?.toolRequired || null;
                card.inputs = Array.isArray(template.inputs) ? [...template.inputs] : (Array.isArray(template.config?.inputs) ? [...template.config.inputs] : []);
                card.outputs = Array.isArray(template.outputs) ? [...template.outputs] : (Array.isArray(template.config?.outputs) ? [...template.config.outputs] : []);
                card.outputMap = template.outputMap || null;
                card.xpAwarded = template.xpAwarded || 0;
                card.config = template.config ? JSON.parse(JSON.stringify(template.config)) : null;
                card.rarity = null;

                // Re-generate traits from template
                card.traits = template.traits ? JSON.parse(JSON.stringify(template.traits)) : null;
                ensureModular(card, template);

                // Reset volatile runtime state
                card.progress = card.progress || 0;
                card.aggregator = new ModifierAggregator(card.id);
                card._rev = 0;

                rehydratedCount++;
            }
        }

        if (rehydratedCount > 0) {
            logger.info('GameState', `Rehydrated ${rehydratedCount} cards from CardRegistry`);
        }
    }

    /**
     * Restore ModifierAggregator instances for all cards and heroes
     */
    rehydrateAggregators() {
        if (!this.state) return;

        const activeCards = this.state.cards?.active || [];
        const libraryCards = this.state.cards?.library || [];
        const heroes = this.state.heroes || [];

        const entities = [...activeCards, ...libraryCards, ...heroes];
        let count = 0;

        for (const entity of entities) {
            if (entity.aggregator) {
                entity.aggregator = new ModifierAggregator(entity.id);
                count++;
            }
        }

        if (count > 0) {
            logger.info('GameState', `Rehydrated ${count} aggregators`);
        }
    }

    /**
     * Check if state is initialized
     * @returns {boolean}
     */
    getIsInitialized() {
        return this.isInitialized;
    }

    // ========================================
    // === State Accessors (Read) ===
    // ========================================

    /** @returns {Object} Meta information */
    get meta() { return this.state?.meta; }

    /** @returns {Object} Game settings */
    get settings() { return this.state?.settings; }

    /** @returns {Array} Hero array */
    get heroes() { return this.state?.heroes || []; }

    /** @returns {Array} Bench array */
    get bench() { return this.state?.bench || []; }

    /** @returns {Object} Cards data */
    get cards() { return this.state?.cards; }

    /** @returns {Object} Inventory data */
    get inventory() { return this.state?.inventory; }

    /** @returns {Object} Currency data */
    get currency() { return this.state?.currency; }

    /** @returns {Object} Progress data */
    get progress() { return this.state?.progress; }

    /** @returns {Object} Threat data */
    get threats() { return this.state?.threats; }

    /** @returns {Object} Time data */
    get time() { return this.state?.time; }

    /** @returns {Object} Cached modifiers */
    get modifiers() { return this.state?.modifiers; }

    /** @returns {Object} Library data (discovered tasks) */
    get library() { return this.state?.library; }

    /** @returns {Object} Collection data (playsets, mastery, unlocked areas) */
    get collection() { return this.state?.collection; }

    /** @returns {Object} Discovered items map */
    get discoveredItems() { return this.state?.collection?.discoveredItems || {}; }

    /** @returns {Object} Discovered enemies map */
    get discoveredEnemies() { return this.state?.collection?.discoveredEnemies || {}; }

    /** @returns {Object} Item lifetime acquisition counts */
    get itemLifetimeCounts() { return this.state?.collection?.itemLifetimeCounts || {}; }

    /** @returns {Object} Enemy kill counts */
    get enemyKillCounts() { return this.state?.collection?.enemyKillCounts || {}; }

    /** @returns {Object} Map fragments progress per area */
    get mapFragments() { return this.state?.mapFragments; }

    /** @returns {Object} UI state (activeAreaId, etc.) */
    get ui() { return this.state?.ui; }

    /** @returns {Array} Global list of active quests */
    get globalQuests() { return this.state?.globalQuests; }

    /** @returns {Object} Per-area hibernation data */
    get areaStates() { return this.state?.areaStates; }

    /** @returns {Object} Grid configuration and valid cells */
    get grid() { return this.state?.grid; }

    /** @returns {string} Currently active biome ID (convenience getter) */
    get activeAreaId() { return this.state?.ui?.activeAreaId || 'guild_hall_v1'; }

    // ========================================
    // === Card Lookup Cache (O(1) lookups) ===
    // ========================================

    /** Runtime Map for instant card lookups (not persisted) */
    _cardById = new Map();

    /**
     * Rebuild the card lookup cache from active cards
     * Call this after loading a save or modifying the cards array
     */
    rebuildCardCache() {
        this._cardById.clear();
        const activeCards = this.state?.cards?.active || [];
        const libraryCards = this.state?.cards?.library || [];
        for (const card of [...activeCards, ...libraryCards]) {
            this._cardById.set(card.id, card);
        }
        logger.debug('GameState', `Card cache rebuilt with ${this._cardById.size} cards`);
    }

    /**
     * Get a card by ID instantly (O(1))
     * @param {string} cardId 
     * @returns {Object|null}
     */
    getCardById(cardId) {
        return this._cardById.get(cardId) || null;
    }

    /**
     * Get a card by its grid coordinates.
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null}
     */
    getCardAt(x, y) {
        return this.state.cards.active.find(c =>
            c.position && c.position.x === x && c.position.y === y
        ) || null;
    }

    /**
     * Returns an array of valid empty cells adjacent to a coordinate.
     * @param {number} x 
     * @param {number} y 
     * @returns {Array<{x: number, y: number}>}
     */
    getValidAdjacentEmptyCells(x, y) {
        const grid = this.state.grid;
        if (!grid || !grid.validCells) return [];

        const neighbors = [
            { x: x + 1, y }, { x: x - 1, y },
            { x, y: y + 1 }, { x, y: y - 1 }
        ];

        const validCellKeys = new Set(grid.validCells.map(c => `${c.x},${c.y}`));
        const occupiedKeys = new Set(
            this.state.cards.active
                .filter(c => c.position && c.position.x !== null)
                .map(c => `${c.position.x},${c.position.y}`)
        );
        // Also the Hub
        const hubPos = grid.hubPosition || grid.center || { x: 0, y: 0 };
        occupiedKeys.add(`${hubPos.x},${hubPos.y}`);

        return neighbors.filter(n =>
            validCellKeys.has(`${n.x},${n.y}`) && !occupiedKeys.has(`${n.x},${n.y}`)
        );
    }

    /**
     * Add a card to the cache
     * @param {Object} card 
     */
    cacheCard(card) {
        this._cardById.set(card.id, card);
    }

    /**
     * Remove a card from the cache
     * @param {string} cardId 
     */
    uncacheCard(cardId) {
        this._cardById.delete(cardId);
    }

    // ========================================
    // === State Mutators (Write) ===
    // ========================================

    /**
     * Update meta information
     * @param {Partial<Object>} updates 
     */
    updateMeta(updates) {
        Object.assign(this.state.meta, updates);
        this.state.meta._rev = (this.state.meta._rev || 0) + 1;
    }

    /**
     * Update time tracking
     * @param {Partial<Object>} updates 
     */
    updateTime(updates) {
        Object.assign(this.state.time, updates);
        this.state.time._rev = (this.state.time._rev || 0) + 1;
    }

    /**
     * Update settings
     * @param {string} category - 'audio', 'gameplay', or 'notifications'
     * @param {Partial<Object>} updates 
     */
    updateSettings(category, updates) {
        if (this.state.settings[category]) {
            Object.assign(this.state.settings[category], updates);
            this.state.settings._rev = (this.state.settings._rev || 0) + 1;
        }
    }

    /**
     * Set modifier cache
     * @param {Object} modifiers 
     */
    setModifiers(modifiers) {
        this.state.modifiers = modifiers;
    }

    // ========================================
    // === Grid Mutators ===
    // ========================================

    /**
     * Expand the current grid dimensions if they are below the hard cap (12x12).
     * @param {number} newWidth 
     * @param {number} newHeight 
     */
    expandGrid(newWidth, newHeight) {
        const grid = this.state.grid;
        if (!grid) return;

        grid.width = Math.min(Math.max(grid.width, newWidth), grid.max_width || 12);
        grid.height = Math.min(Math.max(grid.height, newHeight), grid.max_height || 12);

        grid._rev = (grid._rev || 0) + 1;
        this.EventBus.publish('state_changed', { source: 'grid_expanded' });
    }

    /**
     * Unlock specific cells in the current area.
     * @param {Array<{x: number, y: number}>} cells - Array of coordinates to unlock
     */
    unlockCells(cells) {
        const grid = this.state.grid;
        if (!grid || !grid.validCells) return;

        const currentAreaId = this.state.ui.activeAreaId;
        const areaState = this.state.areaStates[currentAreaId];

        const existingKeys = new Set(grid.validCells.map(c => `${c.x},${c.y}`));
        let added = false;

        for (const cell of cells) {
            // Respect hard cap bounds
            if (cell.x < 0 || cell.x >= 12 || cell.y < 0 || cell.y >= 12) continue;

            const key = `${cell.x},${cell.y}`;
            if (!existingKeys.has(key)) {
                grid.validCells.push({ x: cell.x, y: cell.y });
                existingKeys.add(key);
                added = true;
            }
        }

        if (added) {
            // Update the persistent areaState as well so it survives biome switching
            if (areaState) {
                areaState.validCells = [...grid.validCells];
            }
            grid._rev = (grid._rev || 0) + 1;
            this.EventBus.publish('state_changed', { source: 'cells_unlocked' });
        }
    }

    // ========================================
    // === Serialization ===
    // ========================================

    /**
     * Serialize state for saving
     * Excludes cached data that can be recalculated
     * @returns {Object}
     */
    serialize() {
        // Clone state
        const saveState = structuredClone(this.state);
        delete saveState.modifiers;

        // Strip static and volatile data from cards (Flyweight protocol)
        const cardLists = [
            saveState.cards?.active,
            saveState.cards?.library,
        ].filter(Boolean);

        for (const list of cardLists) {
            for (let i = 0; i < list.length; i++) {
                const card = list[i];

                // Remove static template properties (will be rehydrated from registry on load)
                for (const prop of STATIC_CARD_PROPS) {
                    delete card[prop];
                }

                // Remove volatile runtime properties (will be recalculated)
                for (const prop of VOLATILE_CARD_PROPS) {
                    delete card[prop];
                }
            }
        }

        return {
            version: GAME_VERSION,
            savedAt: Date.now(),
            state: saveState
        };
    }

    /**
     * Get raw state (for debugging)
     * @returns {Object}
     */
    getRawState() {
        return this.state;
    }
}

// Export singleton instance
export const GameState = new GameStateClass();
