// Fantasy Guild — Token registry (loader)

/**
 * The Token registry — the *type* half of "a Token is a definition plus board
 * state" (D-79). Board state lives on the instance (see `BoardState.js`); this
 * holds everything true of every copy.
 *
 * ## Definitions live in `data/`, not here (CMS rework Phase 0, CMS-82)
 * Token definitions used to be a hand-authored object literal in this file.
 * They now load from `data/tokens.json` (plus an optional `data/tokens/**`
 * folder), so the CMS has somewhere to write — CMS-53 makes the CMS the
 * exclusive authoring surface, and it had no data file to target while Tokens
 * were JavaScript. This file is now a loader plus accessors.
 *
 * ⚠️ **The ~190 lines of design commentary that used to sit inline here moved
 * to [`token_content_notes.md`](../../../token_content_notes.md)** (CMS-88).
 * JSON cannot carry comments, and the reasoning was worth more than the
 * convenience of having it beside the numbers. **Read that document before
 * authoring or retuning Tokens** — it holds the four authoring rules, the
 * three independent axes (rarity / charges / theme), the execution-config
 * schema, and the per-Token justifications for why the shipped numbers are
 * what they are.
 *
 * The rule that most needs restating here, because a test depends on it:
 * ⚠️ **every material must have at least one tool-free source** (D-213, rule
 * 1). `ContentRules.test.js` asserts it mechanically — it is the only thing
 * preventing a supply hard-lock.
 *
 * ⚠️ **Never hand-edit `data/tokens.json` once the CMS is live** (CMS-53).
 * The CMS writes it wholesale; anything added by hand is destroyed on the next
 * sync.
 */

import { DatabaseManager } from '../DatabaseManager.js';
import { recipesForToken } from './recipePoolRegistry.js';

/**
 * Merge every Token JSON source into one keyed object.
 *
 * Mirrors `itemRegistry.js`'s loader: the single file first, then the folder
 * glob, so a split-out file can override a same-id entry in `tokens.json`.
 * An entry missing an `id` takes its key, matching how items behave.
 */
function loadJsonTokens() {
    const tokens = {};

    for (const source of [DatabaseManager.tokenFilesSingle, DatabaseManager.tokenFilesGlob]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                for (const [typeId, def] of Object.entries(data)) {
                    if (!def.id) def.id = typeId;
                    tokens[typeId] = def;
                }
            } catch (error) {
                console.warn(`[TokenRegistry] Error loading token JSON from ${path}:`, error);
            }
        }
    }

    return tokens;
}

/**
 * Every Token definition, keyed by id.
 *
 * ⚠️ **Deliberately NOT frozen.** `registerTokenTypes` mutates it for test
 * fixtures — see its own note below.
 *
 * @type {Record<string, object>}
 */
export const TOKENS = loadJsonTokens();

/**
 * Add Token definitions at runtime. **For test fixtures only.**
 *
 * ## Why this exists
 * Engine tests need Tokens with *stable, known* numbers — a producer that makes
 * exactly 2 of something every 12s, a consumer that needs exactly 5. Before
 * this, they used shipped content for that, which quietly made every balance
 * change a test-breaking change: retuning the Oakwood Grove failed assertions
 * in `TokenCycle` that were never about the Grove at all.
 *
 * That coupling was reported at the end of Phase 9 as the real shape of risk
 * 17 — hand-authored numbers do not scale, and they scale even worse when
 * touching one breaks twenty tests in three files. **Content should be free to
 * be retuned without the engine suite noticing.**
 *
 * Fixtures live in `src/tests/fixtures/testTokens.js` and are all prefixed
 * `fixture_`, so they can never collide with content and are trivially
 * filterable. Vitest isolates module registries per test file, so registering
 * them never leaks into the content validation suite.
 *
 * ⚠️ **Nothing in `src/systems` or `src/ui` may call this.** It is a seam for
 * tests, not an extension point — content belongs in this file, where the
 * validation rules can see it.
 */
export function registerTokenTypes(definitions) {
    Object.assign(TOKENS, definitions || {});
}

/** A Token definition by id, or null. */
export function getTokenType(typeId) {
    return TOKENS[typeId] || null;
}

/** Every Token definition, keyed by id. */
export function getAllTokenTypes() {
    return TOKENS;
}

/** Every Token id. */
export function listTokenTypeIds() {
    return Object.keys(TOKENS);
}

/** A Token's display name, falling back to its id so the UI never renders blank. */
export function tokenName(typeId) {
    return TOKENS[typeId]?.name || typeId || 'Unknown Token';
}

/**
 * A Token's starting charges — `null` for unlimited use (D-176).
 *
 * Deliberately returns `null` rather than `Infinity` or `0`: `null` and `0` are
 * opposites (never depletes vs spent), and every charge comparison has to check
 * `== null` first.
 */
export function tokenStartingUses(typeId) {
    const def = TOKENS[typeId];
    return def ? (def.uses ?? null) : null;
}

/** The sprite path for a Token's art. */
export function tokenSpritePath(typeId) {
    const sprite = TOKENS[typeId]?.sprite;
    return sprite ? `/assets/skills/${sprite}.png` : null;
}

/**
 * Every way a Token can produce, as `[{ inputs, outputs, requiresContext }]`.
 *
 * Flattens "authored on the config" and "decided by a recipe" into one list, so
 * content validation can reason about the economy without re-deriving which
 * kind of Token it is holding. Recipe-less Tokens yield a single entry.
 */
export function productionRoutes(typeId) {
    const def = TOKENS[typeId];
    if (!def) return [];

    // Pooled recipes count as routes exactly as private ones do (CMS-39), so
    // content validation sees a Kitchen's whole Cooking pool. Without this,
    // opting a station into a pool would silently exempt everything it makes
    // from rule 1's tool-free-source check.
    const recipes = recipesForToken(def);
    if (recipes.length) {
        return recipes.map(r => ({
            id: r.id,
            inputs: r.inputs || [],
            outputs: r.outputs || [],
            requiresContext: r.requiresContext || []
        }));
    }
    if (!def.config?.outputs?.length) return [];
    return [{
        id: null,
        inputs: def.config.inputs || [],
        outputs: def.config.outputs,
        requiresContext: []
    }];
}

/**
 * An output entry's quantity range, as `{ min, max }`.
 *
 * ## Why a range (CMS-41)
 * An output used to be a single fixed `quantity`. The CMS authors outputs as
 * `{ itemId, chance, minQty, maxQty }` so a Token can yield "2–4 Oak Wood"
 * rather than always exactly 2 — the variability that makes a completion worth
 * watching.
 *
 * **Backwards compatible on purpose:** an entry with only `quantity` reads as
 * the degenerate range `{ min: q, max: q }`, so every existing authored Token
 * keeps its exact behaviour and nothing needed migrating.
 *
 * ⚠️ Per-entry `chance` is a **separate** axis and already independent — each
 * output rolls its own chance, so one cycle can yield several different items
 * (CMS-41). This is deliberately not the legacy "pick exactly one" cluster
 * behaviour, which stays orphaned.
 */
export function outputRange(output) {
    const fallback = output?.quantity ?? 1;
    const min = output?.minQty ?? fallback;
    const max = output?.maxQty ?? fallback;
    // Tolerate an inverted range rather than silently yielding nothing.
    return min <= max ? { min, max } : { min: max, max: min };
}

/**
 * A uniform roll within an output's range — what the runtime actually yields
 * before adjacency modifiers are applied.
 */
export function rollOutputQuantity(output, random = Math.random) {
    const { min, max } = outputRange(output);
    return min + Math.floor(random() * (max - min + 1));
}

/**
 * An output's average quantity per successful roll, ignoring `chance`.
 *
 * Content validation reasons about rates rather than single rolls, so it needs
 * the expected value where the runtime needs a sample.
 */
export function expectedOutputQuantity(output) {
    const { min, max } = outputRange(output);
    return (min + max) / 2;
}

/**
 * A Token's effect blocks (CMS-59/61/65).
 *
 * ## Blocks, not one buff
 * A Token is **not single-purpose** (CMS-58): it can produce AND carry an aura,
 * or carry two auras reacting to different neighbours. So effects are a *stack*
 * of blocks rather than the single `buff` object the schema used to allow, and
 * blocks are freely repeatable (CMS-65).
 *
 * Each block is a flexible container of already-typed pieces (CMS-61) — any of
 * `trigger`, `cost`, `target` and `modifiers` may be present or absent:
 *
 * ```jsonc
 * effectBlocks: [
 *   {
 *     targetToken: { mode: 'tag', value: 'seafood' },   // CMS-18
 *     cost: { items: [{ itemId, quantity }], cadenceMs: 30000 },  // CMS-60
 *     modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 1.0 }]
 *   }
 * ]
 * ```
 *
 * ## Legacy `buff` reads as one block
 * Shipped content and older fixtures use `buff: { target, targetToken,
 * modifiers }`. That is exactly one untriggered, uncosted block, so it is
 * normalised here rather than migrated — the same backwards-compatible move
 * output ranges took (CMS-41), and for the same reason: no content churn.
 */
export function effectBlocksOf(def) {
    if (Array.isArray(def?.effectBlocks)) return def.effectBlocks;
    if (def?.buff) return [def.buff];
    return [];
}

/**
 * Whether a Token affects its neighbours **by sitting beside them**.
 *
 * Used to decide whether a Token is "support" — something that serves adjacent
 * work and therefore wears one charge per cycle served (D-126).
 *
 * ⚠️ **Triggered blocks do not count.** A Triggered Token is not ambient
 * support: it wears when it *fires* (CMS-26), which `TriggerSystem` handles.
 * Counting it here too would wear it twice for one event — once as a reaction
 * and once as a bystander.
 */
export function hasAdjacencyEffect(def) {
    return effectBlocksOf(def).some(b => b?.modifiers?.length && !b?.trigger?.event);
}

/** Which context tags are TOOLS (D-213) rather than recipe definitions. */
export function toolContextTags() {
    const tags = new Set();
    for (const def of Object.values(TOKENS)) {
        if (!def.isTool) continue;
        for (const tag of def.provides || []) tags.add(tag);
    }
    return tags;
}
