// Fantasy Guild - Wounded System

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * WoundedSystem - drains wounded heroes' recovery timers; a recovered hero
 * returns to idle at 50% HP.
 */

const BASE_RECOVERY_TIME_MS = 5 * 60 * 1000;

const WoundedSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('WoundedSystem', 'Wounded system initialized');
    },

    /**
     * Main tick function - called by the engine each tick
     * @param {number} deltaMs - Time-scaled game time in milliseconds
     */
    tick(deltaMs) {
        const woundedHeroes = this.getWoundedHeroes();

        for (const hero of woundedHeroes) {
            this.processWoundedTick(hero, deltaMs);
        }
    },

    /**
     * Process recovery tick for a wounded hero.
     *
     * Recovery counts game time (the time-scaled tick delta), not wall-clock
     * time, so it speeds up under Time Bank fast-forward and offline time
     * reaches heroes by replaying the bank through the live engine.
     * @param {Object} hero - Wounded hero object
     * @param {number} deltaMs - Time-scaled game time in milliseconds
     */
    processWoundedTick(hero, deltaMs) {
        if (typeof hero.woundedRemainingMs !== 'number') {
            // Legacy saves stored a wall-clock deadline in woundedUntil: convert
            // whatever is left on it; fresh wounds get the full timer.
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
     * Recover a hero from wounded state
     * @param {string} heroId 
     */
    recoverHero(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero) {
            logger.warn('WoundedSystem', `Cannot recover hero: ${heroId} not found`);
            return;
        }

        HeroManager.setHeroStatus(heroId, 'idle');

        const recoveryHp = Math.floor(hero.hp.max * 0.5);
        hero.hp.current = recoveryHp;

        hero.woundedUntil = null;
        hero.woundedRemainingMs = null;

        logger.info('WoundedSystem', `${hero.name} has recovered with ${recoveryHp} HP`);

        EventBus.publish(ENGINE_EVENTS.HERO_RECOVERED, {
            heroId,
            heroName: hero.name,
            recoveredHp: recoveryHp
        });

        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'wounded_recovery' });
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
