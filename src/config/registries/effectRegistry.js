// Fantasy Guild — Effect registry (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { hasWorkingStatements, usedBy } from '../../systems/effects/effectLibrary.js';
import { migrateAppliesTargets } from '../../systems/effects/effectMigration.js';

/**
 * One entry on its way into the library, in the shape the game runs.
 *
 * ⚠️ The retired `target: 'enemy'` flag becomes the enemy role here, on
 * every entry — shipped and fixture alike — so nothing downstream ever sees the
 * flag. The CMS store runs the same function on its own copy.
 */
function admit(entry) {
    return migrateAppliesTargets(entry);
}

/**
 * The named effect library — every rule in the game, once, with a name.
 *
 * Bearers (Tokens today, items from P4) store references; this holds the
 * entries they point at. `tokenRegistry` resolves the two together at load, so
 * nothing downstream of it knows the library exists.
 *
 * ## ⚠️ `data/effects.json` has been this name before
 * An old card-era file of this name (56 entries keyed `"0"`–`"55"`, each a name and a `targetEntityTypes` list) was orphaned and deleted. Do not restore it.
 *
 * The old library failed because **the names had no mechanism behind them.**
 * An entry here is a name wrapping real statements, which generate their own sentence and are consumed by the
 * same board systems that have always consumed them — and `ContentAudit`
 * enforces that a named effect cannot exist without a statement that
 * works.
 *
 * ⚠️ **Never hand-edit `data/effects.json`.** The CMS writes it
 * wholesale on sync; anything added by hand is destroyed on the next one.
 */
function loadJsonEffects() {
    const effects = {};

    for (const source of [DatabaseManager.effectFilesSingle, DatabaseManager.effectFilesGlob]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                for (const [effectId, entry] of Object.entries(data)) {
                    if (!entry.id) entry.id = effectId;
                    effects[effectId] = admit(entry);
                }
            } catch (error) {
                console.warn(`[EffectRegistry] Error loading effect JSON from ${path}:`, error);
            }
        }
    }

    return effects;
}

/**
 * Every library entry, keyed by id.
 *
 * ⚠️ **Deliberately NOT frozen**, for the same reason `TOKENS` is not:
 * `registerEffects` mutates it for test fixtures.
 *
 * @type {Record<string, object>}
 */
export const EFFECTS = loadJsonEffects();

/**
 * Add library entries at runtime. **For test fixtures only.**
 *
 * Mirrors `registerTokenTypes` exactly, including its rule: nothing in
 * `src/systems` or `src/ui` may call this. A fixture Token that references
 * `fixture_effect_*` needs the entry to exist before it is expanded.
 */
export function registerEffects(entries) {
    for (const [effectId, entry] of Object.entries(entries || {})) {
        EFFECTS[effectId] = admit(entry);
    }
}

/** One entry, or null. */
export function getEffect(effectId) {
    return EFFECTS[effectId] || null;
}

/** Every entry. */
export function getAllEffects() {
    return EFFECTS;
}

/** An entry's display name, falling back to its id so a sentence never reads blank. */
export function effectName(effectId) {
    return EFFECTS[effectId]?.name || effectId || '';
}

/** Entries with a name and nothing behind it — violations of the rule that a named effect needs a working statement. */
export function unbackedEffectIds() {
    return Object.keys(EFFECTS).filter(id => !hasWorkingStatements(EFFECTS[id]));
}

/**
 * Which bearers reference an entry.
 *
 * The game side of the CMS's *used by* readout. It is here rather than only in
 * the CMS because `ContentAudit` needs the inverse question — an entry nothing
 * references is content the owner has probably lost track of.
 */
export function effectUsedBy(effectId, tokens = {}) {
    return usedBy(effectId, tokens);
}
