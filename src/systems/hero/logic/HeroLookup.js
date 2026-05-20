import { GameState } from '../../../state/GameState.js';
import { rehydrateHero } from './HeroRehydration.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { calculateHeroLevel } from '../HeroGenerator.js';

/**
 * Hero Lookup: High-performance finding and filtering of heroes.
 */

/**
 * Get a hero by ID (O(N) across Roster and Bench)
 * @param {string} heroId 
 * @returns {Object|null}
 */
export function getHero(heroId) {
    if (!GameState.heroes) return null;
    
    const hero = GameState.heroes.find(h => h.id === heroId) || 
                 GameState.bench.find(h => h.id === heroId) || 
                 null;
    
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

export function getBenchCount() {
    return GameState.bench.length;
}

export function getBench() {
    return GameState.bench;
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

/**
 * Get hero's class data
 * @param {string} heroId 
 * @returns {Object|null}
 */
export function getHeroClass(heroId) {
    const hero = getHero(heroId);
    if (!hero || !hero.classId) return null;
    return getClass(hero.classId);
}
