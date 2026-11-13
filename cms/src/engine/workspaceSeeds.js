import {
    statementsOf, migrateBearers, migrateAppliesTargetsIn, migrateSkillIdsIn, migrateRecipePools,
    migrateEffectLibrary, migrateEffectIdsIn, migratePerkEffectIds,
} from '../utils/constants';
import { seedSimIntent } from '../stores/simIntentNormaliser';
import { normaliseStarterCamp } from './starterCamp';
import { normaliseWorkspacePerks } from './skillPerks';
import { workspaceSkyFrom } from './hallSky';
import { workspaceWorldFrom } from './worldTables';
import { workspaceEventsFrom } from './events';

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

/**
 * A renamed skill id (Logging → Forestry) is rewritten wherever the workspace names a skill, and a recipe pool under the old key moves to the new one.
 * ⚠️ Runs first on the same three load paths and calls the same pure function the game's loaders call: Sync to Game writes this workspace wholesale, so a workspace still naming the old id would write it back into `data/`. Idempotent.
 */
export function seedSkillIds(state) {
    if (!state || typeof state !== 'object') return state;
    let next = state;
    const replace = (key, value) => {
        if (value === state[key]) return;
        if (next === state) next = { ...state };
        next[key] = value;
    };
    replace('tokens', migrateSkillIdsIn(state.tokens));
    replace('effects', migrateSkillIdsIn(state.effects));
    replace('items', migrateSkillIdsIn(state.items));
    replace('recipePools', migrateRecipePools(state.recipePools));
    return next;
}

/**
 * A renamed library effect (the Poison status became Venom) moves to its new id, keeping its place, and every Token, item, effect and perk naming it follows.
 * ⚠️ Runs on the same three load paths and calls the same pure functions the game's loaders call: Sync to Game writes this workspace wholesale, so a workspace still naming the old id would write it back into `data/`. Idempotent.
 */
export function seedEffectIds(state) {
    if (!state || typeof state !== 'object') return state;
    let next = state;
    const replace = (key, value) => {
        if (value === state[key]) return;
        if (next === state) next = { ...state };
        next[key] = value;
    };
    replace('effects', migrateEffectLibrary(state.effects));
    replace('tokens', migrateEffectIdsIn(state.tokens));
    replace('items', migrateEffectIdsIn(state.items));
    replace('skillPerks', migratePerkEffectIds(state.skillPerks));
    return next;
}

/** A workspace saved before maps were items carries the retired `maps` collection; it is dropped on load, never read. */
export function dropRetiredCollections(state) {
    if (!state || typeof state !== 'object' || !('maps' in state)) return state;
    const rest = { ...state };
    delete rest.maps;
    return rest;
}

/**
 * A stored workspace (the disk file, the browser's cache) brought up to today's shape: what the
 * store's persist `merge` and `migrate` run.
 */
export function seedStoredWorkspace(state) {
    return seedEffectIds(seedAppliesTargets(seedEffectLibrary(seedSkillIds(seedSimIntent(dropRetiredCollections(state))))));
}

/**
 * An imported workspace (a backup, Restore from Game, the command line's restore) as the store
 * holds it: what `hydrate` sets, without the open-entity selection.
 */
export function workspaceFromImport(data = {}) {
    const seeded = seedEffectIds(seedAppliesTargets(seedEffectLibrary(seedSkillIds(seedSimIntent({
        items: data.items || {},
        tokens: data.tokens || {},
        effects: data.effects || {},
        recipePools: data.recipePools || {},
        skillPerks: data.skillPerks,
    })))));
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
        planSettings: data.planSettings && typeof data.planSettings === 'object' ? data.planSettings : null,
    };
}
