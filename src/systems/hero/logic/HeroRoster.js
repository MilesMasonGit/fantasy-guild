import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { ENGINE_EVENTS } from '../../core/engineEvents.js';

/**
 * Hero Roster: ordering of the roster. There is one list of heroes, capped by
 * `progress.rosterLimit`; recruiting is refused when it is full.
 */

export function reorderHero(heroId, targetIndex) {
    const heroes = GameState.heroes;
    const currentIndex = heroes.findIndex(h => h.id === heroId);

    if (currentIndex === -1) return { success: false };

    const [hero] = heroes.splice(currentIndex, 1);
    const finalIndex = Math.max(0, Math.min(targetIndex, heroes.length));
    heroes.splice(finalIndex, 0, hero);

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'reorderHero' });
    return { success: true };
}
