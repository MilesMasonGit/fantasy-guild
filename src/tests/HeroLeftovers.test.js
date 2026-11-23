import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { HERO_PORTRAITS } from '../config/registries/heroPortraits.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';

/** What a hero no longer carries, and the portrait a recruit arrives in being one a player may pick. */

beforeEach(() => GameState.initNew());

describe('the Hall recruit\'s portrait', () => {
    it('is in the portrait picker, so a recruit who changes portrait can change back', () => {
        const recruit = generateHero({ name: 'Newcomer' });
        expect(HERO_PORTRAITS).toContain(recruit.spriteId);
        expect(new Set(HERO_PORTRAITS).size).toBe(HERO_PORTRAITS.length);
    });
});

describe('a wound deadline', () => {
    it('is not on a new hero, and an old save\'s is dropped on load', () => {
        expect('woundedUntil' in generateHero({ name: 'Fresh' })).toBe(false);
        const old = { ...generateHero({ name: 'Old' }), woundedUntil: 12345 };
        rehydrateHero(old);
        expect('woundedUntil' in old).toBe(false);
    });
});

describe('a skill requirement', () => {
    it('reads the hero\'s level: there is no separate effective level', () => {
        expect(SkillSystem.getEffectiveLevel).toBeUndefined();
        const hero = generateHero({ name: 'Gate' });
        hero.skills = { mining: { level: 5, xp: 0 } };
        GameState.state.heroes = [hero];
        expect(SkillSystem.requirementFailure(hero.id, { skill: 'mining', level: 5 })).toBeNull();
        expect(SkillSystem.requirementFailure(hero.id, { skill: 'mining', level: 6 })).toBe('LEVEL');
        expect(SkillSystem.requirementFailure(hero.id, { skill: 'forestry', level: 1 })).toBe('POSSESSION');
    });
});
