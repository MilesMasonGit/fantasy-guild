// Fantasy Guild — Token registry (loader)

/**
 * The Token registry — the *type* half of "a Token is a definition plus board
 * state". Board state lives on the instance (see `BoardState.js`); this
 * holds everything true of every copy.
 *
 * ## Definitions live in `data/`, not here
 * Definitions load from `data/tokens.json`; this file is a loader plus accessors.
 *
 * ⚠️ Design commentary on authoring and retuning Tokens lives in `docs/archive/token_content_notes.md`.
 *
 * The rule that most needs restating here, because a test depends on it:
 * ⚠️ **every material must have at least one tool-free source.**
 * `ContentRules.test.js` asserts it mechanically — it is the only thing
 * preventing a supply hard-lock.
 *
 * ⚠️ **Never hand-edit `data/tokens.json`.**
 * The CMS writes it wholesale; anything added by hand is destroyed on the next
 * sync.
 */

import { DatabaseManager } from '../DatabaseManager.js';
import { recipesForToken, contextTagsOf } from './recipePoolRegistry.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { EFFECTS } from './effectRegistry.js';
import { expandBearer } from '../../systems/effects/effectLibrary.js';
import { migrateAppliesTargets } from '../../systems/effects/effectMigration.js';
import { engineTokenType } from './engineTokens.js';

/**
 * Merge every Token JSON source into one keyed object.
 *
 * Mirrors `itemRegistry.js`'s loader: the single file first, then the folder
 * glob, so a split-out file can override a same-id entry in `tokens.json`.
 * An entry missing an `id` takes its key, matching how items behave.
 */
function loadJsonTokens() {
    const tokens = {};

    for (const source of [DatabaseManager.tokenFilesSingle]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                for (const [typeId, def] of Object.entries(data)) {
                    if (!def.id) def.id = typeId;
                    // Library references become the statements the game runs on, once, here, so everything downstream keeps reading `def.statements`.
                    // Inline statements lose the retired enemy flag here;
                    // library statements already lost it in `effectRegistry`.
                    tokens[typeId] = expandBearer(migrateAppliesTargets(def), EFFECTS);
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
 * exactly 2 of something every 12s, a consumer that needs exactly 5. Shipped content would make
 * every balance change a test-breaking change, so **content should be free to be retuned without
 * the engine suite noticing.**
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
    // Expanded on the way in, exactly as the JSON loader expands shipped
    // content, so a fixture may author its rules either way: inline
    // `statements` (which most do, and which still work untouched) or an
    // `effects` reference into a fixture library registered beforehand.
    for (const [typeId, def] of Object.entries(definitions || {})) {
        TOKENS[typeId] = expandBearer(migrateAppliesTargets(def), EFFECTS);
    }
    tokenRegistryVersion++;
}

/**
 * ## The registry version
 * Bumped on every `registerTokenTypes` call — today only a CMS re-sync (which
 * reloads the page) or a test re-registering a type mid-file. Nothing in the
 * shipped game changes content at runtime. A reader that memoises something
 * derived from a Token *type* (not an instance) — `SpawnerSystem.familyOf`'s
 * cache — keys on this too, so a test that re-registers a type cannot see a
 * stale answer.
 */
let tokenRegistryVersion = 0;

/** The registry's own version — see above. */
export function registryVersion() {
    return tokenRegistryVersion;
}

/**
 * A Token definition by id, or null.
 *
 * Falls back to the engine-owned types (`engineTokens.js`: the quest
 * Token), so an instance of one resolves like any Token. They are NOT in
 * `TOKENS` or {@link getAllTokenTypes}: those stay the authored content set
 * the audits and the Shop walk.
 */
export function getTokenType(typeId) {
    return TOKENS[typeId] || engineTokenType(typeId);
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
    return getTokenType(typeId)?.name || typeId || 'Unknown Token';
}

/**
 * A Token's starting charges — `null` for unlimited use.
 *
 * Deliberately returns `null` rather than `Infinity` or `0`: `null` and `0` are
 * opposites (never depletes vs spent), and every charge comparison has to check
 * `== null` first.
 *
 * ## `uses` is the ONLY charge field
 * `uses` is the sole charge field: this is its sole reader, and the CMS's own
 * Token editor writes it.
 *
 * ⚠️ **Never read a `charges` field here.** If the CMS ever grows one it will be a proposal,
 * not the pool — reading it would silently multiply some Tokens' lifetimes twentyfold.
 * `uses` is the field; anything else by that name is data about a Token, not its charges.
 */
export function tokenStartingUses(typeId) {
    const def = getTokenType(typeId);
    return def ? (def.uses ?? null) : null;
}

/** The sprite path for a Token's art. */
export function tokenSpritePath(typeId) {
    const def = getTokenType(typeId);
    if (!def) return null;
    const sprite = def.sprite || typeId;
    const resolved = resolveSpritePath(sprite);
    if (!resolved) return null;
    return resolved.startsWith('/') ? resolved : `/${resolved}`;
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

    // Pooled recipes count as routes, so
    // content validation sees a Kitchen's whole Cooking pool. Without this,
    // opting a station into a pool would silently exempt everything it makes
    // from rule 1's tool-free-source check.
    const recipes = recipesForToken(def);
    if (recipes.length) {
        return recipes.map(r => ({
            id: r.id,
            inputs: r.inputs || [],
            outputs: r.outputs || [],
            requiresContext: contextTagsOf(r)
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
 * ## Why a range
 * The CMS authors outputs as
 * `{ itemId, chance, minQty, maxQty }` so a Token can yield "2–4 Oak Wood"
 * rather than always exactly 2 — the variability that makes a completion worth
 * watching.
 *
 * **Backwards compatible on purpose:** an entry with only `quantity` reads as
 * the degenerate range `{ min: q, max: q }`.
 *
 * ⚠️ Per-entry `chance` is a **separate** axis and already independent — each
 * output rolls its own chance, so one cycle can yield several different items
 * This is deliberately not the legacy "pick exactly one" cluster
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
 * ⚠️ Nothing calls this: the statements shape replaced effect blocks. Reads
 * `effectBlocks`, or a legacy `buff` as a single block.
 */
export function effectBlocksOf(def) {
    if (Array.isArray(def?.effectBlocks)) return def.effectBlocks;
    if (def?.buff) return [def.buff];
    return [];
}

/**
 * A Token's **statements** — the shape that replaced effect blocks.
 *
 * Re-exported from `statements.js` so the rest of the game has one import for
 * "read a Token's rules".
 */
export { statementsOf, statementsWith } from '../../systems/effects/statements.js';

import {
    KEYWORD as STATEMENT_KEYWORD,
    statementsOf as statementList,
    getProvidedTagsWithTiers
} from '../../systems/effects/statements.js';

/**
 * Whether a Token affects its neighbours **by sitting beside them**.
 *
 * Used to decide whether a Token is "support" — something that serves nearby
 * work and therefore wears one charge per cycle served.
 *
 * ⚠️ **Triggered blocks do not count.** A Triggered Token is not ambient
 * support: it wears when it *fires*, which `TriggerSystem` handles.
 * Counting it here too would wear it twice for one event — once as a reaction
 * and once as a bystander.
 */
export function hasAdjacencyEffect(def) {
    return statementList(def).some(s => isAmbientSupport(s));
}

/**
 * Which statements make a Token *ambient support* — something that serves its
 * neighbours simply by sitting beside them, and therefore wears one charge per
 * cycle served.
 *
 * A triggered statement is excluded:
 * it wears when it **fires**, and counting it here too would wear it
 * twice for one event.
 */
function isAmbientSupport(statement) {
    if (statement?.when?.event) return false;
    return statement?.keyword === STATEMENT_KEYWORD.PROVIDES
        || statement?.keyword === STATEMENT_KEYWORD.GRANTS;
}

/**
 * The capabilities a Token hands its neighbours, as `{ [tag]: highestTier }`.
 * Lives in `statements.js` (a pure reader, so the lifecycle audit — which the
 * CMS also loads — can use it without pulling in this registry) and is
 * re-exported here so existing imports keep working.
 */
export { getProvidedTagsWithTiers } from '../../systems/effects/statements.js';

/** Which context tags are TOOLS rather than recipe definitions. */
export function toolContextTags() {
    const tags = new Set();
    for (const def of Object.values(TOKENS)) {
        if (!def.isTool) continue;
        for (const tag of Object.keys(getProvidedTagsWithTiers(def))) tags.add(tag);
    }
    return tags;
}
