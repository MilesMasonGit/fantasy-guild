import { describe, it, expect } from 'vitest';
import {
    JOB_TIERS, STARTING_JOB_ID,
    getAllJobIds, getJob, getJobsByTier, getPromotionsFrom,
    getJobSkills, getJobSkillsByLayer, getJobCombatSkill, getJobSignatureSkill,
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
 *
 * Nothing here hardcodes a skill or job name except where the rule genuinely is
 * about a specific thing. Counts derive from the registries, so adding a
 * seventh base class or a thirteenth signature puts it under every rule
 * automatically.
 */

const ADVANCED = getJobsByTier(JOB_TIERS.ADVANCED);
const BASE = getJobsByTier(JOB_TIERS.BASE);

/**
 * ⚠️ Token Lifecycle slice 1.1 (2026-09-25) — the known exceptions.
 *
 * Construction (SP-59), Farming (SP-60) and Explore (SP-74) joined the
 * foundation layer so a Recruit can build, farm and explore, but the promoted
 * sheets were deliberately left alone until the promotion overhaul (TL-6,
 * SP-58). Two things follow, and the rules below name them rather than
 * pretending the tree is still balanced:
 *
 * * `NOT_YET_IN_TREE` — the three new foundation skills are not part of the
 *   promoted tree's foundation design (no base class holds any of them), so the
 *   coverage audit runs over the other six.
 * * `FORMER_SIGNATURE` — the Warlord still lists `construction`, which used to
 *   be its signature and is now a foundation skill. It has no signature until
 *   the overhaul, and takes Construction back from the bank on promotion.
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
    it.each([...BASE, ...ADVANCED])('%s holds exactly HERO_SKILL_SLOTS skills', (jobId) => {
        // Width never changes between promoted tiers. Promotion swaps contents —
        // that is the whole reason a promotion reads as becoming someone else
        // rather than accumulating a bigger sheet.
        expect(getJobSkills(jobId)).toHaveLength(HERO_SKILL_SLOTS);
    });

    it('the Recruit holds RECRUIT_SKILL_SLOTS: every foundation skill, nine of them', () => {
        // Slice 1.1: the Recruit is wider than a promoted sheet (SP-59/60/74),
        // so the first promotion narrows it. The count is pinned at nine so a
        // silent change to the starting set is noticed.
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
        // Its signature moved to foundation (SP-59) and TL-6 leaves the sheet
        // alone, so it reads 3 foundation · 1 combat · 2 shared · 0 signature.
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

describe('A promotion narrows — it never hands back what a tier dropped', () => {
    it.each(BASE)('%s removes every foundation skill but four, and adds exactly 2', (jobId) => {
        // Slice 1.1: the Recruit holds nine and a base class keeps four, so the
        // first promotion banks five (it banked two when the Recruit held six).
        // TL-6 leaves the promoted sheets alone until the promotion overhaul.
        expect(removesOf(jobId), `${jobId} removals`).toHaveLength(RECRUIT_SKILL_SLOTS - 4);
        expect(grantsOf(jobId), `${jobId} grants`).toHaveLength(2);
    });

    it.each(ADVANCED)('%s removes exactly 2 and adds exactly 2', (jobId) => {
        expect(removesOf(jobId), `${jobId} removals`).toHaveLength(2);
        expect(grantsOf(jobId), `${jobId} grants`).toHaveLength(2);
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
        // This is the rule D-268 exists to enforce. Before it, Leadership sat
        // at 7 of 12 while Nature, Crime and Enchanting sat at 3.
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
        // Slice 1.1 / TL-6. A fully-promoted guild cannot farm or explore (it
        // can build only through the Warlord). This pins the gap so it is
        // visible; the overhaul (SP-58) should turn it into a coverage rule.
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
     * ⚠️ The gold half of this was deleted in Promotes rule P3 (PR-6). A
     * promotion is paid for with a Token charge, so `PROMOTION_COSTS` holds only
     * the skill threshold. What the tiers must still differ on is the
     * QUALIFICATION: an advanced job has to ask more of a hero than a base one.
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
        // the wiring honours it, without waiting for that machinery.
        const hero = generateHero({ jobId });

        expect(hero.jobId).toBe(jobId);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills(jobId)].sort());
        // A Recruit is wider than a promoted sheet since slice 1.1.
        expect(Object.keys(hero.skills)).toHaveLength(
            jobId === STARTING_JOB_ID ? RECRUIT_SKILL_SLOTS : HERO_SKILL_SLOTS
        );
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
