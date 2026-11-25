import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';
import { STANDARD_REACH_U } from '../../config/registries/reachRegistry.js';
import { workspaceWorldFrom } from '../../../cms/src/engine/worldTables.js';

/**
 * A `data/` file's text as the CMS holds it once loaded and synced: retired skill ids
 * renamed (`skillIdMigration.js`). So a sync differs from `data/` by exactly those and
 * nothing else.
 *
 * And a camp's description naming the reach its block once carried, as the next Recalculate
 * rewrites it: every camp works the one standard reach (brief 560 R1).
 *
 * And the world tables with the biome table the CMS seeds a record without one with (today's values),
 * its kits' retired Stone dropped.
 *
 * Byte-identical to the file whenever there is nothing to change, which is the case once
 * the owner's next Sync has written the new ids into `data/`.
 */

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
    'tokens.json': (tokens) => describeStandardReach(migrateSkillIdsIn(tokens)),
    'items.json': (items) => migrateSkillIdsIn(items),
    'effects.json': (effects) => migrateSkillIdsIn(effects),
    'tokenRecipes.json': migrateRecipeList,
    'world.json': workspaceWorldFrom
};

export function asLoaded(file, text) {
    const migrate = MIGRATIONS[file];
    if (!migrate) return text;
    const parsed = JSON.parse(text);
    const migrated = migrate(parsed);
    // The file's own last line kept: `data/` ends without a newline.
    return migrated === parsed ? text : `${JSON.stringify(migrated, null, 2)}${text.endsWith('\n') ? '\n' : ''}`;
}
