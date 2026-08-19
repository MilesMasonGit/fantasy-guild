import { GameState } from '../../../state/GameState.js';
import { rehydrateHero } from './HeroRehydration.js';
import { calculateHeroLevel } from '../HeroGenerator.js';

/**
 * Hero Lookup: High-performance finding and filtering of heroes.
 */

/**
 * Get a hero by ID (O(N) across the roster)
 * @param {string} heroId
 * @returns {Object|null}
 */
export function getHero(heroId) {
    if (!GameState.heroes) return null;

    const hero = GameState.heroes.find(h => h.id === heroId) || null;

    // Failsafe: Rehydrate if aggregator was lost (e.g. from state mutation)
    if (hero && !hero.aggregator) {
        rehydrateHero(hero);
    }
    
    return hero;
}

export function getAllHeroes() {
    return GameState.heroes;
}

export function getHeroCount() {
    return GameState.heroes.length;
}

export function getHeroesByStatus(status) {
    return GameState.heroes.filter(h => h.status === status);
}

export function getIdleHeroes() {
    return getHeroesByStatus('idle');
}

/**
 * Get hero's calculated level
 * @param {string} heroId 
 * @returns {number|null}
 */
export function getHeroLevel(heroId) {
    const hero = getHero(heroId);
    if (!hero) return null;
    return calculateHeroLevel(hero.skills);
}

// `getHeroClass` is retired with the class registry (owner decision
// 2026-08-18). Nothing called it; a hero's identity is their job, and
// `getJob(hero.jobId)` is the lookup that replaces it.
