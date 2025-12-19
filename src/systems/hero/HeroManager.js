// Fantasy Guild - Hero Manager
// Phase 7: Hero Generation

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { generateHero, calculateHeroLevel } from './HeroGenerator.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { previewRetirementInfluence } from '../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';

/**
 * HeroManager - Manages all hero state operations
 * 
 * This is the owner of heroes[] in GameState.
 * Other systems must call HeroManager for hero mutations.
 */

/**
 * Create and add a new hero to the game
 * @param {Object} options - Hero generation options
 * @returns {Object} The created hero
 */
export function createHero(options = {}) {
    const hero = generateHero(options);
    GameState.heroes.push(hero);

    EventBus.publish('hero_recruited', {
        heroId: hero.id,
        name: hero.name,
        classId: hero.classId,
        traitId: hero.traitId
    });

    logger.info('HeroManager', `Created hero "${hero.name}" (${hero.className}/${hero.traitName})`);
    return hero;
}

/**
 * Add a pre-generated hero to the game
 * Used by RecruitSystem to add heroes from recruit cards
 * @param {Object} heroData - Full hero object from generateHero
 * @returns {Object} The added hero
 */
export function addHero(heroData) {
    if (!heroData || !heroData.id) {
        console.error('[HeroManager] addHero: Invalid hero data');
        return null;
    }

    GameState.heroes.push(heroData);

    EventBus.publish('hero_recruited', {
        heroId: heroData.id,
        name: heroData.name,
        classId: heroData.classId,
        traitId: heroData.traitId
    });

    EventBus.publish('heroes_updated', { source: 'addHero' });

    logger.info('HeroManager', `Added hero "${heroData.name}" (${heroData.className}/${heroData.traitName})`);
    return heroData;
}

/**
 * Get a hero by ID
 * @param {string} heroId 
 * @returns {Object|null} Hero object or null if not found
 */
export function getHero(heroId) {
    return GameState.heroes.find(h => h.id === heroId) || null;
}

/**
 * Get all heroes
 * @returns {Array} Array of all heroes
 */
export function getAllHeroes() {
    return GameState.heroes;
}

/**
 * Get hero count
 * @returns {number}
 */
export function getHeroCount() {
    return GameState.heroes.length;
}

/**
 * Get heroes by status
 * @param {string} status - 'idle', 'working', 'combat', 'wounded'
 * @returns {Array} Heroes with that status
 */
export function getHeroesByStatus(status) {
    return GameState.heroes.filter(h => h.status === status);
}

/**
 * Get idle heroes (available for assignment)
 * @returns {Array}
 */
export function getIdleHeroes() {
    return getHeroesByStatus('idle');
}

/**
 * Update hero status
 * @param {string} heroId 
 * @param {string} status - 'idle', 'working', 'combat', 'wounded'
 * @returns {{ success: boolean, error?: string }}
 */
export function setHeroStatus(heroId, status) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    hero.status = status;
    return { success: true };
}

/**
 * Update hero's profile (name and/or icon)
 * @param {string} heroId 
 * @param {Object} updates - { name?: string, icon?: string }
 * @returns {{ success: boolean, error?: string }}
 */
export function updateHeroProfile(heroId, updates = {}) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    if (updates.name !== undefined && updates.name.trim()) {
        hero.name = updates.name.trim();
    }

    if (updates.icon !== undefined) {
        hero.icon = updates.icon;
    }

    EventBus.publish('heroes_updated', { source: 'updateHeroProfile' });
    return { success: true };
}

/**
 * Assign hero to a card
 * @param {string} heroId 
 * @param {string} cardId 
 * @returns {{ success: boolean, error?: string }}
 */
export function assignHeroToCard(heroId, cardId) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    if (hero.status === 'wounded') {
        return { success: false, error: 'HERO_WOUNDED' };
    }

    if (hero.assignedCardId !== null) {
        return { success: false, error: 'HERO_BUSY' };
    }

    hero.assignedCardId = cardId;
    hero.status = 'working';

    EventBus.publish('hero_assigned', { heroId, cardId });
    EventBus.publish('heroes_updated', { source: 'assignHeroToCard' });
    return { success: true };
}

/**
 * Unassign hero from their current card
 * @param {string} heroId 
 * @returns {{ success: boolean, error?: string }}
 */
export function unassignHero(heroId) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    const previousCardId = hero.assignedCardId;
    hero.assignedCardId = null;
    hero.status = 'idle';

    if (previousCardId) {
        EventBus.publish('hero_unassigned', { heroId, cardId: previousCardId });
    }
    EventBus.publish('heroes_updated', { source: 'unassignHero' });

    return { success: true };
}

/**
 * Retire a hero (remove from game, grants Recruit card)
 * @param {string} heroId 
 * @returns {{ success: boolean, recruitCardsGranted?: number, error?: string }}
 */
export function retireHero(heroId) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    // Calculate Influence reward before removing
    const influenceReward = previewRetirementInfluence(hero);
    const recruitCost = calculateRecruitCost();

    // Block retirement if payout <= recruit cost (prevents "free rerolls")
    if (influenceReward <= recruitCost) {
        return {
            success: false,
            error: 'RETIREMENT_BLOCKED',
            reason: `Payout (${influenceReward}) must exceed recruit cost (${recruitCost})`
        };
    }

    // Unassign first if working
    if (hero.assignedCardId) {
        const cardId = hero.assignedCardId;
        // Use dynamic import to break circular dependency and clear card state
        import('../cards/CardManager.js').then(({ unassignHero }) => {
            unassignHero(cardId);
        }).catch(err => logger.error('HeroManager', 'Failed to unassign retired hero', err));

        // Start unassignment locally (clears hero status, but CardManager needs to clear card)
        unassignHero(heroId);
    }

    // Remove from heroes array
    const index = GameState.heroes.findIndex(h => h.id === heroId);
    if (index !== -1) {
        GameState.heroes.splice(index, 1);
    }

    // Add Influence reward
    CurrencyManager.addInfluence(influenceReward, 'retirement');

    // Spawn a Recruit card to replace the retired hero
    // Use dynamic import to avoid circular dependency
    import('../cards/RecruitSystem.js').then(({ RecruitSystem }) => {
        RecruitSystem.createRecruitCard(false);  // false = not free
        logger.info('HeroManager', 'Spawned Recruit card from retirement');
    });

    EventBus.publish('hero_retired', {
        heroId,
        name: hero.name,
        influenceReward
    });

    EventBus.publish('heroes_updated', { source: 'retireHero' });

    logger.info('HeroManager', `Retired hero "${hero.name}" for ${influenceReward} Influence`);
    return { success: true, influenceReward };
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
 * Update hero HP
 * @param {string} heroId 
 * @param {number} amount - Positive to heal, negative to damage
 * @returns {{ success: boolean, newHp?: number, error?: string }}
 */
export function modifyHeroHp(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    hero.hp.current = Math.max(0, Math.min(hero.hp.max, hero.hp.current + amount));
    return { success: true, newHp: hero.hp.current };
}

/**
 * Update hero Energy
 * @param {string} heroId 
 * @param {number} amount - Positive to restore, negative to consume
 * @returns {{ success: boolean, newEnergy?: number, error?: string }}
 */
export function modifyHeroEnergy(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    hero.energy.current = Math.max(0, Math.min(hero.energy.max, hero.energy.current + amount));
    return { success: true, newEnergy: hero.energy.current };
}
