import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { generateHero } from '../HeroGenerator.js';
import { rehydrateHero, updateHeroFromSkills } from './HeroRehydration.js';
import { rosterLimitForRank, authoredStars } from '../../../config/guildUpgrades.js';
import { xpForEveryoneOf } from '../../progression/hallModifiers.js';
import { addXpToEverySkill } from '../everySkillXp.js';
import { ENGINE_EVENTS } from '../../core/engineEvents.js';
import { ensureFlagColour } from '../../board/FlagColours.js';

/**
 * Hero Lifecycle: creation and recruitment. The player never removes a hero from
 * the roster; a new recruit arrives automatically when the Guild Hall raises the
 * roster cap (`GuildUpgradeManager.purchase`).
 */

/**
 * The roster cap, raised one per `roster_size` Guild Hall rank (0 to 8).
 *
 * `GuildUpgradeManager.recompute` normally writes `progress.rosterLimit`; the
 * fallback covers a save written before it ran. Both go through
 * `rosterLimitForRank`, so the cap has a single definition.
 */
export function getRosterLimit() {
    return GameState.progress?.rosterLimit
        ?? rosterLimitForRank(GameState.state?.progress?.guildUpgrades?.roster_size);
}

/** Whether the roster is at its cap — recruiting is refused while true. */
export function isRosterFull() {
    return GameState.heroes.length >= getRosterLimit();
}

/**
 * A hero joining the roster brings the Guild Hall's XP for Everyone: the whole gift of the ranks
 * held now, in every skill, as if they had been there for every purchase. Worked out from the stars
 * and the saved ranks at that moment and then kept in the hero's own skills, so no counter is
 * saved and a load (which rehydrates, never comes through here) gives nothing again. Arriving is
 * not levelling up: nothing is announced but the recruit.
 */
function arriveWithHallXp(hero) {
    const amount = xpForEveryoneOf(authoredStars(), GameState.state?.progress?.guildUpgrades || {});
    if (addXpToEverySkill(hero, amount).length) updateHeroFromSkills(hero);
}

export function createHero(options = {}, silent = false) {
    // Honours the same cap as addHero, or this is a back door around the limit.
    if (isRosterFull()) {
        logger.info('HeroLifecycle', 'Roster full — refused to create a new hero');
        return null;
    }

    const hero = generateHero(options);
    rehydrateHero(hero);
    arriveWithHallXp(hero);
    // A new recruit arrives rested: whatever max HP the Hall's XP gave them, they hold in full.
    if (hero.hp) hero.hp.current = hero.hp.max;
    GameState.heroes.push(hero);
    ensureFlagColour(hero.id);

    if (!silent) {
        EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, {
            heroId: hero.id,
            name: hero.name
        });
    }

    logger.info('HeroLifecycle', `Created hero "${hero.name}"`);
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

    // A full roster refuses the hero outright rather than benching them. Callers
    // must check the null return and keep whatever the player was spending.
    if (isRosterFull()) {
        logger.info('HeroLifecycle', `Roster full — refused new hero "${heroData.name}"`);
        return null;
    }

    rehydrateHero(heroData);
    arriveWithHallXp(heroData);
    GameState.heroes.push(heroData);
    ensureFlagColour(heroData.id);
    logger.info('HeroLifecycle', `Added hero "${heroData.name}" to the roster`);

    EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, {
        heroId: heroData.id,
        name: heroData.name
    });

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'addHero' });
    return heroData;
}

