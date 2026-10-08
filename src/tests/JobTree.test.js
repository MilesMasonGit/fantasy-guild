import { describe, it, expect } from 'vitest';
import {
    JOB_TIERS, STARTING_JOB_ID,
    getAllJobIds, getJob, getJobsByTier, getPromotionsFrom,
    getJobSkills, getJobSheet, getJobSkillsByLayer, getJobCombatSkill, getJobMasterSkill,
    jobCanFight, grantsOf, removesOf, getPromotionGateSkills, getJobLineage,
    getPromotionCost
} from '../config/registries/jobRegistry.js';
import * as JobRegistry from '../config/registries/jobRegistry.js';
import {
    SKILLS, SKILL_LAYERS, RECRUIT_SKILL_SLOTS,
    STARTING_SKILL_IDS, COMBAT_SKILL_IDS, ADVANCED_SKILL_IDS, MASTER_SKILL_IDS
} from '../config/registries/skillRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { canHeroFight } from '../utils/CombatFormulas.js';

/**
 * The job tree's structural rules, asserted mechanically: the Recruit, four
 * basic classes and eight master classes.
 *
 * ⚠️ **This suite is what makes the tree safe to rearrange.** Every rule below
 * is one that a human eye stops catching somewhere around the sixth sheet, and
 * every one of them would fail *silently* in play rather than throwing.
 *
 * The rules read a job's skills by layer, so a basic class may also list
 * Starting skills (the promotion gate's picks) without breaking them.
 */

const BASIC = getJobsByTier(JOB_TIERS.BASIC);
const MASTER = getJobsByTier(JOB_TIERS.MASTER);

/** The master classes that list `skillId`. */
function masterHolding(skillId) {
    return MASTER.filter(id => getJobSkills(id).includes(skillId));
}

describe('The tree is the Recruit, 4 basic and 8 master classes', () => {
    it('the tree is the Recruit, 4 basic and 8 master classes', () => {
        expect(getJobsByTier(JOB_TIERS.RECRUIT)).toEqual([STARTING_JOB_ID]);
        expect(BASIC).toEqual(['fighter', 'ranger', 'wizard', 'rogue']);
        expect([...MASTER].sort()).toEqual([
            'assassin', 'beastmaster', 'hunter', 'knight',
            'merchant', 'necromancer', 'paladin', 'scholar'
        ]);
        expect(getAllJobIds()).toHaveLength(13);
    });

    it('the tiers are Recruit, basic and master', () => {
        expect(JOB_TIERS).toEqual({ RECRUIT: 0, BASIC: 1, MASTER: 2 });
    });

    it('every basic class branches into two master classes', () => {
        const children = Object.fromEntries(BASIC.map(id => [id, getPromotionsFrom(id).sort()]));
        expect(children).toEqual({
            fighter: ['knight', 'paladin'],
            ranger: ['beastmaster', 'hunter'],
            wizard: ['necromancer', 'scholar'],
            rogue: ['assassin', 'merchant']
        });
    });

    it.each(getAllJobIds())('%s names only real skills, with no duplicates', (jobId) => {
        const skills = getJobSkills(jobId);
        for (const id of skills) {
            expect(SKILLS[id], `${jobId} names unknown skill "${id}"`).toBeDefined();
        }
        expect(new Set(skills).size, `${jobId} lists a skill twice`).toBe(skills.length);
    });

    it('the retired v1 names are gone, so a stale import fails loudly', () => {
        for (const name of ['getJobSignatureSkill', 'HERO_SKILL_SLOTS']) {
            expect(JobRegistry[name], name).toBeUndefined();
        }
        expect(JOB_TIERS.BASE).toBeUndefined();
        expect(JOB_TIERS.ADVANCED).toBeUndefined();
    });
});

describe('Each tier has the shape the design specifies', () => {
    it('the Recruit is exactly the Starting layer, and cannot fight', () => {
        expect(getJobSkills(STARTING_JOB_ID).sort()).toEqual([...STARTING_SKILL_IDS].sort());
        expect(getJobCombatSkill(STARTING_JOB_ID)).toBeNull();
        expect(jobCanFight(STARTING_JOB_ID)).toBe(false);
    });

    it('each basic class lists its combat and advanced skill (Fighter melee + leadership, Ranger ranged + fletching, Wizard magic + enchanting, Rogue stealth + crime)', () => {
        const pairs = Object.fromEntries(BASIC.map(id => [id, [
            ...getJobSkillsByLayer(id, SKILL_LAYERS.COMBAT),
            ...getJobSkillsByLayer(id, SKILL_LAYERS.ADVANCED)
        ]]));
        expect(pairs).toEqual({
            fighter: ['melee', 'leadership'],
            ranger: ['ranged', 'fletching'],
            wizard: ['magic', 'enchanting'],
            rogue: ['stealth', 'crime']
        });
        for (const id of BASIC) {
            expect(getJobSkillsByLayer(id, SKILL_LAYERS.MASTER), id).toEqual([]);
            expect(getJobMasterSkill(id), id).toBeNull();
        }
    });

    it('every combat skill belongs to exactly one basic class', () => {
        for (const skillId of COMBAT_SKILL_IDS) {
            const owners = BASIC.filter(id => getJobCombatSkill(id) === skillId);
            expect(owners, skillId).toHaveLength(1);
        }
    });

    it.each(MASTER)('%s keeps its parent\'s two skills and adds one other advanced skill and one master skill', (jobId) => {
        const parentId = getJob(jobId).parent;
        const combat = getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT);
        const advanced = getJobSkillsByLayer(jobId, SKILL_LAYERS.ADVANCED);
        const parentAdvanced = getJobSkillsByLayer(parentId, SKILL_LAYERS.ADVANCED);

        expect(combat).toEqual([getJobCombatSkill(parentId)]);
        expect(advanced).toHaveLength(2);
        expect(advanced).toEqual(expect.arrayContaining(parentAdvanced));
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.MASTER)).toHaveLength(1);
    });

    it('the master classes are the owner\'s table (concept §5.3, Leadership in place of Construction)', () => {
        const sheet = (id) => [
            ...getJobSkillsByLayer(id, SKILL_LAYERS.COMBAT),
            ...getJobSkillsByLayer(id, SKILL_LAYERS.ADVANCED).sort(),
            getJobMasterSkill(id)
        ];
        expect(Object.fromEntries(MASTER.map(id => [id, [getJob(id).parent, ...sheet(id)]]))).toEqual({
            paladin: ['fighter', 'melee', 'enchanting', 'leadership', 'faith'],
            knight: ['fighter', 'melee', 'fletching', 'leadership', 'armory'],
            beastmaster: ['ranger', 'ranged', 'enchanting', 'fletching', 'taming'],
            hunter: ['ranger', 'ranged', 'crime', 'fletching', 'trapping'],
            necromancer: ['wizard', 'magic', 'crime', 'enchanting', 'summoning'],
            scholar: ['wizard', 'magic', 'enchanting', 'leadership', 'science'],
            merchant: ['rogue', 'stealth', 'crime', 'leadership', 'commerce'],
            assassin: ['rogue', 'stealth', 'crime', 'fletching', 'shadowcraft']
        });
    });

    it('every master skill belongs to exactly one master class', () => {
        for (const skillId of MASTER_SKILL_IDS) {
            expect(MASTER.filter(id => getJobMasterSkill(id) === skillId), skillId).toHaveLength(1);
        }
    });

    it('every advanced skill is held by exactly four master classes', () => {
        for (const skillId of ADVANCED_SKILL_IDS) {
            expect(masterHolding(skillId), skillId).toHaveLength(4);
        }
    });

    it('every promoted job can fight; only the Recruit cannot', () => {
        for (const jobId of [...BASIC, ...MASTER]) {
            expect(jobCanFight(jobId), `${jobId} cannot fight`).toBe(true);
        }
    });
});

describe('A promotion adds; it never removes a Starting skill', () => {
    it('a hero holds 9, 11 and 13 skills by tier', () => {
        expect(getJobSheet(STARTING_JOB_ID)).toHaveLength(9);
        for (const id of BASIC) expect(getJobSheet(id), id).toHaveLength(11);
        for (const id of MASTER) expect(getJobSheet(id), id).toHaveLength(13);
    });

    it.each(getAllJobIds())('%s holds every Starting skill (getJobSheet)', (jobId) => {
        const sheet = getJobSheet(jobId);
        for (const id of STARTING_SKILL_IDS) expect(sheet, `${jobId} lacks ${id}`).toContain(id);
        expect(new Set(sheet).size, `${jobId} sheet has a duplicate`).toBe(sheet.length);
    });

    it.each(BASIC)('%s removes nothing and adds exactly its combat and advanced skill', (jobId) => {
        expect(removesOf(jobId)).toEqual([]);
        expect(grantsOf(jobId).sort()).toEqual([
            ...getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT),
            ...getJobSkillsByLayer(jobId, SKILL_LAYERS.ADVANCED)
        ].sort());
    });

    it.each(MASTER)('%s removes nothing and adds exactly its second advanced skill and its master skill', (jobId) => {
        expect(removesOf(jobId)).toEqual([]);
        const grants = grantsOf(jobId);
        expect(grants).toHaveLength(2);
        expect(grants).toContain(getJobMasterSkill(jobId));
        for (const id of grants) {
            expect(SKILLS[id].layer, `${jobId} grants "${id}"`).not.toBe(SKILL_LAYERS.STARTING);
        }
    });

    it('a promotion never removes the skills it gates on', () => {
        for (const jobId of [...BASIC, ...MASTER]) {
            const removed = new Set(removesOf(jobId));
            for (const gate of getPromotionGateSkills(jobId)) {
                expect(removed.has(gate), `${jobId} gates on "${gate}" then removes it`).toBe(false);
            }
        }
    });
});

describe('The tree is connected and complete', () => {
    it('every job descends from the Recruit', () => {
        for (const jobId of getAllJobIds()) {
            expect(getJobLineage(jobId)[0], `${jobId} is orphaned`).toBe(STARTING_JOB_ID);
        }
    });

    it('only the Recruit has no parent, and every master class has a basic parent', () => {
        expect(getAllJobIds().filter(id => !getJob(id).parent)).toEqual([STARTING_JOB_ID]);
        for (const id of BASIC) expect(getJob(id).parent, id).toBe(STARTING_JOB_ID);
        for (const id of MASTER) expect(BASIC, id).toContain(getJob(id).parent);
    });

    it('every promoted job has a cost, and the Recruit does not', () => {
        expect(getPromotionCost(STARTING_JOB_ID)).toBeNull();
        for (const jobId of [...BASIC, ...MASTER]) {
            const cost = getPromotionCost(jobId);
            expect(cost, `${jobId} has no cost`).not.toBeNull();
            expect(cost.skillLevel).toBeGreaterThan(0);
        }
    });

    it('a master class demands more of a hero than the first promotion', () => {
        expect(getPromotionCost(MASTER[0]).skillLevel)
            .toBeGreaterThan(getPromotionCost(BASIC[0]).skillLevel);
    });

    /** The price is a Token, so nothing here may quietly re-grow a gold cost. */
    it('charges no gold and no materials', () => {
        for (const jobId of [BASIC[0], MASTER[0]]) {
            expect(getPromotionCost(jobId).gold).toBeUndefined();
            expect(getPromotionCost(jobId).materials).toBeUndefined();
        }
    });

    it('a master class gates on its parent\'s combat and advanced skill', () => {
        for (const jobId of MASTER) {
            const parentId = getJob(jobId).parent;
            expect(getPromotionGateSkills(jobId).sort(), jobId).toEqual([
                ...getJobSkillsByLayer(parentId, SKILL_LAYERS.COMBAT),
                ...getJobSkillsByLayer(parentId, SKILL_LAYERS.ADVANCED)
            ].sort());
        }
    });
});

describe('Hero generation reads the tree, rather than repeating it', () => {
    it('a generated hero holds exactly the Recruit\'s sheet', () => {
        const hero = generateHero();
        expect(hero.jobId).toBe(STARTING_JOB_ID);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills(STARTING_JOB_ID)].sort());
    });

    it.each(getAllJobIds())('generating straight into %s produces that sheet', (jobId) => {
        const hero = generateHero({ jobId });
        expect(hero.jobId).toBe(jobId);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet(jobId)].sort());
        expect(Object.keys(hero.skills).length).toBeGreaterThanOrEqual(RECRUIT_SKILL_SLOTS);
    });

    it('only a hero on a fighting job can fight', () => {
        for (const jobId of getAllJobIds()) {
            const hero = generateHero({ jobId });
            expect(canHeroFight(hero), `${jobId}`).toBe(jobCanFight(jobId));
        }
    });
});
