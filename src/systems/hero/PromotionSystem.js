// Fantasy Guild - Promotion System
// Skill & Class rework, Phase 5 (skill_class_rework_roadmap_v1.md).

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as InputAllocator from '../board/InputAllocator.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import {
    getJob, getAllJobIds, getJobSkills, getPromotionCost,
    getPromotionGateSkills, STARTING_JOB_ID
} from '../../config/registries/jobRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';

/**
 * PromotionSystem — **the only way a hero's skills ever change shape.**
 *
 * A hero holds 6 of 27 skills and their job decides which 6. There is no free
 * re-slotting and no partial respec (D-248): changing what a hero can do means
 * moving them to a different job, and paying for it.
 *
 * ## Promotion and re-training are the same act
 * Deliberately. **Re-training is not an undo** — it is entering a job, priced
 * exactly like entering it the first time. Treating it as a special reversal
 * would have made "go forward" and "go back" two systems with two sets of
 * rules; this way there is one, and a Knight becoming a Warlord is the same
 * operation as a Recruit becoming a Fighter.
 *
 * ⚠️ **This makes the re-training price the single most important balance
 * number in the rework** (D-248). It is the only thing standing between
 * "meaningfully specialised" and "punished for experimenting". The roadmap's
 * advice is to ship it cheap and raise it: a forgiving system is far easier to
 * tighten later than a punishing one is to recover from.
 *
 * ## Nothing is ever lost, only banked (D-71)
 * A skill a promotion removes goes **dormant at its level**, not to zero. Come
 * back to a job that uses it and it returns exactly as it was. That is what
 * makes promotion a reconfiguration rather than a gamble — and it is why the
 * gate below counts banked skills as known.
 */

/** Why a promotion cannot happen. */
export const REFUSAL = {
    NO_HERO: 'NO_HERO',
    NO_JOB: 'NO_JOB',
    SAME_JOB: 'SAME_JOB',
    VILLAGER: 'VILLAGER',
    SKILL_TOO_LOW: 'SKILL_TOO_LOW',
    NOT_ENOUGH_GOLD: 'NOT_ENOUGH_GOLD',
    SHORT_ON_MATERIALS: 'SHORT_ON_MATERIALS'
};

/** A hero's banked skills, created lazily. */
function bankOf(hero) {
    if (!hero.bankedSkills) hero.bankedSkills = {};
    return hero.bankedSkills;
}

/**
 * What a hero knows about a skill, held **or banked**.
 *
 * Banked skills count. A hero who reached Cooking 30 and gave it up at a
 * promotion has not forgotten how to cook — so re-training into a job that
 * wants Cooking should not demand they earn it twice. Without this, D-71's
 * "banked, not lost" would be true of the number and false of everything that
 * matters.
 *
 * @returns {number|null} the level, or null if never learned
 */
export function knownLevel(hero, skillId) {
    const held = hero?.skills?.[skillId];
    if (held) return held.level ?? 0;
    const banked = hero?.bankedSkills?.[skillId];
    if (banked) return banked.level ?? 0;
    return null;
}

/** Every skill a hero holds or has banked, with where it currently sits. */
export function getSkillSheet(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    const held = Object.entries(hero.skills || {}).map(([id, s]) => ({
        skillId: id, level: s.level, xp: s.xp, banked: false,
        name: getSkill(id)?.name || id, icon: getSkill(id)?.icon
    }));
    const banked = Object.entries(hero.bankedSkills || {}).map(([id, s]) => ({
        skillId: id, level: s.level, xp: s.xp, banked: true,
        name: getSkill(id)?.name || id, icon: getSkill(id)?.icon
    }));

    return [...held, ...banked];
}

/**
 * Whether a hero may take a job, and why not.
 *
 * Two gates, both from D-262: the skills the job **carries forward** must each
 * reach its tier threshold, and the cost must be payable. Gating on the carried
 * skills is what makes promotion the payoff for work already done — the hero
 * you trained toward a job is the one who can take it.
 *
 * @returns {{ ok: boolean, reason?: string, detail?: string, missing?: Array }}
 */
export function canPromote(heroId, jobId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { ok: false, reason: REFUSAL.NO_HERO };
    if (hero.isVillager) return { ok: false, reason: REFUSAL.VILLAGER, detail: 'Villagers do not take jobs' };

    const job = getJob(jobId);
    if (!job) return { ok: false, reason: REFUSAL.NO_JOB };
    if (hero.jobId === jobId) return { ok: false, reason: REFUSAL.SAME_JOB, detail: `Already a ${job.name}` };

    const cost = getPromotionCost(jobId);
    if (!cost) return { ok: true };          // the Recruit costs nothing

    // Skill gate — the carried-forward skills, held or banked.
    const missing = [];
    for (const skillId of getPromotionGateSkills(jobId)) {
        const level = knownLevel(hero, skillId);
        if (level === null || level < cost.skillLevel) {
            missing.push({
                skillId,
                name: getSkill(skillId)?.name || skillId,
                have: level ?? 0,
                need: cost.skillLevel
            });
        }
    }
    if (missing.length > 0) {
        const names = missing.map(m => `${m.name} ${m.have}/${m.need}`).join(', ');
        return { ok: false, reason: REFUSAL.SKILL_TOO_LOW, detail: `Needs ${names}`, missing };
    }

    if (CurrencyManager.getCurrency('gold') < (cost.gold || 0)) {
        return { ok: false, reason: REFUSAL.NOT_ENOUGH_GOLD, detail: `Needs ${cost.gold}g` };
    }

    const check = InputAllocator.checkInputs(cost.materials || []);
    if (!check.ok) {
        return { ok: false, reason: REFUSAL.SHORT_ON_MATERIALS, detail: 'Short on materials' };
    }

    return { ok: true };
}

/** Every job this hero could move to right now. */
export function getAvailablePromotions(heroId) {
    return getAllJobIds()
        .filter(id => id !== STARTING_JOB_ID)
        .map(id => ({ jobId: id, job: getJob(id), ...canPromote(heroId, id) }));
}

/**
 * Move a hero to a job — promotion and re-training alike.
 *
 * Order matters, and mirrors the Cartographer's purchase: **every check passes
 * before anything is taken.** A half-paid promotion that then refuses would be
 * the worst possible failure here, because the thing it is spending is a
 * hero's skills.
 *
 * @returns {{ success: boolean, reason?: string, detail?: string,
 *             gained?: string[], banked?: string[], restored?: string[] }}
 */
export function promote(heroId, jobId) {
    const check = canPromote(heroId, jobId);
    if (!check.ok) return { success: false, ...check };

    const hero = HeroManager.getHero(heroId);
    const job = getJob(jobId);
    const cost = getPromotionCost(jobId);
    const fromJob = getJob(hero.jobId);

    // Pay. Materials first, then gold — same order and same reasoning as the
    // Map purchase: the harder thing to refund is taken last.
    if (cost) {
        if (!InputAllocator.consumeInputs(cost.materials || [])) {
            return { success: false, reason: REFUSAL.SHORT_ON_MATERIALS, detail: 'Short on materials' };
        }
        if (!CurrencyManager.spendGold(cost.gold || 0, `Promotion: ${job.name}`)) {
            return { success: false, reason: REFUSAL.NOT_ENOUGH_GOLD, detail: `Needs ${cost.gold}g` };
        }
    }

    const target = new Set(getJobSkills(jobId));
    const bank = bankOf(hero);
    const banked = [];
    const restored = [];
    const gained = [];

    // 1. Bank everything the new sheet does not want, AT ITS LEVEL (D-71).
    for (const skillId of Object.keys(hero.skills || {})) {
        if (target.has(skillId)) continue;
        bank[skillId] = { ...hero.skills[skillId] };
        delete hero.skills[skillId];
        banked.push(skillId);
    }

    // 2. Fill the new sheet — from the bank where possible, fresh otherwise.
    for (const skillId of target) {
        if (hero.skills[skillId]) continue;
        if (bank[skillId]) {
            hero.skills[skillId] = { ...bank[skillId] };
            delete bank[skillId];
            restored.push(skillId);
        } else {
            hero.skills[skillId] = { xp: xpForLevel(1), level: 1 };
            gained.push(skillId);
        }
    }

    hero.jobId = jobId;

    // Max HP and hero level both derive from skills, and both just changed —
    // a promotion that grants a combat skill is the moment a Recruit stops
    // being a non-combatant.
    HeroManager.updateHeroSkillModifiers(hero);

    EventBus.publish('hero_promoted', {
        heroId, heroName: hero.name,
        fromJobId: fromJob?.id || null, fromJobName: fromJob?.name || null,
        toJobId: jobId, toJobName: job.name,
        gained, banked, restored
    });
    EventBus.publish('heroes_updated', { source: 'promote', heroId });

    return { success: true, gained, banked, restored };
}

/**
 * What a promotion would do, without doing it.
 *
 * The UI needs this to show the trade before the player commits — "you will
 * lose Fishing 12 and Cooking 8" is the whole decision, and finding out
 * afterwards is not a decision at all.
 */
export function previewPromotion(heroId, jobId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !getJob(jobId)) return null;

    const target = new Set(getJobSkills(jobId));
    const held = Object.keys(hero.skills || {});

    const losing = held.filter(id => !target.has(id)).map(id => ({
        skillId: id, name: getSkill(id)?.name || id, level: hero.skills[id].level
    }));

    const keeping = held.filter(id => target.has(id));

    const arriving = [...target].filter(id => !hero.skills[id]).map(id => {
        const bankedLevel = hero.bankedSkills?.[id]?.level ?? null;
        return {
            skillId: id, name: getSkill(id)?.name || id,
            level: bankedLevel ?? 1,
            restored: bankedLevel !== null
        };
    });

    return { jobId, losing, keeping, arriving, cost: getPromotionCost(jobId), ...canPromote(heroId, jobId) };
}
