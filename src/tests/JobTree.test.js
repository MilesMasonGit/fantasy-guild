import { describe, it, expect } from 'vitest';
import {
    JOB_TIERS, STARTING_JOB_ID,
    getAllJobIds, getJob, getJobsByTier, getPromotionsFrom,
    getJobSkills, getJobSheet, getJobSkillsByLayer, getJobCombatSkill, getJobSignatureSkill,
    jobCanFight, grantsOf, removesOf, getPromotionGateSkills, getJobLineage,
    getPromotionCost
} from '../config/registries/jobRegistry.js';
import {
    SKILLS, SKILL_LAYERS, HERO_SKILL_SLOTS, RECRUIT_SKILL_SLOTS,
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
 */

const ADVANCED = getJobsByTier(JOB_TIERS.ADVANCED);
const BASE = getJobsByTier(JOB_TIERS.BASE);

/**
 * ⚠️ Token Lifecycle slice 1.1 — the known exceptions.
 */
const NOT_YET_IN_TREE = new Set(['construction', 'farming', 'explore']);
const TREE_FOUNDATION = FOUNDATION_SKILL_IDS.filter(id => !NOT_YET_IN_TREE.has(id));
const FORMER_SIGNATURE = { warlord: 'construction' };
const SIGNED_ADVANCED = ADVANCED.filter(id => !FORMER_SIGNATURE[id]);

/** How many advanced jobs hold `skillId`. */
function advancedHolding(skillId) {
    return ADVANCED.filter(id => getJobSkills(id).includes(skillId));
}

describe('Every job sheet is well-formed', () => {
    it.each([...BASE, ...ADVANCED])('%s lists exactly HERO_SKILL_SLOTS skills', (jobId) => {
        // ⚠️ this is the width of the authored LIST (what the gate and the
        // layer-shape rules read), not of the held sheet — a promoted hero
        // also keeps every foundation skill (`getJobSheet`, tested below).
        expect(getJobSkills(jobId)).toHaveLength(HERO_SKILL_SLOTS);
    });

    it('the Recruit holds RECRUIT_SKILL_SLOTS: every foundation skill, nine of them', () => {
        // Slice 1.1: the Recruit is wider than a promoted sheet, so the first
        // promotion narrows it. The count is pinned at nine so a silent change
        // to the starting set is noticed.
        expect(getJobSkills(STARTING_JOB_ID)).toHaveLength(RECRUIT_SKILL_SLOTS);
        expect(RECRUIT_SKILL_SLOTS).toBe(9);
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
    it('the Recruit is exactly the Foundation layer, and cannot fight', () => {
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

    it.each(SIGNED_ADVANCED)('%s is 2 foundation · 1 combat · 2 shared · 1 signature', (jobId) => {
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)).toHaveLength(2);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)).toHaveLength(1);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SHARED)).toHaveLength(2);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SIGNATURE)).toHaveLength(1);
    });

    it.each(Object.keys(FORMER_SIGNATURE))('⚠️ %s lost its signature to the foundation layer (slice 1.1)', (jobId) => {
        // Its signature moved to foundation leaves the sheet alone, so it
        // reads 3 foundation · 1 combat · 2 shared · 0 signature.
        expect(getJobSkills(jobId)).toContain(FORMER_SIGNATURE[jobId]);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)).toHaveLength(3);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)).toHaveLength(1);
        expect(getJobSkillsByLayer(jobId, SKILL_LAYERS.SHARED)).toHaveLength(2);
        expect(getJobSignatureSkill(jobId)).toBeNull();
    });

    it('every promoted job can fight; only the Recruit cannot', () => {
        for (const jobId of [...BASE, ...ADVANCED]) {
            expect(jobCanFight(jobId), `${jobId} cannot fight`).toBe(true);
        }
    });
});

describe('A promotion adds — it never removes a starting skill (TL-7)', () => {
    // ⚠️ Updated for Token Lifecycle slice 1.2. These used to assert that
    // promotion NARROWS the sheet (base class: remove five foundation skills;
    // advanced: remove two). The owner reversed that: promotion keeps every
    // foundation skill, so down the tree nothing is removed and each promotion
    // only adds its two new skills.
    it.each(BASE)('%s removes nothing and adds exactly 2 (its combat and shared skill)', (jobId) => {
        expect(removesOf(jobId), `${jobId} removals`).toEqual([]);
        expect(grantsOf(jobId), `${jobId} grants`).toHaveLength(2);
        expect(grantsOf(jobId)).toContain(getJobCombatSkill(jobId));
    });

    it.each(ADVANCED)('%s removes nothing and adds exactly 2 non-foundation skills', (jobId) => {
        // The Warlord adds only one: its listed `construction` is a foundation
        // skill since slice 1.1, so it is already held (FORMER_SIGNATURE).
        expect(removesOf(jobId), `${jobId} removals`).toEqual([]);
        expect(grantsOf(jobId), `${jobId} grants`).toHaveLength(FORMER_SIGNATURE[jobId] ? 1 : 2);
        for (const id of grantsOf(jobId)) {
            expect(SKILLS[id].layer, `${jobId} grants foundation "${id}"`).not.toBe(SKILL_LAYERS.FOUNDATION);
        }
    });

    it.each(getAllJobIds())('%s holds every foundation skill (getJobSheet)', (jobId) => {
        const sheet = getJobSheet(jobId);
        for (const id of FOUNDATION_SKILL_IDS) expect(sheet, `${jobId} lacks ${id}`).toContain(id);
        expect(new Set(sheet).size, `${jobId} sheet has a duplicate`).toBe(sheet.length);
        // 9 on the Recruit, 11 on a base class, 13 on an advanced job (the
        // Warlord 12, see FORMER_SIGNATURE).
        const expected = RECRUIT_SKILL_SLOTS + getJobSkills(jobId).filter(
            id => SKILLS[id].layer !== SKILL_LAYERS.FOUNDATION).length;
        expect(sheet).toHaveLength(expected);
    });

    it.each(ADVANCED)("%s's foundation pair is a subset of its parent's four", (jobId) => {
        // The rule that stops a promotion restoring something the previous tier
        // gave up. Without it a hero could route around the narrowing entirely.
        // ⚠️ The one known exception is a former signature now in the
        // foundation layer (slice 1.1, see FORMER_SIGNATURE).
        const parentFoundation = new Set(
            getJobSkillsByLayer(getJob(jobId).parent, SKILL_LAYERS.FOUNDATION)
        );
        for (const id of getJobSkillsByLayer(jobId, SKILL_LAYERS.FOUNDATION)) {
            if (FORMER_SIGNATURE[jobId] === id) continue;
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

    it.each(SIGNED_ADVANCED)('%s gains its signature only at tier 2', (jobId) => {
        expect(grantsOf(jobId)).toContain(getJobSignatureSkill(jobId));
    });

    it('a promotion never removes the skills it gates on', () => {
        // Gating on something the same promotion takes away would be
        // incoherent.
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

    // ⚠️ Slice 1.1: run over the six foundation skills the promoted tree was
    // designed around. The three added for the Recruit (NOT_YET_IN_TREE) wait
    // for the promotion overhaul; the Warlord's former signature is outside the
    // advanced jobs' two-foundation budget, so the six still split 24 evenly.
    const perFoundation = ADVANCED.length * 2 / TREE_FOUNDATION.length;
    const perShared = ADVANCED.length * 2 / SHARED_SKILL_IDS.length;

    it.each(TREE_FOUNDATION)('%s is held by an even share of advanced jobs', (skillId) => {
        expect(advancedHolding(skillId).length).toBe(perFoundation);
    });

    it.each(SHARED_SKILL_IDS)('%s is held by an even share of advanced jobs', (skillId) => {
        // This is the rule exists to enforce. Before it, Leadership sat at 7
        // of 12 while Nature, Crime and Enchanting sat at 3.
        expect(advancedHolding(skillId).length).toBe(perShared);
    });

    it.each(COMBAT_SKILL_IDS)('%s is available from an even share of advanced jobs', (skillId) => {
        expect(advancedHolding(skillId).length).toBe(ADVANCED.length / COMBAT_SKILL_IDS.length);
    });

    it('the tree\'s six foundation skills stay collectively coverable by a full guild', () => {
        for (const skillId of TREE_FOUNDATION) {
            expect(advancedHolding(skillId).length,
                `no advanced job keeps "${skillId}" — a fully-promoted guild loses it`
            ).toBeGreaterThan(0);
        }
    });

    it('⚠️ known gap until the promotion overhaul: no promoted job holds Farming or Explore', () => {
        // Slice 1.1. A fully-promoted guild cannot farm or explore (it can
        // build only through the Warlord). This pins the gap so it is
        // visible; the overhaul should turn it into a coverage rule.
        for (const skillId of NOT_YET_IN_TREE) {
            if (Object.values(FORMER_SIGNATURE).includes(skillId)) continue;
            expect(advancedHolding(skillId), skillId).toEqual([]);
            expect(BASE.filter(id => getJobSkills(id).includes(skillId)), skillId).toEqual([]);
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

    /**
     * ⚠️ The gold half of this was deleted in Promotes rule P3. A promotion is
     * paid for with a Token charge, so `PROMOTION_COSTS` holds only the skill
     * threshold. What the tiers must still differ on is the QUALIFICATION: an
     * advanced job has to ask more of a hero than a base one.
     */
    it('advancing demands more of a hero than the first promotion', () => {
        expect(PROMOTION_COST_AT(JOB_TIERS.ADVANCED).skillLevel)
            .toBeGreaterThan(PROMOTION_COST_AT(JOB_TIERS.BASE).skillLevel);
    });

    /** The price is a Token, so nothing here may quietly re-grow a gold cost. */
    it('charges no gold and no materials', () => {
        for (const tier of [JOB_TIERS.BASE, JOB_TIERS.ADVANCED]) {
            expect(PROMOTION_COST_AT(tier).gold).toBeUndefined();
            expect(PROMOTION_COST_AT(tier).materials).toBeUndefined();
        }
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
        // the wiring honours it, without waiting for that machinery. ⚠️ the
        // held sheet is `getJobSheet` (every foundation skill plus the job's
        // own), no longer the six-wide listed `skills`.
        const hero = generateHero({ jobId });

        expect(hero.jobId).toBe(jobId);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet(jobId)].sort());
        expect(Object.keys(hero.skills).length).toBeGreaterThanOrEqual(RECRUIT_SKILL_SLOTS);
    });

    it('a new Recruit holds all nine foundation skills at level 1 (slice 1.1)', () => {
        const hero = generateHero();
        const expected = ['mining', 'logging', 'fishing', 'smithing', 'crafting',
            'cooking', 'construction', 'farming', 'explore'];

        expect(Object.keys(hero.skills).sort()).toEqual(expected.sort());
        for (const id of expected) {
            expect(hero.skills[id].level, `${id} level`).toBe(1);
            expect(SKILLS[id].layer, `${id} layer`).toBe(SKILL_LAYERS.FOUNDATION);
        }
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
