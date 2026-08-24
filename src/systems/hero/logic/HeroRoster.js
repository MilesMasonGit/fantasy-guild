import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';

/**
 * Hero Roster: ordering of the roster.
 *
 * The bench was retired in the Hero Dock rework (Phase 3): there is one list
 * of heroes, capped by `progress.rosterLimit`, and recruiting is refused when
 * it is full rather than overflowing onto a second list. `moveHeroToBench` /
 * `moveHeroToActive` went with it. Since retirement was retired too (owner
 * decision 2026-08-19, CR2-086), nothing takes a hero off the roster at all.
 */

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
