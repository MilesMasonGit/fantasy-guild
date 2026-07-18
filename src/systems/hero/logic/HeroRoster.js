import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { getHero } from './HeroLookup.js';
import { getAreaForHero, unassignHero as unassignHeroFromArea } from '../../area/HeroAssignmentManager.js';

/**
 * Hero Roster: Managing the active/bench roster and ordering.
 */

export function moveHeroToBench(heroId) {
    const index = GameState.heroes.findIndex(h => h.id === heroId);
    if (index === -1) return { success: false, error: 'HERO_NOT_IN_ROSTER' };

    // Deck-loop assignment lives on the area, not the hero — clear it here
    // so no UI caller can bench a hero into a ghost assignment (CR-026).
    const areaId = getAreaForHero(heroId);
    if (areaId) unassignHeroFromArea(areaId);

    const [hero] = GameState.heroes.splice(index, 1);

    hero.status = 'idle'; // Bench heroes are always "idle"
    GameState.bench.push(hero);

    EventBus.publish('hero_benched', { heroId });
    EventBus.publish('heroes_updated', { source: 'moveHeroToBench' });
    
    logger.info('HeroRoster', `Hero "${hero.name}" moved to bench`);
    return { success: true };
}

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

    logger.info('HeroRoster', `Hero "${hero.name}" moved to active roster`);
    return { success: true };
}

export function reorderHero(heroId, targetIndex) {
    const heroes = GameState.heroes;
    const currentIndex = heroes.findIndex(h => h.id === heroId);

    if (currentIndex === -1) return { success: false };

    const [hero] = heroes.splice(currentIndex, 1);
    const finalIndex = Math.max(0, Math.min(targetIndex, heroes.length));
    heroes.splice(finalIndex, 0, hero);

    EventBus.publish('heroes_updated', { source: 'reorderHero' });
    return { success: true };
}
