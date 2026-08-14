import { describe, it, expect } from 'vitest';
import {
    JOBS, JOB_TIERS, STARTING_JOB_ID,
    getAllJobIds, getJob, getJobsByTier, getPromotionsFrom,
    getJobSkills, getJobSkillsByLayer, getJobCombatSkill, getJobSignatureSkill,
    jobCanFight, grantsOf, removesOf, getPromotionGateSkills, getJobLineage,
    getPromotionCost
} from '../config/registries/jobRegistry.js';
import {
    SKILLS, SKILL_LAYERS, HERO_SKILL_SLOTS,
    FOUNDATION_SKILL_IDS, COMBAT_SKILL_IDS,
    SHARED_SKILL_IDS, SIGNATURE_SKILL_IDS
} from '../config/registries/skillRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { canHeroFight } from '../utils/CombatFormulas.js';

/**
 * The job tree's structural rules, asserted mechanically.
 *
 * ⚠️ **This suite is what makes the tree safe to rearrange.** The owner has
 * said the job list is a first draft — which jobs exist, what each holds, and
 * the shape of the tree are all expected to move. Every rule below is one that
 * a human eye stops catching somewhere around the sixth sheet, and every one of
 * them would fail *silently* in play rather than throwing.
 *
 * Nothing here hardcodes a skill or job name except where the rule genuinely is
 * about a specific thing. Counts derive from the registries, so adding a
 * seventh base class or a thirteenth signature puts it under every rule
 * automatically.
 */

const ADVANCED = getJobsByTier(JOB_TIERS.ADVANCED);
const BASE = getJobsByTier(JOB_TIERS.BASE);

/** How many advanced jobs hold `skillId`. */
function advancedHolding(skillId) {
    return ADVANCED.filter(id => getJobSkills(id).includes(skillId));
}

describe('Every job sheet is well-formed', () => {
    it.each(getAllJobIds())('%s holds exactly HERO_SKILL_SLOTS skills', (jobId) => {
        // Width never changes. Promotion swaps contents — that is the whole
        // reason a promotion reads as becoming someone else rather than
        // accumulating a bigger sheet.
        expect(getJobSkills(jobId)).toHaveLength(HERO_SKILL_SLOTS);
    });

    it.each(getAllJobIds())('%s names only real skills, with no duplicates', (jobId) => {
        const skills = getJobSkills(jobId);
        for (const id of skills) {
            expect(SKILLS[id], `${jobId} names unknown skill "${id}"`).toBeDefined();
        }
        expect(new Set(skills).size, `${jobId} lists a skill twice`).toBe(skills.length);
    });
});

describe('Each tier has the shape the design specifies', () => {
    it('the Recruit is exactly the Foundation six, and cannot fight', () => {
        expect(getJobSkills(STARTING_JOB_ID).sort())
            .toEqual([...FOUNDATION_SKILL_IDS].sort());
        expect(getJobCombatSkill(STARTING_JOB_ID)).toBeNull();
        expect(jobCanFight(STARTING_JOB_ID)).toBe(false);
    });

    it.each(BASE)('%s is 4 foundation · 1 combat · 1 shared', (jobId) => {
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)).toHaveLength(4);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)).toHaveLength(1);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SHARED)).toHaveLength(1);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SIGNATURE)).toHaveLength(0);
    });

    it.each(ADVANCED)('%s is 2 foundation · 1 combat · 2 shared · 1 signature', (jobId) => {
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)).toHaveLength(2);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)).toHaveLength(1);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SHARED)).toHaveLength(2);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SIGNATURE)).toHaveLength(1);
    });

    it('every promoted job can fight; only the Recruit cannot', () => {
        for (const jobId of [...BASE, ...ADVANCED]) {
            expect(jobCanFight(jobId), `${jobId} cannot fight`).toBe(true);
        }
    });
});

describe('A promotion narrows — it never hands back what a tier dropped', () => {
    it.each([...BASE, ...ADVANCED])('%s removes exactly 2 and adds exactly 2', (jobId) => {
        expect(removesOf(jobId), `${jobId} removals`).toHaveLength(2);
        expect(grantsOf(jobId), `${jobId} grants`).toHaveLength(2);
    });

    it.each(ADVANCED)("%s's foundation pair is a subset of its parent's four", (jobId) => {
        // The rule that stops a promotion restoring something the previous tier
        // gave up. Without it a hero could route around the narrowing entirely.
        const parentFoundation = new Set(
            getJobSkillsByLayer(getJob(jobId).parent, SKILL_LAYERS.FOUNDATION)
        );
        for (const id of getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)) {
            expect(parentFoundation.has(id),
                `${jobId} keeps "${id}", which ${getJob(jobId).parent} does not have`
            ).toBe(true);
        }
    });

    it.each(ADVANCED)('%s carries its combat skill and its parent shared forward', (jobId) => {
        const parentId = getJob(jobId).parent;
        expect(getJobCombatSkill(jobId)).toBe(getJobCombatSkill(parentId));

        const parentShared = getJobSkillsByLayer(parentId, SKILL_LAYERS.SHARED)[0];
        expect(getJobSkills(jobId)).toContain(parentShared);
    });

    it.each(ADVANCED)('%s gains its signature only at tier 2', (jobId) => {
        expect(grantsOf(jobId)).toContain(getJobSignatureSkill(jobId));
    });

    it('a promotion never removes the skills it gates on', () => {
        // D-262 gates on the skills carried FORWARD. Gating on something the
        // same promotion takes away would be incoherent.
        for (const jobId of [...BASE, ...ADVANCED]) {
            const removed = new Set(removesOf(jobId));
            for (const gate of getPromotionGateSkills(jobId)) {
                expect(removed.has(gate), `${jobId} gates on "${gate}" then removes it`).toBe(false);
            }
        }
    });
});

describe('Signature skills are exclusive (D-257)', () => {
    it('every signature skill belongs to exactly one job', () => {
        const owners = {};
        for (const jobId of ADVANCED) {
            const sig = getJobSignatureSkill(jobId);
            owners[sig] = (owners[sig] || []).concat(jobId);
        }
        for (const [sig, jobs] of Object.entries(owners)) {
            expect(jobs, `"${sig}" is held by more than one job`).toHaveLength(1);
        }
    });

    it('every signature skill in the registry has a job that grants it', () => {
        // The mirror: a signature nobody grants is content no player can reach.
        const granted = new Set(ADVANCED.map(getJobSignatureSkill));
        for (const id of SIGNATURE_SKILL_IDS) {
            expect(granted.has(id), `no job grants signature "${id}"`).toBe(true);
        }
    });

    it('no base class grants a signature skill', () => {
        for (const jobId of BASE) {
            expect(getJobSignatureSkill(jobId), `${jobId} grants a signature too early`).toBeNull();
        }
    });
});

describe('⚠️ Coverage — the audit that makes the tree authorable (D-268)', () => {
    // A fully-promoted guild must collectively cover the Foundation six, or
    // whole swathes of ordinary content become unreachable. And a shared skill
    // held by half the tree while another is held by a quarter means their
    // authored content is worth wildly different amounts of effort.
    //
    // Both are now EVEN, and these tests are what keep them that way.

    const perFoundation = ADVANCED.length * 2 / FOUNDATION_SKILL_IDS.length;
    const perShared = ADVANCED.length * 2 / SHARED_SKILL_IDS.length;

    it.each(FOUNDATION_SKILL_IDS)('%s is held by an even share of advanced jobs', (skillId) => {
        expect(advancedHolding(skillId).length).toBe(perFoundation);
    });

    it.each(SHARED_SKILL_IDS)('%s is held by an even share of advanced jobs', (skillId) => {
        // This is the rule D-268 exists to enforce. Before it, Leadership sat
        // at 7 of 12 while Nature, Crime and Enchanting sat at 3.
        expect(advancedHolding(skillId).length).toBe(perShared);
    });

    it.each(COMBAT_SKILL_IDS)('%s is available from an even share of advanced jobs', (skillId) => {
        expect(advancedHolding(skillId).length).toBe(ADVANCED.length / COMBAT_SKILL_IDS.length);
    });

    it('the Foundation six stay collectively coverable by a full guild', () => {
        for (const skillId of FOUNDATION_SKILL_IDS) {
            expect(advancedHolding(skillId).length,
                `no advanced job keeps "${skillId}" — a fully-promoted guild loses it`
            ).toBeGreaterThan(0);
        }
    });
});

describe('The tree is connected and complete', () => {
    it('every job descends from the Recruit', () => {
        for (const jobId of getAllJobIds()) {
            expect(getJobLineage(jobId)[0], `${jobId} is orphaned`).toBe(STARTING_JOB_ID);
        }
    });

    it('every base class branches into the same number of jobs', () => {
        const counts = BASE.map(id => getPromotionsFrom(id).length);
        expect(new Set(counts).size, `uneven branching: ${counts.join(', ')}`).toBe(1);
    });

    it('only the Recruit has no parent', () => {
        const rootless = getAllJobIds().filter(id => !getJob(id).parent);
        expect(rootless).toEqual([STARTING_JOB_ID]);
    });

    it('every promoted job has a cost, and the Recruit does not', () => {
        expect(getPromotionCost(STARTING_JOB_ID)).toBeNull();
        for (const jobId of [...BASE, ...ADVANCED]) {
            const cost = getPromotionCost(jobId);
            expect(cost, `${jobId} has no cost`).not.toBeNull();
            expect(cost.skillLevel).toBeGreaterThan(0);
        }
    });

    it('advancing costs more than the first promotion', () => {
        expect(PROMOTION_COST_AT(JOB_TIERS.ADVANCED).skillLevel)
            .toBeGreaterThan(PROMOTION_COST_AT(JOB_TIERS.BASE).skillLevel);
        expect(PROMOTION_COST_AT(JOB_TIERS.ADVANCED).gold)
            .toBeGreaterThan(PROMOTION_COST_AT(JOB_TIERS.BASE).gold);
    });
});

describe('Hero generation reads the tree, rather than repeating it', () => {
    it('a generated hero holds exactly their job sheet', () => {
        // The registry is the single source of truth. If these two can drift,
        // changing a Recruit means editing two files and remembering both.
        const hero = generateHero();

        expect(hero.jobId).toBe(STARTING_JOB_ID);
        expect(Object.keys(hero.skills).sort())
            .toEqual([...getJobSkills(STARTING_JOB_ID)].sort());
    });

    it.each(getAllJobIds())('generating straight into %s produces that sheet', (jobId) => {
        // Phase 5 promotes heroes properly; this proves the data is right and
        // the wiring honours it, without waiting for that machinery.
        const hero = generateHero({ jobId });

        expect(hero.jobId).toBe(jobId);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills(jobId)].sort());
        expect(Object.keys(hero.skills)).toHaveLength(HERO_SKILL_SLOTS);
    });

    it('only a hero on a fighting job can fight', () => {
        for (const jobId of getAllJobIds()) {
            const hero = generateHero({ jobId });
            expect(canHeroFight(hero), `${jobId}`).toBe(jobCanFight(jobId));
        }
    });
});

/** Cost for a tier, via a representative job of that tier. */
function PROMOTION_COST_AT(tier) {
    return getPromotionCost(getJobsByTier(tier)[0]);
}
