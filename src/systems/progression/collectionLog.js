// the collection log: what the guild has had, made and beaten this run, for the Encyclopedia's ticks

import { GameState } from '../../state/GameState.js';

/**
 * Each Encyclopedia entry carries a tick once this run has it:
 *
 * - an **item** once it reached the Bank (`collection.discoveredItems`, `RegistryManager.recordItemGain`);
 * - a **Token** once one has stood on the guild's mat (`collection.tokensHad`, written by
 *   `BoardState.addToken`), or stands on any of the guild's Regions now;
 * - an **enemy** once beaten (`collection.enemyKillCounts`, counted by `CombatResolutionProcessor`
 *   through {@link noteEnemyBeaten}), or paid its first-kill drops (`collection.firstKillDrops`);
 * - a **recipe** once a cycle of it finished (`collection.recipesMade`, written by `BoardRunner`).
 *
 * And totals: `collection.itemLifetimeCounts` (every item gained), `collection.enemyKillCounts`
 * and `collection.tokensBuilt` (each Token a Foundation became, {@link noteTokenBuilt}).
 *
 * Silent on purpose: nothing here announces (the Bank's "New" stub is the only pop).
 * ⚠️ Everything lives in the run's `state.collection`: a new game starts empty, and the ritual
 * (not built yet) must clear `tokensHad`, `recipesMade` and `tokensBuilt` with the rest of the run.
 */

/** Note that a Token of `typeId` stood on the mat. One property write; nothing else. */
export function noteTokenHad(typeId) {
    const collection = GameState.state?.collection;
    if (!collection || !typeId) return;
    const had = collection.tokensHad || (collection.tokensHad = {});
    if (!had[typeId]) had[typeId] = true;
}

/** Count a kill of enemy type `enemyId` (`collection.enemyKillCounts`, the Bestiary's count). */
export function noteEnemyBeaten(enemyId) {
    const collection = GameState.state?.collection;
    if (!collection || !enemyId) return;
    const kills = collection.enemyKillCounts || (collection.enemyKillCounts = {});
    kills[enemyId] = (kills[enemyId] || 0) + 1;
}

/** Note that a cycle of recipe `recipeId` finished. */
export function noteRecipeMade(recipeId) {
    const collection = GameState.state?.collection;
    if (!collection || !recipeId) return;
    const made = collection.recipesMade || (collection.recipesMade = {});
    if (!made[recipeId]) made[recipeId] = true;
}

/** Count a Token of `typeId` built on a Foundation. One property write; nothing else. */
export function noteTokenBuilt(typeId) {
    const collection = GameState.state?.collection;
    if (!collection || !typeId) return;
    const built = collection.tokensBuilt || (collection.tokensBuilt = {});
    built[typeId] = (built[typeId] || 0) + 1;
}

const keys = (record) => Object.keys(record && typeof record === 'object' ? record : {}).filter(k => record[k]);

/**
 * What this run has collected, read from `state` (the live game's by default): sets of item,
 * Token, enemy and recipe ids. Reads only; called when the Encyclopedia opens.
 */
export function collectedOf(state = GameState.state) {
    const c = state?.collection || {};
    const tokens = new Set(keys(c.tokensHad));
    const boards = [state?.board, ...Object.values(state?.atlas?.regions || {}).map(r => r?.board)];
    for (const board of boards) {
        for (const instance of Object.values(board?.tokens || {})) if (instance?.typeId) tokens.add(instance.typeId);
    }
    const kills = c.enemyKillCounts || {};
    const enemies = new Set([...Object.keys(kills).filter(id => kills[id] > 0), ...keys(c.firstKillDrops)]);
    return {
        items: new Set(keys(c.discoveredItems)),
        tokens,
        enemies,
        recipes: new Set(keys(c.recipesMade))
    };
}

/**
 * What this run has had of an entry, by its ledger key (`item:`, `token:`): an item's total
 * collected, a Token's total built, an enemy's total beaten. Zero where nothing is recorded (an
 * older save starts these at zero). Reads only.
 */
export function lifetimeOf(key, state = GameState.state) {
    const c = state?.collection || {};
    const at = typeof key === 'string' ? key.indexOf(':') : -1;
    const kind = at > 0 ? key.slice(0, at) : '';
    const id = at > 0 ? key.slice(at + 1) : '';
    const count = (record) => Math.max(0, Number(record?.[id]) || 0);
    if (kind === 'item') return { collected: count(c.itemLifetimeCounts) };
    if (kind === 'token') return { built: count(c.tokensBuilt), killed: count(c.enemyKillCounts) };
    return {};
}
