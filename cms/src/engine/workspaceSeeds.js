import {
    statementsOf, migrateBearers, migrateAppliesTargetsIn,
} from '../utils/constants';
import { seedSimIntent } from '../stores/simIntentNormaliser';
import { normaliseStarterCamp } from './starterCamp';
import { normaliseWorkspacePerks } from './skillPerks';
import { workspaceSkyFrom } from './hallSky';
import { workspaceWorldFrom } from './worldTables';
import { workspaceEventsFrom } from './events';
import { workspaceRenamesFrom } from './renames';

/**
 * How a stored or imported workspace is brought up to today's shape, in one place: the CMS store
 * runs these on every load path, and the command line (`cms/cli.mjs`) on every workspace it reads,
 * so both see the same workspace. Pure and idempotent.
 */

/**
 * Move a workspace's inline statements into the named library.
 * ⚠️ This must run on EVERY load path (`merge`, `migrate` and `hydrate`): zustand skips `migrate` for a versionless blob and `hydrate` never touches localStorage, so a normaliser on one path silently skips workspaces. The CMS's own workspace (on disk, cached in the browser) must move at the same time as `data/`.
 */
export function seedEffectLibrary(state = {}) {
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
 * The retired `target: 'enemy'` flag on `Applies` becomes the enemy role.
 * ⚠️ Runs on the same three load paths and calls the same pure function the game's registries call on load: Sync to Game writes this workspace wholesale, so a workspace still holding the flag would write it back into `data/`. Idempotent.
 */
export function seedAppliesTargets(state = {}) {
    if (!state) return state;
    const effects = migrateAppliesTargetsIn(state.effects || {});
    const tokens = migrateAppliesTargetsIn(state.tokens || {});
    const items = migrateAppliesTargetsIn(state.items || {});
    if (effects === (state.effects || {}) && tokens === (state.tokens || {}) && items === (state.items || {})) {
        return state;
    }
    return { ...state, effects, tokens, items };
}

/** A workspace saved before maps were items carries the retired `maps` collection; it is dropped on load, never read. */
export function dropRetiredCollections(state) {
    if (!state || typeof state !== 'object' || !('maps' in state)) return state;
    const rest = { ...state };
    delete rest.maps;
    return rest;
}

/** A stored record of renames (`engine/renames.js`) in today's shape; a workspace stored before records were kept has none, and keeps none. */
export function seedRenames(state) {
    if (!state || typeof state !== 'object' || !('renames' in state)) return state;
    return { ...state, renames: workspaceRenamesFrom(state.renames) };
}

/**
 * The world tables get their biome table, seeded with the values the game used (`worldTables.js`),
 * and kits drop their retired Stone. Idempotent.
 */
export function seedWorldBiomes(state) {
    if (!state || typeof state !== 'object' || !state.world) return state;
    const world = workspaceWorldFrom(state.world);
    return world === state.world ? state : { ...state, world };
}

/**
 * A stored workspace (the disk file, the browser's cache) brought up to today's shape: what the
 * store's persist `merge` and `migrate` run.
 */
export function seedStoredWorkspace(state) {
    return seedWorldBiomes(seedRenames(seedAppliesTargets(seedEffectLibrary(seedSimIntent(dropRetiredCollections(state))))));
}

/**
 * An imported workspace (a backup, Restore from Game, the command line's restore) as the store
 * holds it: what `hydrate` sets, without the open-entity selection.
 */
export function workspaceFromImport(data = {}) {
    const seeded = seedAppliesTargets(seedEffectLibrary(seedSimIntent({
        items: data.items || {},
        tokens: data.tokens || {},
        effects: data.effects || {},
        recipePools: data.recipePools || {},
        skillPerks: data.skillPerks,
    })));
    return {
        items: seeded.items,
        tokens: seeded.tokens,
        effects: seeded.effects,
        recipePools: seeded.recipePools,
        starterCamp: normaliseStarterCamp(data.starterCamp),
        skillPerks: normaliseWorkspacePerks(seeded.skillPerks),
        ...workspaceSkyFrom(data),
        world: workspaceWorldFrom(data.world),
        events: workspaceEventsFrom(data.events),
        // A backup brings its record back; Restore from Game has none, since every id then stands where `data/` has it.
        renames: workspaceRenamesFrom(data.renames),
        planSettings: data.planSettings && typeof data.planSettings === 'object' ? data.planSettings : null,
    };
}
