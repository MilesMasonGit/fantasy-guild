import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { slugify, generateId } from '../utils/idGenerator';
import { runSim } from '../engine/sim/simRunner';
import { buildChurnReport } from '../engine/sim/churn';
import { buildSimAnswers } from '../engine/sim/answers';
import { buildChainTrails } from '../engine/sim/chain';
import {
    migrateLegacyIntent,
    applyItemResults,
    applyTokenResults,
    applyRecipePoolResults,
    applyMapResults,
    applyScrapValues,
} from '../engine/sim/writeBack';
import { auditConnectivity } from '../engine/connectivityAuditor';
import { useSimulationStore } from './useSimulationStore';
import { composeTokenDescription } from '../engine/descriptionDictionary';
import {
    deriveTokenType, statementsOf, makeStatement, KEYWORD,
    migrateBearers, migratePromotionFields, expandBearer, expandAll, effectRefsOf, provisionalName,
    normaliseScale,
} from '../utils/constants';
import { seedSimIntent } from './simIntentNormaliser';

/**
 * The CMS's authored content, in one store.
 *
 * ## Four collections, not thirteen (CMS rework Phase 0; +1 in Unified Effects P1)
 * The old store carried items, recipes, tasks, stations, enemies, areas,
 * quests, tags, effects, lootTables, encounters and encounterTables
 * — most of which describe the retired card-sequence game. CMS-36/37 removed
 * them outright. What is left is CMS-1's actual scope:
 *
 * * **items** — the leaf nodes everything references (CMS-11).
 * * **tokens** — producers, context, buffs, managers, triggers **and enemies**.
 *   One collection, not two: CMS-85 makes Enemy a filtered view of this list
 *   rather than a separate entity, following D-104's "one economic model
 *   covers the whole board".
 * * **maps** — what a Map yields when burst (D-139). (D-139's "themed"
 *   wording is retired — see `concept_audit.md` §A.)
 * * **effects** — the named effect library (Unified Effects P1). Every rule in
 *   the game, once, with a name; Tokens reference entries by id.
 *
 * ⚠️ A collection called `effects` was among the thirteen CMS-36 deleted, and
 * the new one is deliberately not a revival of it. Those 56 entries were names
 * with descriptions and no mechanism — which is why deleting them changed
 * nothing. An entry in this collection wraps real statements and is enforced by
 * `ContentAudit` (UE-10) never to be a name alone.
 *
 * Global Value dials (CMS-15) live in `useGlobalStore`, not here.
 *
 * ## No staged deletions, no import remap
 * Both are gone with the model that needed them. CMS-53 replaced merge-sync
 * with a one-way full-file write, so a deletion is simply an entity that is no
 * longer here — there is nothing to stage. CMS-4 removed the game→CMS import
 * path, so the fictional-skill remap that rewrote `industry`/`culinary`/
 * `nautical` on import has nothing left to rewrite.
 *
 * ⚠️ This store is the **only** place authored content lives until a sync
 * (CMS-53). Content is built up here completely, then written to `data/` as one
 * deliberate full replacement — not saved out piecemeal as you go.
 */

// === Cross-references, in one place ==========================================
// Renaming an entity has to chase its id everywhere else. Declaring the shapes
// once keeps performRename honest as the schema grows — every reference site is
// listed here rather than open-coded in each rename branch.
//
// An item id can appear in: a Token's production inputs/outputs, a Token's
// pooled recipes, a Map's material cost, and a Map's pool (as an `item` entry).
// A token id can appear in: a Map's pool (as a `token` entry).
// A map id can appear in: a Token's `mapId` (Map Tokens point at the catalogue).

/**
 * Fields anywhere in an entity that hold an **item id**.
 *
 * ⚠️ Kept as a field-name list rather than a list of paths on purpose. Three
 * separate phases added new places an item id can appear — pooled recipes, then
 * block upkeep costs and `BONUS_DROP` payloads, then trigger watch-items and
 * `CONVERT`'s two lists — and a path-based walker missed every one of them,
 * each time leaving content pointing at a dead id. Matching on the field name
 * instead means a site added later is covered the day it is added.
 */
const ITEM_ID_FIELDS = new Set(['itemId', 'watchItemId']);

/** The simulator's lowercase severities, in the auditor's capitalised words. */
const SEVERITY_WORD = { critical: 'Critical', warning: 'Warning', info: 'Info' };

/**
 * One simulator row, as an audit-panel row.
 *
 * ## ⚠️ This used to flatten every row to a string badged `Warning`
 *
 * `auditConnectivity`'s refusal channel took a list of **strings**, so the
 * simulator's richer rows (a severity, a stable code, ranked remedies) were
 * rendered into one sentence with the severity as its first word, and the panel
 * badged all of them `Warning` because that is what the channel had always
 * meant.
 *
 * Over real content that made the panel actively misleading: of 112 rows badged
 * `Warning`, **94 were Info and 5 were Critical**. The five that mattered — items
 * nothing produces — were dressed identically to 94 "you have not tagged this
 * yet" notes. A Critical reading as a Warning is the worst failure this panel
 * can have, so the severity now travels with the row and the badge tells the
 * truth.
 *
 * The entity name travels too. Every one of these rows used to read
 * "Balance Solver", which made the panel's Entity column worthless for sorting
 * or scanning; a row about a Token now names that Token.
 */
/** A collection keyed by each record's own id, whatever its store key was. */
function byId(collection) {
    const out = {};
    for (const [key, record] of Object.entries(collection || {})) {
        if (!record) continue;
        out[record.id ?? key] = record;
    }
    return out;
}

function describeRow(row) {
    const remedies = (row.remedies || []).length > 0 ? `  → ${row.remedies.join('  → ')}` : '';
    return {
        severity: SEVERITY_WORD[row.severity] || 'Warning',
        entityName: row.entityId || row.itemId || 'Balance Solver',
        details: `[${row.code}] ${row.message}${remedies}`,
        // Carried so the auditor can recognise a problem it would otherwise
        // report a second time in its own words — see `auditConnectivity`.
        code: row.code,
        itemId: row.itemId,
    };
}

/**
 * Deep-rewrite every item reference inside an arbitrary structure.
 *
 * Walks plain objects and arrays only, so it can never wander into anything
 * exotic. Returns the original reference when nothing changed, which keeps
 * React's identity checks meaningful.
 */
function remapItemIdsDeep(value, oldId, newId, mark) {
    if (Array.isArray(value)) {
        let touched = false;
        const next = value.map((entry) => {
            const mapped = remapItemIdsDeep(entry, oldId, newId, () => { touched = true; mark(); });
            return mapped;
        });
        return touched ? next : value;
    }

    if (!value || typeof value !== 'object') return value;

    let touched = false;
    const next = {};
    for (const [key, inner] of Object.entries(value)) {
        if (ITEM_ID_FIELDS.has(key) && inner === oldId) {
            next[key] = newId;
            touched = true;
            mark();
            continue;
        }
        const mapped = remapItemIdsDeep(inner, oldId, newId, () => { touched = true; mark(); });
        next[key] = mapped;
    }

    return touched ? next : value;
}

/** Rewrite every `itemId` in a list of input/output entries. */
function remapEntries(list, oldId, newId, mark) {
    return (list || []).map((entry) => {
        if (entry.itemId !== oldId) return entry;
        mark();
        return { ...entry, itemId: newId };
    });
}

function renameInTokenConfig(token, oldId, newId) {
    let touched = false;
    const mark = () => { touched = true; };
    const next = { ...token };

    if (next.config) {
        next.config = {
            ...next.config,
            inputs: remapEntries(next.config.inputs, oldId, newId, mark),
            outputs: remapEntries(next.config.outputs, oldId, newId, mark),
        };
    }

    if (Array.isArray(next.recipes)) {
        next.recipes = next.recipes.map((recipe) => ({
            ...recipe,
            inputs: remapEntries(recipe.inputs, oldId, newId, mark),
            outputs: remapEntries(recipe.outputs, oldId, newId, mark),
        }));
    }

    // Effect blocks carry item ids in several places — upkeep costs, grant
    // payloads, CONVERT's two lists, a trigger's watched item. The deep walker
    // covers all of them, including any added later.
    if (next.effectBlocks) next.effectBlocks = remapItemIdsDeep(next.effectBlocks, oldId, newId, mark);
    if (next.buff) next.buff = remapItemIdsDeep(next.buff, oldId, newId, mark);

    return touched ? next : token;
}

/**
 * Rewrite item references inside the shared recipe pools (CMS-39).
 *
 * ⚠️ Easy to forget: pooled recipes live in their own collection, not on the
 * Token, so a rename that only walked Tokens would leave every pooled recipe
 * pointing at a dead item id.
 */
/**
 * Rewrite references inside the named effect library (Unified Effects P1).
 *
 * ⚠️ **This is where a Token's rules live now**, so a rename that only walked
 * Tokens would leave every rule pointing at a dead id — the exact failure the
 * cross-reference block at the top of this file exists to prevent.
 *
 * Both kinds of id appear in a statement:
 *
 * * **item ids** — a Grants payload, a Converts list, an upkeep cost, a
 *   trigger's watched item. `remapItemIdsDeep` covers all of them by field name.
 * * **token ids** — a filter aimed at one exact Token (`to.value` with
 *   `mode: 'id'`) and a Restocks list (`payload.tokenIds`). Those are named
 *   explicitly, because neither field name says "token" and a name-based walker
 *   would miss both.
 */
function renameInEffects(effects, oldId, newId, entityType) {
    let touched = false;
    const mark = () => { touched = true; };

    const next = Object.fromEntries(
        Object.entries(effects || {}).map(([effectId, entry]) => {
            const statements = statementsOf(entry).map((statement) => {
                let result = statement;

                if (entityType === 'item') {
                    result = remapItemIdsDeep(result, oldId, newId, mark);
                }

                if (entityType === 'token') {
                    if (result?.to?.mode === 'id' && result.to.value === oldId) {
                        result = { ...result, to: { ...result.to, value: newId } };
                        mark();
                    }
                    const tokenIds = result?.payload?.tokenIds;
                    if (Array.isArray(tokenIds) && tokenIds.includes(oldId)) {
                        result = {
                            ...result,
                            payload: { ...result.payload, tokenIds: tokenIds.map((id) => (id === oldId ? newId : id)) },
                        };
                        mark();
                    }
                }

                return result;
            });

            return [effectId, statements.some((st, i) => st !== statementsOf(entry)[i])
                ? { ...entry, statements }
                : entry];
        })
    );

    return touched ? next : effects;
}

function renameInRecipePools(pools, oldId, newId) {
    let touched = false;
    const mark = () => { touched = true; };

    const next = Object.fromEntries(
        Object.entries(pools || {}).map(([skillId, recipes]) => [
            skillId,
            (recipes || []).map((recipe) => ({
                ...recipe,
                inputs: remapEntries(recipe.inputs, oldId, newId, mark),
                outputs: remapEntries(recipe.outputs, oldId, newId, mark),
            })),
        ])
    );

    return touched ? next : pools;
}

function renameInMap(map, oldId, newId, kind) {
    let touched = false;
    const next = { ...map };

    if (kind === 'item') {
        next.materials = (next.materials || []).map((entry) => {
            if (entry.itemId !== oldId) return entry;
            touched = true;
            return { ...entry, itemId: newId };
        });
    }

    next.pool = (next.pool || []).map((entry) => {
        if (entry.kind !== kind || entry.refId !== oldId) return entry;
        touched = true;
        return { ...entry, refId: newId };
    });

    return touched ? next : map;
}

/**
 * Move an entity to a new id and repoint everything that referenced it.
 *
 * Returns a partial state patch, or `{}` when the rename is impossible (the
 * target id is taken by a different entity) so the caller can leave state alone.
 */
function performRename(state, oldId, newId, entityType) {
    const collectionFor = { item: 'items', token: 'tokens', map: 'maps', effect: 'effects' };
    const collectionKey = collectionFor[entityType];
    if (!collectionKey) return {};

    const collection = state[collectionKey] || {};
    const entity = collection[oldId];
    if (!entity || (collection[newId] && newId !== oldId)) return {};

    // Rebuild the collection preserving insertion order, so renaming an entity
    // does not jump it to the end of the sidebar list.
    const renamed = Object.fromEntries(
        Object.entries(collection).map(([id, value]) =>
            id === oldId ? [newId, { ...value, id: newId }] : [id, value]
        )
    );

    const patch = { [collectionKey]: renamed };

    if (entityType === 'item' || entityType === 'token') {
        // A Token's rules live in the library, so both kinds of rename have to
        // reach into it (Unified Effects P1).
        patch.effects = renameInEffects(state.effects, oldId, newId, entityType);

        if (entityType === 'item') {
            patch.tokens = Object.fromEntries(
                Object.entries(state.tokens || {}).map(([id, token]) => [
                    id,
                    renameInTokenConfig(token, oldId, newId),
                ])
            );
            patch.recipePools = renameInRecipePools(state.recipePools, oldId, newId);
        }
        patch.maps = Object.fromEntries(
            Object.entries(state.maps || {}).map(([id, map]) => [
                id,
                renameInMap(map, oldId, newId, entityType),
            ])
        );
    }

    /**
     * Renaming a library entry repoints every bearer that uses it.
     *
     * The id is derived from the name (`autoSyncId`), so an author renaming
     * "Pickaxe" to "Mining Tool" renames the id underneath — and every Token
     * referencing the old id would quietly lose that rule. This is the one
     * rename where the reference count is the point of the feature, so it is
     * also the one where missing it costs the most.
     */
    if (entityType === 'effect') {
        /**
         * ⚠️ **Both bearer collections, not just Tokens.**
         *
         * This walked only `tokens` until items became bearers (P4), which made
         * renaming a shared effect quietly orphan every item using it: the item
         * kept a reference to an id that no longer existed and simply lost that
         * rule. Exactly the dangling reference `ContentAudit` reports — except
         * caused by an ordinary rename rather than by anything the author did
         * wrong.
         */
        const repoint = (collection) => Object.fromEntries(
            Object.entries(collection || {}).map(([id, bearer]) => {
                const refs = effectRefsOf(bearer);
                if (!refs.some((r) => r.effectId === oldId)) return [id, bearer];
                return [id, {
                    ...bearer,
                    effects: refs.map((r) => (r.effectId === oldId ? { ...r, effectId: newId } : r)),
                }];
            })
        );

        patch.tokens = repoint(state.tokens);
        patch.items = repoint(state.items);
    }

    if (entityType === 'map') {
        patch.tokens = Object.fromEntries(
            Object.entries(state.tokens || {}).map(([id, token]) => [
                id,
                token.mapId === oldId ? { ...token, mapId: newId } : token,
            ])
        );
    }

    return patch;
}

/**
 * First free id of the form `slug`, `slug_2`, `slug_3`… within a collection.
 *
 * ⚠️ `currentId` counts as free at **every** step, not just the first. Without
 * that, an entity already holding a suffixed id would be pushed further up the
 * sequence every time its name was touched: `_3` would see `_3` as occupied (by
 * itself) and move to `_4`. Since the editor updates on each keystroke, typing
 * in the name field of a name-clashing entity would walk its id upward one
 * character at a time.
 */
function uniqueId(collection, desired, currentId = null) {
    if (!collection[desired] || desired === currentId) return desired;
    let counter = 2;
    let candidate = `${desired}_${counter}`;
    while (collection[candidate] && candidate !== currentId) {
        counter += 1;
        candidate = `${desired}_${counter}`;
    }
    return candidate;
}

// === Entity factories ========================================================
// Field sets are the ones the decisions log settled; anything a later phase
// adds (effect blocks, pooling, combat stats) is absent rather than stubbed, so
// an empty field never lies about being authorable yet.

/** CMS-13's field set. ⚠️ No `value` — CMS-86: values are derived, never typed. */
function makeItem(data = {}) {
    return {
        name: 'New Item',
        description: '',
        type: 'material',
        sprite: '',
        stackable: true,
        restoreAmount: 0,
        equipSlot: '',
        // Derived by the economic simulator (CMS-14/44/86). Null means "not yet
        // computed", which is what an unreachable item stays as — and what the
        // audit panel raises as Critical.
        value: null,
        // Which Token or recipe the value came from (plan §16). Also what makes
        // an anchor election *sticky*: adding a new source re-elects nothing on
        // its own, it raises an Info row offering the change.
        valueSource: null,
        autoSyncId: true,
        ...data,
    };
}

/** CMS-71's three header clusters, plus the execution config the game reads. */
function makeToken(data = {}) {
    return {
        // Identity
        name: 'New Token',
        description: '',
        sprite: '',
        // ⚠️ `tokenType` is DERIVED, never picked (§1.2 of the redesign). It
        // is still written into the file — the engine's `tokenType` targeting
        // mode, the CMS sidebar's grouping and `ContentRules.test.js` all read
        // it — but the value here is only a placeholder until the first sync
        // recomputes it from the Token's rules.
        tokenType: 'buff',
        rarity: 'common',
        // The tier this Token's tools count as. Shown as **Tool Tier**, and
        // only on Tokens that actually hand a capability out.
        tier: 1,
        // ⚠️ Token tags are MECHANICAL, unlike item tags (CMS-91). A targeted
        // buff can name a tag — "boost all adjacent seafood" — so these are read
        // by `TileModifiers.matchesTokenTarget` at runtime.
        tags: [],
        // The Token's rules, as statements. One sentence each.
        statements: [],
        // What adjacent tokens this station requires to work (e.g. pickaxe, axe)
        acceptedTokens: [],
        // Footprint size on the 7x7 playmat (1 = 1x1, 2 = 2x2)
        size: 1,
        // Lifecycle. `uses: null` is UNLIMITED, and is the opposite of 0 rather
        // than a large version of it (D-176) — every charge comparison in the
        // game checks `== null` first, so this must never default to a number.
        uses: null,
        requiresHero: true,
        // Production. Null when the Token has no production side at all —
        // Tokens are not single-purpose (CMS-58), and a pure buff or trigger
        // Token has no config rather than an empty one.
        config: null,
        autoSyncId: true,
        ...data,
    };
}

/**
 * A blank production config, created the moment a Token gains its first input
 * or output. Cycle time sits here at Phase 2 because every Token is still
 * "private" — CMS-76's pooling toggle and CMS-70's per-recipe cycle time arrive
 * in Phase 3, and CMS-79 keeps this flat shape for private stations anyway.
 */
export function makeTokenConfig(data = {}) {
    return {
        skill: '',
        skillRequired: 1,
        // D-164's band is 10–30s; 12s matches the Oakwood Grove, the Token most
        // other content is calibrated against.
        cycleTimeMs: 12000,
        xp: 0,
        inputs: [],
        outputs: [],
        ...data,
    };
}

/**
 * A number effect's payload, in the shape its palette entry declares (CMS-25).
 *
 * Still four shapes, still declared by the palette — but a **statement carries
 * exactly one**, rather than a list. A rule with three effects in it was three
 * sentences pretending to be one, which is why no honest description of it
 * could ever be generated.
 */
export function makeModifier(type, shape) {
    if (shape === 'convert') return { type, consumes: [], produces: [], chance: 100 };
    if (shape === 'item') return { type, itemId: '', chance: 100, quantity: 1 };
    if (shape === 'proc') return { type, bucket: 'flat', value: 0 };  // value IS the %
    return { type, bucket: 'percentage', value: 0 };
}

/** An output entry in CMS-41's shape: independent chance, quantity range. */
export function makeOutputEntry(itemId) {
    return { itemId, chance: 100, minQty: 1, maxQty: 1 };
}

/**
 * An output that pays **currency** rather than an item (D-141) — what makes a
 * Market a Market.
 *
 * Same shape as an item output, minus the `itemId`: `BoardRunner` rolls the
 * quantity through exactly the same YIELD widening and double-loot path, then
 * credits it through `CurrencyManager` instead of dropping a sprite on the
 * floor. Gold is not an item, so there is nothing for the floor to hold.
 */
export function makeCurrencyOutputEntry(currency = 'gold') {
    return { currency, chance: 100, minQty: 1, maxQty: 1 };
}

/**
 * An output that drops a **Token** on the floor rather than an item (P5).
 *
 * Same shape as an item output with `tokenId` in place of `itemId`, which is
 * the field `BoardRunner`'s output loop branches on: it calls
 * `SpriteLayer.addSprite('token', …)` once per copy, carrying the type's
 * starting charges.
 */
export function makeTokenOutputEntry(tokenId) {
    return { tokenId, chance: 100, minQty: 1, maxQty: 1 };
}

/** An input entry. Always an exact item — never tag-matched (CMS-43). */
export function makeInputEntry(itemId) {
    return { itemId, quantity: 1 };
}

/**
 * A recipe.
 *
 * `id` is stable and globally unique. A placed station saves the recipe the
 * player picked as `selectedRecipeId`, so a recipe cannot be identified by its
 * position in a pool the way it used to be — inserting one here would repoint
 * every saved station.
 *
 * `skill` is the skill the recipe belongs to; a station draws its skill's
 * recipes. `levelRequirement` is the worker's level in that skill.
 *
 * Carries its own `durationMs` and `xp` (CMS-70) — the reason a Feast can take
 * longer than Bread on the same Kitchen. `requiresContext` is an array because
 * a recipe may be gated on a COMBINATION of context tags (CMS-6): a Pie Tin and
 * a Strawberry Cookbook together key a Kitchen to Strawberry Pie. Each entry is
 * an object — `{ tag, minTier, chargeCost }` — so a recipe can also state the
 * minimum tool tier it needs and what it costs that adjacent Token per cycle.
 *
 * `stationChargeCost` is what the station itself spends per cycle, a separate
 * axis from the context costs above.
 */
export function makeRecipe(data = {}) {
    return {
        id: generateId('recipe'),
        name: 'New Recipe',
        skill: '',
        levelRequirement: 1,
        requiresContext: [],
        inputs: [],
        outputs: [],
        durationMs: 12000,
        stationChargeCost: 1,
        xp: 0,
        ...data,
    };
}

/** The shipped Map shape: price, material cost and a weighted pool. */
function makeMap(data = {}) {
    return {
        name: 'New Map',
        // No `theme` field: removed 2026-08-24 (CR2-125). It was written as ''
        // on every new Map and read by nothing (`concept_audit.md` §A).
        price: 0,
        materials: [],
        pool: [],
        autoSyncId: true,
        ...data,
    };
}

/**
 * A named effect: a title wrapping the statements that do the work.
 *
 * ⚠️ **A new entry starts with one blank statement, not with none.** UE-10 says
 * a named effect cannot exist without a statement that works, and an entry born
 * empty is a violation the moment it is created — which would put a permanent
 * boot warning in front of the author for the ordinary act of starting one. The
 * blank statement is unfinished, which the generated sentence shows as `…`, but
 * it is a mechanism rather than an absence.
 */
function makeEffect(data = {}) {
    return {
        name: 'New Effect',
        statements: [makeStatement(KEYWORD.PROVIDES)],
        autoSyncId: true,
        ...data,
    };
}

/**
 * Move a workspace's inline statements into the named library.
 *
 * ## ⚠️ This must run on EVERY load path, and there are three (finding B7)
 * `merge`, `migrate` and `hydrate`. The store persisted without a version until
 * 2026-08-28, and zustand skips `migrate` entirely for a versionless blob — so
 * a normaliser hung on `migrate` alone silently skips every workspace that
 * exists today. `hydrate` is a third path that never touches localStorage at
 * all. `seedSimIntent` learned this the hard way; this follows it exactly.
 *
 * ## Why the workspace must move at the same time as `data/`
 * `scripts/migrate-effects-library.mjs` migrated the game's files. The CMS's own
 * copy lives in the author's browser and no script can reach it. If it stayed on
 * the old shape, the next "Sync to Game" — a one-way full-file write (CMS-53) —
 * would overwrite the migrated `data/` with un-migrated content and quietly
 * undo the whole phase. Both sides call `migrateBearers`, so both produce the
 * same library and the first sync after this is a no-op.
 *
 * Idempotent: a workspace already carrying `effects` refs is returned untouched.
 */
function seedEffectLibrary(state = {}) {
    const tokens = state.tokens || {};
    const existing = state.effects || {};

    const needsMigration = Object.values(tokens).some((t) => statementsOf(t).length > 0);
    if (!needsMigration) return { ...state, effects: existing };

    const items = state.items || {};
    const nameOf = (id) => items[id]?.name || tokens[id]?.name || id;

    const { effects, bearers } = migrateBearers(tokens, { existing, nameOf });
    return { ...state, tokens: bearers, effects };
}

/**
 * A Token's retired `promotion: { jobId }` field → a Promotes rule in the
 * library (Promotes rule P2).
 *
 * ⚠️ Runs after `seedEffectLibrary`, on the same three load paths (`merge`,
 * `migrate`, `hydrate`), and calls the same pure function as
 * `scripts/migrate-promotion-rules.mjs` — so this workspace and `data/` convert
 * identically and the next sync writes no difference. Idempotent, and a no-op
 * for any workspace without the field.
 */
function seedPromotionRules(state = {}) {
    const tokens = state.tokens || {};
    const needsMigration = Object.values(tokens)
        .some((t) => t && Object.prototype.hasOwnProperty.call(t, 'promotion'));
    if (!needsMigration) return state;

    const { effects, tokens: next } = migratePromotionFields(tokens, { existing: state.effects || {} });
    return { ...state, tokens: next, effects };
}

const FACTORIES = {
    items: { make: makeItem, prefix: 'item', type: 'item' },
    tokens: { make: makeToken, prefix: 'token', type: 'token' },
    maps: { make: makeMap, prefix: 'map', type: 'map' },
    effects: { make: makeEffect, prefix: 'effect', type: 'effect' },
};

/**
 * Build the add/update/delete trio for a collection.
 *
 * The three collections differ only in their factory and id prefix, so the
 * old store's three near-identical copies of this logic (one per entity type,
 * ~80 lines each) collapse into one generator.
 */
function collectionActions(collectionKey, set, get) {
    const { make, prefix, type } = FACTORIES[collectionKey];
    const capitalized = collectionKey.charAt(0).toUpperCase() + collectionKey.slice(1, -1);

    return {
        [`add${capitalized}`]: (data = {}) => {
            const state = get();
            const entity = make(data);
            const id = uniqueId(state[collectionKey], slugify(entity.name, prefix));
            entity.id = id;
            set((s) => ({ [collectionKey]: { ...s[collectionKey], [id]: entity } }));
            return id;
        },

        [`update${capitalized}`]: (id, patch) =>
            set((s) => {
                const collection = s[collectionKey];
                const current = collection[id];
                if (!current) return {};

                const next = { ...current, ...patch };

                // Renaming keeps the id in step unless the author has pinned it
                // by editing the id directly (which clears autoSyncId).
                if ('name' in patch && next.autoSyncId) {
                    const desired = uniqueId(collection, slugify(patch.name, prefix), id);
                    if (desired && desired !== id) {
                        const renamePatch = performRename(
                            { ...s, [collectionKey]: { ...collection, [id]: next } },
                            id,
                            desired,
                            type
                        );
                        if (Object.keys(renamePatch).length > 0) {
                            return {
                                ...renamePatch,
                                activeEntityId: s.activeEntityId === id ? desired : s.activeEntityId,
                            };
                        }
                    }
                }

                return { [collectionKey]: { ...collection, [id]: next } };
            }),

        [`delete${capitalized}`]: (id) =>
            set((s) => {
                const { [id]: _removed, ...rest } = s[collectionKey];
                const clearing = s.activeEntityId === id;
                return {
                    [collectionKey]: rest,
                    ...(clearing ? { activeEntityId: null, activeEntityType: null } : {}),
                };
            }),
    };
}

export const useEntityStore = create(
    persist(
        (set, get) => ({
            // ===== Entity collections (keyed by id) =====
            items: {},
            tokens: {},
            maps: {},

            /**
             * The named effect library (Unified Effects P1).
             *
             * ⚠️ **A collection called `effects` existed here before and was
             * deleted** — the card-era CMS's 56 placeholder Effects, removed
             * outright by CMS-36 because they were names with no mechanism
             * behind them. This is not that. An entry here holds real
             * statements, generates its own sentence, and is enforced by
             * `ContentAudit` (UE-10) never to be a name alone.
             *
             * A Token no longer carries `statements`; it carries
             * `effects: [{ effectId, scale }]` and the entries live here.
             */
            effects: {},

            /**
             * Shared recipe pools, keyed by skill id (CMS-39).
             *
             * Not an entity collection like the three above — a recipe has no
             * global id, only a position in its skill's pool, because it is
             * owned by the skill rather than by any Token. A station names a
             * skill in its `Works as` statement (R-14) and then draws all of it.
             */
            recipePools: {},

            // ===== Active selection =====
            activeEntityId: null,
            activeEntityType: null,

            setActiveEntity: (id, type) => set({ activeEntityId: id, activeEntityType: type }),
            clearActiveEntity: () => set({ activeEntityId: null, activeEntityType: null }),

            ...collectionActions('items', set, get),
            ...collectionActions('tokens', set, get),
            ...collectionActions('maps', set, get),
            ...collectionActions('effects', set, get),

            /**
             * Move an entity to an explicitly chosen id.
             *
             * ⚠️ Deliberately does **not** touch `autoSyncId`. The checkbox that
             * pins an id owns that flag, and this is also the call it makes when
             * you re-enable auto-sync — forcing the flag false here would make
             * re-checking the box instantly uncheck itself.
             */
            renameEntityId: (oldId, newId, entityType) => {
                if (!oldId || !newId || oldId === newId) return false;
                const patch = performRename(get(), oldId, newId, entityType);
                if (Object.keys(patch).length === 0) return false;

                set({
                    ...patch,
                    activeEntityId: get().activeEntityId === oldId ? newId : get().activeEntityId,
                });
                return true;
            },

            // ===== Pooled recipes =====

            /** Add a recipe to a skill's pool. Returns its index in that pool. */
            addRecipe: (skillId, data = {}) => {
                if (!skillId) return -1;
                const pool = get().recipePools[skillId] || [];
                // The pool key is the recipe's skill. Stamped on rather than
                // inferred later, because the file the CMS syncs is a flat list
                // in which the key no longer exists.
                const recipe = makeRecipe({ skill: skillId, ...data });
                set((s) => ({
                    recipePools: { ...s.recipePools, [skillId]: [...pool, recipe] },
                }));
                return pool.length;
            },

            updateRecipe: (skillId, index, patch) =>
                set((s) => {
                    const pool = s.recipePools[skillId] || [];
                    if (!pool[index]) return {};
                    return {
                        recipePools: {
                            ...s.recipePools,
                            [skillId]: pool.map((r, i) => (i === index ? { ...r, ...patch } : r)),
                        },
                    };
                }),

            deleteRecipe: (skillId, index) =>
                set((s) => {
                    const pool = s.recipePools[skillId] || [];
                    return {
                        recipePools: {
                            ...s.recipePools,
                            [skillId]: pool.filter((_, i) => i !== index),
                        },
                    };
                }),

            // ===== Statements =====
            // Freely repeatable and freely reorderable: each statement carries
            // its own id, so the board's saved upkeep and cooldown state
            // follows the rule rather than its position in the list.

            /**
             * Write a library entry's statement list.
             *
             * ⚠️ **This is where statements are edited now, and it is not the
             * Token.** Before Unified Effects P1 the same action wrote
             * `token.statements`; a Token holds references, so editing a rule
             * means editing the entry — and that edit reaches every bearer
             * using it (UE-5), which is the point of the library and the reason
             * the editor shows a *used by* count beside it.
             */
            setEffectStatements: (effectId, statements) =>
                set((s) => {
                    const effect = s.effects[effectId];
                    if (!effect) return {};
                    return { effects: { ...s.effects, [effectId]: { ...effect, statements } } };
                }),

            /**
             * Point a bearer at a library entry.
             *
             * Refuses a duplicate rather than allowing it: two refs to one entry
             * expand to two statements sharing an id, and per-statement state
             * (`instance.blockUpkeep[id]`, `instance.blockCooldowns[id]`) is
             * keyed by that id, so the pair would share one upkeep clock and one
             * cooldown. "Twice as strong" is the `scale` field (UE-6).
             */
            addEffectRef: (collectionKey, bearerId, effectId) =>
                set((s) => {
                    const bearer = s[collectionKey]?.[bearerId];
                    if (!bearer || !effectId) return {};
                    if (effectRefsOf(bearer).some((r) => r.effectId === effectId)) return {};
                    const next = {
                        ...bearer,
                        effects: [...effectRefsOf(bearer), { effectId, scale: 1 }],
                    };
                    // The CMS never writes any retired effect shape again.
                    // Removing them here is what turns "re-author this Token"
                    // into a thing the author can finish.
                    delete next.effectBlocks;
                    delete next.buff;
                    delete next.provides;
                    delete next.statements;
                    return { [collectionKey]: { ...s[collectionKey], [bearerId]: next } };
                }),

            /**
             * Set how strong one bearer's reference to an entry is (UE-18).
             *
             * Stored on the **reference**, never on the entry: that is what lets
             * a potion carry a stronger version of the same named effect a Token
             * carries, without a second library row.
             */
            setEffectRefScale: (collectionKey, bearerId, effectId, scale) =>
                set((s) => {
                    const bearer = s[collectionKey]?.[bearerId];
                    if (!bearer) return {};
                    const next = {
                        ...bearer,
                        effects: effectRefsOf(bearer).map((r) => (
                            r.effectId === effectId ? { ...r, scale: normaliseScale(scale) } : r
                        )),
                    };
                    return { [collectionKey]: { ...s[collectionKey], [bearerId]: next } };
                }),

            /** Stop a bearer using an entry. The entry itself is untouched. */
            removeEffectRef: (collectionKey, bearerId, effectId) =>
                set((s) => {
                    const bearer = s[collectionKey]?.[bearerId];
                    if (!bearer) return {};
                    const next = {
                        ...bearer,
                        effects: effectRefsOf(bearer).filter((r) => r.effectId !== effectId),
                    };
                    return { [collectionKey]: { ...s[collectionKey], [bearerId]: next } };
                }),

            /**
             * Create an entry from one statement and point a bearer at it.
             *
             * The path the Token editor's "Add rule" takes: an author thinking
             * "this Token should slow its neighbours" does not want to visit a
             * library screen first. The entry is born named after its mechanism
             * — the same provisional naming the migration used — and can be
             * renamed in place.
             */
            addEffectForBearer: (collectionKey, bearerId, keywordId) => {
                const state = get();
                const bearer = state[collectionKey]?.[bearerId];
                if (!bearer) return null;

                const statement = makeStatement(keywordId);
                const nameOf = (id) => state.items[id]?.name || state.tokens[id]?.name || id;
                const effectId = get().addEffect({
                    name: provisionalName(statement, nameOf),
                    statements: [statement],
                });
                get().addEffectRef(collectionKey, bearerId, effectId);
                return effectId;
            },

            /**
             * Make a Token a station of a skill, or stop it being one.
             *
             * ⚠️ This writes a **`Works as` statement**, not a field. Station is
             * a statement as of the Recipe & Charges rework (R-14/R-15): the
             * same sentence that makes the Token a station names its recipe
             * pool, so the type and the pool cannot disagree — and the author
             * can equally write it in the Rules list, which is the same data.
             *
             * `recipePool` and the private `recipes[]` fork are both retired, so
             * the pooled-or-private rule CMS-77 enforced has nothing left to
             * enforce; both are stripped here if an old workspace carries them.
             */
            setTokenPooling: (tokenId, skillId) => {
                const state = get();
                const token = state.tokens[tokenId];
                if (!token) return;

                // Drop whatever station rule it has now: every referenced entry
                // whose statements are all `Works as`. An entry that mixes a
                // station rule in with other rules is left alone — unpicking it
                // would change rules the author did not ask about.
                const isStationEntry = (effectId) => {
                    const statements = statementsOf(state.effects[effectId]);
                    return statements.length > 0 && statements.every((st) => st?.keyword === KEYWORD.STATION);
                };
                for (const { effectId } of effectRefsOf(token)) {
                    if (isStationEntry(effectId)) get().removeEffectRef('tokens', tokenId, effectId);
                }

                set((s) => {
                    const current = s.tokens[tokenId];
                    if (!current) return {};
                    const next = { ...current };
                    delete next.recipePool;
                    delete next.recipes;
                    return { tokens: { ...s.tokens, [tokenId]: next } };
                });

                if (!skillId) return;

                // Reuse the entry that already says this, if one exists — two
                // Cooking stations should share one "Cooking Station", not own a
                // twin each. This is the migration's dedup, kept alive for
                // content authored after it ran.
                const after = get();
                const existing = Object.keys(after.effects).find((effectId) => {
                    const statements = statementsOf(after.effects[effectId]);
                    return statements.length === 1
                        && statements[0]?.keyword === KEYWORD.STATION
                        && statements[0]?.payload?.skill === skillId;
                });

                const effectId = existing || get().addEffect({
                    name: provisionalName(makeStatement(KEYWORD.STATION, { payload: { skill: skillId } })),
                    statements: [makeStatement(KEYWORD.STATION, { payload: { skill: skillId } })],
                });
                get().addEffectRef('tokens', tokenId, effectId);
            },

            /**
             * Replace the whole workspace — used by backup/workspace loading.
             *
             * ⚠️ **This path bypasses the persist `migrate` hook entirely**
             * (finding B7). An imported workspace never touches localStorage on
             * the way in, so anything installed only as a persist migration
             * would silently skip half the loads. `seedSimIntent` therefore runs
             * here as well as on the persist config's **`merge`** below (not
             * `migrate`, which zustand skips entirely for a versionless blob —
             * see the note there) — the two together are the whole coverage,
             * and neither is redundant.
             */
            hydrate: (data = {}) => {
                const seeded = seedPromotionRules(seedEffectLibrary(seedSimIntent({
                    items: data.items || {},
                    tokens: data.tokens || {},
                    effects: data.effects || {},
                    recipePools: data.recipePools || {},
                })));
                set({
                    items: data.items || {},
                    tokens: seeded.tokens,
                    maps: data.maps || {},
                    effects: seeded.effects,
                    recipePools: seeded.recipePools,
                    activeEntityId: null,
                    activeEntityType: null,
                });
            },

            /**
             * Recalculate Economy on demand — **the economic simulator**.
             *
             * Runs the whole assembly line — TIME → ANCHOR → PRICE → TUNE →
             * MAP + XP — then writes what it decided back into the fields the
             * game already reads: an item's `value` and `valueSource`, an
             * entity's cycle length, each output's quantity pair, a Map's pool
             * weights, a Token's scrap value, and its XP per cycle. See
             * `sim/writeBack.js` for the mapping and for the retired fields it
             * deletes on the way past.
             *
             * ⚠️ **The write-back also strips.** A workspace saved before the
             * simulator landed still carries `trueCost`/`sellPrice` on items and
             * the nine EV fields on recipes, and Sync writes from this store —
             * so a stale workspace heals on its first Recalculate rather than
             * pushing dead fields back into `data/`.
             *
             * ⚠️ **XP is derived here as of P8** — a recipe's `xp` and a
             * Token's `config.xp`, the two fields the runtime actually reads. A
             * Token's dead *top-level* `xp` is left exactly as it is; removing
             * it is a content migration for its own sitting.
             */
            recalculateEconomy: (globals = {}) => {
                const state = useEntityStore.getState();

                // The legacy `isPrimarySource` flag becomes the `anchor` intent
                // flag BEFORE the passes run, because the anchor election reads
                // `anchor`. Migrating afterwards would price the same content
                // two different ways on two consecutive runs.
                const migrated = migrateLegacyIntent(state);

                /**
                 * ⚠️ **Migrate to the library FIRST, then expand.** Both halves
                 * matter, and the order is not cosmetic (Unified Effects P1).
                 *
                 * *Migrate*, because this is the fourth path into the store's
                 * content and the only one that **writes**. `finalTokens` below
                 * strips `statements` on the way to the file — correct once the
                 * rules are in the library, and silent data loss before that. A
                 * workspace that reached here without passing a load path (a
                 * test, an older session) would have had its rules deleted.
                 *
                 * *Expand*, because several passes read a Token's rules — most
                 * visibly `writeBack`'s `deriveTokenType`, which decides whether
                 * a Token is a station. Unexpanded, every station reprices as an
                 * ordinary resource.
                 *
                 * Both are idempotent, so the common case (a workspace already
                 * migrated on load) pays nothing.
                 */
                const seeded = seedEffectLibrary({
                    items: state.items,
                    tokens: migrated.tokens,
                    effects: state.effects,
                });
                const library = seeded.effects;
                migrated.tokens = expandAll(seeded.tokens, library);

                const flatten = (pools) => {
                    const recipes = {};
                    // Every recipe the simulator sees. There is one source now:
                    // the skill pools. The private `recipes[]` fork is retired.
                    for (const [skillId, pool] of Object.entries(pools || {})) {
                        (pool || []).forEach((r, idx) => {
                            // Recipes carry a real id now, so the synthetic
                            // `pooled_<skill>_<idx>` key is only a fallback for
                            // older workspaces that predate `id`.
                            const id = r.id || `pooled_${skillId}_${idx}`;
                            recipes[id] = { ...r, id, skill: r.skill || skillId };
                        });
                    }
                    return recipes;
                };

                const sim = runSim(
                    {
                        items: state.items,
                        tokens: migrated.tokens,
                        recipes: flatten(migrated.recipePools),
                        // The Map check (P7) reads these two and writes back
                        // only derived pool weights. ⚠️ `enemies` is empty
                        // here: this store has never loaded `data/enemies.json`
                        // (finding S12), so every enemy arm of the check is
                        // exercised by fixtures only, and an enemy pool entry
                        // is unauthorable in the Map editor today.
                        maps: state.maps,
                        enemies: state.enemies || {},
                    },
                    globals?.simDials || {}
                );

                const items = applyItemResults(state.items, sim);
                // ⚠️ `applyScrapValues` runs over the result rather than
                // inside it: `applyTokenResults` returns a config-less Token
                // untouched, and a Map Token or a pickaxe has no config but is
                // exactly the sort of thing a burst hands over and a player
                // then sells.
                const tokens = applyScrapValues(applyTokenResults(migrated.tokens, sim), sim);
                const recipePools = applyRecipePoolResults(migrated.recipePools, sim);
                const maps = applyMapResults(state.maps, sim);
                const recipes = flatten(recipePools);

                // Every Token's type and description are DERIVED here, on the
                // way to the file. There is no override and no hand-written
                // text (owner decision Q3): a Token's description is its rules,
                // rendered, so the two can never drift apart.
                //
                // ⚠️ The description says nothing about Tempo or Purpose, and
                // must not start to (CMS-134): those are authoring tags for the
                // simulator, not something a player is told.
                //
                // ⚠️ Both readers need the Token's **statements**, and a Token
                // stores references (Unified Effects P1). So each is expanded
                // against the library on the way through — and the expansion is
                // deliberately NOT kept: `finalTokens` is what Sync writes, and
                // writing the resolved statements back into `data/tokens.json`
                // would put a second copy of every rule beside the library that
                // owns it, free to drift. The file keeps the references; the
                // game expands them again at load.
                const finalTokens = {};
                for (const [tokenId, token] of Object.entries(tokens)) {
                    const expanded = expandBearer(token, library);
                    const next = { ...token, tokenType: deriveTokenType(expanded).type };
                    next.description = composeTokenDescription(expanded, items, recipePools);
                    delete next.descriptionOverride;
                    delete next.statements;
                    finalTokens[tokenId] = next;
                }

                // The graph audit is unchanged and untouched by the cutover: it
                // reads entities, not the engine. The simulator's own rows reach
                // it through the same channel the old solver's refusals used —
                // one line of prose per row — so the panel keeps working without
                // the auditor having to learn a second shape.
                const auditIssues = auditConnectivity({
                    items,
                    tokens: finalTokens,
                    recipes,
                    maps,
                }, sim.rows.map(describeRow));

                useSimulationStore.getState().setAuditResults(
                    auditIssues,
                    {},
                    null,
                    items,
                    finalTokens,
                    recipes,
                    {}
                );

                // ── The simulator's own surfaces (phase P6) ──────────────────
                // The churn report diffs against the *previous* report's
                // refusal keys, and `state.items` is the only record of what
                // every value was before this run wrote over it — so both are
                // read here, before `set`.
                const ranAt = Date.now();
                const churnReport = buildChurnReport(sim, {
                    itemsBefore: state.items,
                    previous: useSimulationStore.getState().churnReport,
                    ranAt,
                });
                useSimulationStore.getState().setSimResults({
                    // Fingerprinted against the records as written, so any later
                    // edit shows the panel's "stale — recalculate" badge.
                    simAnswers: buildSimAnswers(sim, {
                        tokens: byId(finalTokens),
                        // ⚠️ The *pool* records, not the flattened copies —
                        // flattening injects `id` and `skill`, and a
                        // fingerprint taken over an injected field would read
                        // as an edit the author never made.
                        recipes: byId(Object.values(recipePools).flat().filter(Boolean)),
                    }, ranAt),
                    churnReport,
                    // The Map check's table, one row per Map (plan §13.6).
                    mapReports: [...sim.maps.values()],
                    // The rows with their structure intact, for the anchor
                    // re-elect card (P9) — the audit channel flattens them.
                    simRows: sim.rows,
                    // One sentence trail per item (plan §15.2's chain
                    // inspector), keyed by item id for the Item editor.
                    simChains: Object.fromEntries(buildChainTrails(sim)),
                });

                set({ items, tokens: finalTokens, maps, recipePools, effects: library });

                return { items, tokens: finalTokens, maps, recipePools, recipes, sim, effects: library };
            },

            /**
             * Re-elect one item's anchor (plan §3.2, phase P9).
             *
             * Stickiness means an item keeps the anchor it already has, even
             * once a better-ranked source exists: adding one Token must never
             * silently re-price a chain. The `anchor-candidate-changed` row is
             * where the simulator says a different source *would* win, and this
             * is the one click that accepts it.
             *
             * ⚠️ **It writes `valueSource` and then re-runs the whole line.**
             * That is deliberate rather than a shortcut: `valueSource` is the
             * stored election the ANCHOR pass reads, so writing it and
             * recalculating is exactly the normal path — the new election lands
             * through `writeBack` like any other, and every downstream value
             * moves through the pricing pass rather than through a special case
             * here. The churn report that comes back is the honest account of
             * what the acceptance cost.
             *
             * @returns the churn report for the run this triggered, so the
             *          caller can say what changed. `null` if the item is gone.
             */
            reElectAnchor: (itemId, sourceId, globals = {}) => {
                const state = useEntityStore.getState();
                const key = Object.keys(state.items).find((k) => (state.items[k]?.id ?? k) === itemId);
                if (key === undefined || !sourceId) return null;

                set({
                    items: {
                        ...state.items,
                        [key]: { ...state.items[key], valueSource: sourceId },
                    },
                });

                useEntityStore.getState().recalculateEconomy(globals);
                return useSimulationStore.getState().churnReport;
            },

            /** Empty every collection. */
            resetWorkspace: () =>
                set({
                    items: {},
                    tokens: {},
                    maps: {},
                    recipePools: {},
                    activeEntityId: null,
                    activeEntityType: null,
                }),
        }),
        {
            // ⚠️ Renamed from `fantasy-guild-cms-entities`. The old key holds the
            // retired thirteen-collection shape, and rehydrating it into this
            // store would silently repopulate deleted entity types. A new key
            // starts clean and leaves the old draft recoverable in localStorage
            // if anything in it is ever wanted.
            name: 'fantasy-guild-cms-v2',
            /**
             * ⚠️ **This store persisted without a version until 2026-08-28**, and
             * the versionless case does NOT behave the way the obvious reading
             * of zustand's docs suggests.
             *
             * Verified against `zustand@5.0.13`'s own source and then by hand in
             * the browser against a real pre-change blob:
             *
             * ```js
             * if (typeof deserializedStorageValue.version === "number"
             *     && deserializedStorageValue.version !== options.version) {
             *   // ... call migrate
             * }
             * ```
             *
             * A blob written before this line existed has **no `version` key at
             * all**, so `typeof undefined` is `"undefined"`, not `"number"`, the
             * condition is false, and `migrate` is **never called**. The good
             * news is that the workspace is not discarded either — it is used
             * as-is. The bad news is that a normaliser hung on `migrate` alone
             * would silently skip every workspace that predates the version
             * field, which is every workspace that exists today.
             *
             * So the seeding hangs on **`merge`**, which zustand calls on every
             * rehydration whether or not a migration happened. `migrate` is kept
             * for the case it genuinely covers — a future numbered version — and
             * because without it a real version mismatch would throw the
             * workspace away with a console warning.
             *
             * ⚠️ Do not "simplify" this by deleting `merge` and trusting
             * `migrate`. That is the bug this comment exists to prevent, and it
             * fails silently.
             */
            version: 1,
            /**
             * The default merge, plus the seeding. Runs on every rehydration.
             *
             * The spread order is zustand's own default (`persisted` wins over
             * the fresh store, so actions survive and data is replaced); only
             * `seedSimIntent` is added.
             */
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...seedPromotionRules(seedEffectLibrary(seedSimIntent(persistedState))),
            }),
            /**
             * Reached only by a numbered version that is not 1 — there is none
             * yet. Seeds anyway: the normaliser is idempotent, and a future
             * migration should never be the reason intent went missing.
             */
            migrate: (persistedState) => seedPromotionRules(seedEffectLibrary(seedSimIntent(persistedState))),
            /**
             * What survives a reload.
             *
             * ⚠️ **`activeEntityId` is in here, and it is not cosmetic.** It was
             * left out, so anything that re-created this module dropped the
             * selection and the editor fell back to "Select an entity from the
             * sidebar" with the author's work still on screen a moment earlier.
             *
             * In development that happens on an ordinary authoring action:
             * registering a sprite makes the CMS write
             * `src/config/registries/sprite-manifest.js`, which the editors
             * import through `AssetManager`, so Vite invalidates their module
             * chain and the editor closes. It looked random because it only
             * happens for a sprite that was not already registered.
             *
             * Persisting it also means a plain refresh keeps your place.
             *
             * A persisted id whose record has since gone is harmless: every
             * editor already renders its own empty state for a missing record.
             */
            partialize: (state) => ({
                items: state.items,
                tokens: state.tokens,
                maps: state.maps,
                effects: state.effects,
                recipePools: state.recipePools,
                activeEntityId: state.activeEntityId,
                activeEntityType: state.activeEntityType,
            }),
        }
    )
);
