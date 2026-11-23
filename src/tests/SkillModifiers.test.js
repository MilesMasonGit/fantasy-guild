import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { rehydrateHero, updateHeroFromSkills } from '../systems/hero/logic/HeroRehydration.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { SKILL_COUNT } from '../config/registries/skillRegistry.js';

/**
 * Skill levels and the hero's modifiers: a level gives no work speed, and `addXP` grants the award
 * its caller resolved, its fraction carried by chance.
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
        // The hero level averages every skill, the others at 1.
        expect(hero.level).toBe((99 + (SKILL_COUNT - 1)) / SKILL_COUNT);
    });
});

describe('addXP grants what the caller resolved', () => {
    // XP bonuses are resolved where the XP is earned, by skill (a cycle in `BoardRunner`, a kill in
    // `CombatResolutionProcessor`); a stray XP_BONUS on the hero's aggregator is not read here.
    it('ignores an XP_BONUS on the hero aggregator, so no bonus is counted twice', () => {
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

        expect(result.granted).toBe(100);
        expect(hero.skills.mining.xp - before).toBe(100);
    });

    it('leaves an unbuffed hero on exactly the awarded amount', () => {
        heroWithSkill('mining', 10);
        expect(SkillSystem.addXP('hero_1', 'mining', 37).granted).toBe(37);
    });

    it('never rounds a small award away to nothing', () => {
        // Progress may be slowed; it may not be stopped.
        heroWithSkill('mining', 10);
        expect(SkillSystem.addXP('hero_1', 'mining', 0.4).granted).toBe(1);
    });

    it('rounds a fractional award', () => {
        heroWithSkill('mining', 10);
        expect(SkillSystem.addXP('hero_1', 'mining', 2.6).granted).toBe(3);
    });
});

describe('An XP bonus is a true percentage: its fraction is carried by chance', () => {
    /** What a cycle or kill of `base` XP grants under a summed `bonus`, with `roll` as the draw. */
    function grant(base, bonus, roll = () => 0.5) {
        heroWithSkill('mining', 10);
        return SkillSystem.addXP('hero_1', 'mining', SkillSystem.applyXpBonus(base, base * (1 + bonus), roll)).granted;
    }

    it('+10% on a 1 XP cycle is 2 one time in ten, else 1', () => {
        expect(grant(1, 0.1, () => 0.05)).toBe(2);
        expect(grant(1, 0.1, () => 0.5)).toBe(1);
    });

    it('+10% on a 5 XP cycle is 6 half the time, else 5', () => {
        expect(grant(5, 0.1, () => 0.4)).toBe(6);
        expect(grant(5, 0.1, () => 0.6)).toBe(5);
    });

    it('a whole result draws nothing: +10% on 20 XP is 22', () => {
        const roll = vi.fn(() => 0.99);
        expect(grant(20, 0.1, roll)).toBe(22);
        expect(roll).not.toHaveBeenCalled();
    });

    it('no bonus gives the base and draws nothing', () => {
        const roll = vi.fn(() => 0);
        expect(grant(1, 0, roll)).toBe(1);
        expect(roll).not.toHaveBeenCalled();
    });

    it('a negative bonus is plain rounding, never below 1 XP, and draws nothing', () => {
        const roll = vi.fn(() => 0);
        expect(grant(10, -0.5, roll)).toBe(5);
        expect(grant(1, -0.1, roll)).toBe(1);
        expect(roll).not.toHaveBeenCalled();
    });

    it('a bonus that cancels out (+10% and -10%) gives the base and draws nothing', () => {
        const roll = vi.fn(() => 0);
        expect(grant(1, 0.1 - 0.1, roll)).toBe(1);
        expect(SkillSystem.applyXpBonus(5, 5.0000000001, roll)).toBe(5);
        expect(roll).not.toHaveBeenCalled();
    });

    it('many draws average the exact bonus', () => {
        let seed = 1;
        const roll = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        let sum = 0;
        for (let i = 0; i < 20000; i++) sum += SkillSystem.applyXpBonus(1, 1.1, roll);
        expect(sum / 20000).toBeCloseTo(1.1, 1);
    });

    it('averageXpBonus is what a cycle pays on average, drawing nothing', () => {
        expect(SkillSystem.averageXpBonus(1, 1.1)).toBeCloseTo(1.1);
        expect(SkillSystem.averageXpBonus(5, 5.5)).toBeCloseTo(5.5);
        expect(SkillSystem.averageXpBonus(4, 4)).toBe(4);
        expect(SkillSystem.averageXpBonus(10, 5)).toBe(5);
        expect(SkillSystem.averageXpBonus(1, 0.9)).toBe(1);
    });
});
