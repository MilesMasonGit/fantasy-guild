import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import { handleVictory } from '../systems/combat/CombatResolutionProcessor.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getEnemyProfile } from '../config/registries/enemyProfile.js';

/**
 * Everyone fights: a hero holding no combat skill (a Recruit) punches for 1 every 3 s, barehanded,
 * with no style, and earns no combat XP until promotion.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerItems({
    fixture_recruit_bow: {
        id: 'fixture_recruit_bow', name: 'Recruit Bow', type: 'weapon', equipSlot: 'hand',
        skillRequired: 'ranged', levelRequired: 1, damage: 3, speed: 'fast'
    }
});

/** A new Recruit, and the same hero promoted to a level 1 Melee fighter. */
function pair(equipment = []) {
    const recruit = generateHero({ name: 'r' });
    recruit.id = 'recruit';
    recruit.equipment = [...equipment];
    const fighter = generateHero({ name: 'f' });
    fighter.id = 'fighter';
    fighter.equipment = [...equipment];
    fighter.skills.melee = { level: 1, xp: 0 };
    return { recruit, fighter };
}

const enemy = () => getEnemyProfile('fixture_enemy');

/** Every number the combat engine reads off a hero. */
function numbers(hero) {
    const e = enemy();
    return {
        style: CombatFormulas.getHeroCombatStyle(hero),
        level: CombatFormulas.getHeroCombatLevel(hero),
        maxHp: CombatFormulas.heroMaxHpFromSkills(hero.skills),
        swingMs: CombatFormulas.heroAttackSpeedMs(hero),
        missOnEnemy: CombatFormulas.heroMissChance(hero, e),
        enemyMissOnHero: CombatFormulas.enemyMissChance(e, hero),
        damage: CombatFormulas.heroHitDamage(hero, e),
        damageTaken: CombatFormulas.enemyHitDamage(e, hero)
    };
}

beforeEach(() => {
    GameState.initNew();
});

describe('A Recruit punches for 1 every 3 s', () => {
    it('can fight, with no combat skill written onto the hero', () => {
        const { recruit } = pair();
        const before = JSON.stringify(recruit.skills);

        expect(CombatFormulas.canHeroFight(recruit)).toBe(true);
        expect(CombatFormulas.fightsAsRecruit(recruit)).toBe(true);
        expect(CombatFormulas.getHeroCombatLevel(recruit)).toBe(0);
        expect(CombatFormulas.getHeroCombatSkillEntry(recruit)).toEqual({ id: null, level: 0 });
        expect(JSON.stringify(recruit.skills)).toBe(before);
    });

    it('unarmed: 10 HP, no style, a 1-damage punch every 3 s', () => {
        const { recruit } = pair();
        expect(numbers(recruit)).toMatchObject({ style: null, level: 0, maxHp: 10, swingMs: 3000, damage: 1 });
    });

    it('armed: the weapon is ignored, every number is the same as unarmed', () => {
        const armed = pair(['fixture_recruit_bow']).recruit;
        const bare = pair().recruit;
        expect(CombatFormulas.getHeroWeapon(armed)).toBeNull();
        expect(numbers(armed)).toEqual(numbers(bare));
    });

    it('a promoted fighter swings the same bow: its style, its speed, its damage', () => {
        const { fighter } = pair(['fixture_recruit_bow']);
        // 3 against the melee fixture enemy, ranged's bad matchup: 3 × 0.75 = 2.25, rounded 2.
        expect(numbers(fighter)).toMatchObject({ style: 'ranged', level: 1, maxHp: 11, swingMs: 2000, damage: 2 });
    });

    it('a promoted hero is unchanged: the real level', () => {
        const hero = { skills: { ranged: { level: 30 } } };
        expect(CombatFormulas.getHeroCombatLevel(hero)).toBe(30);
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');
        expect(CombatFormulas.fightsAsRecruit(hero)).toBe(false);
    });

    it('no hero record cannot fight', () => {
        expect(CombatFormulas.canHeroFight(null)).toBe(false);
        expect(CombatFormulas.canHeroFight(undefined)).toBe(false);
    });
});

describe('A won fight pays a Recruit no combat XP, and a fighter their award', () => {
    function win(heroes) {
        GameState.state.heroes = heroes;
        const fight = { id: 'f', combat: { state: {} }, drops: [] };
        handleVictory(fight, heroes[0], enemy(), heroes[0].id, heroes.map(h => h.id));
    }

    it('a Recruit: no skill gains XP and no combat skill appears', () => {
        const { recruit } = pair();
        const before = JSON.stringify(recruit.skills);
        win([recruit]);
        expect(JSON.stringify(recruit.skills)).toBe(before);
    });

    it('a promoted fighter still gains their combat XP', () => {
        const { fighter } = pair();
        win([fighter]);
        expect(fighter.skills.melee.xp).toBeGreaterThan(0);
    });
});
