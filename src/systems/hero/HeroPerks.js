import { perkRowsFor, skillsWithPerks } from '../../config/registries/perkRegistry.js';
import { perksEarnedAt } from './perkTable.js';
import { MAX_SCALE, normaliseScale } from '../effects/effectLibrary.js';

/**
 * The milestone perks a hero holds, read off their levels every time they are asked for. Nothing is
 * stored on the hero, so a perk reached in a catch-up, live, or long ago in an older save is held
 * the same way, and none is ever granted twice. Reading draws no random numbers.
 */

const NONE = Object.freeze([]);

/** A hero's level in one skill, 0 when the record lacks it (a villager, a hero not yet settled). */
function levelOf(hero, skillId) {
    const level = hero?.skills?.[skillId]?.level;
    return Number.isFinite(level) ? level : 0;
}

/**
 * Every perk the hero holds, as `{ skillId, level, effectId, scale }`, skill by skill in the perk
 * tables' order, each skill's in level order. Villagers hold none.
 */
export function earnedPerks(hero) {
    if (!hero || hero.isVillager) return NONE;
    const skills = skillsWithPerks();
    if (!skills.length) return NONE;
    let out = null;
    for (const skillId of skills) {
        const level = levelOf(hero, skillId);
        if (!level) continue;
        for (const row of perksEarnedAt(perkRowsFor(skillId), level)) {
            (out ||= []).push({ skillId, level: row.level, effectId: row.effectId, scale: row.scale });
        }
    }
    return out || NONE;
}

/**
 * The library references a hero's perks add up to, one per effect: two perks naming the same
 * effect (Forestry 25 and 50 both "Clean Felling") are one reference whose scales add, capped at
 * 5, as a loadout's are, so the effect's statements are never expanded twice on one hero.
 * @returns {Array<{ effectId: string, scale: number }>}
 */
export function earnedPerkRefs(hero) {
    const perks = earnedPerks(hero);
    if (!perks.length) return NONE;
    const merged = new Map();
    for (const { effectId, scale } of perks) {
        const current = merged.get(effectId);
        merged.set(effectId, current == null ? normaliseScale(scale) : Math.min(MAX_SCALE, current + scale));
    }
    return [...merged].map(([effectId, scale]) => ({ effectId, scale }));
}
