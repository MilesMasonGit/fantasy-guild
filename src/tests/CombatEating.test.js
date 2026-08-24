import { describe, it, expect, vi, beforeEach } from 'vitest';

// D-27: food fires whenever HP is low, in combat or out — but eating DURING a
// fight pauses the attack cycle while the fight carries on, so the enemy gets
// a free swing. That price is the whole reason HP management stays tense.

const { state } = vi.hoisted(() => ({ state: { meal: null } }));

vi.mock('../systems/hero/ConsumptionSystem.js', () => ({
    tryEat: vi.fn(() => state.meal),
    tryDrink: vi.fn(() => null)
}));

vi.mock('../systems/hero/HeroManager.js', () => ({
    getHero: vi.fn(() => ({ id: 'h1', hp: { current: 10, max: 100 }, statuses: [] })),
    modifyHeroHp: vi.fn(),
    setHeroStatus: vi.fn()
}));

vi.mock('../systems/effects/StatusEffectSystem.js', () => ({
    rollAttackFailure: vi.fn(() => false),
    applyToEnemy: vi.fn(),
    applyToHero: vi.fn(),
    notifyHitTaken: vi.fn()
}));

vi.mock('../utils/CombatFormulas.js', () => ({
    rollHit: vi.fn(() => true),
    computeHeroDamage: vi.fn(() => 25),
    computeEnemyDamage: vi.fn(() => 5),
    getHeroCombatSkill: vi.fn(() => 10),
    getHeroCombatStyle: vi.fn(() => 'melee'),
    getHeroDefenseSkill: vi.fn(() => 10),
    ENEMY_ATTACK_INTERVAL_MS: 2000
}));

vi.mock('../config/registries/itemRegistry.js', () => ({ getItem: vi.fn(() => null) }));
vi.mock('../config/registries/equipmentConstants.js', () => ({
    getPrimaryWeapon: vi.fn(() => null),
    getPrimaryWeaponSlot: vi.fn(() => null),
    getEquippedEntries: vi.fn(() => []),
    isGearCategory: vi.fn(() => false)
}));
vi.mock('../systems/combat/CombatResolutionProcessor.js', () => ({ handleHeroWounded: vi.fn() }));

import { handleHeroAttack } from '../systems/combat/CombatAttackProcessor.js';

const ATTACK_SPEED = 2000;

function makeCard() {
    return {
        id: 'card_fight',
        combat: {
            enemyHp: { current: 100, max: 100 },
            enemyStatuses: [],
            heroTickProcesses: { h1: ATTACK_SPEED },
            stats: {}
        }
    };
}

const hero = { id: 'h1', hp: { current: 10, max: 100 }, statuses: [] };
const enemy = { id: 'e1', defenceSkill: 5, combatType: 'melee' };

beforeEach(() => {
    state.meal = null;
    vi.clearAllMocks();
});

describe('eating mid-combat (D-27)', () => {
    it('attacks normally when the hero does not need food', () => {
        const card = makeCard();
        handleHeroAttack(card, hero, enemy, 'melee', ATTACK_SPEED);
        expect(card.combat.enemyHp.current).toBe(75);      // the blow landed
    });

    it('skips the attack entirely when the hero stops to eat', () => {
        state.meal = { itemId: 'bread', amount: 20 };
        const card = makeCard();
        handleHeroAttack(card, hero, enemy, 'melee', ATTACK_SPEED);

        // The enemy is untouched — this attack simply never happened, which is
        // what "the enemy gets a free hit" means in practice.
        expect(card.combat.enemyHp.current).toBe(100);
    });

    it('still spends the attack window, so the meal costs real time', () => {
        state.meal = { itemId: 'bread', amount: 20 };
        const card = makeCard();
        handleHeroAttack(card, hero, enemy, 'melee', ATTACK_SPEED);

        // Progress toward the next swing is consumed exactly as a real attack
        // would consume it — the hero doesn't get the time back.
        expect(card.combat.heroTickProcesses.h1).toBe(0);
    });

    it('costs the same window as an ordinary attack', () => {
        const eating = makeCard();
        state.meal = { itemId: 'bread', amount: 20 };
        handleHeroAttack(eating, hero, enemy, 'melee', ATTACK_SPEED);

        const fighting = makeCard();
        state.meal = null;
        handleHeroAttack(fighting, hero, enemy, 'melee', ATTACK_SPEED);

        expect(eating.combat.heroTickProcesses.h1).toBe(fighting.combat.heroTickProcesses.h1);
    });

    // W-2: uncapped eating (D-31) means the spiral — eat, get hit, eat — is
    // reachable. It is working as designed (a hero who can't out-heal the
    // damage should lose), but it must be OBSERVABLE rather than silent.
    it('announces the meal so the spiral is visible rather than mysterious', async () => {
        const { EventBus } = await import('../systems/core/EventBus.js');
        const seen = [];
        const unsub = EventBus.subscribe('combat_hero_ate', e => seen.push(e));

        state.meal = { itemId: 'bread', amount: 20 };
        handleHeroAttack(makeCard(), hero, enemy, 'melee', ATTACK_SPEED);

        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ heroId: 'h1', itemId: 'bread', healed: 20 });
        unsub();
    });
});
