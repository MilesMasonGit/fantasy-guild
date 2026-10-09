import { useSyncExternalStore } from 'react';
import { getSkill, getSkillIdsByLayer, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';
import { isMastered, MASTERY_LEVEL } from '../../../systems/hero/PromotionSystem.js';
import { getXpProgress } from '../../../utils/XPCurve.js';

/** Class skills first (combat, advanced, master), in the registry's own order within a layer. */
const CLASS_LAYERS = [SKILL_LAYERS.COMBAT, SKILL_LAYERS.ADVANCED, SKILL_LAYERS.MASTER];

const orderedIds = (layers) => layers.flatMap(layer => getSkillIdsByLayer(layer));

/**
 * A hero's skills as the hero panel lists them: the class skills they hold, the Starting skills
 * they hold, and the class skills they set down at a job change (`bankedSkills`). A skill the
 * hero never held is not listed.
 * @param {{ skills?: object, bankedSkills?: object }} hero
 */
export function groupHeroSkills(hero) {
    const held = hero?.skills || {};
    const banked = hero?.bankedSkills || {};
    const row = (id, state) => ({
        id,
        name: getSkill(id)?.name || id,
        level: Math.max(1, Math.floor(state?.level ?? 1)),
        xp: state?.xp ?? 0,
        mastered: isMastered(id, state)
    });
    return {
        classRows: orderedIds(CLASS_LAYERS).filter(id => held[id]).map(id => row(id, held[id])),
        startingRows: getSkillIdsByLayer(SKILL_LAYERS.STARTING).filter(id => held[id]).map(id => row(id, held[id])),
        bankedRows: orderedIds(Object.values(SKILL_LAYERS))
            .filter(id => banked[id] && !held[id])
            .map(id => ({ ...row(id, banked[id]), mastered: false }))
    };
}

/** `25/99`: the panel's level text. */
export const skillLevelText = (level) => `${Math.max(1, Math.floor(level || 1))}/${MASTERY_LEVEL}`;

/** The XP bar's fill (0..1) and its hover text, `1,154 / 1,500 XP`; at the top level, the total. */
export function skillXpView(xp) {
    const total = Math.max(0, Math.floor(xp || 0));
    const prog = getXpProgress(total);
    if (prog.level >= MASTERY_LEVEL) {
        return { fill: 1, title: `${total.toLocaleString('en-US')} XP` };
    }
    const into = Math.max(0, Math.floor(prog.currentXp));
    return {
        fill: prog.progress,
        title: `${into.toLocaleString('en-US')} / ${Math.round(prog.nextLevelXp).toLocaleString('en-US')} XP`
    };
}

/**
 * Whether the Starting drawer is open. Remembered for the session (module memory, so a reload
 * starts fresh); until the player touches it, it follows the hero: shut when they have class
 * skills to show on top, open for a Recruit, who has nothing else.
 */
let startingOpenChoice = null;
const listeners = new Set();

/** `null` forgets the player's choice. */
export function setStartingDrawerOpen(open) {
    startingOpenChoice = open == null ? null : Boolean(open);
    listeners.forEach(fn => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useStartingDrawerOpen(hasClassSkills) {
    const choice = useSyncExternalStore(subscribe, () => startingOpenChoice, () => startingOpenChoice);
    return choice === null ? !hasClassSkills : choice;
}
