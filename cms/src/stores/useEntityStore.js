import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { slugify, generateId } from '../utils/idGenerator';
import { runFullBalance } from '../engine/balanceRunner';
import { auditConnectivity } from '../engine/connectivityAuditor';
import { useSimulationStore } from './useSimulationStore';
import { composeTokenDescription } from '../engine/descriptionDictionary';
import { deriveTokenType, statementsOf, makeStatement, KEYWORD } from '../utils/constants';

/**
 * The CMS's authored content, in one store.
 *
 * ## Three collections, not thirteen (CMS rework Phase 0)
 * The old store carried items, recipes, tasks, stations, enemies, areas,
 * quests, subskills, tags, effects, lootTables, encounters and encounterTables
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
    const collectionFor = { item: 'items', token: 'tokens', map: 'maps' };
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
        // Derived by the balance engine (CMS-14/44/86). Null means "not yet
        // computed", which is what an unreachable item stays as — and what the
        // audit panel raises as Critical.
        value: null,
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

const FACTORIES = {
    items: { make: makeItem, prefix: 'item', type: 'item' },
    tokens: { make: makeToken, prefix: 'token', type: 'token' },
    maps: { make: makeMap, prefix: 'map', type: 'map' },
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

            /** Write the statement list, retiring the old effect shapes. */
            setStatements: (tokenId, statements) =>
                set((s) => {
                    const token = s.tokens[tokenId];
                    if (!token) return {};
                    const next = { ...token, statements };
                    // The CMS never writes either retired shape again. Removing
                    // them here is what turns "re-author this Token" into a
                    // thing the author can finish.
                    delete next.effectBlocks;
                    delete next.buff;
                    delete next.provides;
                    return { tokens: { ...s.tokens, [tokenId]: next } };
                }),

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
            setTokenPooling: (tokenId, skillId) =>
                set((s) => {
                    const token = s.tokens[tokenId];
                    if (!token) return {};
                    const rest = statementsOf(token).filter(st => st?.keyword !== KEYWORD.STATION);
                    const next = { ...token };
                    delete next.recipePool;
                    delete next.recipes;
                    next.statements = skillId
                        ? [...rest, makeStatement(KEYWORD.STATION, { payload: { skill: skillId } })]
                        : rest;
                    return { tokens: { ...s.tokens, [tokenId]: next } };
                }),

            /** Replace the whole workspace — used by backup/workspace loading. */
            hydrate: (data = {}) =>
                set({
                    items: data.items || {},
                    tokens: data.tokens || {},
                    maps: data.maps || {},
                    recipePools: data.recipePools || {},
                    activeEntityId: null,
                    activeEntityType: null,
                }),

            /**
             * Recalculate Economy on demand (CMS-16, CMS-47, CMS-109 through CMS-116).
             * Runs the multi-stage balance runner and updates derived item trueCosts,
             * non-anchor token yields, XP, charges, and audit issues.
             */
            recalculateEconomy: (globals = {}) => {
                const state = useEntityStore.getState();
                const recipes = {};
                // Every recipe the solver sees. There is one source now: the
                // skill pools. The private `recipes[]` fork is retired (P2.5).
                for (const [skillId, pool] of Object.entries(state.recipePools || {})) {
                    pool.forEach((r, idx) => {
                        // Recipes carry a real id now, so the synthetic
                        // `pooled_<skill>_<idx>` key the solver used to need is
                        // gone. Older workspaces predate `id`; those still fall
                        // back to position so loading one does not crash.
                        const id = r.id || `pooled_${skillId}_${idx}`;
                        recipes[id] = { ...r, id, skill: r.skill || skillId };
                    });
                }

                const result = runFullBalance({
                    items: state.items,
                    tokens: state.tokens,
                    recipes,
                    maps: state.maps,
                }, globals);

                // Every Token's type and description are DERIVED here, on the
                // way to the file. There is no override and no hand-written
                // text (owner decision Q3): a Token's description is its rules,
                // rendered, so the two can never drift apart.
                const finalTokens = {};
                for (const [tokenId, token] of Object.entries(result.tokens)) {
                    const next = { ...token, tokenType: deriveTokenType(token).type };
                    next.description = composeTokenDescription(next, result.items, state.recipePools);
                    delete next.descriptionOverride;
                    finalTokens[tokenId] = next;
                }

                // Run connectivity audit
                const auditIssues = auditConnectivity({
                    items: result.items,
                    tokens: finalTokens,
                    recipes,
                    maps: result.maps,
                }, result.refusals);

                useSimulationStore.getState().setAuditResults(
                    auditIssues,
                    {},
                    null,
                    result.items,
                    finalTokens,
                    recipes,
                    {}
                );

                set({
                    items: result.items,
                    tokens: finalTokens,
                    maps: result.maps,
                });

                return { ...result, tokens: finalTokens };
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
            partialize: (state) => ({
                items: state.items,
                tokens: state.tokens,
                maps: state.maps,
                recipePools: state.recipePools,
            }),
        }
    )
);
