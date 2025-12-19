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
    tick(deltaTime) {
        // Convert to milliseconds
        const deltaMs = deltaTime * 1000;

        // Get all wounded heroes
        const woundedHeroes = this.getWoundedHeroes();

        for (const hero of woundedHeroes) {
            this.processWoundedTick(hero, deltaMs);
        }
    },

    /**
     * Process recovery tick for a wounded hero
     * @param {Object} hero - Wounded hero object
     * @param {number} deltaMs - Time in milliseconds
     */
    processWoundedTick(hero, deltaMs) {
        // Check if hero has recovery time set
        if (!hero.woundedUntil) {
            // Set recovery time if not already set
            hero.woundedUntil = Date.now() + BASE_RECOVERY_TIME_MS;
            logger.debug('WoundedSystem', `Set recovery time for ${hero.name}: ${BASE_RECOVERY_TIME_MS}ms`);
        }

        // Check if recovery time has passed
        if (Date.now() >= hero.woundedUntil) {
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

        // Set recovery time
        hero.woundedUntil = Date.now() + BASE_RECOVERY_TIME_MS;

        logger.info('WoundedSystem', `${hero.name} is wounded. Recovery in ${BASE_RECOVERY_TIME_MS / 1000}s`);

        EventBus.publish('hero_wounded', {
            heroId,
            heroName: hero.name,
            recoveryTime: BASE_RECOVERY_TIME_MS,
            recoversAt: hero.woundedUntil
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
        if (!hero || hero.status !== 'wounded' || !hero.woundedUntil) {
            return null;
        }

        const now = Date.now();
        const remaining = Math.max(0, hero.woundedUntil - now);
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
