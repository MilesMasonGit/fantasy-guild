import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';
import { migrateEffectLibrary, migrateEffectIdsIn, EFFECT_ID_RENAMES } from '../../systems/effects/effectIdMigration.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';

/**
 * A `data/` file's text as the CMS holds it once loaded and synced: retired skill ids
 * renamed (`skillIdMigration.js`), and a Token still filed under the retired `map` type
 * (Map Tokens are gone: maps are items) refiled by what its rules say, as the next Sync
 * refiles it. So a sync differs from `data/` by exactly those and nothing else.
 *
 * Also a renamed library effect (`effectIdMigration.js`: the Poison status is Venom) under its new
 * id, with every reference and a Token description naming the old id (the CMS composes a rule's
 * text with the id) following it.
 *
 * Also a Token description saying "1 more harvests", as the next Recalculate rewrites it now the
 * renderer agrees with its count.
 *
 * Byte-identical to the file whenever there is nothing to change, which is the case once
 * the owner's next Sync has written the new ids into `data/` and the
 * last Map Token (Volcanic Island) is deleted or refiled.
 */
function refileRetiredMapTokens(tokens) {
    if (!Object.values(tokens || {}).some((def) => def?.tokenType === 'map')) return tokens;
    return Object.fromEntries(Object.entries(tokens).map(([id, def]) => [
        id,
        def?.tokenType === 'map' ? { ...def, tokenType: deriveTokenType(def).type } : def
    ]));
}

/** Token descriptions naming a renamed effect by its old id, as the next Recalculate rewrites them. */
function describeRenamedEffects(tokens) {
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(tokens || {})) {
        let text = def?.description;
        if (typeof text === 'string') {
            for (const [oldId, { id: newId }] of Object.entries(EFFECT_ID_RENAMES)) text = text.split(oldId).join(newId);
            text = text.replace(/1 (more|fewer) harvests/g, '1 $1 harvest');
        }
        out[id] = text !== def?.description ? { ...def, description: text } : def;
        if (out[id] !== def) changed = true;
    }
    return changed ? out : tokens;
}

const MIGRATIONS = {
    'tokens.json': (tokens) => describeRenamedEffects(refileRetiredMapTokens(migrateEffectIdsIn(migrateSkillIdsIn(tokens)))),
    'items.json': (items) => migrateEffectIdsIn(migrateSkillIdsIn(items)),
    'effects.json': (effects) => migrateEffectLibrary(migrateSkillIdsIn(effects)),
    'tokenRecipes.json': migrateRecipeList
};

export function asLoaded(file, text) {
    const migrate = MIGRATIONS[file];
    if (!migrate) return text;
    const parsed = JSON.parse(text);
    const migrated = migrate(parsed);
    return migrated === parsed ? text : `${JSON.stringify(migrated, null, 2)}\n`;
}
