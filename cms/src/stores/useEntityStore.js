import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { slugify, generateId } from '../utils/idGenerator';
import { useSimulationStore } from './useSimulationStore';
import {
    statementsOf, makeStatement, KEYWORD,
    effectRefsOf, provisionalName,
    normaliseScale, FOUNDATION_KINDS, TURN_DEFAULTS, RESPAWN_DEFAULTS,
} from '../utils/constants';
import { normaliseStarterCamp, emptyStarterCamp, withBankCount, withoutToken } from '../engine/starterCamp';
import { withPerkRow, withoutPerkRow } from '../engine/skillPerks';
import { pendingSpriteRenames, applySpriteRenamesTo } from '../engine/spriteRenames';
import { workspaceStorage } from '../engine/diskWorkspace';
import { seedStoredWorkspace, workspaceFromImport } from '../engine/workspaceSeeds';
import { recalculateWorkspace, balancedForSync } from '../engine/recalculate';

/** The CMS's authored content, in one store: the keyed collections `items` and `tokens`, the named effect library, and the per-skill recipe pools. Enemy is a filtered view of the Token list. */

// Cross-references, in one place: renaming an entity has to chase its id everywhere else, so every reference site is listed here rather than open-coded in each rename branch. An item id can appear in a Token's production inputs/outputs and pooled recipes. A token id can appear in a `tokenId` output on a recipe or a Token's config, and a Token's lifecycle blocks.

/**
 * Fields anywhere in an entity that hold an item id.
 * ⚠️ A field-name list rather than a list of paths, on purpose: a path-based walker missed every place an item id was later added (pooled recipes, upkeep costs, trigger watch-items, CONVERT lists); matching the name covers a new site the day it is added.
 */
const ITEM_ID_FIELDS = new Set(['itemId', 'watchItemId', 'bait']);

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

    if (next.effectBlocks) next.effectBlocks = remapItemIdsDeep(next.effectBlocks, oldId, newId, mark);
    if (next.buff) next.buff = remapItemIdsDeep(next.buff, oldId, newId, mark);

    // `catchPools`: a water's catches (`itemId`) and baits (`bait`).
    for (const key of ['spawner', 'shop', 'trickle', 'catchPools']) {
        if (next[key]) next[key] = remapItemIdsDeep(next[key], oldId, newId, mark);
    }

    return touched ? next : token;
}

/**
 * Rewrite item references inside the shared recipe pools.
 * ⚠️ Pooled recipes live in their own collection, not on the Token, so a rename that only walked Tokens would leave every pooled recipe pointing at a dead id.
 */
/**
 * Rewrite references inside the named effect library.
 * ⚠️ A Token's rules live here, so a rename that only walked Tokens would leave every rule pointing at a dead id. Item ids are covered by `remapItemIdsDeep`; token ids (a filter aimed at one exact Token, `payload.tokenIds` in a Restocks list) are named explicitly, because neither field name says token.
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

/** Repoint the Token ids inside one Token's lifecycle blocks: a spawner's `spawns[].typeId`, `grows.into`, the `needsNearby` lists of a growth and a refill, `turns.into[].typeId` and a regrow's `respawn.into`. Those field names are not shared with an item slot, so they are named explicitly rather than walked. */
function renameTokenInLifecycleBlocks(token, oldId, newId) {
    let touched = false;
    const next = { ...token };
    const remapWeighted = (list) => {
        if (!Array.isArray(list) || !list.some((e) => e?.typeId === oldId)) return list;
        touched = true;
        return list.map((e) => (e?.typeId === oldId ? { ...e, typeId: newId } : e));
    };

    if (next.spawner && typeof next.spawner === 'object') {
        const spawns = remapWeighted(next.spawner.spawns);
        if (spawns !== next.spawner.spawns) next.spawner = { ...next.spawner, spawns };
    }
    const remapIds = (list) => {
        if (!Array.isArray(list) || !list.includes(oldId)) return list;
        touched = true;
        return list.map((id) => (id === oldId ? newId : id));
    };

    if (next.grows && next.grows.into === oldId) {
        next.grows = { ...next.grows, into: newId };
        touched = true;
    }
    if (next.grows && typeof next.grows === 'object') {
        const needsNearby = remapIds(next.grows.needsNearby);
        if (needsNearby !== next.grows.needsNearby) next.grows = { ...next.grows, needsNearby };
    }
    if (next.turns && typeof next.turns === 'object') {
        const into = remapWeighted(next.turns.into);
        if (into !== next.turns.into) next.turns = { ...next.turns, into };
    }
    if (next.respawn && next.respawn.into === oldId) {
        next.respawn = { ...next.respawn, into: newId };
        touched = true;
    }
    if (next.respawn && typeof next.respawn === 'object') {
        const needsNearby = remapIds(next.respawn.needsNearby);
        if (needsNearby !== next.respawn.needsNearby) next.respawn = { ...next.respawn, needsNearby };
    }

    return touched ? next : token;
}

function remapTokenOutputs(list, oldId, newId, mark) {
    if (!Array.isArray(list) || !list.some((e) => e?.tokenId === oldId)) return list;
    mark();
    return list.map((e) => (e?.tokenId === oldId ? { ...e, tokenId: newId } : e));
}

/**
 * Repoint `tokenId` outputs after a Token rename.
 * ⚠️ A recipe that builds outputs a Token by `tokenId`, and so can a Token's own config and its legacy private recipes; a rename must walk all of them or the building recipe points at a dead id.
 */
function renameTokenInRecipePools(pools, oldId, newId) {
    let touched = false;
    const mark = () => { touched = true; };
    const next = Object.fromEntries(
        Object.entries(pools || {}).map(([skillId, recipes]) => [
            skillId,
            (recipes || []).map((recipe) => {
                const outputs = remapTokenOutputs(recipe?.outputs, oldId, newId, mark);
                return outputs === recipe?.outputs ? recipe : { ...recipe, outputs };
            }),
        ])
    );
    return touched ? next : pools;
}

function renameTokenInOutputs(token, oldId, newId) {
    let touched = false;
    const mark = () => { touched = true; };
    const next = { ...token };
    if (next.config) {
        const outputs = remapTokenOutputs(next.config.outputs, oldId, newId, mark);
        if (outputs !== next.config.outputs) next.config = { ...next.config, outputs };
    }
    if (Array.isArray(next.recipes)) {
        next.recipes = next.recipes.map((recipe) => {
            const outputs = remapTokenOutputs(recipe?.outputs, oldId, newId, mark);
            return outputs === recipe?.outputs ? recipe : { ...recipe, outputs };
        });
    }
    return touched ? next : token;
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

/**
 * Move an entity to a new id and repoint everything that referenced it.
 *
 * Returns a partial state patch, or `{}` when the rename is impossible (the
 * target id is taken by a different entity) so the caller can leave state alone.
 */
function performRename(state, oldId, newId, entityType) {
    const collectionFor = { item: 'items', token: 'tokens', effect: 'effects' };
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
        // A Token's rules live in the library, so both kinds of rename have to reach into it.
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
        if (entityType === 'token') {
            // Walks the RENAMED collection, so a Token whose spawner lists
            // itself (an audit error, but authorable) is repointed too.
            patch.tokens = Object.fromEntries(
                Object.entries(renamed).map(([id, token]) => [
                    id,
                    renameTokenInOutputs(renameTokenInLifecycleBlocks(token, oldId, newId), oldId, newId),
                ])
            );
            patch.recipePools = renameTokenInRecipePools(state.recipePools, oldId, newId);
        }
    }

    /** Renaming a library entry repoints every bearer that uses it. The id is derived from the name (`autoSyncId`), so a rename changes the id underneath, and a bearer left on the old id would quietly lose that rule. */
    if (entityType === 'effect') {
        /** ⚠️ Both bearer collections, not just Tokens: items are bearers too, and walking only `tokens` would orphan every item using a renamed shared effect. */
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

        // An enemy's moves name the effect each lands.
        const repointMoves = (token) => {
            const moves = token?.enemy?.moves;
            if (!Array.isArray(moves) || !moves.some((m) => m?.effectId === oldId)) return token;
            return { ...token, enemy: { ...token.enemy, moves: moves.map((m) => (m?.effectId === oldId ? { ...m, effectId: newId } : m)) } };
        };
        patch.tokens = Object.fromEntries(Object.entries(repoint(state.tokens)).map(([id, token]) => [id, repointMoves(token)]));
        patch.items = repoint(state.items);
        // A perk table names its effects too.
        if (state.skillPerks) {
            patch.skillPerks = Object.fromEntries(Object.entries(state.skillPerks).map(([skillId, record]) => [skillId, {
                ...record,
                perks: (record?.perks || []).map((row) => (row?.effectId === oldId ? { ...row, effectId: newId } : row)),
            }]));
        }
    }

    return patch;
}

/**
 * First free id of the form `slug`, `slug_2`, `slug_3`... within a collection.
 * ⚠️ `currentId` counts as free at every step, not just the first; otherwise an entity already holding a suffixed id would be pushed up the sequence every time its name was touched, and the editor updates on each keystroke.
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

// Entity factories: a field a later phase adds is absent rather than stubbed, so an empty field never lies about being authorable yet.

/** No `value`: values are derived, never typed. */
function makeItem(data = {}) {
    return {
        name: 'New Item',
        description: '',
        type: 'material',
        sprite: '',
        stackable: true,
        restoreAmount: 0,
        equipSlot: '',
        // Derived by the economic simulator. Null means "not yet
        // computed", which is what an unreachable item stays as — and what the
        // audit panel raises as Critical.
        value: null,
        // Which Token or recipe the value came from. Also what makes
        // an anchor election *sticky*: adding a new source re-elects nothing on
        // its own, it raises an Info row offering the change.
        valueSource: null,
        autoSyncId: true,
        ...data,
    };
}

function makeToken(data = {}) {
    return {
        name: 'New Token',
        description: '',
        sprite: '',
        // ⚠️ `tokenType` is DERIVED, never picked. It is still written into the file (the engine's `tokenType` targeting mode, the CMS sidebar's grouping and `ContentRules.test.js` read it), but the value here is a placeholder until the first sync recomputes it from the Token's rules.
        tokenType: 'buff',
        rarity: 'common',
        // The tier this Token's tools count as. Shown as **Tool Tier**, and
        // only on Tokens that actually hand a capability out.
        tier: 1,
        // ⚠️ Token tags are MECHANICAL, unlike item tags: a targeted buff can name a tag, so these are read by `matchesTokenTarget` at runtime.
        tags: [],
        statements: [],
        acceptedTokens: [],
        size: 1,
        // Lifecycle. `uses: null` is UNLIMITED, the opposite of 0 rather than a large version of it: every charge comparison in the game checks `== null` first, so this must never default to a number.
        uses: null,
        requiresHero: true,
        // Production. Null when the Token has no production side at all: Tokens are not single-purpose, and a pure buff or trigger Token has no config rather than an empty one.
        config: null,
        autoSyncId: true,
        ...data,
    };
}

/** A blank production config, created the moment a Token gains its first input or output. */
export function makeTokenConfig(data = {}) {
    return {
        skill: '',
        skillRequired: 1,
        cycleTimeMs: 12000,
        xp: 0,
        inputs: [],
        outputs: [],
        ...data,
    };
}

/** A number effect's payload, in the shape its palette entry declares. A statement carries exactly one, not a list: a rule with three effects in it was three sentences pretending to be one, so no honest description could be generated. */
export function makeModifier(type, shape) {
    if (shape === 'convert') return { type, consumes: [], produces: [], chance: 100 };
    if (shape === 'item') return { type, itemId: '', chance: 100, quantity: 1 };
    if (shape === 'proc') return { type, bucket: 'flat', value: 0 };
    return { type, bucket: 'percentage', value: 0 };
}

export function makeOutputEntry(itemId) {
    return { itemId, chance: 100, minQty: 1, maxQty: 1 };
}

/** An output that pays currency rather than an item: what makes a Market a Market. Same shape as an item output minus the `itemId`: `BoardRunner` rolls the quantity through the same YIELD widening and double-loot path, then credits it through `CurrencyManager`. */
export function makeCurrencyOutputEntry(currency = 'gold') {
    return { currency, chance: 100, minQty: 1, maxQty: 1 };
}

/** An output that drops a Token on the floor rather than an item: the same shape with `tokenId` in place of `itemId`, which is the field `BoardRunner`'s output loop branches on. */
export function makeTokenOutputEntry(tokenId) {
    return { tokenId, chance: 100, minQty: 1, maxQty: 1 };
}

// Token Lifecycle blocks: `spawner`, `grows`, `turns`, `foundation`, `shop`, `trickle`, `respawn`, `field`, `camp`. These factories only give the editor a starting value when an author ADDS a block.
// ⚠️ Absent means absent: `makeToken` creates none of them and nothing on the load or sync path fills them in, so a Token without a block round-trips without one, byte for byte.

export const TOKEN_LIFECYCLE_BLOCKS = Object.freeze(['spawner', 'grows', 'turns', 'foundation', 'shop', 'trickle', 'respawn', 'field', 'camp']);

export function makeWeightedTokenEntry(typeId = '') {
    return { typeId, weight: 1 };
}

/** A Passive Production line: paid every lap of the one shared timer (`PassiveProduction.lapMs`), so it has no interval of its own. */
export function makeTrickleEntry(itemId = '') {
    return { itemId, quantity: 1 };
}

/** A new block's starting value. Token and item id slots start empty rather than guessed; the content audit reports an unfinished one. */
export function makeLifecycleBlock(key) {
    switch (key) {
        case 'spawner':
            return { spawns: [], allowance: 1, intervalMs: 20000, upkeep: [] };
        case 'grows':
            return { into: '', afterMs: 30000 };
        case 'turns':
            // A chance once per cycle, used both ways.
            return { into: [], everyMs: TURN_DEFAULTS.everyMs, chance: TURN_DEFAULTS.chance };
        case 'foundation':
            return { kind: FOUNDATION_KINDS[0], skill: 'construction' };
        case 'shop':
            return { price: [], section: 'general' };
        case 'trickle':
            return [];
        case 'respawn':
            // A refill on the game's default rest; a regrow is picked in the editor.
            return { mode: RESPAWN_DEFAULTS.mode, afterMs: RESPAWN_DEFAULTS.afterMs };
        case 'field':
            // A Field with no pictures of its own (its own art) that starts empty.
            return {};
        case 'camp':
            // A camp of no skill yet (the audit reports it); every camp works the game's one standard reach.
            return { skill: '' };
        default:
            return undefined;
    }
}

/** An input entry. Always an exact item, never tag-matched. */
export function makeInputEntry(itemId) {
    return { itemId, quantity: 1 };
}

/** A recipe. `id` is stable and globally unique: a placed station saves the recipe the player picked as `selectedRecipeId`, so a recipe cannot be identified by its position in a pool. `skill` is the skill the recipe belongs to; `levelRequirement` is the worker's level in it. `requiresContext` is an array because a recipe may be gated on a combination of context tags. */
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

/**
 * A named effect: a title wrapping the statements that do the work.
 * ⚠️ A new entry starts with one blank statement, not with none: a named effect cannot exist without a statement that works, and an entry born empty would be an audit violation the moment it is created.
 */
function makeEffect(data = {}) {
    return {
        name: 'New Effect',
        statements: [makeStatement(KEYWORD.PROVIDES)],
        autoSyncId: true,
        ...data,
    };
}


const FACTORIES = {
    items: { make: makeItem, prefix: 'item', type: 'item' },
    tokens: { make: makeToken, prefix: 'token', type: 'token' },
    effects: { make: makeEffect, prefix: 'effect', type: 'effect' },
};

/** Build the add/update/delete trio for a collection; the collections differ only in their factory and id prefix. */
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

                // Renaming keeps the id in step unless the author has pinned it by editing the id directly (which clears autoSyncId).
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
            items: {},
            tokens: {},

            /**
             * The named effect library.
             * ⚠️ A collection called `effects` once held the card-era placeholder effects, deleted because they were names with no mechanism; this is not that. An entry holds real statements, generates its own sentence, and `ContentAudit` enforces that it is never a name alone. A Token carries `effects: [{ effectId, scale }]` and the entries live here.
             */
            effects: {},

            /** Shared recipe pools, keyed by skill id. Not an entity collection: a recipe is owned by its skill rather than by any Token. A station names a skill in its `Works as` statement and draws all of it. */
            recipePools: {},

            /** The Starter Camp (`engine/starterCamp.js`). ⚠️ Null means this workspace never held one, and Sync then leaves `data/starterCamp.json` alone; Clear sets an empty camp instead. */
            starterCamp: null,

            /** Each skill's milestone perks (`engine/skillPerks.js`). ⚠️ Null means this workspace never held any, and Sync then leaves `data/skillPerks.json` alone. */
            skillPerks: null,
            /** Set (or with index -1 add) one row of a skill's perk table. */
            setSkillPerkRow: (skillId, index, row) => set((s) => ({ skillPerks: withPerkRow(s.skillPerks, skillId, index, row) })),
            removeSkillPerkRow: (skillId, index) => set((s) => ({ skillPerks: withoutPerkRow(s.skillPerks, skillId, index) })),
            /**
             * The Guild Hall's authored sky (`engine/hallSky.js`): constellations and stars, keyed by id. ⚠️ Null means this
             * workspace never held one, and Sync then leaves `data/hallStars.json` alone.
             */
            hallConstellations: null,
            hallStars: null,
            /** The world tables (`engine/worldTables.js`), as authored. ⚠️ Null means this workspace never held any, and Sync then leaves `data/world.json` alone. */
            world: null,
            /** Change one star's top-level fields (name, description, constellation, place). */
            setHallStar: (id, patch) => set((s) => (s.hallStars?.[id]
                ? { hallStars: { ...s.hallStars, [id]: { ...s.hallStars[id], ...patch, id } } }
                : {})),
            removeHallStar: (id) => set((s) => {
                if (!s.hallStars?.[id]) return {};
                const rest = { ...s.hallStars };
                delete rest[id];
                return { hallStars: rest };
            }),
            /** A skill the Skill Perks page should open on next (the change-pack review's Open in editor). Not persisted. */
            perkFocus: null,
            focusPerks: (skillId) => set({ perkFocus: skillId }),

            /** The Ledger settings (`ledger/settings.js`), kept in `cms/plan/plan.json`. ⚠️ Null means this workspace never set any: Sync then sends none and the server keeps the file's own. */
            planSettings: null,
            setPlanSettings: (settings) => set({ planSettings: settings && typeof settings === 'object' ? settings : null }),

            activeEntityId: null,
            activeEntityType: null,

            /** A recipe the Recipes screen should open on next, by id (the change-pack review's Open in editor). Not persisted. */
            recipeFocus: null,
            focusRecipe: (recipeId) => set({ recipeFocus: recipeId }),

            setActiveEntity: (id, type) => set({ activeEntityId: id, activeEntityType: type }),
            clearActiveEntity: () => set({ activeEntityId: null, activeEntityType: null }),

            setStarterCamp: (camp) => set({ starterCamp: normaliseStarterCamp(camp) || emptyStarterCamp() }),
            setStarterCampBankCount: (itemId, count) => set((s) => ({ starterCamp: withBankCount(s.starterCamp, itemId, count) })),
            removeStarterCampToken: (index) => set((s) => ({ starterCamp: withoutToken(s.starterCamp, index) })),
            clearStarterCamp: () => set({ starterCamp: emptyStarterCamp() }),

            ...collectionActions('items', set, get),
            ...collectionActions('tokens', set, get),
            ...collectionActions('effects', set, get),

            /**
             * Move an entity to an explicitly chosen id.
             * ⚠️ Deliberately does NOT touch `autoSyncId`: the checkbox that pins an id owns that flag, and this is also the call it makes on re-enabling auto-sync, so forcing the flag false here would make re-checking the box uncheck itself.
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

            /**
             * Rewrite every sprite name from before the art was renamed to its new name (`engine/spriteRenames.js`), in this workspace; Sync to Game then writes it to `data/`. Returns how many fields changed: 0 on a second run.
             */
            applySpriteRenames: () => {
                const state = get();
                const count = pendingSpriteRenames(state).length;
                if (count > 0) set(applySpriteRenamesTo(state));
                return count;
            },

            addRecipe: (skillId, data = {}) => {
                if (!skillId) return -1;
                const pool = get().recipePools[skillId] || [];
                // The pool key is the recipe's skill, stamped on rather than inferred later, because the file the CMS syncs is a flat list in which the key no longer exists.
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

            // Statements are freely repeatable and reorderable: each carries its own id, so the board's saved upkeep and cooldown state follows the rule rather than its position.

            /**
             * Write a library entry's statement list.
             * ⚠️ Statements are edited on the library entry, not on the Token: a Token holds references, so an edit reaches every bearer using it, which is why the editor shows a used-by count.
             */
            setEffectStatements: (effectId, statements) =>
                set((s) => {
                    const effect = s.effects[effectId];
                    if (!effect) return {};
                    return { effects: { ...s.effects, [effectId]: { ...effect, statements } } };
                }),

            /** Point a bearer at a library entry. Refuses a duplicate: two refs to one entry expand to two statements sharing an id, and per-statement state (`instance.blockUpkeep[id]`, `instance.blockCooldowns[id]`) is keyed by that id, so the pair would share one upkeep clock and one cooldown. Twice as strong is the `scale` field. */
            addEffectRef: (collectionKey, bearerId, effectId) =>
                set((s) => {
                    const bearer = s[collectionKey]?.[bearerId];
                    if (!bearer || !effectId) return {};
                    if (effectRefsOf(bearer).some((r) => r.effectId === effectId)) return {};
                    const next = {
                        ...bearer,
                        effects: [...effectRefsOf(bearer), { effectId, scale: 1 }],
                    };
                    // The CMS never writes a retired effect shape again; removing them here lets the author finish re-authoring the Token.
                    delete next.effectBlocks;
                    delete next.buff;
                    delete next.provides;
                    delete next.statements;
                    return { [collectionKey]: { ...s[collectionKey], [bearerId]: next } };
                }),

            /** Set how strong one bearer's reference to an entry is. Stored on the reference, never on the entry, so a potion can carry a stronger version of the same named effect a Token carries. */
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

            /** Create an entry from one statement and point a bearer at it: the path the Token editor's Add rule takes. The entry is born named after its mechanism and can be renamed in place. */
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
             * Make a Token a station of a skill (optionally of one station kind, narrowing the pool), or stop it being one.
             * ⚠️ This writes a `Works as` statement, not a field: the same sentence that makes the Token a station names its recipe pool, so type and pool cannot disagree, and the author can write it in the Rules list too. The retired `recipePool` and private `recipes[]` are stripped here if an old workspace carries them.
             */
            setTokenPooling: (tokenId, skillId, stationKind = null) => {
                const state = get();
                const token = state.tokens[tokenId];
                if (!token) return;

                // Drop whatever station rule it has now: every referenced entry whose statements are all `Works as`. An entry that mixes a station rule with other rules is left alone, since unpicking it would change rules the author did not ask about.
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

                // Reuse the entry that already says this, if one exists: two Cooking stations should share one Cooking Station, not own a twin each. The kind must match too (none matches none).
                const after = get();
                const kind = stationKind || null;
                const existing = Object.keys(after.effects).find((effectId) => {
                    const statements = statementsOf(after.effects[effectId]);
                    return statements.length === 1
                        && statements[0]?.keyword === KEYWORD.STATION
                        && statements[0]?.payload?.skill === skillId
                        && (statements[0]?.payload?.stationKind || null) === kind;
                });

                const payload = kind ? { skill: skillId, stationKind: kind } : { skill: skillId };
                const effectId = existing || get().addEffect({
                    name: provisionalName(makeStatement(KEYWORD.STATION, { payload })),
                    statements: [makeStatement(KEYWORD.STATION, { payload })],
                });
                get().addEffectRef('tokens', tokenId, effectId);
            },

            /**
             * Replace the whole workspace, used by backup/workspace loading.
             * ⚠️ This path bypasses the persist `migrate` hook entirely: an imported workspace never touches localStorage on the way in, so `seedSimIntent` runs here as well as on the persist config's `merge`; the two together are the whole coverage.
             */
            hydrate: (data = {}) => {
                set({
                    ...workspaceFromImport(data),
                    activeEntityId: null,
                    activeEntityType: null,
                });
            },

            /**
             * Recalculate Economy on demand (`engine/recalculate.js`, which the command line runs too): the simulator's results land in the simulation store and the workspace takes the recalculated collections. Returns what Sync builds its files from.
             */
            recalculateEconomy: (globals = {}) => {
                const workspace = useEntityStore.getState();
                const { workspace: next, report } = recalculateWorkspace(workspace, globals?.simDials || {}, {
                    previousChurn: useSimulationStore.getState().churnReport,
                });

                useSimulationStore.getState().setAuditResults(
                    report.auditIssues,
                    {},
                    null,
                    report.items,
                    report.tokens,
                    report.recipes,
                    {}
                );
                useSimulationStore.getState().setSimResults({
                    simAnswers: report.simAnswers,
                    churnReport: report.churnReport,
                    // The rows with their structure intact, for the anchor re-elect card; the audit channel flattens them.
                    simRows: report.sim.rows,
                    simChains: report.simChains,
                });

                set({ items: next.items, tokens: next.tokens, recipePools: next.recipePools, effects: next.effects });

                return balancedForSync(workspace, report);
            },

            /**
             * Re-elect one item's anchor. Stickiness means an item keeps its anchor even when a better-ranked source exists; the `anchor-candidate-changed` row says a different source would win, and this is the one click that accepts it.
             * ⚠️ It writes `valueSource` and then re-runs the whole line: `valueSource` is the stored election the ANCHOR pass reads, so this is the normal path and every downstream value moves through the pricing pass.
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

            resetWorkspace: () =>
                set({
                    items: {},
                    tokens: {},
                    recipePools: {},
                    starterCamp: null,
                    skillPerks: null,
                    hallConstellations: null,
                    hallStars: null,
                    world: null,
                    planSettings: null,
                    activeEntityId: null,
                    activeEntityType: null,
                }),
        }),
        {
            // ⚠️ Renamed from `fantasy-guild-cms-entities`: the old key holds a retired collection shape, and rehydrating it into this store would silently repopulate deleted entity types.
            name: 'fantasy-guild-cms-v2',
            /** The workspace on disk, with this browser's localStorage as its cache (`engine/diskWorkspace.js`); plain localStorage until the page connects to the disk. */
            storage: workspaceStorage,
            /**
             * ⚠️ This store persisted without a version, and zustand does not call `migrate` for a versionless blob (it checks `typeof version === 'number'`), so a normaliser hung on `migrate` alone would silently skip every older workspace. Seeding therefore hangs on `merge`, which zustand calls on every rehydration; `migrate` is kept for a future numbered version, because without it a real mismatch would discard the workspace.
             * ⚠️ Do not simplify this by deleting `merge`.
             */
            version: 1,
            /** The default merge plus the seeding. The spread order is zustand's own default (persisted wins over the fresh store, so actions survive and data is replaced); only `seedSimIntent` is added. */
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...seedStoredWorkspace(persistedState),
            }),
            /** Reached only by a numbered version that is not 1. Seeds anyway: the normaliser is idempotent, and a future migration should never be the reason intent went missing. */
            migrate: (persistedState) => seedStoredWorkspace(persistedState),
            /**
             * What survives a reload.
             * ⚠️ `activeEntityId` is in here deliberately: without it, anything that re-created this module (registering a sprite writes `sprite-manifest.js`, which the editors import, so Vite reloaded them) dropped the selection and closed the editor.
             */
            partialize: (state) => ({
                items: state.items,
                tokens: state.tokens,
                effects: state.effects,
                recipePools: state.recipePools,
                starterCamp: state.starterCamp,
                skillPerks: state.skillPerks,
                hallConstellations: state.hallConstellations,
                hallStars: state.hallStars,
                world: state.world,
                planSettings: state.planSettings,
                activeEntityId: state.activeEntityId,
                activeEntityType: state.activeEntityType,
            }),
        }
    )
);
