import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { rehydrateHero, updateHeroFromSkills } from '../systems/hero/logic/HeroRehydration.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * Skill levels and the hero's modifiers: a level gives no work speed, and `addXP` grants the award
 * its caller resolved, through the XP floor.
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

describe('The XP floor: a positive XP bonus adds at least 1 XP', () => {
    /** What a cycle or kill of `base` XP grants under a summed `bonus`, as the callers resolve it. */
    function grant(base, bonus) {
        heroWithSkill('mining', 10);
        return SkillSystem.addXP('hero_1', 'mining', SkillSystem.applyXpBonus(base, base * (1 + bonus))).granted;
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
        expect(grant(1, 0.1 - 0.1)).toBe(1);
        expect(SkillSystem.applyXpBonus(5, 5.0000000001)).toBe(5);
    });

    it('applyXpBonus is the one rule for the tile axis too', () => {
        expect(SkillSystem.applyXpBonus(1, 1.1)).toBe(2);
        expect(SkillSystem.applyXpBonus(5, 5.5)).toBe(6);
        expect(SkillSystem.applyXpBonus(4, 4)).toBe(4);
        expect(SkillSystem.applyXpBonus(10, 5)).toBe(5);
    });
});
