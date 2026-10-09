import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';

/**
 * A `data/` file's text as the CMS holds it once loaded and synced: retired skill ids
 * renamed (`skillIdMigration.js`), and a Token still filed under the retired `map` type
 * (Map Tokens are gone: maps are items) refiled by what its rules say, as the next Sync
 * refiles it. So a sync differs from `data/` by exactly those and nothing else.
 *
 * Byte-identical to the file whenever there is nothing to change, which is the case once
 * the owner's next Sync has written the new ids into `data/` and the last Map Token
 * (Volcanic Island) is deleted or refiled.
 */
function refileRetiredMapTokens(tokens) {
    if (!Object.values(tokens || {}).some((def) => def?.tokenType === 'map')) return tokens;
    return Object.fromEntries(Object.entries(tokens).map(([id, def]) => [
        id,
        def?.tokenType === 'map' ? { ...def, tokenType: deriveTokenType(def).type } : def
    ]));
}

const MIGRATIONS = {
    'tokens.json': (tokens) => refileRetiredMapTokens(migrateSkillIdsIn(tokens)),
    'items.json': migrateSkillIdsIn,
    'effects.json': migrateSkillIdsIn,
    'tokenRecipes.json': migrateRecipeList
};

export function asLoaded(file, text) {
    const migrate = MIGRATIONS[file];
    if (!migrate) return text;
    const parsed = JSON.parse(text);
    const migrated = migrate(parsed);
    return migrated === parsed ? text : `${JSON.stringify(migrated, null, 2)}\n`;
}
