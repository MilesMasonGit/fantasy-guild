// Fantasy Guild — A hero's flag rules: which skills they work, and in what order (Free Playmat slice 1.5b)

import { isCombatSkill, getSkill } from '../../config/registries/skillRegistry.js';
import { GameState } from '../../state/GameState.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';

/**
 * FlagRules — **the data half of FP-71**: per-hero, per-skill "allowed" and
 * "priority". The rules that act on them (choosing, switching, `setRule`) are
 * in `Flags.js`; this file only reads and describes.
 *
 * ## The shape (FPP-17)
 * `hero.flagRules = { [ruleId]: { allowed: boolean, priority: 1..5 } }`, saved
 * on the hero, so it survives a recall, a defeat and a save. **Sparse**: a
 * missing entry means allowed at priority 3. A `ruleId` is a work skill id, or
 * {@link FIGHT} for combat.
 *
 * * An entry for a skill the hero no longer holds (banked by a promotion) is
 *   **kept and ignored** — so a banked-and-restored skill comes back with its
 *   rule, and a newly gained skill simply has no entry, which is the default.
 * * **Priority 1 is highest** (FP-79). The hero takes the nearest runnable
 *   Token of the best priority that has one (FP-72).
 * * **Combat is one rule**, `'combat'` — a hero fights with whatever combat
 *   skill they hold, so combat skills are never listed one by one (FP-74).
 *   Allowed by default.
 */

/** The single combat rule (FP-74). */
export const FIGHT = 'combat';

export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 5;
export const PRIORITY_DEFAULT = 3;

/**
 * The hero record, read straight from state.
 *
 * ⚠️ Not through `HeroManager.getHero`: that rehydrates the hero as a side
 * effect, and the chooser's hot path must not rebuild a hero's modifiers (or
 * crash on a half-made hero record).
 */
export function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** Whether a number is a valid priority. */
export function isPriority(value) {
    return Number.isInteger(value) && value >= PRIORITY_MIN && value <= PRIORITY_MAX;
}

/**
 * One rule of one hero, defaults filled: `{ allowed, priority }`. A stored
 * value of the wrong type reads as the default rather than being trusted.
 */
export function ruleOf(heroId, ruleId) {
    const stored = heroRecord(heroId)?.flagRules?.[ruleId];
    return {
        allowed: stored?.allowed !== false,
        priority: isPriority(stored?.priority) ? stored.priority : PRIORITY_DEFAULT
    };
}

/** The hero's held skills, as saved. */
function heldSkills(heroId) {
    const hero = heroRecord(heroId);
    return hero?.skills && typeof hero.skills === 'object' ? hero.skills : {};
}

/** Whether the hero can fight at all — holds a combat skill (D-249). */
export function canFight(heroId) {
    return CombatFormulas.canHeroFight(heroRecord(heroId));
}

/**
 * Whether a rule applies to this hero right now: a work skill they hold, or
 * {@link FIGHT} for a hero who can fight.
 */
export function holdsRule(heroId, ruleId) {
    if (!ruleId) return false;
    if (ruleId === FIGHT) return canFight(heroId);
    return !!heldSkills(heroId)[ruleId];
}

/**
 * The rows a rules panel lists for a hero: every held **non-combat** skill
 * (highest level first, then name), then one **Fight** row only if the hero
 * can fight. Each row carries its rule.
 *
 * @returns {{ ruleId: string, name: string, level: number|null, combat: boolean,
 *             allowed: boolean, priority: number }[]}
 */
export function rowsFor(heroId) {
    const skills = heldSkills(heroId);
    const rows = Object.keys(skills)
        .filter(id => !isCombatSkill(id))
        .map(id => ({ ruleId: id, name: getSkill(id)?.name || id, level: skills[id]?.level ?? null, combat: false }))
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name));
    if (canFight(heroId)) rows.push({ ruleId: FIGHT, name: 'Fight', level: null, combat: true });
    return rows.map(row => ({ ...row, ...ruleOf(heroId, row.ruleId) }));
}
