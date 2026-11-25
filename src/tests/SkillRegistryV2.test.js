import { describe, it, expect } from 'vitest';
import {
    SKILLS, SKILL_LAYERS, SKILL_CATEGORIES, SKILL_COUNT, HERO_SKILL_IDS, RETIRED_SKILL_IDS,
    STARTING_SKILL_IDS, COMBAT_SKILL_IDS,
    getAllSkillIds, getSkill
} from '../config/registries/skillRegistry.js';
import * as SkillRegistry from '../config/registries/skillRegistry.js';
import { SKILLS as CMS_SKILLS, skillsByLayer } from '../../cms/src/utils/constants.js';

/**
 * The skill registry of classless heroes (brief 270 K1): 21 skills in two layers, every one held
 * by every hero. Rewritten from the class rework's 25 in two layers: five skills were cut and
 * every skill that is not a combat style became one list.
 *
 * ⚠️ These pin the owner's table on purpose: a skill moving layer is a design
 * change, and it should be a deliberate edit here as well as in the registry.
 */

describe('The 21 skills in two layers', () => {
    it('has 21 skills: 17 non-combat, 4 combat, every one a hero holds', () => {
        expect(SKILL_COUNT).toBe(21);
        expect(getAllSkillIds()).toHaveLength(20);
        expect(HERO_SKILL_IDS).toEqual(getAllSkillIds());
        expect(STARTING_SKILL_IDS).toHaveLength(16);
        expect(COMBAT_SKILL_IDS).toHaveLength(4);
    });

    it('the layers are starting and combat, in that order', () => {
        expect(Object.values(SKILL_LAYERS)).toEqual(['starting', 'combat']);
        expect(Object.values(SKILL_CATEGORIES).map(c => c.name))
            .toEqual(['Skills', 'Combat']);
    });

    it('the starting layer is the nine everyday skills, then the seven the owner kept and Tailor', () => {
        expect(STARTING_SKILL_IDS).toEqual([
            'mining', 'forestry', 'fishing', 'smithing', 'crafting',
            'cooking', 'farming', 'alchemy', 'construction',
            'fletching', 'faith', 'summoning', 'enchanting', 'tailor', 'crime', 'science'
        ]);
    });

    it('combat is melee, ranged, magic, stealth', () => {
        expect(COMBAT_SKILL_IDS).toEqual(['melee', 'ranged', 'magic', 'stealth']);
    });

    it('leadership, commerce, trapping, armory and shadowcraft are cut', () => {
        expect(RETIRED_SKILL_IDS).toEqual(['leadership', 'commerce', 'trapping', 'armory', 'shadowcraft', 'taming']);
        for (const id of RETIRED_SKILL_IDS) expect(getSkill(id), id).toBeNull();
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
            sprite: 'assets/skills/s_logging.png'
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
        for (const name of ['FOUNDATION_SKILL_IDS', 'SHARED_SKILL_IDS', 'SIGNATURE_SKILL_IDS', 'HERO_SKILL_SLOTS',
            'ADVANCED_SKILL_IDS', 'MASTER_SKILL_IDS', 'RECRUIT_SKILL_SLOTS']) {
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
            .toEqual(['Skills', 'Combat']);
        expect(groups[0][1].map(s => s.id)).toEqual(STARTING_SKILL_IDS);
    });
});
