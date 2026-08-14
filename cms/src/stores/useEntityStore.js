import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { slugify } from '../utils/idGenerator';

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
 * * **maps** — what a themed Map yields when burst (D-139).
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

function renameInTokenConfig(token, oldId, newId) {
    let touched = false;
    const next = { ...token };

    const remapEntries = (list) =>
        (list || []).map((entry) => {
            if (entry.itemId !== oldId) return entry;
            touched = true;
            return { ...entry, itemId: newId };
        });

    if (next.config) {
        const config = { ...next.config };
        config.inputs = remapEntries(config.inputs);
        config.outputs = remapEntries(config.outputs);
        next.config = config;
    }

    if (Array.isArray(next.recipes)) {
        next.recipes = next.recipes.map((recipe) => ({
            ...recipe,
            inputs: remapEntries(recipe.inputs),
            outputs: remapEntries(recipe.outputs),
        }));
    }

    return touched ? next : token;
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
        // ⚠️ Lowercase, matching the game's `ITEM_TYPES` — NOT the old CMS's
        // capitalised `'Material'`. Which vocabulary is canonical is still open
        // (see `constants.js`), but defaulting to the game's is the side to be
        // wrong on: type keys recipe gating (CMS-13), and a value the game does
        // not recognise is worse than one the CMS does not offer yet.
        type: 'material',
        tags: [],
        sprite: '',
        // D-137: stackable is true for almost everything and rarely a decision.
        stackable: true,
        // Conditional consumable fields — only surfaced by the editor when the
        // item's type warrants them (CMS-13), but always present in the schema.
        restoreAmount: 0,
        restoreType: '',
        regen: 0,
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
        // Classification. `tokenType` is secondary but load-bearing (CMS-62):
        // BoardCombat reads it to know a Token is an enemy at all.
        tokenType: 'resource',
        theme: '',
        rarity: 'common',
        // Lifecycle. `uses: null` is UNLIMITED, and is the opposite of 0 rather
        // than a large version of it (D-176) — every charge comparison in the
        // game checks `== null` first, so this must never default to a number.
        uses: null,
        requiresHero: true,
        noStackDuplicates: false,
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

/** An output entry in CMS-41's shape: independent chance, quantity range. */
export function makeOutputEntry(itemId) {
    return { itemId, chance: 100, minQty: 1, maxQty: 1 };
}

/** An input entry. Always an exact item — never tag-matched (CMS-43). */
export function makeInputEntry(itemId) {
    return { itemId, quantity: 1 };
}

/** The shipped Map shape: price, material cost and a weighted pool. */
function makeMap(data = {}) {
    return {
        name: 'New Map',
        theme: '',
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

            /** Replace the whole workspace — used by backup/workspace loading. */
            hydrate: (data = {}) =>
                set({
                    items: data.items || {},
                    tokens: data.tokens || {},
                    maps: data.maps || {},
                    activeEntityId: null,
                    activeEntityType: null,
                }),

            /** Empty every collection. */
            resetWorkspace: () =>
                set({
                    items: {},
                    tokens: {},
                    maps: {},
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
            }),
        }
    )
);
