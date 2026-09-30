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
                // B6.1: quests run on the game-time `clockMs`, not the wall clock.
                clockMs: 0,
                nextQuestAt: null
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
    get board() { return this.state?.board || { tiles: {} }; }

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

    /**
     * The save as a JSON string, byte for byte `JSON.stringify(this.serialize())`
     * but without deep-copying the whole state first (CR3-109).
     *
     * A `stringify` replacer does the two things `serialize()` does to its copy,
     * on the way out, and never touches the live state:
     * - each hero is written as a shallow copy without `HERO_PROPS_TO_STRIP`
     *   (a copy with keys deleted keeps the others in their order, as the
     *   deep copy did);
     * - `meta` is written with `lastSavedAt` set (in place if it is already
     *   there, last if not, as an assignment to the copy did).
     * Only the top-level `state.heroes` and `state.meta` are rewritten: the
     * replacer checks its holder is the state itself.
     *
     * `SaveBytesIdentical.test.js` compares the two on S2- and S3-shaped boards.
     * @returns {string}
     */
    serializeJson() {
        const state = this.state;
        const savedAt = Date.now();
        const replacer = function (key, value) {
            if (this !== state) return value;
            if (key === 'heroes' && Array.isArray(value)) {
                return value.map(hero => {
                    const out = { ...hero };
                    for (const prop of HERO_PROPS_TO_STRIP) delete out[prop];
                    return out;
                });
            }
            if (key === 'meta') return { ...value, lastSavedAt: savedAt };
            return value;
        };
        return JSON.stringify({ version: GAME_VERSION, savedAt, state }, replacer);
    }
}

export const GameState = new GameStateClass();
