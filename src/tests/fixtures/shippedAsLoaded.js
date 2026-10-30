import { migrateSkillIdsIn, migrateRecipeList } from '../../systems/effects/skillIdMigration.js';
import { migrateEffectLibrary, migrateEffectIdsIn, EFFECT_ID_RENAMES } from '../../systems/effects/effectIdMigration.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';
import { neededToolOf, toolNeedPhrase } from '../../config/registries/toolKinds.js';
import fs from 'fs';
import path from 'path';

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
 * Also a Token that needs a tool in hand but whose description does not say so yet: the
 * tools content was first synced by a CMS that had no Needs tool clause, and Recalculate
 * now writes it ("Needs a Pickaxe in hand.") ahead of the rest of the description.
 *
 * Byte-identical to the file whenever there is nothing to change, which is the case once
 * the owner's next Sync has written the new ids and the tool clauses into `data/` and the
 * last Map Token (Volcanic Island) is deleted or refiled.
 */
function refileRetiredMapTokens(tokens) {
    if (!Object.values(tokens || {}).some((def) => def?.tokenType === 'map')) return tokens;
    return Object.fromEntries(Object.entries(tokens).map(([id, def]) => [
        id,
        def?.tokenType === 'map' ? { ...def, tokenType: deriveTokenType(def).type } : def
    ]));
}

const FALLBACK_DESCRIPTION = 'A token for the guild playmat.';
const shippedItems = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/items.json'), 'utf8'));

function describeNeededTools(tokens) {
    let items = null;
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(tokens || {})) {
        const need = neededToolOf(def);
        let next = def;
        if (need && !(def.acceptedTokens || []).length) {
            const phrase = toolNeedPhrase(need, items ||= shippedItems());
            const clause = `Needs ${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase} in hand.`;
            const text = def.description || '';
            if (!text.includes(clause)) {
                next = { ...def, description: !text || text === FALLBACK_DESCRIPTION ? clause : `${clause} ${text}` };
                changed = true;
            }
        }
        out[id] = next;
    }
    return changed ? out : tokens;
}

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

const MIGRATIONS = {
    'tokens.json': (tokens) => describeRenamedEffects(describeNeededTools(refileRetiredMapTokens(migrateEffectIdsIn(migrateSkillIdsIn(tokens))))),
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
