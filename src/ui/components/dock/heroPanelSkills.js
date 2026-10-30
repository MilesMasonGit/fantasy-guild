import { getSkill, getSkillIdsByLayer, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';
import { getXpProgress, xpForLevel, MAX_SKILL_LEVEL } from '../../../utils/XPCurve.js';

/** The panel's one list: combat, then the Starting skills, then the specialist ones. */
const LIST_LAYERS = [SKILL_LAYERS.COMBAT, SKILL_LAYERS.STARTING, SKILL_LAYERS.SPECIALIST];

/** Layers whose rows get their own background colour. */
export const TIER_LAYERS = new Set([SKILL_LAYERS.SPECIALIST]);

const orderedIds = (layers) => layers.flatMap(layer => getSkillIdsByLayer(layer));

/**
 * A hero's skills as the hero panel lists them: every skill, combat first, then Starting, then
 * specialist, each layer in the registry's order. A skill the record lacks (a hero not yet
 * settled by a load) reads level 1.
 * @param {{ skills?: object }} hero
 * @returns {{ rows: Array<{ id: string, name: string, layer: string|null, tier: string|null, level: number, xp: number }> }}
 */
export function heroSkillList(hero) {
    const held = hero?.skills || {};
    const rows = orderedIds(LIST_LAYERS).map(id => {
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

/** A time to go, as the UI writes times: `0:34`, `4:05`, `1:04:05`. */
export function formatEta(seconds) {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * A skill row's opened detail, as display strings:
 * * `level`: this level's XP, `1,154 / 1,500`; `toNext`: what is left, `346`;
 * * `total`: all XP earned in the skill;
 * * `rate`: XP an hour, `+1,234`, over the last stretch of work, or null when it is not being trained;
 * * `eta`: time to the next level at that rate (`4:05`), or null.
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
        eta: rate > 0 ? formatEta((left / rate) * 3600) : null
    };
}
