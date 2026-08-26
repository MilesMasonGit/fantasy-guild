import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { rehydrateHero, updateHeroSkillModifiers } from '../systems/hero/logic/HeroRehydration.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { SKILL_SPEED_FACTOR } from '../config/FormulaRegistry.js';

/**
 * **The two hero-side modifier wires that were connected at one end only.**
 *
 * Both were live for months, both were silent, and both were the same shape: a
 * value produced and filed under a name nothing could look up.
 *
 * - **CR2-072** — every skill level registers a `SPEED` modifier, filed under
 *   `skillId.toUpperCase()` (`'MINING'`). Categories are lower-case everywhere
 *   else and `_forEachMatching` compares them case-sensitively, so the query
 *   returned 0. Nothing read `SPEED` at all either.
 * - **CR2-073** — `getXpMultiplier` read `EFFECT_TYPES.XP_GAIN`, which does not
 *   exist (the axis is `XP_BONUS`), so it always returned exactly 1 — and it
 *   had no callers, so even a corrected name would have changed nothing.
 *
 * A modifier that resolves to "no change" looks identical to a modifier that
 * was never written. That is why both ends are pinned here.
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

describe('Skill speed is filed where a reader can find it (CR2-072)', () => {
    it('registers the SPEED modifier under the LOWER-case skill id', () => {
        const hero = heroWithSkill('mining', 60);

        // The exact query a consumer makes. Before the fix this was 0 and the
        // upper-cased spelling was the only one that answered.
        expect(hero.aggregator.query(EFFECT_TYPES.SPEED, 'mining')).toBeCloseTo(0.3);
        expect(hero.aggregator.query(EFFECT_TYPES.SPEED, 'MINING')).toBe(0);
    });

    it('resolves to a percentage bucket a cycle time can be divided by', () => {
        const hero = heroWithSkill('mining', 60);

        expect(hero.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'mining'))
            .toBeCloseTo(1 + 60 * SKILL_SPEED_FACTOR);
    });

    it('grows with the level, and is neutral at level 0', () => {
        const novice = heroWithSkill('mining', 0);
        expect(novice.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'mining')).toBe(1);

        novice.skills.mining.level = 40;
        updateHeroSkillModifiers(novice);
        expect(novice.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'mining'))
            .toBeCloseTo(1 + 40 * SKILL_SPEED_FACTOR);
    });

    it('does not make a hero faster at a skill they did not level', () => {
        const hero = heroWithSkill('mining', 60);
        expect(hero.aggregator.getPercentageBucket(EFFECT_TYPES.SPEED, 'cooking')).toBe(1);
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
