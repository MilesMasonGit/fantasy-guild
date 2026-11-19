import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * The events that move a hero's health. In a fight the engine changes `hp` in place and says so
 * only through the hit, the meal and the status tick; `HEROES_UPDATED` covers everything else.
 * Every health readout (the mat's bar, the hero bar's figure, the Hero drawer) listens to this
 * one list, so the three never disagree.
 */
export const HERO_HP_EVENTS = Object.freeze([
    ENGINE_EVENTS.HEROES_UPDATED,
    ENGINE_EVENTS.COMBAT_ENEMY_ATTACK,
    ENGINE_EVENTS.COMBAT_HERO_ATE,
    ENGINE_EVENTS.STATUS_DOT_TICK,
    ENGINE_EVENTS.GAME_RESET
]);

/**
 * Whether `event` with `payload` can have moved `heroId`'s health: a fight event about another
 * hero, or a status ticking on an enemy, cannot. Anything else may have, so it passes.
 * The `useGameState` event filter for a readout of one hero.
 */
export function movesHeroHp(heroId, payload, event) {
    switch (event) {
        case ENGINE_EVENTS.COMBAT_ENEMY_ATTACK:
        case ENGINE_EVENTS.COMBAT_HERO_ATE:
            return payload?.heroId === heroId;
        case ENGINE_EVENTS.STATUS_DOT_TICK:
            return payload?.targetType === 'hero' && payload?.targetId === heroId;
        default:
            return true;
    }
}
