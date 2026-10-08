import { describe, it, expect } from 'vitest';
import {
    SKILLS, SKILL_LAYERS, SKILL_CATEGORIES, SKILL_COUNT, RECRUIT_SKILL_SLOTS,
    STARTING_SKILL_IDS, COMBAT_SKILL_IDS, ADVANCED_SKILL_IDS, MASTER_SKILL_IDS,
    getAllSkillIds, getSkill
} from '../config/registries/skillRegistry.js';
import * as SkillRegistry from '../config/registries/skillRegistry.js';
import { SKILLS as CMS_SKILLS, skillsByLayer } from '../../cms/src/utils/constants.js';

/**
 * The 25-skill registry of the class rework v2, in its four layers.
 *
 * ⚠️ These pin the owner's table on purpose: a skill moving layer is a design
 * change, and it should be a deliberate edit here as well as in the registry.
 */

describe('The 25 skills in four layers', () => {
    it('has 25 skills: 9 starting, 4 combat, 4 advanced, 8 master', () => {
        expect(SKILL_COUNT).toBe(25);
        expect(getAllSkillIds()).toHaveLength(25);
        expect(STARTING_SKILL_IDS).toHaveLength(9);
        expect(COMBAT_SKILL_IDS).toHaveLength(4);
        expect(ADVANCED_SKILL_IDS).toHaveLength(4);
        expect(MASTER_SKILL_IDS).toHaveLength(8);
    });

    it('the layers are starting, combat, advanced and master, in that order', () => {
        expect(Object.values(SKILL_LAYERS)).toEqual(['starting', 'combat', 'advanced', 'master']);
        expect(Object.values(SKILL_CATEGORIES).map(c => c.name))
            .toEqual(['Starting', 'Combat', 'Advanced', 'Master']);
    });

    it('the starting layer is exactly mining, forestry, fishing, smithing, crafting, cooking, farming, alchemy, construction', () => {
        expect(STARTING_SKILL_IDS).toEqual([
            'mining', 'forestry', 'fishing', 'smithing', 'crafting',
            'cooking', 'farming', 'alchemy', 'construction'
        ]);
        expect(RECRUIT_SKILL_SLOTS).toBe(9);
    });

    it('combat is melee, ranged, magic, stealth', () => {
        expect(COMBAT_SKILL_IDS).toEqual(['melee', 'ranged', 'magic', 'stealth']);
    });

    it('advanced is leadership, fletching, enchanting, crime', () => {
        expect(ADVANCED_SKILL_IDS).toEqual(['leadership', 'fletching', 'enchanting', 'crime']);
    });

    it('master is faith, trapping, summoning, taming, commerce, science, armory, shadowcraft', () => {
        expect(MASTER_SKILL_IDS).toEqual([
            'faith', 'trapping', 'summoning', 'taming',
            'commerce', 'science', 'armory', 'shadowcraft'
        ]);
    });

    it('logging, explore and the dropped v1 skills are gone', () => {
        const dropped = ['logging', 'explore', 'nature', 'occult', 'inscription', 'beastmaster',
            'survival', 'brewing', 'astrology', 'engineering'];
        for (const id of dropped) expect(getSkill(id), id).toBeNull();
        // And the older deletions stay deleted.
        for (const id of ['labor', 'aquatic', 'forge', 'defense', 'social']) expect(SKILLS[id], id).toBeUndefined();
    });

    it('forestry keeps the Logging sprite', () => {
        expect(getSkill('forestry')).toMatchObject({
            id: 'forestry', name: 'Forestry', layer: SKILL_LAYERS.STARTING,
            sprite: 'assets/skills/skill_logging.png'
        });
    });

    it('every skill has an id matching its key, a name, a description and an icon', () => {
        for (const [key, skill] of Object.entries(SKILLS)) {
            expect(skill.id, key).toBe(key);
            expect(skill.name, key).toBeTruthy();
            expect(skill.description, key).toBeTruthy();
            expect(skill.icon, key).toBeTruthy();
        }
    });

    it('the retired v1 layer exports are gone, so a stale import fails loudly', () => {
        for (const name of ['FOUNDATION_SKILL_IDS', 'SHARED_SKILL_IDS', 'SIGNATURE_SKILL_IDS', 'HERO_SKILL_SLOTS']) {
            expect(SkillRegistry[name], name).toBeUndefined();
        }
    });
});

describe('The CMS skill pickers follow the registry', () => {
    it('every registry skill appears in a skill-picker group', () => {
        // ⚠️ The pickers group by layer and drop a layer they have no heading
        // for, so a renamed layer would empty them silently.
        const grouped = skillsByLayer().flatMap(([, group]) => group.map(s => s.id));
        expect(grouped.sort()).toEqual(getAllSkillIds().sort());
        expect(CMS_SKILLS.map(s => s.id)).toEqual(getAllSkillIds());
    });

    it('groups the pickers by layer in registry order, headed by the game\'s layer names', () => {
        const groups = skillsByLayer();
        expect(groups.map(([label]) => label.split(' ')[0]))
            .toEqual(['Starting', 'Combat', 'Advanced', 'Master']);
        expect(groups[0][1].map(s => s.id)).toEqual(STARTING_SKILL_IDS);
    });
});
