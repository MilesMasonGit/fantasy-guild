// Fantasy Guild - Game State
// Phase 5: State Foundation

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';

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
        this.isInitialized = true;
        logger.info('GameState', 'Loaded from save');
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
        for (const card of activeCards) {
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
    }

    /**
     * Update time tracking
     * @param {Partial<Object>} updates 
     */
    updateTime(updates) {
        Object.assign(this.state.time, updates);
    }

    /**
     * Update settings
     * @param {string} category - 'audio', 'gameplay', or 'notifications'
     * @param {Partial<Object>} updates 
     */
    updateSettings(category, updates) {
        if (this.state.settings[category]) {
            Object.assign(this.state.settings[category], updates);
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
    // === Serialization ===
    // ========================================

    /**
     * Serialize state for saving
     * Excludes cached data that can be recalculated
     * @returns {Object}
     */
    serialize() {
        // Clone state but exclude modifiers (recalculated on load)
        const saveState = structuredClone(this.state);
        delete saveState.modifiers;

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
