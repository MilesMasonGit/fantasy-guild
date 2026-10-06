import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import {
    getJob, getAllJobIds, getJobSheet, getPromotionCost,
    getPromotionGateSkills, STARTING_JOB_ID
} from '../../config/registries/jobRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * PromotionSystem — the only way a hero's skills ever change shape.
 *
 * A hero holds every foundation skill plus their job's own non-foundation
 * skills (`getJobSheet`). Changing what a hero can do means moving them to a
 * different job; there is no free re-slotting or partial respec.
 *
 * Foundation skills are never banked: every job's sheet contains all nine, so
 * the bank step can only take combat, shared or signature skills, and only when
 * re-training across branches. A hero who banked foundation skills under an
 * older rule gets them back on their next promotion (the fill step restores
 * anything the target sheet wants) and on load
 * (`HeroRehydration.restoreBankedFoundation`).
 *
 * ⚠️ This module charges nothing. Promotion is paid for by a charge of the
 * Token whose Promotes rule names the job, spent by `BoardPromotion.accept`,
 * which is the only thing that knows which Token the hero is standing on. What
 * lives here is the skill gate.
 *
 * Promotion and re-training are the same act: re-training is entering a job,
 * priced exactly like the first time, not an undo.
 *
 * Nothing is ever lost, only banked: a skill a promotion removes goes dormant
 * at its level and returns exactly as it was if the hero comes back to a job
 * that uses it. The gate therefore counts banked skills as known.
 */

/** Why a promotion cannot happen. */
export const REFUSAL = {
    NO_HERO: 'NO_HERO',
    NO_JOB: 'NO_JOB',
    SAME_JOB: 'SAME_JOB',
    VILLAGER: 'VILLAGER',
    SKILL_TOO_LOW: 'SKILL_TOO_LOW'
    // Whether the Token can pay is `BoardPromotion`'s question, not this module's.
};

/** A hero's banked skills, created lazily. */
function bankOf(hero) {
    if (!hero.bankedSkills) hero.bankedSkills = {};
    return hero.bankedSkills;
}

/**
 * What a hero knows about a skill, held **or banked**. Banked skills count: a
 * hero who gave up Cooking 30 at a promotion should not have to earn it twice
 * when re-training into a job that wants it.
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
 * One gate: the skills the job carries forward must each reach its tier
 * threshold, so promotion pays off work already done.
 *
 * ⚠️ This answers "is this hero QUALIFIED" and nothing more. Whether the Token
 * the hero stands on can pay is `BoardPromotion`'s half.
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
 * ⚠️ This does not check for a Token, and callers must. It is the raw
 * skill-sheet swap; `BoardPromotion.accept` is what makes it cost something, so
 * calling it directly grants a free promotion.
 *
 * @returns {{ success: boolean, reason?: string, detail?: string,
 *             gained?: string[], banked?: string[], restored?: string[] }}
 */
export function promote(heroId, jobId) {
    const check = canPromote(heroId, jobId);
    if (!check.ok) return { success: false, ...check };

    const hero = HeroManager.getHero(heroId);
    const job = getJob(jobId);
    const fromJob = getJob(hero.jobId);

    const target = new Set(getJobSheet(jobId));
    const bank = bankOf(hero);
    const banked = [];
    const restored = [];
    const gained = [];

    // 1. Bank everything the new sheet does not want, at its level.
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

    // Max HP and hero level both derive from skills.
    HeroManager.updateHeroSkillModifiers(hero);

    EventBus.publish(ENGINE_EVENTS.HERO_PROMOTED, {
        heroId, heroName: hero.name,
        fromJobId: fromJob?.id || null, fromJobName: fromJob?.name || null,
        toJobId: jobId, toJobName: job.name,
        gained, banked, restored
    });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'promote', heroId });

    return { success: true, gained, banked, restored };
}

/**
 * What a promotion would do, without doing it, so the UI can show the trade
 * before the player commits.
 */
export function previewPromotion(heroId, jobId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !getJob(jobId)) return null;

    const target = new Set(getJobSheet(jobId));
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
