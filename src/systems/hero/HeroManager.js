// Fantasy Guild - Hero Manager
// Phase 7: Hero Generation

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { generateHero, calculateHeroLevel } from './HeroGenerator.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { previewRetirementInfluence } from '../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import * as CardManager from '../cards/CardManager.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { getClass } from '../../config/registries/classRegistry.js';
import { skillSpeedBonus } from '../../config/FormulaRegistry.js';

/**
 * HeroManager - Manages all hero state operations
 * 
 * This is the owner of heroes[] in GameState.
 * Other systems must call HeroManager for hero mutations.
 */

// PERFORMANCE: Reference map to provide stable object references for React.memo
// and O(1) lookups for the UI.
let _heroReferenceMap = new Map();

/**
 * Create and add a new hero to the game
 * @param {Object} options - Hero generation options
 * @returns {Object} The created hero
 */
export function createHero(options = {}) {
    const hero = generateHero(options);
    GameState.heroes.push(hero);
    _heroReferenceMap.set(hero.id, hero);

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

    const rosterLimit = GameState.progress?.rosterLimit || 5;
    const isFull = GameState.heroes.length >= rosterLimit;

    if (isFull) {
        GameState.bench.push(heroData);
        _heroReferenceMap.set(heroData.id, heroData);
        EventBus.publish('hero_benched', { heroId: heroData.id });
        logger.info('HeroManager', `Roster full! Benched new hero "${heroData.name}"`);
    } else {
        GameState.heroes.push(heroData);
        _heroReferenceMap.set(heroData.id, heroData);
        logger.info('HeroManager', `Added hero "${heroData.name}" to active roster`);
    }

    EventBus.publish('hero_recruited', {
        heroId: heroData.id,
        name: heroData.name,
        classId: heroData.classId,
        traitId: heroData.traitId
    });

    EventBus.publish('heroes_updated', { source: 'addHero' });

    return heroData;
}

/**
 * Get a hero by ID
 * @param {string} heroId 
 * @returns {Object|null} Hero object or null if not found
 */
export function getHero(heroId) {
    // PERFORMANCE: Use O(1) map lookup. If not found, fallback to array search 
    // (useful if hydrated from save without map initialization)
    if (_heroReferenceMap.has(heroId)) return _heroReferenceMap.get(heroId);
    
    const hero = GameState.heroes.find(h => h.id === heroId) || 
                 GameState.bench.find(h => h.id === heroId) || 
                 null;
    if (hero) _heroReferenceMap.set(heroId, hero);
    return hero;
}

/**
 * Get stable hero array (PERFORMANCE: Reuse object references)
 */
export function getStableHeroes() {
    return GameState.heroes.map(hero => {
        const cached = _heroReferenceMap.get(hero.id);
        
        // If the object in GameState is literally the same as cached, reuse cache
        // If it's different (mutated in place but reference changed), update cache
        // Actually, our engine mutates in place, so reference is often same.
        // But for React's sake, we want to return the same OBJECT literal if nothing meaningful changed.
        
        if (cached) {
            // Check for meaningful changes to avoid re-renders
            // Now including skill levels/XP to ensure progress bars update
            const totalXp = Object.values(hero.skills || {}).reduce((sum, s) => sum + (s.xp || 0), 0);
            const cachedXp = Object.values(cached.skills || {}).reduce((sum, s) => sum + (s.xp || 0), 0);

            const changed = 
                cached.status !== hero.status ||
                cached.hp.current !== hero.hp.current ||
                cached.energy.current !== hero.energy.current ||
                cached.assignedCardId !== hero.assignedCardId ||
                totalXp !== cachedXp;
                
            if (!changed) return cached;
        }
        
        // If changed or not cached, create a stable "view" object or just store the current one
        // Since the engine mutates GameState.heroes[i] directly, we can't just store it
        // if we want React to see it as "same". We must return the SAME reference.
        
        // We actually want to return a NEW reference ONLY when it changes.
        // Let's create a "stable clone" for the UI.
        const stableClone = { ...hero };
        _heroReferenceMap.set(hero.id, stableClone);
        return stableClone;
    });
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
 * Get benched hero count
 * @returns {number}
 */
export function getBenchCount() {
    return GameState.bench.length;
}

/**
 * Get stable bench array (PERFORMANCE: Reuse object references)
 */
export function getStableBench() {
    return GameState.bench.map(hero => {
        const cached = _heroReferenceMap.get(hero.id);
        if (cached) {
            // Basic change detection for bench (HP/Energy might still regen or change)
            const changed = cached.status !== hero.status ||
                          cached.hp.current !== hero.hp.current ||
                          cached.energy.current !== hero.energy.current;
            if (!changed) return cached;
        }
        const stableClone = { ...hero };
        _heroReferenceMap.set(hero.id, stableClone);
        return stableClone;
    });
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
 * Re-apply a hero's modifiers to their assigned card's aggregator.
 * Used during rehydration after loading a save.
 * @param {string} heroId 
 * @param {string} cardId 
 */
export function reapplyHeroModifiers(heroId, cardId) {
    const hero = getHero(heroId);
    const card = CardManager.getCard(cardId);
    if (!hero || !card) return;

    // Ensure entities have healthy aggregators
    if (!hero.aggregator || typeof hero.aggregator.addModifier !== 'function') {
        hero.aggregator = new ModifierAggregator(hero.id);
    }
    if (!card.aggregator || typeof card.aggregator.addModifier !== 'function') {
        card.aggregator = new ModifierAggregator(card.id);
    }

    // Re-add skill modifiers
    for (const [skillId, skillData] of Object.entries(hero.skills)) {
        const level = typeof skillData === 'number' ? skillData : (skillData.level || 0);
        if (level > 0) {
            card.aggregator.addModifier({
                source: `hero:${hero.id}`,
                type: EFFECT_TYPES.SPEED,
                target: { category: skillId.toUpperCase() },
                value: skillSpeedBonus(level)
            });
        }
    }
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

    // Ensure Hero has aggregator (for older saves)
    if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

    // NEW: Add hero's skills as modifiers to the card's aggregator
    const card = CardManager.getCard(cardId);
    if (card) {
        // Ensure Card has aggregator (for older saves)
        if (!card.aggregator) card.aggregator = new ModifierAggregator(card.id);
        
        for (const [skillId, skillData] of Object.entries(hero.skills)) {
            const level = typeof skillData === 'number' ? skillData : (skillData.level || 0);
            if (level > 0) {
                card.aggregator.addModifier({
                    source: `hero:${hero.id}`,
                    type: EFFECT_TYPES.SPEED,
                    target: { category: skillId.toUpperCase() },
                    value: skillSpeedBonus(level)
                });
            }
        }
    }

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

    // NEW: Remove hero's modifiers from the previous card's aggregator
    if (previousCardId) {
        const card = CardManager.getCard(previousCardId);
        if (card && card.aggregator) {
            card.aggregator.removeModifiersBySource(`hero:${hero.id}`);
        }
    }

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

    // Remove from heroes OR bench array
    let removed = false;
    const activeIndex = GameState.heroes.findIndex(h => h.id === heroId);
    if (activeIndex !== -1) {
        GameState.heroes.splice(activeIndex, 1);
        removed = true;
    } else {
        const benchIndex = GameState.bench.findIndex(h => h.id === heroId);
        if (benchIndex !== -1) {
            GameState.bench.splice(benchIndex, 1);
            removed = true;
        }
    }

    if (removed) {
        _heroReferenceMap.delete(heroId);
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

    return { success: false, error: 'HERO_NOT_FOUND' };
}

/**
 * Move a hero from the active roster to the bench
 * @param {string} heroId 
 * @returns {{ success: boolean, error?: string }}
 */
export function moveHeroToBench(heroId) {
    const index = GameState.heroes.findIndex(h => h.id === heroId);
    if (index === -1) return { success: false, error: 'HERO_NOT_IN_ROSTER' };

    const [hero] = GameState.heroes.splice(index, 1);
    
    // Unassign if working
    if (hero.assignedCardId) {
        unassignHero(heroId);
    }

    hero.status = 'idle'; // Bench heroes are always "idle"
    GameState.bench.push(hero);

    EventBus.publish('hero_benched', { heroId });
    EventBus.publish('heroes_updated', { source: 'moveHeroToBench' });
    
    logger.info('HeroManager', `Hero "${hero.name}" moved to bench`);
    return { success: true };
}

/**
 * Move a hero from the bench to the active roster
 * @param {string} heroId 
 * @returns {{ success: boolean, error?: string }}
 */
export function moveHeroToActive(heroId) {
    const index = GameState.bench.findIndex(h => h.id === heroId);
    if (index === -1) return { success: false, error: 'HERO_NOT_IN_BENCH' };

    const rosterLimit = GameState.progress?.rosterLimit || 5;
    if (GameState.heroes.length >= rosterLimit) {
        return { success: false, error: 'ROSTER_FULL' };
    }

    const [hero] = GameState.bench.splice(index, 1);
    GameState.heroes.push(hero);

    EventBus.publish('hero_activated', { heroId });
    EventBus.publish('heroes_updated', { source: 'moveHeroToActive' });

    logger.info('HeroManager', `Hero "${hero.name}" moved to active roster`);
    return { success: true };
}

/**
 * Reorder a hero within the roster
 * @param {string} heroId 
 * @param {number} targetIndex 
 * @returns {{ success: boolean }}
 */
export function reorderHero(heroId, targetIndex) {
    const heroes = GameState.heroes;
    const currentIndex = heroes.findIndex(h => h.id === heroId);

    if (currentIndex === -1) return { success: false };

    // Remove the hero from current position
    const [hero] = heroes.splice(currentIndex, 1);

    // Insert at the new position
    // If dragging from top to bottom, the array is now 1 element shorter, 
    // so targetIndex might need adjustment if calculation was based on original array?
    // Let's just trust the passed targetIndex and clamp it.
    const finalIndex = Math.max(0, Math.min(targetIndex, heroes.length));
    heroes.splice(finalIndex, 0, hero);

    EventBus.publish('heroes_updated', { source: 'reorderHero' });
    return { success: true };
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
