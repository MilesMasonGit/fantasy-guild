import { statementsOf, getKeyword } from './statements.js';
import { getPaletteEntry, clampModifierValue } from '../../config/registries/modifierPalette.js';

/**
 * A named effect is a title wrapping one or more statements, stored once and referenced by
 * every bearer that uses it: `{ effects: [ { effectId, scale } ] }` on a Token or item.
 *
 * ⚠️ This module is imported by the CMS, so it stays PURE: no registry imports, no `data/`
 * reads, no `import.meta.glob`. A data-loading import here would break the CMS build.
 * Loading lives in `src/config/registries/effectRegistry.js`; the shape logic lives here so
 * the CMS migration and the game loader call the same functions.
 *
 * A bearer STORES references; the game RUNS on expanded statements. `expandBearer` resolves
 * the refs once at load and stamps each statement with its source entry, so consumers keep
 * reading `def.statements`. Test fixtures may therefore author `statements` inline.
 */

/** The id prefix every library entry carries. */
export const EFFECT_ID_PREFIX = 'effect';

/** The strongest a reference may be. Also the stacking ceiling. */
export const MAX_SCALE = 5;

/** Roman numerals for 1–5. A scale of 1 has no numeral — it is the plain effect. */
const NUMERALS = ['', '', 'II', 'III', 'IV', 'V'];

/**
 * A scale pulled into the shape the grammar allows: a whole number, 1 to 5 (the title is a
 * Roman numeral, and a strength outside the range should be its own library entry).
 */
export function normaliseScale(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(MAX_SCALE, n);
}

/**
 * The title the player is shown: name plus numeral (`Shrimp Trawler III` at scale 3).
 *
 * ⚠️ The numeral is the ONLY number allowed in a title. The magnitude lives in the generated
 * sentence underneath; a title carrying "10%" would be a hand-written description that
 * drifts when the statement changes.
 */
export function effectTitle(name, scale = 1) {
    const numeral = NUMERALS[normaliseScale(scale)];
    return numeral ? `${name} ${numeral}` : `${name}`;
}

/** Multiply a list of `{itemId, quantity}` entries. */
function scaleAmounts(list, scale) {
    return (list || []).map(entry => (
        entry?.quantity == null ? entry : { ...entry, quantity: Math.round(entry.quantity * scale) }
    ));
}

/**
 * One statement at a given scale.
 *
 * ⚠️ Scaling happens HERE, during expansion, so the rest of the game keeps reading plain
 * statements (including the generated sentence) and no consumer can forget to multiply.
 *
 * What scales is declared, never inferred: the palette row for a `Provides`/`Grants`/
 * `Converts` payload, the keyword itself for `Applies`. A statement whose effect declares
 * nothing comes back untouched.
 */
export function scaleStatement(statement, scale = 1) {
    const factor = normaliseScale(scale);
    if (factor === 1 || !statement) return statement;

    const payload = statement.payload || {};
    const entry = getPaletteEntry(payload.type);
    const field = entry?.scales || getKeyword(statement.keyword)?.scales;
    if (!field) return statement;

    if (field === 'amounts') {
        return {
            ...statement,
            payload: {
                ...payload,
                consumes: scaleAmounts(payload.consumes, factor),
                produces: scaleAmounts(payload.produces, factor),
            }
        };
    }

    const current = Number(payload[field]);
    if (!Number.isFinite(current)) return statement;

    // A proc is a chance: clamp holds it inside 0-100 so a scaled chance saturates.
    const scaled = entry
        ? clampModifierValue(entry, current * factor)
        : current * factor;

    return { ...statement, payload: { ...payload, [field]: scaled } };
}

/**
 * A bearer's references, normalised. Tolerates a bare string id, a `{ effectId }` object and
 * the full `{ effectId, scale }`; a blank or malformed entry is dropped rather than returned
 * as a hole. `scale` is normalised to a whole 1-5.
 */
export function effectRefsOf(def) {
    const raw = Array.isArray(def?.effects) ? def.effects : [];
    const refs = [];
    for (const entry of raw) {
        const effectId = typeof entry === 'string' ? entry : entry?.effectId;
        if (!effectId) continue;
        // ⚠️ `chargeCost` is read but NOT defaulted: absent means whatever the statement says,
        // and a number here overrides it (one Thorns free on a berry bush, a charge on a monster).
        const chargeCost = typeof entry === 'string' ? undefined : entry.chargeCost;
        refs.push({
            effectId,
            scale: normaliseScale(typeof entry === 'string' ? 1 : entry.scale),
            ...(typeof chargeCost === 'number' ? { chargeCost } : {})
        });
    }
    return refs;
}

/**
 * Whether a library entry is real: it has at least one statement and every statement names a
 * keyword. Deliberately shallow: a half-authored payload is a normal mid-authoring state
 * (the sentence shows blanks as `…`); this catches a name with nothing behind it.
 */
export function hasWorkingStatements(entry) {
    const statements = statementsOf(entry);
    if (!statements.length) return false;
    return statements.every(statement => !!statement?.keyword);
}

/**
 * One library entry's statements, stamped with where they came from: `sourceEffectId`
 * (traced by `ContentAudit` and the CMS used-by readout), `effectName`, and `scale`
 * (already applied to the payload by `scaleStatement`; nothing downstream multiplies again).
 *
 * ⚠️ Statement ids are not rewritten, and that is safe: all per-statement state is stored on
 * the INSTANCE (`instance.blockUpkeep[id]`, `instance.blockCooldowns[id]`, and
 * `TriggerSystem`'s re-entry guard keyed `tile:id`), so two Tokens sharing an id hold
 * separate state. One bearer naming the same entry twice would collide; see `duplicateRefsOf`.
 */
export function statementsFromEntry(entry, ref) {
    const scale = normaliseScale(ref?.scale);
    // A per-bearer cost is applied HERE, during expansion, for the same reason as
    // `scaleStatement`: consumers keep reading plain statements.
    let override = null;
    if (typeof ref?.chargeCost === 'number') {
        // ⚠️ `-Math.abs(0)` is -0, which `Object.is`/`toBe` treat as different from 0. A free
        // effect must produce a plain zero.
        const cost = Math.abs(ref.chargeCost);
        override = { chargeDelta: cost === 0 ? 0 : -cost };
    }
    return statementsOf(entry).map(statement => ({
        ...scaleStatement(statement, scale),
        ...(override || {}),
        sourceEffectId: entry?.id || ref?.effectId || null,
        effectName: entry?.name || null,
        effectTitle: effectTitle(entry?.name || ref?.effectId || '', scale),
        scale
    }));
}

/**
 * A bearer, with its references resolved into the statements the game runs on.
 * Returns a copy; the definition passed in is never mutated.
 *
 * A ref naming a missing entry contributes nothing and is not an error here: `ContentAudit`
 * reports dangling references at boot (they warn, never block).
 *
 * A def with inline `statements` and no `effects` is returned as-is (test fixtures).
 */
export function expandBearer(def, library = {}) {
    const refs = effectRefsOf(def);
    if (!refs.length) return def;

    const statements = [];
    for (const ref of refs) {
        const entry = library[ref.effectId];
        if (!entry) continue;
        statements.push(...statementsFromEntry(entry, ref));
    }

    // Inline statements come first and survive.
    //
    // ⚠️ Only statements that did NOT come from the library: every expanded statement is
    // stamped `sourceEffectId`, and keeping those as inline made a second expansion of an
    // already-expanded bearer duplicate every rule (the CMS Recalculate expands twice).
    // Dropping stamped copies makes expansion idempotent.
    const inline = statementsOf(def).filter(statement => !statement?.sourceEffectId);
    return { ...def, statements: [...inline, ...statements] };
}

/** Every bearer in a keyed collection, expanded. */
export function expandAll(defs = {}, library = {}) {
    const out = {};
    for (const [id, def] of Object.entries(defs)) {
        out[id] = expandBearer(def, library);
    }
    return out;
}

/**
 * The effect ids a bearer names more than once.
 *
 * Two refs to one entry on a bearer give two statements with the same id in one instance's
 * state map, so an upkeep clock or cooldown would be shared. "Twice as strong" is the `scale`
 * field, so this is reported rather than merged.
 */
export function duplicateRefsOf(def) {
    const seen = new Set();
    const duplicates = new Set();
    for (const { effectId } of effectRefsOf(def)) {
        if (seen.has(effectId)) duplicates.add(effectId);
        seen.add(effectId);
    }
    return [...duplicates];
}

/**
 * Which bearers use an entry (the CMS used-by readout), so "edit once, changes everywhere"
 * is safe to use.
 *
 * @param {string} effectId
 * @param {Record<string, object>[]} collections tokens, items, ...
 * @returns {Array<{id: string, name: string}>}
 */
export function usedBy(effectId, ...collections) {
    const users = [];
    for (const collection of collections) {
        for (const [id, def] of Object.entries(collection || {})) {
            if (effectRefsOf(def).some(ref => ref.effectId === effectId)) {
                users.push({ id, name: def?.name || id });
            }
        }
    }
    return users;
}
