// Fantasy Guild - Wounded System
// Phase 31: Combat System - Wounded State Handling

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * WoundedSystem - Handles hero wounded state and recovery
 * 
 * When a hero is defeated in combat (HP = 0):
 * - Hero enters "wounded" status
 * - Cannot be assigned to any cards
 * - Recovers after a set time (5 minutes base)
 * - Recovers at 50% HP
 */

// Recovery time in milliseconds (5 minutes)
const BASE_RECOVERY_TIME_MS = 5 * 60 * 1000;

const WoundedSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the wounded system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('WoundedSystem', 'Wounded system initialized');
    },

    /**
     * Main tick function - called by GameLoop
     * @param {number} deltaTime - Time since last tick in SECONDS
     */
    tick(deltaMs) {
        // Delta is already in milliseconds from GameLoop

        // Get all wounded heroes
        const woundedHeroes = this.getWoundedHeroes();

        for (const hero of woundedHeroes) {
            this.processWoundedTick(hero, deltaMs);
        }
    },

    /**
     * Process recovery tick for a wounded hero.
     *
     * Recovery counts GAME time (the already time-scaled tick delta), not
     * wall-clock time (owner decision 2026-07-17, CR-033): every feature
     * must speed up under Time Bank fast-forward, and offline time reaches
     * heroes by replaying the bank through the live engine.
     * @param {Object} hero - Wounded hero object
     * @param {number} deltaMs - Time-scaled game time in milliseconds
     */
    processWoundedTick(hero, deltaMs) {
        if (typeof hero.woundedRemainingMs !== 'number') {
            // Legacy saves stored a wall-clock deadline in woundedUntil —
            // convert whatever is left on it; fresh wounds get the full timer.
            const legacyRemaining = hero.woundedUntil ? hero.woundedUntil - Date.now() : BASE_RECOVERY_TIME_MS;
            hero.woundedRemainingMs = Math.max(0, Math.min(BASE_RECOVERY_TIME_MS, legacyRemaining));
            hero.woundedUntil = null;
            logger.debug('WoundedSystem', `Set recovery timer for ${hero.name}: ${hero.woundedRemainingMs}ms`);
        }

        hero.woundedRemainingMs -= deltaMs;
        if (hero.woundedRemainingMs <= 0) {
            this.recoverHero(hero.id);
        }
    },

    /**
     * Wound a hero (called by CombatSystem on defeat)
     * @param {string} heroId 
     */
    woundHero(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero) {
            logger.warn('WoundedSystem', `Cannot wound hero: ${heroId} not found`);
            return;
        }

        // Set hero to wounded status
        HeroManager.setHeroStatus(heroId, 'wounded');

        // Set recovery timer (game-time ms, drained by processWoundedTick)
        hero.woundedRemainingMs = BASE_RECOVERY_TIME_MS;
        hero.woundedUntil = null;

        logger.info('WoundedSystem', `${hero.name} is wounded. Recovery in ${BASE_RECOVERY_TIME_MS / 1000}s of game time`);

        EventBus.publish('hero_wounded', {
            heroId,
            heroName: hero.name,
            recoveryTime: BASE_RECOVERY_TIME_MS
        });
    },

    /**
     * Recover a hero from wounded state
     * @param {string} heroId 
     */
    recoverHero(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero) {
            logger.warn('WoundedSystem', `Cannot recover hero: ${heroId} not found`);
            return;
        }

        // Set hero back to idle
        HeroManager.setHeroStatus(heroId, 'idle');

        // Recover at 50% HP
        const recoveryHp = Math.floor(hero.hp.max * 0.5);
        hero.hp.current = recoveryHp;

        // Clear recovery timer
        hero.woundedUntil = null;
        hero.woundedRemainingMs = null;

        logger.info('WoundedSystem', `${hero.name} has recovered with ${recoveryHp} HP`);

        EventBus.publish('hero_recovered', {
            heroId,
            heroName: hero.name,
            recoveredHp: recoveryHp
        });

        // Trigger UI update
        EventBus.publish('heroes_updated', { source: 'wounded_recovery' });
    },

    /**
     * Get all wounded heroes
     * @returns {Array}
     */
    getWoundedHeroes() {
        return HeroManager.getHeroesByStatus('wounded');
    },

    /**
     * Get recovery progress for a wounded hero
     * @param {string} heroId 
     * @returns {{ remaining: number, total: number, percent: number }|null}
     */
    getRecoveryProgress(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status !== 'wounded' || typeof hero.woundedRemainingMs !== 'number') {
            return null;
        }

        const remaining = Math.max(0, hero.woundedRemainingMs);
        const total = BASE_RECOVERY_TIME_MS;
        const percent = 1 - (remaining / total);

        return { remaining, total, percent };
    },

    /**
     * Check if a hero is wounded
     * @param {string} heroId 
     * @returns {boolean}
     */
    isWounded(heroId) {
        const hero = HeroManager.getHero(heroId);
        return hero?.status === 'wounded';
    },

    /**
     * Get base recovery time in milliseconds
     * @returns {number}
     */
    getBaseRecoveryTime() {
        return BASE_RECOVERY_TIME_MS;
    }
};

export { WoundedSystem };
