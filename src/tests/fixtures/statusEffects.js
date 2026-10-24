// Poison and Burn as a test registers them: the shape the combat content pack authors in the CMS.

import { registerEffects } from '../../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';

/** "On Tick: deals 1 damage to itself, ignoring armour." */
export const tickDamage = (id, amount = 1) => ({
    ...makeStatement(KEYWORD.DEALS),
    id,
    when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF },
    payload: { amount, ignoresArmor: true }
});

/** "Provides <value> <type>" as a percentage (a fraction: -0.5 is -50 %). */
export const providesPct = (id, type, value) => ({
    ...makeStatement(KEYWORD.PROVIDES),
    id, to: null,
    payload: { type, bucket: 'percentage', value }
});

/** "Provides <value> <type>" flat. */
export const providesFlat = (id, type, value) => ({
    ...makeStatement(KEYWORD.PROVIDES),
    id, to: null,
    payload: { type, bucket: 'flat', value }
});

export const POISON = 'effect_poison';
export const BURN = 'effect_burn';

/**
 * Poison: stacks up to 3, lasts the fight, 1 a stack a tick. Burn: does not stack, 3 ticks, 1 a
 * tick, and food heals half while it burns.
 */
export function registerStatusFixtures() {
    registerEffects({
        [POISON]: {
            id: POISON, name: 'Poison', status: { stacks: 3, ticks: 0 },
            statements: [tickDamage('stm_poison_tick')]
        },
        [BURN]: {
            id: BURN, name: 'Burn', status: { stacks: 1, ticks: 3 },
            statements: [
                tickDamage('stm_burn_tick'),
                providesPct('stm_burn_food', EFFECT_TYPES.FOOD_HEALING, -0.5)
            ]
        }
    });
}
