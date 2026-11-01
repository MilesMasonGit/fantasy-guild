import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * "For one attack" is spent by an attack, and a hero who eats instead of swinging has not attacked:
 * a Flutter on the enemy waits for the swing after the meal.
 */

const state = { meal: null };
vi.mock('../systems/hero/ConsumptionSystem.js', () => ({
    tryEat: vi.fn(() => (state.meal ? [state.meal] : []))
}));

const { handleHeroAttack } = await import('../systems/combat/CombatAttackProcessor.js');
const { registerEffects } = await import('../config/registries/effectRegistry.js');

registerEffects({ eme_flutter: { id: 'eme_flutter', name: 'Flutter', statements: [] } });

function setUp() {
    const hero = { id: 'eme_hero', name: 'Aela', hp: { current: 2, max: 100 }, skills: { melee: { level: 1, xp: 0 } }, effects: [] };
    const fight = {
        id: 'fight_eme', instanceId: 'eme', assignedHeroId: hero.id,
        effects: [{ effectId: 'eme_flutter', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, forFight: true, forAttack: 1 }],
        combat: { enemyHp: { current: 50, max: 50 }, heroTickProcesses: { [hero.id]: 3000 }, enemyTickProgress: 0, state: { intermissionTimer: 0 } }
    };
    const enemy = { id: 'eme_enemy', level: 1, hp: 50, hit: 1, combatType: 'melee', traits: [], resistances: {} };
    return { hero, fight, enemy };
}

beforeEach(() => { state.meal = null; });

describe('a meal is not an attack', () => {
    it('Flutter stays on through a meal, and comes off with the swing after it', () => {
        const { hero, fight, enemy } = setUp();
        state.meal = { itemId: 'item_shrimp', amount: 5 };
        handleHeroAttack(fight, hero, enemy, 3000);
        expect(fight.effects.map(e => e.effectId)).toEqual(['eme_flutter']);

        state.meal = null;
        fight.combat.heroTickProcesses[hero.id] = 3000;
        handleHeroAttack(fight, hero, enemy, 3000);
        expect(fight.effects).toEqual([]);
    });
});
