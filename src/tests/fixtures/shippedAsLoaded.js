import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';
import { migrateEffectLibrary, migrateEffectIdsIn, EFFECT_ID_RENAMES } from '../../systems/effects/effectIdMigration.js';
import { STANDARD_REACH_U } from '../../config/registries/reachRegistry.js';

/**
 * A `data/` file's text as the CMS holds it once loaded and synced: retired skill ids
 * renamed (`skillIdMigration.js`). So a sync differs from `data/` by exactly those and
 * nothing else.
 *
 * Also a renamed library effect (`effectIdMigration.js`: the Poison status is Venom) under its new
 * id, with every reference and a Token description naming the old id (the CMS composes a rule's
 * text with the id) following it.
 *
 * And a camp's description naming the reach its block once carried, as the next Recalculate
 * rewrites it: every camp works the one standard reach (brief 560 R1).
 *
 * Byte-identical to the file whenever there is nothing to change, which is the case once
 * the owner's next Sync has written the new ids into `data/`.
 */

/** Token descriptions naming a renamed effect by its old id, as the next Recalculate rewrites them. */
function describeRenamedEffects(tokens) {
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(tokens || {})) {
        let text = def?.description;
        if (typeof text === 'string') {
            for (const [oldId, { id: newId }] of Object.entries(EFFECT_ID_RENAMES)) text = text.split(oldId).join(newId);
        }
        out[id] = text !== def?.description ? { ...def, description: text } : def;
        if (out[id] !== def) changed = true;
    }
    return changed ? out : tokens;
}

/** A camp's description with its old authored reach, as the next Recalculate rewrites it to the standard reach. */
const CAMP_CLAUSE = /^(A camp: heroes sent here work the .+ Tokens within )(\d+)( u, one hero each\.)$/;
function describeStandardReach(tokens) {
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(tokens || {})) {
        const m = def?.camp && typeof def.description === 'string' ? CAMP_CLAUSE.exec(def.description) : null;
        const text = m && Number(m[2]) !== STANDARD_REACH_U ? `${m[1]}${STANDARD_REACH_U}${m[3]}` : null;
        out[id] = text ? { ...def, description: text } : def;
        if (text) changed = true;
    }
    return changed ? out : tokens;
}

const MIGRATIONS = {
    'tokens.json': (tokens) => describeStandardReach(describeRenamedEffects(migrateEffectIdsIn(migrateSkillIdsIn(tokens)))),
    'items.json': (items) => migrateEffectIdsIn(migrateSkillIdsIn(items)),
    'effects.json': (effects) => migrateEffectLibrary(migrateSkillIdsIn(effects)),
    'tokenRecipes.json': migrateRecipeList
};

export function asLoaded(file, text) {
    const migrate = MIGRATIONS[file];
    if (!migrate) return text;
    const parsed = JSON.parse(text);
    const migrated = migrate(parsed);
    // The file's own last line kept: `data/` ends without a newline.
    return migrated === parsed ? text : `${JSON.stringify(migrated, null, 2)}${text.endsWith('\n') ? '\n' : ''}`;
}
