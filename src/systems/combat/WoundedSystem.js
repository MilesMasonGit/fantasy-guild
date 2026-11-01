// Fantasy Guild - Wounded System

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import * as GameClock from '../core/GameClock.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { floorSpeedUp } from '../board/workTime.js';

/**
 * WoundedSystem - drains wounded heroes' recovery timers; a recovered hero
 * returns to idle at 50% HP.
 */

export const BASE_RECOVERY_TIME_MS = 5 * 60 * 1000;

/**
 * How long a wound takes now: the base, moved by the guild's Wound Time (a Guild Hall star, the
 * Infirmary) and floored like every speed-up. Read as a wound starts, so a star bought mid-wound
 * shortens the next one.
 */
export function woundTimeMs() {
    const resolved = getGlobalAggregator().resolveAxis(EFFECT_TYPES.WOUND_TIME, BASE_RECOVERY_TIME_MS);
    return Math.round(floorSpeedUp(BASE_RECOVERY_TIME_MS, resolved));
}

const WoundedSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('WoundedSystem', 'Wounded system initialized');
    },

    /**
     * Main tick function - called by the engine each tick
     * @param {number} deltaMs - Game time in milliseconds
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
     * Recovery counts game time (the tick delta), not wall-clock time, so a
     * catch-up of time away reaches heroes like live play.
     * @param {Object} hero - Wounded hero object
     * @param {number} deltaMs - Game time in milliseconds
     */
    processWoundedTick(hero, deltaMs) {
        if (typeof hero.woundedRemainingMs !== 'number') {
            // Legacy saves stored a wall-clock deadline in woundedUntil: convert
            // whatever is left on it; fresh wounds get the full timer.
            const full = woundTimeMs();
            const legacyRemaining = hero.woundedUntil ? hero.woundedUntil - GameClock.now() : full;
            hero.woundedRemainingMs = Math.max(0, Math.min(full, legacyRemaining));
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
    }
};

export { WoundedSystem };
