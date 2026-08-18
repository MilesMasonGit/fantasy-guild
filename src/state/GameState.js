// Fantasy Guild - Game State
// Auditor Pass 1: Efficiency & Intent Alignment

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { getCard as getCardTemplate } from '../config/registries/cardRegistry.js';
import { rehydrateList } from '../utils/RegistryUtils.js';
import { deriveCardTags } from '../config/registries/tagRegistry.js';

/**
 * Configuration for save/load stripping to maintain Flyweight efficiency.
 */
const CARD_PROPS_TO_STRIP = [
    'name', 'description', 'icon', 'traits', 'config', 'skill', 'skillRequirement',
    'taskCategory', 'biomeId', 'isUnique', 'baseTickTime', 'baseEnergyCost',
    'toolRequired', 'inputs', 'outputs', 'outputMap', 'xpAwarded', 'rarity',
    '_rev', 'aggregator', 'currentTickTime', 'adjacencyEffects', 'progress', 'slots',
    // Tags are derived from the template (§15.4), never authored per instance,
    // so persisting them would just freeze a stale copy. Re-derived on load.
    'tags'
];

/**
 * GameState - Central "Clean Vault" for game data.
 */
class GameStateClass {
    constructor() {
        this.state = null;
        this.isInitialized = false;
        this._cardById = new Map();
    }

    initNew() {
        this.state = createInitialState();
        this.isInitialized = true;
        logger.info('GameState', 'Fresh initialization complete.');
    }

    async initFromSave(savedState) {
        this.state = savedState;
        await this._rehydrateAll();
        this.rebuildCardCache();
        this.isInitialized = true;
        logger.info('GameState', 'Save rehydration complete.');
    }

    /**
     * Unified rehydration flow
     */
    async _rehydrateAll() {
        if (!this.state) return;

        // 1. Cards (Active & Library)
        rehydrateList(this.state.cards?.active, getCardTemplate);
        rehydrateList(this.state.cards?.library, getCardTemplate);

        // 2. Clear and rebuild aggregators (rehydration setup)
        const allCards = [...(this.state.cards?.active || []), ...(this.state.cards?.library || [])];
        allCards.forEach(card => {
            card.aggregator = new ModifierAggregator(card.id);
            // Tags are stripped on save; re-derive from the template (§15.4).
            card.tags = deriveCardTags(card._template || getCardTemplate(card.templateId));
        });

        // 3. Heroes
        const HM = await import('../systems/hero/HeroManager.js');
        const EM = await import('../systems/equipment/EquipmentManager.js');
        (this.state.heroes || []).forEach(hero => {
            HM.rehydrateHero(hero);
            EM.recalculateEquipmentModifiers(hero);
        });

        // 4. Quests
        if (!this.state.quests) {
            this.state.quests = {
                active: [],
                tutorialStep: 0,
                nextQuestAt: Date.now() + 3600000
            };
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
    // === Core Accessors ===
    // ========================================

    get meta() { return this.state?.meta || {}; }
    get heroes() { return this.state?.heroes || []; }
    get cards() { return this.state?.cards || { idCounter: 1 }; }
    get inventory() { return this.state?.inventory || { items: {} }; }
    get currency() { return this.state?.currency || { gold: 0, influence: 0 }; }
    get progress() { return this.state?.progress || {}; }
    get time() { return this.state?.time || { gameTimeMs: 0 }; }
    get collection() { return this.state?.collection || { playsets: {} }; }
    get discoveredItems() { return this.state?.collection?.discoveredItems || {}; }
    get discoveredEnemies() { return this.state?.collection?.discoveredEnemies || {}; }
    get itemLifetimeCounts() { return this.state?.collection?.itemLifetimeCounts || {}; }
    get enemyKillCounts() { return this.state?.collection?.enemyKillCounts || {}; }
    get cardUseCounts() { return this.state?.collection?.cardUseCounts || {}; }
    get recruitment() { return this.state?.recruitment || { candidates: [] }; }
    get questBoard() { return this.state?.questBoard || null; }
    get quests() { return this.state?.quests || { active: [], tutorialStep: 0, nextQuestAt: null }; }
    get ui() { return this.state?.ui || {}; }
    // The board (7×7 playmat). Selectors receive THIS object, not `state`, so a
    // top-level slice is unreachable from the UI without a getter here — which
    // is why the retired `areaStates` / `outposts` / `playmatOrder` getters had
    // to exist too, and why they go with their systems.
    get board() { return this.state?.board || { tiles: {}, tokenBank: {}, tray: [] }; }

    // ========================================
    // === Board Accessors (Phase 2) ===
    // ========================================

    /** The Token instance on a tile, or null. Tile 0 is valid — `== null` checks only. */
    getTile(index) {
        return this.state?.board?.tiles?.[index] || null;
    }

    /** The hero working a tile, or null. */
    getHeroOnTile(index) {
        const heroId = this.state?.board?.tiles?.[index]?.heroId;
        if (!heroId) return null;
        return (this.state?.heroes || []).find(h => h.id === heroId) || null;
    }

    // ========================================
    // === Card Cache Management ===
    // ========================================

    rebuildCardCache() {
        this._cardById.clear();
        const allCards = [...(this.state?.cards?.active || []), ...(this.state?.cards?.library || [])];
        allCards.forEach(card => this._cardById.set(card.id, card));
        logger.debug('GameState', `Cache rebuilt: ${this._cardById.size} cards.`);
    }

    getCardById(id) { return this._cardById.get(id) || null; }

    cacheCard(card) { this._cardById.set(card.id, card); }
    uncacheCard(id) { this._cardById.delete(id); }

    // ========================================
    // === Write Mutators ===
    // ========================================

    updateTime(updates) {
        Object.assign(this.state.time, updates);
        this.state.time._rev = (this.state.time._rev || 0) + 1;
    }


    // ========================================
    // === Persistence Flow ===
    // ========================================

    /**
     * Serialize state for saving (Flyweight protocol)
     */
    serialize() {
        const saveState = structuredClone(this.state);

        const allCards = [...(saveState.cards?.active || []), ...(saveState.cards?.library || [])];
        allCards.forEach(card => {
            CARD_PROPS_TO_STRIP.forEach(prop => delete card[prop]);
        });

        const savedAt = Date.now();
        saveState.meta.lastSavedAt = savedAt;
        return {
            version: GAME_VERSION,
            savedAt,
            state: saveState
        };
    }
}

export const GameState = new GameStateClass();
