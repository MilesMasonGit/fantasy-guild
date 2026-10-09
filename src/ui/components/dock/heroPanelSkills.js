import { useSyncExternalStore } from 'react';
import { getSkill, getSkillIdsByLayer, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';
import { isMastered, MASTERY_LEVEL } from '../../../systems/hero/PromotionSystem.js';
import { getXpProgress, xpForLevel } from '../../../utils/XPCurve.js';

/** The panel's one list: combat, then the Starting skills, then the specialist layers. */
const LIST_LAYERS = [SKILL_LAYERS.COMBAT, SKILL_LAYERS.STARTING, SKILL_LAYERS.ADVANCED, SKILL_LAYERS.MASTER];

/** Layers whose rows get their own background colour. */
export const TIER_LAYERS = new Set([SKILL_LAYERS.ADVANCED, SKILL_LAYERS.MASTER]);

const orderedIds = (layers) => layers.flatMap(layer => getSkillIdsByLayer(layer));

/**
 * A hero's skills as the hero panel lists them, each in the registry's own order within a layer:
 * * `rows`: every skill held, in one list (combat, Starting, Advanced, Master);
 * * `bankedRows`: skills set down at a job change (`bankedSkills`), at the level they reached;
 * * `lockedRows`: skills the hero has never held, for the collapsed list at the bottom.
 * @param {{ skills?: object, bankedSkills?: object }} hero
 */
export function heroSkillList(hero) {
    const held = hero?.skills || {};
    const banked = hero?.bankedSkills || {};
    const row = (id, state) => {
        const layer = getSkill(id)?.layer || null;
        return {
            id,
            name: getSkill(id)?.name || id,
            layer,
            tier: TIER_LAYERS.has(layer) ? layer : null,
            level: Math.max(1, Math.floor(state?.level ?? 1)),
            xp: state?.xp ?? 0,
            mastered: isMastered(id, state)
        };
    };
    const all = orderedIds(LIST_LAYERS);
    return {
        rows: all.filter(id => held[id]).map(id => row(id, held[id])),
        bankedRows: all.filter(id => banked[id] && !held[id]).map(id => ({ ...row(id, banked[id]), mastered: false })),
        lockedRows: all.filter(id => !held[id] && !banked[id]).map(id => ({ ...row(id, null), mastered: false }))
    };
}

/** `25/99`: the panel's level text. */
export const skillLevelText = (level) => `${Math.max(1, Math.floor(level || 1))}/${MASTERY_LEVEL}`;

const n = (v) => Math.max(0, Math.floor(v || 0)).toLocaleString('en-US');

/** The XP bar's fill (0..1) and its hover text, `1,154 / 1,500 XP`; at the top level, the total. */
export function skillXpView(xp) {
    const total = Math.max(0, Math.floor(xp || 0));
    const prog = getXpProgress(total);
    if (prog.level >= MASTERY_LEVEL) {
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
    if (prog.level >= MASTERY_LEVEL) {
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

/**
 * Whether the locked list (skills never held) is open. Shut until the player opens it, then
 * remembered for the session (module memory, so a reload starts shut).
 */
let lockedOpen = false;
const listeners = new Set();

export function setLockedListOpen(open) {
    lockedOpen = Boolean(open);
    listeners.forEach(fn => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useLockedListOpen() {
    return useSyncExternalStore(subscribe, () => lockedOpen, () => lockedOpen);
}
