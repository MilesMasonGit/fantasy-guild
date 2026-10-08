// Content that names a skill or a job the game does not have.

import { isSkillId } from '../../config/registries/skillRegistry.js';
import { getJob } from '../../config/registries/jobRegistry.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { statementsOf, stationSkillOf } from '../effects/statements.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';

/**
 * The one rule behind "this names a skill or job that does not exist", shared
 * by the game's boot audit (`ContentAudit`) and the CMS Economy Audit
 * (`connectivityAuditor`), so the two name the same things in the same words.
 *
 * A renamed or dropped skill (Logging, Explore) or job loads silently: the
 * registries return null and every reader survives it, so the content just
 * stops doing anything. This makes it visible.
 *
 * ⚠️ **It only reports.** Nothing here changes how the game runs. A blank
 * field is "not set", never a finding.
 *
 * ## Input
 * A pure function over `{ tokens, items, recipes }` (keyed by id, or lists).
 * Tokens must be **expanded** (effect references resolved into statements):
 * a Promotes rule or a station's `Works as` lives in the effect library.
 *
 * ## Output
 * `[{ entityType, entityId, entityName, field, message }]`, `entityType` being
 * `'Token'`, `'Item'` or `'Recipe'`, and `message` a sentence that does not
 * repeat the entity's name.
 */

/** Shop entries without a skill section fall under this one (`Shop.GENERAL_SECTION`). */
const GENERAL_SHOP_SECTION = 'general';

const hasValue = (v) => typeof v === 'string' && v.trim() !== '';
const asList = (collection) => (Array.isArray(collection) ? collection : Object.values(collection || {}));

/** A rule's narrowing may also name the combat parent or "all", which match more than one skill. */
function isScopeCategory(category) {
    return isSkillId(category) || category === TARGET_CATEGORIES.COMBAT || category === TARGET_CATEGORIES.ALL;
}

/** Findings for one bearer's statements (a Token or an item). */
function statementFindings(def, push) {
    for (const statement of statementsOf(def)) {
        const payload = statement?.payload || {};
        // ⚠️ By the field, not the keyword: only `BoardPromotion` may read the Promotes rule among
        // the engine systems (`BoardPromotion.test.js` scans for it), and a job id is a job id.
        if (hasValue(payload.jobId) && !getJob(payload.jobId)) {
            push('statements', `one of its rules promotes to the job "${payload.jobId}", which does not exist — it promotes nobody. Pick the job again in the CMS.`);
        }
        if (hasValue(payload.category) && getPaletteEntry(payload.type)?.categories === 'skill'
            && !isScopeCategory(payload.category)) {
            push('statements', `one of its rules is narrowed to the skill "${payload.category}", which does not exist — the rule matches nothing. Pick the skill again in the CMS.`);
        }
    }
}

/**
 * Every skill and job reference in the content that does not resolve.
 *
 * @param {{ tokens?: object, items?: object, recipes?: object }} content
 * @returns {Array<{ entityType: string, entityId: string, entityName: string, field: string, message: string }>}
 */
export function findUnknownRefs({ tokens, items, recipes } = {}) {
    const out = [];

    for (const def of asList(tokens)) {
        if (!def || typeof def !== 'object') continue;
        const push = (field, message) => out.push({
            entityType: 'Token', entityId: def.id, entityName: def.name || def.id, field, message
        });

        const skill = def.config?.skill;
        if (hasValue(skill) && !isSkillId(skill)) {
            push('config.skill', `is worked with the skill "${skill}", which does not exist — no hero holds it, so nobody can work it. Pick its skill in the CMS, under Work Cycle → Skill.`);
        }
        const station = stationSkillOf(def);
        if (hasValue(station) && !isSkillId(station)) {
            push('statements', `works as the skill "${station}", which does not exist — no hero holds it, so nobody can work it. Pick the skill again in the CMS.`);
        }
        const section = def.shop?.section;
        if (hasValue(section) && section !== GENERAL_SHOP_SECTION && !isSkillId(section)) {
            push('shop.section', `is sold in the Shop section "${section}", which is neither a skill nor General — the Shop heads it with that raw id. Pick its section again in the CMS.`);
        }
        statementFindings(def, push);
    }

    for (const def of asList(items)) {
        if (!def || typeof def !== 'object') continue;
        const push = (field, message) => out.push({
            entityType: 'Item', entityId: def.id, entityName: def.name || def.id, field, message
        });
        const needs = [
            ...(Array.isArray(def.requirements) ? def.requirements.map(r => r?.skill) : []),
            def.skillRequired
        ];
        for (const skill of needs) {
            if (hasValue(skill) && !isSkillId(skill)) {
                push('requirements', `needs the skill "${skill}", which does not exist — no hero can equip it.`);
            }
        }
        statementFindings(def, push);
    }

    for (const recipe of asList(recipes)) {
        if (!recipe || typeof recipe !== 'object') continue;
        if (hasValue(recipe.skill) && !isSkillId(recipe.skill)) {
            out.push({
                entityType: 'Recipe', entityId: recipe.id, entityName: recipe.name || recipe.id, field: 'skill',
                message: `belongs to the skill "${recipe.skill}", which does not exist — no station can make it.`
            });
        }
    }

    return out;
}
