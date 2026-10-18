import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import { handleVictory } from '../systems/combat/CombatResolutionProcessor.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getEnemyProfile } from '../config/registries/enemyProfile.js';

/**
 * Everyone fights: a hero holding no combat skill (a Recruit) fights exactly as a level 1
 * fighter with what they hold, and earns no combat XP until promotion.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerItems({
    fixture_recruit_bow: {
        id: 'fixture_recruit_bow', name: 'Recruit Bow', type: 'weapon', equipSlot: 'hand',
        skillRequired: 'ranged', levelRequired: 1, damage: 3
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
function numbers(hero, weapon = null) {
    const style = CombatFormulas.getHeroCombatStyle(hero);
    const e = enemy();
    return {
        style,
        attack: CombatFormulas.getHeroCombatSkill(hero, style),
        defence: CombatFormulas.getHeroDefenseSkill(hero),
        maxHp: CombatFormulas.heroMaxHpFromSkills(hero.skills),
        block: CombatFormulas.getHeroBlockChance(hero),
        hitOnEnemy: CombatFormulas.calculateHitChance(
            CombatFormulas.getHeroCombatSkill(hero, style), e.defenceSkill, style, e.combatType, hero, e),
        enemyHitOnHero: CombatFormulas.calculateHitChance(
            e.attackSkill, CombatFormulas.getHeroDefenseSkill(hero), e.combatType, style, e, hero),
        damage: CombatFormulas.getHeroDamageRange(hero, e, weapon, 0, style),
        damageTaken: CombatFormulas.getEnemyDamageRange(e, hero, style)
    };
}

beforeEach(() => {
    GameState.initNew();
});

describe('A Recruit fights as a level 1 fighter', () => {
    it('can fight, with no combat skill written onto the hero', () => {
        const { recruit } = pair();
        const before = JSON.stringify(recruit.skills);

        expect(CombatFormulas.canHeroFight(recruit)).toBe(true);
        expect(CombatFormulas.getHeroCombatLevel(recruit)).toBe(1);
        expect(CombatFormulas.getHeroCombatSkillEntry(recruit)).toEqual({ id: null, level: 0 });
        expect(JSON.stringify(recruit.skills)).toBe(before);
    });

    it('unarmed: every number equals an unarmed level 1 Melee fighter, on the Melee side', () => {
        const { recruit, fighter } = pair();
        const r = numbers(recruit);

        expect(r.style).toBe('melee');
        expect(r).toEqual(numbers(fighter));
        for (const v of [r.attack, r.defence, r.maxHp, r.hitOnEnemy, r.damage.min, r.damage.max]) {
            expect(Number.isFinite(v) && v > 0).toBe(true);
        }
    });

    it('armed: the weapon decides the side, and every number equals a level 1 fighter with it', () => {
        const bow = { id: 'fixture_recruit_bow', damage: 3 };
        const { recruit, fighter } = pair(['fixture_recruit_bow']);
        const r = numbers(recruit, bow);

        expect(r.style).toBe('ranged');
        expect(r).toEqual(numbers(fighter, bow));
    });

    it('a promoted hero is unchanged: the real level, not 1', () => {
        const hero = { skills: { ranged: { level: 30 } } };
        expect(CombatFormulas.getHeroCombatLevel(hero)).toBe(30);
        expect(CombatFormulas.getHeroCombatSkill(hero)).toBe(30);
        expect(CombatFormulas.getHeroDefenseSkill(hero)).toBe(30);
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');
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
