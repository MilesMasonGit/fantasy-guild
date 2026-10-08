import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';

/**
 * A `data/` file's text as the CMS holds it once loaded: retired skill ids
 * renamed (`skillIdMigration.js`), so a sync differs from `data/` by exactly
 * that rename and nothing else.
 *
 * Byte-identical to the file whenever there is nothing to rename, which is the
 * case once the owner's next Sync has written the new ids into `data/`.
 */
const MIGRATIONS = {
    'tokens.json': migrateSkillIdsIn,
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
