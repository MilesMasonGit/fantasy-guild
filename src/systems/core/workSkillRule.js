// Fantasy Guild — a hero-worked Token must name a skill (FP-47)

import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';

/**
 * The one rule behind "this Token has no skill", shared by the game's boot audit
 * (`ContentAudit`) and the CMS (the Economy Audit tab and the Token editor), so
 * the two can never disagree about which Tokens it names.
 *
 * ## Why it exists (Free Playmat slice 1.0)
 * FP-47 (locked): every hero-worked Token names a skill, and a Token with no
 * skill is not workable. Today `BoardRunner` lets ANY hero work a Token whose
 * `config.skill` is blank, so a blank skill is invisible — the bush works,
 * nothing complains. When the free playmat lands, those Tokens stop being
 * workable. This rule makes them visible first, so the owner can author a skill
 * for each one before anything changes.
 *
 * ⚠️ **It changes nothing about how the game runs.** It only reports.
 *
 * ## Who it names
 * A Token that has a work cycle (`config`), is worked by a hero
 * (`requiresHero` is not `false`), and has a blank or missing `config.skill`.
 *
 * ## Who is exempt
 * * **Enemies** — they are fought by combat flags, not worked with a skill.
 * * **Promotion Tokens** (FP-34, FP-61) — a hero trains there; the Promotes
 *   rule, not a skill, decides who may.
 * * **Tokens with no work cycle** (maps, buffs, pickaxes, stations drawing a
 *   recipe pool) — there is nothing for a hero to work, so there is no skill to
 *   name. `BoardRunner` skips a config-less Token entirely.
 *
 * ⚠️ The definition must be **expanded** (its effect references resolved into
 * statements) or a Promotion Token cannot be recognised. The game's registry
 * stores Tokens expanded; the CMS stores references, so CMS callers expand first.
 *
 * @param {object} def A Token definition, expanded.
 * @returns {boolean} true when this Token needs a skill authored.
 */
export function isWorkedWithoutSkill(def) {
    if (!def || typeof def !== 'object') return false;
    if (!def.config || typeof def.config !== 'object') return false;
    if (def.requiresHero === false) return false;
    if (isEnemyDef(def)) return false;
    // ⚠️ Through the type classifier, NOT by reading the Promotes rule here:
    // PR-9 pins that only `BoardPromotion` reads that rule among the engine
    // systems (`BoardPromotion.test.js` scans for it by name). The classifier
    // already knows what a Promotion Token is, so this asks it.
    if (deriveTokenType(def)?.type === 'promotion') return false;

    const skill = def.config.skill;
    return typeof skill !== 'string' || skill.trim() === '';
}

/**
 * Why it matters, in the owner's words. Shared so the game console and the CMS
 * say the same thing.
 */
export const WORK_SKILL_WHY =
    'Today any hero can work it, but on the free playmat a Token with no skill will not be ' +
    'workable at all (FP-47). Pick its skill in the CMS, under Work Cycle → Skill.';
