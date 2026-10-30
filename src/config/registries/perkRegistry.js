// Fantasy Guild - milestone perk tables (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { perkRowsOf } from '../../systems/hero/perkTable.js';

/**
 * Each skill's perk rows, read from `data/skillPerks.json` (shape: `perkTable.js`), in level order.
 * A skill the file does not name has none. Content naming a skill the game does not have is kept
 * here and named by the audits; no hero holds it, so it does nothing.
 *
 * ⚠️ **Never hand-edit `data/skillPerks.json`.** The CMS writes it wholesale on Sync.
 */
function loadSkillPerks() {
    const tables = {};
    for (const [path, module] of Object.entries(DatabaseManager.skillPerkFilesSingle || {})) {
        try {
            const data = module.default || module;
            for (const [skillId, record] of Object.entries(data || {})) {
                const rows = perkRowsOf(record);
                if (rows.length) tables[skillId] = rows;
            }
        } catch (error) {
            console.warn(`[PerkRegistry] Error loading perks from ${path}:`, error);
        }
    }
    return tables;
}

/**
 * Every skill's rows, keyed by skill id. ⚠️ Deliberately not frozen: `registerSkillPerks` replaces
 * a skill's table for test fixtures and the dev QA scenes.
 * @type {Record<string, ReadonlyArray<{ level: number, effectId: string, scale: number }>>}
 */
export const SKILL_PERKS = loadSkillPerks();

const NONE = Object.freeze([]);

/** The skills with at least one perk, read on every hero-rules lookup, so kept rather than derived. */
let perkSkillIds = Object.keys(SKILL_PERKS);

/** One skill's perk rows, in level order (none when it has no table). */
export function perkRowsFor(skillId) {
    return SKILL_PERKS[skillId] || NONE;
}

/** The skill ids that carry at least one perk. */
export function skillsWithPerks() {
    return perkSkillIds;
}

/**
 * Replace skills' perk tables at run time (`{ forestry: { perks: [...] } }`; an empty list clears
 * one). **For test fixtures and the dev QA scenes only**: nothing in `src/systems` may call it.
 */
export function registerSkillPerks(collection) {
    for (const [skillId, record] of Object.entries(collection || {})) {
        const rows = perkRowsOf(record);
        if (rows.length) SKILL_PERKS[skillId] = rows;
        else delete SKILL_PERKS[skillId];
    }
    perkSkillIds = Object.keys(SKILL_PERKS);
}
