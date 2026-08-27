import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { generateHero } from '../HeroGenerator.js';
import { rehydrateHero } from './HeroRehydration.js';
import { rosterLimitForRank } from '../../../config/guildUpgrades.js';

/**
 * Hero Lifecycle: Creation and Recruitment.
 *
 * Retirement was retired as a mechanic (owner decision, 2026-08-19, CR2-086):
 * heroes are never removed from the roster by the player, and a new recruit
 * arrives automatically when the Guild Hall raises the roster cap
 * (`GuildUpgradeManager.purchase`). `retireHero`, the recruit-cost formula and
 * the retirement Influence payout all went with it.
 */

/**
 * The roster cap, raised one per `roster_size` Guild Hall rank (0 to 12).
 *
 * `GuildUpgradeManager.recompute` normally writes `progress.rosterLimit`; the
 * fallback covers a save written before it ran, or a state shape caught
 * mid-migration. That fallback used to re-derive the cap by hand and left
 * `ROSTER_BASE` out (CR2-193) — so the two answers differ by the whole base the
 * moment ROSTER_BASE stops being 0, and the roster reads as full when it is not.
 * Both now go through `rosterLimitForRank`, the single definition.
 */
export function getRosterLimit() {
    return GameState.progress?.rosterLimit
        ?? rosterLimitForRank(GameState.state?.progress?.guildUpgrades?.roster_size);
}

/** Whether the roster is at its cap — recruiting is refused while true. */
export function isRosterFull() {
    return GameState.heroes.length >= getRosterLimit();
}

export function createHero(options = {}, silent = false) {
    // Honours the same cap as addHero — otherwise this is a back door around
    // a limit the game now enforces for real (Hero Dock Phase 3).
    if (isRosterFull()) {
        logger.info('HeroLifecycle', 'Roster full — refused to create a new hero');
        return null;
    }

    const hero = generateHero(options);
    rehydrateHero(hero);
    GameState.heroes.push(hero);

    if (!silent) {
        EventBus.publish('hero_recruited', {
            heroId: hero.id,
            name: hero.name
        });
    }

    logger.info('HeroLifecycle', `Created hero "${hero.name}" (${hero.jobId})`);
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
        name: heroData.name
    });

    EventBus.publish('heroes_updated', { source: 'addHero' });
    return heroData;
}

