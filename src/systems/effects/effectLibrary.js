// Fantasy Guild — the named effect library (Unified Effects, P1)

import { statementsOf, getKeyword } from './statements.js';
import { getPaletteEntry, clampModifierValue } from '../../config/registries/modifierPalette.js';

/**
 * A **named effect** is a title wrapping one or more statements, stored once
 * and referenced by every bearer that uses it.
 *
 * ```
 * data/effects.json     effect_shrimp_trawler: { name, statements: [ … ] }
 * data/tokens.json      token_shrimp_bay:      { effects: [ { effectId, scale } ] }
 * data/items.json       item_trawl_potion:     { effects: [ { effectId, scale } ] }   (P4)
 * ```
 *
 * ## Why the library, and not statements on the bearer (UE-3)
 * A statement inline on a Token is invisible and unshareable: the same idea
 * authored on a Bay and on a potion is two sets of numbers that drift, and
 * neither has a name the player could ever be shown. A named entry fixes both
 * at once — one edit reaches every bearer (UE-5), and the name is what pops up
 * on the tile when the effect fires.
 *
 * ## ⚠️ This module is imported by the CMS, so it stays PURE
 * No registry imports, no `data/` reads, no `import.meta.glob`. The CMS pulls
 * this across the project boundary the same way it pulls `statements.js`
 * (`cms/src/utils/constants.js`), and a data-loading import here would break
 * its build. Loading lives in `src/config/registries/effectRegistry.js`;
 * everything about the *shape* lives here, so the CMS's migration and the
 * game's loader cannot drift apart — they call the same functions.
 *
 * ## The storage shape and the runtime shape are deliberately different
 * A bearer **stores** references. The game **runs** on expanded statements:
 * `expandBearer` resolves the refs once at load and stamps each statement with
 * the entry it came from. Every existing consumer — `TileModifiers`,
 * `TriggerSystem`, `Restrictions`, `statementText`, `deriveTokenType` — keeps
 * reading `def.statements` and needed no change at all when the library landed.
 *
 * That is also why test fixtures may still author `statements` inline: an
 * expanded def and a hand-written one are the same thing by the time anything
 * reads it.
 */

/** The id prefix every library entry carries. */
export const EFFECT_ID_PREFIX = 'effect';

/** The strongest a reference may be (UE-18). Also the stacking ceiling (UE-19). */
export const MAX_SCALE = 5;

/** Roman numerals for 1–5. A scale of 1 has no numeral — it is the plain effect. */
const NUMERALS = ['', '', 'II', 'III', 'IV', 'V'];

/**
 * A scale pulled into the shape the grammar allows: a whole number, 1 to 5.
 *
 * UE-18. Integers because UE-9's title is a Roman numeral and 1.5 has none;
 * capped at 5 because that is where the numerals stop being readable and
 * because a strength outside the range is meant to be its own library entry.
 */
export function normaliseScale(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(MAX_SCALE, n);
}

/**
 * The title the player is shown — name plus numeral (UE-9).
 *
 * `Shrimp Trawler` at scale 1, `Shrimp Trawler III` at scale 3, so a potion's
 * stronger version reads as the same effect, larger, rather than as a second
 * thing to learn.
 *
 * ⚠️ The numeral is the **only** number allowed in a title. The magnitude lives
 * in the generated sentence underneath (UE-8): a title carrying "10%" would be
 * a hand-written description by the back door, free to drift the moment the
 * statement changes.
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
 * ## ⚠️ Scaling happens HERE, during expansion, and that is the whole design
 * The alternative was to carry `scale` alongside every statement and teach each
 * consumer to multiply by it — `TileModifiers`, `TriggerSystem`,
 * `StatusApplication`, `statementText`, and every consumer added later. One of
 * them would eventually forget, and a forgotten multiply is invisible.
 *
 * Applying it once, at the moment a reference becomes a statement, means the
 * rest of the game keeps reading plain statements and gets scaling for free —
 * including the generated sentence, which therefore says the scaled magnitude
 * without `statementText` knowing scale exists.
 *
 * **What scales is declared, never inferred** (UE-7): the palette row for a
 * `Provides`/`Grants`/`Converts` payload, the keyword itself for `Applies`. A
 * statement whose effect declares nothing comes back untouched.
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

    // A proc is a chance: `clampModifierValue` holds it inside 0–100 so a
    // scaled chance saturates rather than becoming a nonsense probability.
    const scaled = entry
        ? clampModifierValue(entry, current * factor)
        : current * factor;

    return { ...statement, payload: { ...payload, [field]: scaled } };
}

/**
 * A bearer's references, normalised.
 *
 * Tolerates the three shapes an author or a half-done migration can produce: a
 * bare string id, a `{ effectId }` object, and the full `{ effectId, scale }`.
 * A blank or malformed entry is dropped rather than returned as a hole, because
 * every caller here is a loop that would otherwise need its own guard.
 *
 * `scale` is normalised to a whole 1–5 here (UE-18), so nothing downstream has
 * to defend against a fractional or negative one.
 */
export function effectRefsOf(def) {
    const raw = Array.isArray(def?.effects) ? def.effects : [];
    const refs = [];
    for (const entry of raw) {
        const effectId = typeof entry === 'string' ? entry : entry?.effectId;
        if (!effectId) continue;
        /**
         * ⚠️ `chargeCost` is read but NOT defaulted (G-5).
         *
         * Absent means "whatever the statement says", which is every reference
         * authored before this — so nothing shipped changes cost. A number here
         * overrides it, which is what lets one Thorns be free on a berry bush
         * and cost a charge on a monster.
         *
         * ⚠️ Reverses UE-20, which put the cost on the statement alone. The
         * statement's value survives as the default; the reference is now
         * allowed to disagree with it.
         */
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
 * Whether a library entry is real — UE-10, the rule the deleted 56 needed.
 *
 * > A named effect cannot exist without a statement that works.
 *
 * "Works" is deliberately shallow here: it has at least one statement and every
 * statement names a keyword. This cannot check that the keyword's payload is
 * complete — a half-authored statement is a normal mid-authoring state, and the
 * generated sentence already shows the author their blanks as `…`. What it
 * catches is the failure the old library was made of: **a name with nothing
 * behind it at all.**
 */
export function hasWorkingStatements(entry) {
    const statements = statementsOf(entry);
    if (!statements.length) return false;
    return statements.every(statement => !!statement?.keyword);
}

/**
 * One library entry's statements, stamped with where they came from.
 *
 * The stamp is three fields, and each has a consumer waiting:
 *
 * * `sourceEffectId` — what `ContentAudit` and the CMS's *used by* readout
 *   trace, and what P3's popup will publish.
 * * `effectName` — the title. P3 shows it; today it rides along so that nothing
 *   has to reach back into the library to render a sentence.
 * * `scale` — the multiplier, **already applied** to the payload by
 *   `scaleStatement` before the statement is stamped. It rides along so the
 *   title can carry its numeral (UE-9); nothing downstream multiplies again.
 *
 * ⚠️ **Statement ids are not rewritten**, and that is safe on purpose. Two
 * Tokens referencing one entry hold the same statement id, but every piece of
 * per-statement state is stored on the **instance** — `instance.blockUpkeep[id]`
 * and `instance.blockCooldowns[id]`, with `TriggerSystem`'s re-entry guard keyed
 * `tile:id`. Sharing an id across two Tokens is therefore two separate pieces of
 * state that happen to share a name, which is exactly right.
 *
 * The case that would collide is one bearer naming the same entry twice. That is
 * refused rather than handled — see `duplicateRefsOf`.
 */
export function statementsFromEntry(entry, ref) {
    const scale = normaliseScale(ref?.scale);
    /**
     * A per-bearer cost is applied HERE, during expansion, for exactly the
     * reason `scaleStatement` is: every consumer keeps reading a plain
     * statement, and none of them has to learn that references exist. The
     * alternative — teaching `Charges`, `TriggerSystem` and `HeroEffects` each
     * to check a ref — is three places to forget.
     */
    let override = null;
    if (typeof ref?.chargeCost === 'number') {
        // ⚠️ `-Math.abs(0)` is **-0**, which `Object.is` and therefore
        // `toBe`/`===`-style comparisons treat as a different value from 0. A
        // free effect must produce a plain zero: an author's 0 is the whole
        // "this costs nothing" case, and it should not arrive as a negative
        // zero that reads oddly in a saved file and compares oddly in a test.
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
 *
 * Returns a **copy**; the definition passed in is never mutated, so a loader may
 * call this on the same defs twice without compounding.
 *
 * A ref naming an entry that does not exist contributes nothing and is *not* an
 * error here — `ContentAudit` reports it by name at boot, which is this
 * project's rule for dangling references (they warn, they never block).
 *
 * A def that carries inline `statements` and no `effects` is returned as-is.
 * That is how test fixtures author rules, and how a bearer looks in the moment
 * before it is migrated.
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

    // Inline statements come first and survive. Nothing shipped mixes the two,
    // but dropping hand-authored rules because a ref was added beside them
    // would be exactly the silent half-translation this project keeps refusing.
    return { ...def, statements: [...statementsOf(def), ...statements] };
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
 * The one shape the library cannot resolve honestly: two refs to one entry on a
 * single bearer produce two statements with the same id inside one instance's
 * state map, so an upkeep clock or a cooldown would be shared between them.
 *
 * It is also never what an author means — "twice as strong" is the `scale`
 * field (UE-6), not the same effect listed twice. So this is reported rather
 * than merged, and the CMS refuses to create the second ref.
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
 * Which bearers use an entry — the *used by* readout (UE-5).
 *
 * Reuse is the point of the library and blind cross-game edits are the risk it
 * brings, so the count is not an optional nicety: it is the thing that makes
 * "edit once, changes everywhere" safe to use.
 *
 * @param {string} effectId
 * @param {Record<string, object>[]} collections — tokens, items, …
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
