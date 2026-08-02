import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { generateHero } from '../HeroGenerator.js';
import { CurrencyManager } from '../../economy/CurrencyManager.js';
import { previewRetirementInfluence } from '../../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../../utils/RecruitCostCalculator.js';
import { rehydrateHero } from './HeroRehydration.js';
import { getHero } from './HeroLookup.js';
import { getAreaForHero, unassignHero as unassignHeroFromArea } from '../../area/HeroAssignmentManager.js';

/**
 * Hero Lifecycle: Creation, Recruitment, and Retirement.
 */

/** The roster cap, raised one per `roster_size` Guild Hall rank. */
export function getRosterLimit() {
    return GameState.progress?.rosterLimit || 5;
}

/** Whether the roster is at its cap — recruiting is refused while true. */
export function isRosterFull() {
    return GameState.heroes.length >= getRosterLimit();
}

export function createHero(options = {}) {
    // Honours the same cap as addHero — otherwise this is a back door around
    // a limit the game now enforces for real (Hero Dock Phase 3).
    if (isRosterFull()) {
        logger.info('HeroLifecycle', 'Roster full — refused to create a new hero');
        return null;
    }

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

    // Ids are unique: a duplicate makes React render the same hero twice and
    // leaves two divergent copies of one person's state.
    if (GameState.heroes.some(h => h.id === heroData.id)) {
        logger.warn('HeroLifecycle', `Hero "${heroData.id}" is already on the roster — refused`);
        return null;
    }

    // The roster is the whole roster now (Hero Dock Phase 3) — a full roster
    // refuses the hero outright rather than quietly benching them. Callers
    // must check the null return and keep whatever the player was spending.
    if (isRosterFull()) {
        logger.info('HeroLifecycle', `Roster full — refused new hero "${heroData.name}"`);
        return null;
    }

    rehydrateHero(heroData);
    GameState.heroes.push(heroData);
    logger.info('HeroLifecycle', `Added hero "${heroData.name}" to the roster`);

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

    // Deck-loop assignment lives on the area — clear it before the hero
    // object disappears, or the area keeps running a deleted hero (CR-026).
    const areaId = getAreaForHero(heroId);
    if (areaId) unassignHeroFromArea(areaId);

    const wasRemoved = removeFromRoster(heroId);

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

function removeFromRoster(heroId) {
    const index = GameState.heroes.findIndex(h => h.id === heroId);
    if (index === -1) return false;
    GameState.heroes.splice(index, 1);
    return true;
}
