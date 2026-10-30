import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { rehydrateHero, updateHeroFromSkills } from '../systems/hero/logic/HeroRehydration.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * Skill levels and the hero's modifiers: a level gives no work speed, and XP bonuses reach the bar.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** A hero holding exactly one named skill, at `level`. */
function heroWithSkill(skillId, level) {
    const hero = generateHero({ name: 'subject' });
    hero.id = 'hero_1';
    hero.skills = { [skillId]: { level, xp: 0 } };
    rehydrateHero(hero);
    GameState.state.heroes = [hero];
    return hero;
}

beforeEach(() => {
    GameState.initNew();
});

describe('A skill level adds no work speed', () => {
    it('registers no SPEED modifier for a held skill, on rehydrate or on a level-up', () => {
        const hero = heroWithSkill('mining', 60);
        expect(hero.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'mining')).toBe(1);

        hero.skills.mining.level = 99;
        updateHeroFromSkills(hero);
        expect(hero.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'mining')).toBe(1);
        // Rewritten with classless heroes: the hero level averages all twenty skills, the other
        // nineteen at 1.
        expect(hero.level).toBe((99 + 19) / 20);
    });
});

describe('XP bonuses reach the XP bar (CR2-073)', () => {
    it('reads the axis that exists — XP_BONUS, not XP_GAIN', () => {
        const hero = heroWithSkill('mining', 10);
        hero.aggregator.addModifier({
            source: 'test:charm',
            type: EFFECT_TYPES.XP_BONUS,
            target: { category: 'mining' },
            value: 0.5,
            persistent: true
        });

        expect(SkillSystem.getXpMultiplier('hero_1', 'mining')).toBeCloseTo(1.5);
    });

    it('applies the multiplier when XP is actually awarded', () => {
        const hero = heroWithSkill('mining', 10);
        hero.aggregator.addModifier({
            source: 'test:charm',
            type: EFFECT_TYPES.XP_BONUS,
            target: { category: 'mining' },
            value: 0.5,
            persistent: true
        });
        const before = hero.skills.mining.xp;

        const result = SkillSystem.addXP('hero_1', 'mining', 100);

        expect(result.granted).toBe(150);
        expect(hero.skills.mining.xp - before).toBe(150);
    });

    it('is targeted — a Cooking bonus does nothing for Mining', () => {
        const hero = heroWithSkill('mining', 10);
        hero.aggregator.addModifier({
            source: 'test:apron',
            type: EFFECT_TYPES.XP_BONUS,
            target: { category: 'cooking' },
            value: 0.5,
            persistent: true
        });

        expect(SkillSystem.addXP('hero_1', 'mining', 100).granted).toBe(100);
    });

    it('leaves an unbuffed hero on exactly the awarded amount', () => {
        heroWithSkill('mining', 10);
        expect(SkillSystem.addXP('hero_1', 'mining', 37).granted).toBe(37);
    });

    it('never rounds a small award away to nothing', () => {
        // A hypothetical −90% would otherwise turn a 1 XP grant into 0 and stall
        // a bar completely. Progress may be slowed; it may not be stopped.
        const hero = heroWithSkill('mining', 10);
        hero.aggregator.addModifier({
            source: 'test:curse',
            type: EFFECT_TYPES.XP_BONUS,
            target: { category: 'mining' },
            value: -0.9,
            persistent: true
        });

        expect(SkillSystem.addXP('hero_1', 'mining', 1).granted).toBe(1);
    });
});

describe('The XP floor: a positive XP bonus adds at least 1 XP', () => {
    function grant(base, bonus) {
        const hero = heroWithSkill('mining', 10);
        if (bonus) {
            hero.aggregator.addModifier({
                source: 'test:charm', type: EFFECT_TYPES.XP_BONUS,
                target: { category: 'mining' }, value: bonus, persistent: true
            });
        }
        return SkillSystem.addXP('hero_1', 'mining', base).granted;
    }

    it('+10% on a 1 XP cycle gives 2', () => expect(grant(1, 0.1)).toBe(2));
    it('+10% on a 5 XP cycle gives 6', () => expect(grant(5, 0.1)).toBe(6));
    it('+10% on a 20 XP cycle gives 22', () => expect(grant(20, 0.1)).toBe(22));
    it('no bonus gives the base', () => expect(grant(1, 0)).toBe(1));
    it('a negative bonus is plain rounding, never below 1 XP', () => {
        expect(grant(10, -0.5)).toBe(5);
        expect(grant(1, -0.1)).toBe(1);
    });

    it('a bonus that cancels out (+10% and -10%) gives the base', () => {
        const hero = heroWithSkill('mining', 10);
        for (const value of [0.1, -0.1]) {
            hero.aggregator.addModifier({
                source: 'test:' + value, type: EFFECT_TYPES.XP_BONUS,
                target: { category: 'mining' }, value, persistent: true
            });
        }
        expect(SkillSystem.addXP('hero_1', 'mining', 1).granted).toBe(1);
        expect(SkillSystem.applyXpBonus(5, 5.0000000001)).toBe(5);
    });

    it('applyXpBonus is the one rule for the tile axis too', () => {
        expect(SkillSystem.applyXpBonus(1, 1.1)).toBe(2);
        expect(SkillSystem.applyXpBonus(5, 5.5)).toBe(6);
        expect(SkillSystem.applyXpBonus(4, 4)).toBe(4);
        expect(SkillSystem.applyXpBonus(10, 5)).toBe(5);
    });
});
