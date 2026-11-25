import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { xpForLevel } from '../utils/XPCurve.js';
import {
    SKILLS, SKILL_COUNT, SKILL_TRADES, SKILL_LAYERS, HERO_SKILL_IDS, STARTING_SKILL_IDS,
    heroSheetSkillIds, getSkill
} from '../config/registries/skillRegistry.js';
import { SKILLS as CMS_SKILLS, skillsByLayer } from '../../cms/src/utils/constants.js';
import { skillArt, SKILL_PLACEHOLDER_SPRITE } from '../ui/components/base/SkillIcon.jsx';

/** Tailor, the 21st skill: one entry in the registry, and everything that lists skills follows it. */
describe('Tailor in the registry', () => {
    it('is one of the 20 skills, a making skill every hero holds', () => {
        expect(SKILL_COUNT).toBe(20);
        expect(getSkill('tailor')).toMatchObject({
            id: 'tailor', name: 'Tailor', trade: SKILL_TRADES.CRAFTING, layer: SKILL_LAYERS.STARTING
        });
        expect(HERO_SKILL_IDS).toContain('tailor');
        expect(STARTING_SKILL_IDS).toContain('tailor');
    });

    it('has no icon yet: the shared placeholder stands in', () => {
        expect(getSkill('tailor').sprite).toBeUndefined();
        expect(skillArt('tailor').spritePath).toBe(SKILL_PLACEHOLDER_SPRITE);
    });
});

describe('Tailor on the hero sheet', () => {
    it('stands among the making skills, before the ones with no trade', () => {
        const order = heroSheetSkillIds();
        expect(order).toHaveLength(SKILL_COUNT);
        const making = order.filter(id => SKILLS[id].trade === SKILL_TRADES.CRAFTING);
        expect(making).toContain('tailor');
        const at = order.indexOf('tailor');
        expect(order.indexOf('enchanting')).toBe(at - 1);
        expect(SKILLS[order[at + 1]].trade).toBeUndefined();
    });

    it('a new hero starts with Tailor at level 1', () => {
        expect(generateHero({ name: 'Tess' }).skills.tailor).toEqual({ level: 1, xp: 0 });
    });
});

describe('an older save without Tailor', () => {
    beforeEach(() => GameState.initNew());

    it('loads with Tailor at level 1 for every hero, other levels kept', () => {
        const state = GameState.serialize().state;
        const old = (id, mining) => {
            const h = generateHero({ name: id });
            h.id = id;
            h.skills.mining = { level: mining, xp: xpForLevel(mining) };
            delete h.skills.tailor;
            return h;
        };
        state.heroes = [old('h_a', 30), old('h_b', 7)];
        const migrated = migrateState(state, GAME_VERSION);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
        loadSavedState(migrated);
        for (const h of GameState.state.heroes) {
            expect(h.skills.tailor, h.id).toEqual({ level: 1, xp: 0 });
            expect(Object.keys(h.skills).sort()).toEqual([...HERO_SKILL_IDS].sort());
        }
        expect(GameState.state.heroes.map(h => h.skills.mining.level)).toEqual([30, 7]);
    });
});

describe('the CMS skill pickers', () => {
    it('list Tailor in the Skills group', () => {
        expect(CMS_SKILLS.map(s => s.id)).toContain('tailor');
        expect(CMS_SKILLS).toHaveLength(SKILL_COUNT);
        const [, skills] = skillsByLayer().find(([label]) => label.startsWith('Skills'));
        expect(skills.map(s => s.id)).toContain('tailor');
    });
});
