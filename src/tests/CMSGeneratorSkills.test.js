import { describe, it, expect } from 'vitest';
import { getAllSkillIds, isSkillId } from '../config/registries/skillRegistry.js';
import {
    DEFAULT_GENERATOR_SKILL,
    generatorSkillList,
    buildSystemPrompt,
    buildUserPrompt,
} from '../../cms/src/engine/contentGenerator.js';

/**
 * The CMS's AI content generator names skills in its prompt and in the
 * defaults of its modal. Both used to be hand-typed and drifted to skills the
 * game no longer has (`nature`), so they are read from the game's registry.
 */
describe('the CMS content generator\'s skills', () => {
    it('the generator\'s default skill is a registry skill', () => {
        expect(isSkillId(DEFAULT_GENERATOR_SKILL)).toBe(true);
    });

    it('the generator\'s skill list is the registry\'s', () => {
        expect(generatorSkillList()).toBe(getAllSkillIds().join(', '));

        const globals = { gpt: 1, skillMultiplierRate: 0.01, energyGpValue: 1, healthGpValue: 1, xpToGoldRatio: 1, sellModifiers: {} };
        const prompt = buildSystemPrompt(globals, {}, {});
        const skillsSection = prompt.split('## SKILLS\n')[1].split('\n')[0];
        expect(skillsSection).toBe(getAllSkillIds().join(', '));
    });

    it('an area request with no skills falls back to registry skills', () => {
        const prompt = buildUserPrompt({ type: 'generate_area' }, {});
        const line = prompt.split('\n').find((l) => l.startsWith('Primary skills: '));
        const ids = line.slice('Primary skills: '.length).split(', ');
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) expect(isSkillId(id)).toBe(true);
    });
});
