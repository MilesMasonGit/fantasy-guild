// Venom, Burn and Sunder as a test registers them: the shape the combat content pack authors in the CMS.

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

export const VENOM = 'effect_venom';
export const BURN = 'effect_burn';
export const SUNDER = 'effect_sunder';

/**
 * Venom (the status once named Poison): stacks up to 3, lasts the fight, 1 a stack a tick. Burn:
 * does not stack, 3 ticks, 1 a tick, and food heals half while it burns. Sunder: stacks up to 3,
 * lasts the fight, every resistance 10 points lower a stack.
 */
export function registerStatusFixtures() {
    registerEffects({
        [VENOM]: {
            id: VENOM, name: 'Venom', status: { stacks: 3, ticks: 0 },
            statements: [tickDamage('stm_venom_tick')]
        },
        [SUNDER]: {
            id: SUNDER, name: 'Sunder', status: { stacks: 3, ticks: 0 },
            statements: [providesFlat('stm_sunder', EFFECT_TYPES.SUNDER, 10)]
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
