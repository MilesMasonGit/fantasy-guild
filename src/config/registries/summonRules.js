// Summoned workers: a summon Token's own block, and the charges a Summoning Circle's cycle adds
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the
// Token editor's Summoned worker and Summoning Circle fields and the audit read it. Pure.

import { MAX_SKILL_LEVEL, xpForLevel } from '../../utils/XPCurve.js';

/**
 * A Summoned worker's kind is a Token type carrying a `summon` block: the enemy it is a recolour of
 * (`of`), its own skills at fixed levels (`skills`, skill id to level) and its one trait (a library
 * effect, `trait: { effectId, scale }`). It never stands on the mat as a Token: a Summoning Circle's
 * recipe names it as its output, and each finished cycle charges that Circle's Summoned worker
 * (`board/Summons.js`), who is then ordered like a hero.
 */

/** The skill a Summoning Circle works as, and whose level a summon recipe asks. */
export const SUMMONING_SKILL = 'summoning';

/**
 * What a Circle's cycle adds when its Token authors no `summonCircle` block: `charges`, plus
 * `perLevel` for every Summoning level of the hero working it, rounded down.
 */
export const DEFAULT_CIRCLE_CHARGES = Object.freeze({ charges: 5, perLevel: 0.1 });

/** Whether a Token type is a Summoned worker's kind. */
export function isSummonType(def) {
    return !!def && !!def.summon && typeof def.summon === 'object';
}

/** A trait reference as `{ effectId, scale }`, from the block or a bare effect id; null for none. */
export function traitRefOf(raw) {
    if (typeof raw === 'string') return raw ? { effectId: raw, scale: 1 } : null;
    if (!raw || typeof raw !== 'object' || typeof raw.effectId !== 'string' || !raw.effectId) return null;
    const scale = Number(raw.scale);
    return { effectId: raw.effectId, scale: Number.isFinite(scale) && scale > 0 ? scale : 1 };
}

/** A level as a whole number from 1 to the top level, or null for nonsense. */
function levelValue(raw) {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_SKILL_LEVEL) : null;
}

/**
 * A summon Token's block, read: `{ of, skills, trait }`, `skills` a fresh `{ skillId: level }` of
 * the rows that name a skill and a level, `trait` from {@link traitRefOf}. Null when the Token is
 * not a summon.
 */
export function summonOf(def) {
    if (!isSummonType(def)) return null;
    const block = def.summon;
    const skills = {};
    for (const [skillId, raw] of Object.entries(block.skills && typeof block.skills === 'object' ? block.skills : {})) {
        const level = levelValue(raw && typeof raw === 'object' ? raw.level : raw);
        if (skillId && level != null) skills[skillId] = level;
    }
    return {
        of: typeof block.of === 'string' && block.of ? block.of : null,
        skills,
        trait: traitRefOf(block.trait)
    };
}

/**
 * The skill sheet a Summoned worker of type `def` holds: only its own skills, each at its fixed
 * level with that level's XP, as a hero record's `skills` reads. Empty for a Token that is no summon.
 */
export function summonSkillSheet(def) {
    const sheet = {};
    for (const [skillId, level] of Object.entries(summonOf(def)?.skills || {})) {
        sheet[skillId] = { level, xp: xpForLevel(level) };
    }
    return sheet;
}

/** A setting's number, or the default when absent or below zero. */
function settingValue(raw, fallback) {
    const n = Number(raw);
    return raw != null && raw !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** A Summoning Circle Token's charge setting, read: `{ charges, perLevel }` (defaults filled in). */
export function circleChargeSetting(def) {
    const block = def?.summonCircle && typeof def.summonCircle === 'object' ? def.summonCircle : {};
    return {
        charges: settingValue(block.charges, DEFAULT_CIRCLE_CHARGES.charges),
        perLevel: settingValue(block.perLevel, DEFAULT_CIRCLE_CHARGES.perLevel)
    };
}

/**
 * How many charges one finished cycle of a Circle of type `def` adds, worked by a hero at Summoning
 * `level`: its `charges`, plus `perLevel` a level, rounded down; never fewer than 1.
 */
export function circleChargesAt(def, level) {
    const { charges, perLevel } = circleChargeSetting(def);
    const lv = Math.max(0, Math.floor(Number(level) || 0));
    return Math.max(1, Math.floor(charges + perLevel * lv + 1e-9));
}
