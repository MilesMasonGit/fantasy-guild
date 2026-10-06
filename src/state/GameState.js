// Fantasy Guild - Game State

import { createInitialState, GAME_VERSION } from './StateSchema.js';
import { logger } from '../utils/Logger.js';

/**
 * Runtime scratch left out of the save.
 *
 * ⚠️ Every entry must be something `rehydrateHero` rebuilds unconditionally on
 * load; a field stripped but not rebuilt is silent data loss. `hp`, `equipment`,
 * `statuses`, `spriteId` and `icon` are NOT here: rehydration only fills those
 * in when missing, so the saved value is the real one.
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

        // ⚠️ Keep these two imports dynamic: HeroManager and EquipmentManager
        // (through the modules they import) import this one back, and static
        // imports re-form the import cycle `npm run cycles` guards.
        const HM = await import('../systems/hero/HeroManager.js');
        const EM = await import('../systems/equipment/EquipmentManager.js');
        (this.state.heroes || []).forEach(hero => {
            HM.rehydrateHero(hero);
            EM.recalculateEquipmentModifiers(hero);
        });

        if (!this.state.quests) {
            this.state.quests = {
                active: [],
                completedTutorials: [],
                tutorialStep: 0,
                // quests run on the game-time `clockMs`, not the wall clock.
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
    // The board (7×7 playmat). Selectors receive this object, not `state`, so a
    // top-level slice needs a getter here to be reachable from the UI.
    get board() { return this.state?.board || { tiles: {} }; }

    // ========================================
    // === Board Accessors ===
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
     * Serialize state for saving.
     */
    serialize() {
        const saveState = structuredClone(this.state);

        // Heroes are saved whole, minus the runtime scratch.
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
     * but without deep-copying the whole state first.
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
