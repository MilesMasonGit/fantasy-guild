import { registerTokenTypes, getTokenType } from '../../config/registries/tokenRegistry.js';

/**
 * A camp of one for enemy type `enemyTypeId`: a spawner that brings one back `intervalMs` after
 * the last is beaten (the first after `intervalMs` too). Every enemy is one use, so a test that
 * wants a hero to win several fights sends the hero at a camp, as a player does.
 *
 * @returns {string} the camp's type id
 */
export function enemyCampType(enemyTypeId, { intervalMs = 2000 } = {}) {
    const id = `${enemyTypeId}_camp`;
    if (!getTokenType(id)) {
        registerTokenTypes({
            [id]: {
                id, name: `${enemyTypeId} camp`, tokenType: 'spawner', rarity: 'common', theme: 'fixture',
                uses: null, sprite: 's_crime',
                spawner: { spawns: [{ typeId: enemyTypeId, weight: 1 }], allowance: 1, intervalMs, upkeep: [] }
            }
        });
    }
    return id;
}
