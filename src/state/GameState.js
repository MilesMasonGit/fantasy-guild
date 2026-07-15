// Fantasy Guild - Game State
// Auditor Pass 1: Efficiency & Intent Alignment

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { getCard as getCardTemplate } from '../config/registries/cardRegistry.js';
import { rehydrateList } from '../utils/RegistryUtils.js';

/**
 * Configuration for save/load stripping to maintain Flyweight efficiency.
 */
const CARD_PROPS_TO_STRIP = [
    'name', 'description', 'icon', 'traits', 'config', 'skill', 'skillRequirement',
    'taskCategory', 'biomeId', 'isUnique', 'baseTickTime', 'baseEnergyCost',
    'toolRequired', 'inputs', 'outputs', 'outputMap', 'xpAwarded', 'rarity',
    '_rev', 'aggregator', 'currentTickTime', 'adjacencyEffects', 'progress', 'slots'
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
        });

        // 3. Heroes (Active & Bench)
        const HM = await import('../systems/hero/HeroManager.js');
        const EM = await import('../systems/equipment/EquipmentManager.js');
        (this.state.heroes || []).forEach(hero => {
            HM.rehydrateHero(hero);
            EM.recalculateEquipmentModifiers(hero);
        });
        (this.state.bench || []).forEach(hero => {
            HM.rehydrateHero(hero);
            EM.recalculateEquipmentModifiers(hero);
        });
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
    get settings() { return this.state?.settings || {}; }
    get heroes() { return this.state?.heroes || []; }
    get bench() { return this.state?.bench || []; }
    get cards() { return this.state?.cards || { active: [], library: [], limits: { currentCount: 0, max: 12 } }; }
    get inventory() { return this.state?.inventory || { items: {} }; }
    get currency() { return this.state?.currency || { gold: 0, influence: 0 }; }
    get progress() { return this.state?.progress || {}; }
    get threats() { return this.state?.threats || { activeInvasions: [] }; }
    get time() { return this.state?.time || { gameTimeMs: 0 }; }
    get library() { return this.state?.library || { tasks: [] }; }
    get collection() { return this.state?.collection || { playsets: {}, packsBought: {} }; }
    get discoveredItems() { return this.state?.collection?.discoveredItems || {}; }
    get discoveredEnemies() { return this.state?.collection?.discoveredEnemies || {}; }
    get itemLifetimeCounts() { return this.state?.collection?.itemLifetimeCounts || {}; }
    get enemyKillCounts() { return this.state?.collection?.enemyKillCounts || {}; }
    get cardUseCounts() { return this.state?.collection?.cardUseCounts || {}; }
    get recruitment() { return this.state?.recruitment || { candidates: [] }; }
    get mapFragments() { return this.state?.mapFragments || {}; }
    get questBoard() { return this.state?.questBoard || null; }
    get ui() { return this.state?.ui || {}; }
    get globalQuests() { return this.state?.globalQuests || []; }
    get areaStates() { return this.state?.areaStates || {}; }
    // Legacy 2D grid accessor — only meaningful with USE_DECK_LOOP off; deleted in Phase 9.
    get grid() { return this.state?.grid || {}; }
    get activeAreaId() { return this.state?.ui?.activeAreaId || 'area_guild_hall'; }

    // ========================================
    // === Deck Loop Accessors (USE_DECK_LOOP, Phase 2 §2A) ===
    // ========================================

    /** The deck slot array for an area (empty array if the area has no state yet). */
    getAreaDeck(areaId) {
        return this.state?.areaStates?.[areaId]?.deckSlots || [];
    }

    /** The deck slot currently executing in an area, or null. Flyweight: resolve template data via cardRegistry. */
    getActiveCardForArea(areaId) {
        const areaState = this.state?.areaStates?.[areaId];
        if (!areaState?.deckSlots?.length) return null;
        return areaState.deckSlots[areaState.activeCardIndex] || null;
    }

    /** The hero object assigned to an area, or null. */
    getHeroForArea(areaId) {
        const heroId = this.state?.areaStates?.[areaId]?.assignedHeroId;
        if (!heroId) return null;
        return (this.state?.heroes || []).find(h => h.id === heroId) || null;
    }

    /**
     * Returns an array of valid empty cells adjacent to a coordinate.
     * Required for placement logic until migrated to GridSystem.
     */
    getValidAdjacentEmptyCells(x, y) {
        const grid = this.state?.grid;
        if (!grid || !grid.validCells) return [];

        const neighbors = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
        const validCellKeys = new Set(grid.validCells.map(c => `${c.x},${c.y}`));
        const occupiedKeys = new Set(
            (this.state?.cards?.active || [])
                .filter(c => c.position && c.position.x !== null)
                .map(c => `${c.position.x},${c.position.y}`)
        );
        const hubPos = grid.hubPosition || grid.center || { x: 0, y: 0 };
        occupiedKeys.add(`${hubPos.x},${hubPos.y}`);

        return neighbors.filter(n => validCellKeys.has(`${n.x},${n.y}`) && !occupiedKeys.has(`${n.x},${n.y}`));
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

    getCardAt(x, y) {
        return this.state?.cards?.active?.find(c => 
            c.position?.x === x && c.position?.y === y
        ) || null;
    }

    cacheCard(card) { this._cardById.set(card.id, card); }
    uncacheCard(id) { this._cardById.delete(id); }

    // ========================================
    // === Write Mutators ===
    // ========================================

    updateMeta(updates) { 
        Object.assign(this.state.meta, updates);
        this.state.meta._rev = (this.state.meta._rev || 0) + 1;
    }

    updateTime(updates) {
        Object.assign(this.state.time, updates);
        this.state.time._rev = (this.state.time._rev || 0) + 1;
    }

    updateSettings(category, updates) {
        if (this.state.settings[category]) {
            Object.assign(this.state.settings[category], updates);
        }
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

        return {
            version: GAME_VERSION,
            savedAt: Date.now(),
            state: saveState
        };
    }
}

export const GameState = new GameStateClass();
