// Fantasy Guild - Game State
// Auditor Pass 1: Efficiency & Intent Alignment

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';

/**
 * Runtime scratch that is left out of the save (CR2-023).
 *
 * ⚠️ **Every entry here must be something `rehydrateHero` rebuilds
 * unconditionally on load** — a field stripped but not rebuilt is silent data
 * loss. Each was checked against `HeroRehydration.rehydrateHero` before being
 * added:
 *   aggregator  → replaced with `new ModifierAggregator(hero.id)` every load,
 *                 so whatever was saved was already discarded.
 *   className   → recomputed from `isVillager`.
 *   traitName   → set to '' (classes and traits are retired).
 *   level       → recomputed by `calculateHeroLevel(hero.skills)`.
 *   _rev        → a UI change counter, incremented on load.
 *
 * `hp`, `equipment`, `statuses`, `spriteId` and `icon` are deliberately NOT
 * here: rehydration only fills those in when they are missing, so the saved
 * value is the real one.
 */
const HERO_PROPS_TO_STRIP = ['aggregator', 'className', 'traitName', 'level', '_rev'];

/**
 * GameState - Central "Clean Vault" for game data.
 */
class GameStateClass {
    constructor() {
        this.state = null;
        this.isInitialized = false;
    }

    initNew() {
        this.state = createInitialState();
        this.isInitialized = true;
        logger.info('GameState', 'Fresh initialization complete.');
    }

    async initFromSave(savedState) {
        this.state = savedState;
        await this._rehydrateAll();
        this.isInitialized = true;
        logger.info('GameState', 'Save rehydration complete.');
    }

    /**
     * Unified rehydration flow
     */
    async _rehydrateAll() {
        if (!this.state) return;

        // Card rehydration removed with the card retirement (2026-08-18).
        // It walked `state.cards.active` / `.library`, which StateSchema no
        // longer declares — `state.cards` holds only `idCounter` — so both
        // loops iterated nothing and the flyweight strip/re-derive pass was a
        // no-op at runtime.

        // Heroes
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
                completedTutorials: [],
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
    get inventory() { return this.state?.inventory || { items: {} }; }
    get currency() { return this.state?.currency || { gold: 0 }; }
    get progress() { return this.state?.progress || {}; }
    get time() { return this.state?.time || { gameTimeMs: 0 }; }
    get collection() { return this.state?.collection || { playsets: {} }; }
    get discoveredItems() { return this.state?.collection?.discoveredItems || {}; }
    get discoveredEnemies() { return this.state?.collection?.discoveredEnemies || {}; }
    get itemLifetimeCounts() { return this.state?.collection?.itemLifetimeCounts || {}; }
    get enemyKillCounts() { return this.state?.collection?.enemyKillCounts || {}; }
    get cardUseCounts() { return this.state?.collection?.cardUseCounts || {}; }
    get recruitment() { return this.state?.recruitment || { candidates: [] }; }
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

    // The card lookup cache (`_cardById`, `rebuildCardCache`, `getCardById`,
    // `cacheCard`, `uncacheCard`) was deleted on 2026-08-24 (CR2-013). It read
    // `state.cards.active` / `.library`, which StateSchema stopped declaring
    // with the card retirement, so it always rebuilt to zero entries and every
    // lookup returned null. Nothing outside this file ever called it.

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

        // The flyweight strip pass that used to run here walked
        // `cards.active` / `cards.library`, which no longer exist. Removed
        // with the card retirement (2026-08-18).

        // Heroes are saved whole, minus the runtime scratch below (CR2-023).
        for (const hero of saveState.heroes || []) {
            for (const prop of HERO_PROPS_TO_STRIP) delete hero[prop];
        }

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
