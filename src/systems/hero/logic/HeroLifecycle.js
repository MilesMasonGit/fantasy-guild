import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { generateHero } from '../HeroGenerator.js';
import { CurrencyManager } from '../../economy/CurrencyManager.js';
import { previewRetirementInfluence } from '../../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../../utils/RecruitCostCalculator.js';
import { rehydrateHero } from './HeroRehydration.js';
import { getHero } from './HeroLookup.js';
import { AssignmentSystem } from '../../global/AssignmentSystem.js';

/**
 * Hero Lifecycle: Creation, Recruitment, and Retirement.
 */

export function createHero(options = {}) {
    const hero = generateHero(options);
    rehydrateHero(hero);
    GameState.heroes.push(hero);

    EventBus.publish('hero_recruited', {
        heroId: hero.id,
        name: hero.name,
        classId: hero.classId,
        traitId: hero.traitId
    });

    logger.info('HeroLifecycle', `Created hero "${hero.name}" (${hero.className}/${hero.traitName})`);
    return hero;
}

export function addHero(heroData) {
    if (!heroData || !heroData.id) {
        logger.error('HeroLifecycle', 'addHero: Invalid hero data');
        return null;
    }

    rehydrateHero(heroData);

    const rosterLimit = GameState.progress?.rosterLimit || 5;
    const isFull = GameState.heroes.length >= rosterLimit;

    if (isFull) {
        GameState.bench.push(heroData);
        EventBus.publish('hero_benched', { heroId: heroData.id });
        logger.info('HeroLifecycle', `Roster full! Benched new hero "${heroData.name}"`);
    } else {
        GameState.heroes.push(heroData);
        logger.info('HeroLifecycle', `Added hero "${heroData.name}" to active roster`);
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

export function retireHero(heroId) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    // Calculate Influence reward
    const influenceReward = previewRetirementInfluence(hero);
    const recruitCost = calculateRecruitCost();

    // Block retirement if payout <= recruit cost
    if (influenceReward <= recruitCost) {
        return {
            success: false,
            error: 'RETIREMENT_BLOCKED',
            reason: `Payout (${influenceReward}) must exceed recruit cost (${recruitCost})`
        };
    }

    // Unassign if working
    if (hero.assignedCardId) {
        AssignmentSystem.unassignHero(heroId);
    }

    // Remove from heroes or bench
    const wasRemoved = removeFromRosterOrBench(heroId);

    if (wasRemoved) {
        CurrencyManager.addInfluence(influenceReward, 'retirement');

        // Recruitment runs through the Bottom Drawer's Heroes tab (Phase 7) —
        // no replacement recruit card is spawned on retirement.
        EventBus.publish('hero_retired', { heroId, name: hero.name, influenceReward });
        EventBus.publish('heroes_updated', { source: 'retireHero' });
        
        logger.info('HeroLifecycle', `Retired hero "${hero.name}" for ${influenceReward} Influence`);
        return { success: true, influenceReward };
    }

    return { success: false, error: 'DELETE_FAILED' };
}

function removeFromRosterOrBench(heroId) {
    const activeIndex = GameState.heroes.findIndex(h => h.id === heroId);
    if (activeIndex !== -1) {
        GameState.heroes.splice(activeIndex, 1);
        return true;
    }
    const benchIndex = GameState.bench.findIndex(h => h.id === heroId);
    if (benchIndex !== -1) {
        GameState.bench.splice(benchIndex, 1);
        return true;
    }
    return false;
}
