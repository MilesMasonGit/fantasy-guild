// Fantasy Guild — the named effect library (Unified Effects, P1)

import { statementsOf } from './statements.js';

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

/**
 * A bearer's references, normalised.
 *
 * Tolerates the three shapes an author or a half-done migration can produce: a
 * bare string id, a `{ effectId }` object, and the full `{ effectId, scale }`.
 * A blank or malformed entry is dropped rather than returned as a hole, because
 * every caller here is a loop that would otherwise need its own guard.
 *
 * ⚠️ `scale` is stored from P1 but **read by nothing until P2** (UE-18). It is
 * written now so the shape does not change under content that already exists.
 */
export function effectRefsOf(def) {
    const raw = Array.isArray(def?.effects) ? def.effects : [];
    const refs = [];
    for (const entry of raw) {
        const effectId = typeof entry === 'string' ? entry : entry?.effectId;
        if (!effectId) continue;
        const scale = Number(typeof entry === 'string' ? 1 : entry.scale);
        refs.push({ effectId, scale: Number.isFinite(scale) && scale > 0 ? scale : 1 });
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
 * * `scale` — P2's multiplier. Stamped, not applied: P1 changes no numbers.
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
    return statementsOf(entry).map(statement => ({
        ...statement,
        sourceEffectId: entry?.id || ref?.effectId || null,
        effectName: entry?.name || null,
        scale: ref?.scale ?? 1
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
