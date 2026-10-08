import { statementsOf } from './statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';

/**
 * Rewrites a renamed skill id wherever content names a skill. A shared module
 * because it must run over two copies of the same content, like
 * `effectMigration.js`: the game's `data/` (the JSON loaders in
 * `tokenRegistry`, `effectRegistry`, `itemRegistry` and `recipePoolRegistry`)
 * and the CMS workspace in the author's browser (`useEntityStore`, on every
 * load path). If only the game converted, the next "Sync to Game" would write
 * the old id straight back into `data/`.
 *
 * ⚠️ Pure, because the CMS imports it.
 *
 * ⚠️ Never called from `registerTokenTypes` or the other test-fixture seams: a
 * fixture that named an old id would then pass while its heroes hold no such
 * skill. It can go once `data/` and the CMS workspace say the new id.
 *
 * Rules:
 * - An id not in the table (a real skill, or an unknown one) is left as it is;
 *   `ContentAudit` names the unknown ones.
 * - Idempotent, and returns the SAME object when nothing changed, so a loader
 *   can call it on everything without copying content.
 */

/** Old skill id → new skill id. */
export const SKILL_ID_RENAMES = Object.freeze({ logging: 'forestry' });

const renamed = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(SKILL_ID_RENAMES, id)
    ? SKILL_ID_RENAMES[id]
    : id);

/** `obj` with `obj[key]` renamed, or `obj` itself when there is nothing to rename. */
function withRenamed(obj, key) {
    if (!obj || typeof obj !== 'object') return obj;
    const next = renamed(obj[key]);
    return next === obj[key] ? obj : { ...obj, [key]: next };
}

/**
 * A statement's skill fields: the station skill (`Works as`) and a modifier's
 * narrowing. A narrowing on a row whose vocabulary is statuses names a status,
 * not a skill, and is left alone.
 */
function migrateStatement(statement) {
    const payload = statement?.payload;
    if (!payload || typeof payload !== 'object') return statement;
    let next = withRenamed(payload, 'skill');
    if (getPaletteEntry(payload.type)?.categories !== 'status') next = withRenamed(next, 'category');
    return next === payload ? statement : { ...statement, payload: next };
}

/**
 * Every skill a definition names: a Token's `config.skill`, `foundation.skill`
 * and `shop.section`; a recipe's `skill`; an item's `skillRequired` and
 * `requirements[].skill`; and every statement's `payload.skill` and
 * `payload.category`. One function for all of them, since each kind only
 * carries its own fields.
 *
 * @param {object} def a Token, library entry, item or recipe
 * @returns {object} the same object when nothing changed
 */
export function migrateSkillIds(def) {
    if (!def || typeof def !== 'object') return def;
    let next = def;
    const set = (key, value) => {
        if (value === next[key]) return;
        if (next === def) next = { ...def };
        next[key] = value;
    };

    set('config', withRenamed(def.config, 'skill'));
    set('foundation', withRenamed(def.foundation, 'skill'));
    set('shop', withRenamed(def.shop, 'section'));
    set('skill', renamed(def.skill));
    set('skillRequired', renamed(def.skillRequired));

    if (Array.isArray(def.requirements)) {
        const requirements = def.requirements.map(r => withRenamed(r, 'skill'));
        if (requirements.some((r, i) => r !== def.requirements[i])) set('requirements', requirements);
    }

    const statements = statementsOf(def);
    if (statements.length) {
        const migrated = statements.map(migrateStatement);
        if (migrated.some((s, i) => s !== statements[i])) set('statements', migrated);
    }

    return next;
}

/** `migrateSkillIds` over a keyed collection (Tokens, effects, items). */
export function migrateSkillIdsIn(collection) {
    if (!collection || typeof collection !== 'object') return collection;
    let out = null;
    for (const [id, def] of Object.entries(collection)) {
        const migrated = migrateSkillIds(def);
        if (migrated !== def) {
            if (!out) out = { ...collection };
            out[id] = migrated;
        }
    }
    return out || collection;
}

/** `migrateSkillIds` over a flat recipe list (`data/tokenRecipes.json`). */
export function migrateRecipeList(recipes) {
    if (!Array.isArray(recipes)) return recipes;
    const migrated = recipes.map(migrateSkillIds);
    return migrated.some((r, i) => r !== recipes[i]) ? migrated : recipes;
}

/**
 * The CMS keeps recipes in pools keyed by skill id: each recipe's `skill` is
 * renamed, and a pool under an old key moves to the new key, after any recipes
 * already there.
 */
export function migrateRecipePools(pools) {
    if (!pools || typeof pools !== 'object') return pools;
    let changed = false;
    const out = {};
    const moved = [];
    for (const [skillId, pool] of Object.entries(pools)) {
        const key = renamed(skillId);
        const recipes = migrateRecipeList(pool);
        if (recipes !== pool) changed = true;
        if (key !== skillId) {
            changed = true;
            moved.push([key, recipes]);
            continue;
        }
        out[key] = recipes;
    }
    for (const [key, recipes] of moved) {
        out[key] = out[key] ? [...out[key], ...(recipes || [])] : recipes;
    }
    return changed ? out : pools;
}
