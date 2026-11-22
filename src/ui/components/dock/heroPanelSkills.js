import { getSkill, heroSheetSkillIds, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';
import { getXpProgress, xpForLevel, MAX_SKILL_LEVEL } from '../../../utils/XPCurve.js';
import { t } from '../../../i18n/index.js';
import { countdownText } from '../../../utils/Formatters.js';

/** Layers whose rows get their own background colour. */
export const TIER_LAYERS = new Set([SKILL_LAYERS.SPECIALIST]);

/** How many skills stand in one column of the hero drawer's grid. */
export const SKILLS_PER_COLUMN = 4;

/**
 * A hero's skills as the hero drawer lists them: every skill, in the sheet's order (combat, then
 * gathering, crafting and specialist, `heroSheetSkillIds`). A skill the record lacks (a hero not yet
 * settled by a load) reads level 1.
 * @param {{ skills?: object }} hero
 * @returns {{ rows: Array<{ id: string, name: string, layer: string|null, tier: string|null, level: number, xp: number }> }}
 */
export function heroSkillList(hero) {
    const held = hero?.skills || {};
    const rows = heroSheetSkillIds().map(id => {
        const layer = getSkill(id)?.layer || null;
        const state = held[id];
        return {
            id,
            name: getSkill(id)?.name || id,
            layer,
            tier: TIER_LAYERS.has(layer) ? layer : null,
            level: Math.max(1, Math.floor(state?.level ?? 1)),
            xp: state?.xp ?? 0
        };
    });
    return { rows };
}

/** `25/99`: the panel's level text. */
export const skillLevelText = (level) => `${Math.max(1, Math.floor(level || 1))}/${MAX_SKILL_LEVEL}`;

const n = (v) => Math.max(0, Math.floor(v || 0)).toLocaleString('en-US');

/** The XP bar's fill (0..1) and its hover text, `1,154 / 1,500 XP`; at the top level, the total. */
export function skillXpView(xp) {
    const total = Math.max(0, Math.floor(xp || 0));
    const prog = getXpProgress(total);
    if (prog.level >= MAX_SKILL_LEVEL) {
        return { fill: 1, title: `${n(total)} XP` };
    }
    return {
        fill: prog.progress,
        title: `${n(prog.currentXp)} / ${Math.round(prog.nextLevelXp).toLocaleString('en-US')} XP`
    };
}


/**
 * A skill row's opened detail, as display strings:
 * * `level`: this level's XP, `1,154 / 1,500`; `toNext`: what is left, `346`;
 * * `total`: all XP earned in the skill;
 * * `rate`: XP an hour, `+1,234`, over the last stretch of work, or null when it is not being trained;
 * * `eta`: time to the next level at that rate (`4m 5s`), or null.
 * At the top level only `total` is filled.
 * @param {number} xp the skill's total XP
 * @param {number} ratePerHour from `XpRateTracker.getRate`
 */
export function skillDetail(xp, ratePerHour = 0) {
    const total = Math.max(0, Math.floor(xp || 0));
    const prog = getXpProgress(total);
    if (prog.level >= MAX_SKILL_LEVEL) {
        return { level: null, toNext: null, total: n(total), rate: null, eta: null, nextLevel: null };
    }
    const span = Math.round(prog.nextLevelXp);
    const left = Math.max(0, xpForLevel(prog.level + 1) - total);
    const rate = Number(ratePerHour) > 0 ? Number(ratePerHour) : 0;
    return {
        level: `${n(prog.currentXp)} / ${span.toLocaleString('en-US')}`,
        toNext: n(left),
        nextLevel: skillLevelText(prog.level + 1),
        total: n(total),
        rate: rate > 0 ? `+${Math.round(rate).toLocaleString('en-US')}` : null,
        eta: rate > 0 ? countdownText((left / rate) * 3600 * 1000) : null
    };
}

/**
 * What a skill is for and what it feeds, one line from the strings file (`skillPurpose` in
 * `src/i18n/en.json`, where the owner edits them), or null for a skill with no line yet.
 */
export function skillPurposeText(skillId) {
    const key = `skillPurpose.${skillId}`;
    const text = t(key);
    return text === key ? null : text;
}

/**
 * A skill's hover tip, as display strings: this level's XP (`1,154`), what is left to the next
 * level, and the XP an hour (`+1,234`, or null when it is not being trained). At the top level only
 * the total XP and no next level.
 * @param {number} xp the skill's total XP
 * @param {number} ratePerHour from `XpRateTracker.getRate`
 */
export function skillTipView(xp, ratePerHour = 0) {
    const total = Math.max(0, Math.floor(xp || 0));
    const prog = getXpProgress(total);
    const rate = Number(ratePerHour) > 0 ? `+${Math.round(Number(ratePerHour)).toLocaleString('en-US')}` : null;
    if (prog.level >= MAX_SKILL_LEVEL) return { xp: n(total), toNext: null, rate };
    return { xp: n(prog.currentXp), toNext: n(Math.max(0, xpForLevel(prog.level + 1) - total)), rate };
}
