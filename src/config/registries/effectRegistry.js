// Fantasy Guild — Effect registry (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { hasWorkingStatements, usedBy } from '../../systems/effects/effectLibrary.js';

/**
 * The named effect library — every rule in the game, once, with a name.
 *
 * Bearers (Tokens today, items from P4) store references; this holds the
 * entries they point at. `tokenRegistry` resolves the two together at load, so
 * nothing downstream of it knows the library exists.
 *
 * ## ⚠️ `data/effects.json` has been this name before
 * The retired card-era CMS kept a collection called Effects: 56 entries keyed
 * `"0"`–`"55"`, each a name, a `targetEntityTypes` list and a description. It
 * was deleted from the editor by CMS-36 and the data file was orphaned — still
 * on disk, read by nothing, for months. The Unified Effects work deleted it and
 * took the filename back.
 *
 * That library failed for one reason, and it is the reason this file exists in
 * the shape it does: **the names had no mechanism behind them.** A name, a
 * description, and nothing that read either. An entry here is a name wrapping
 * real statements, which generate their own sentence and are consumed by the
 * same board systems that have always consumed them — and `ContentAudit`
 * enforces UE-10, that a named effect cannot exist without a statement that
 * works.
 *
 * ⚠️ **Never hand-edit `data/effects.json`** (CMS-53). The CMS writes it
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
                    effects[effectId] = entry;
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
    Object.assign(EFFECTS, entries || {});
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

/** Entries with a name and nothing behind it — UE-10's violations. */
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
