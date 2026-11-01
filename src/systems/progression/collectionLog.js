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
 * Silent on purpose: nothing here announces (the Bank's "New" stub is the only pop).
 * ⚠️ Everything lives in the run's `state.collection`: a new game starts empty, and the ritual
 * (not built yet) must clear `tokensHad` and `recipesMade` with the rest of the run.
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
 * The items this run collected last, newest first, at most `count`: `collection.discoveredItems`
 * keeps the order they first came in (an object keeps its text keys in the order written, through
 * a save and a load). Reads only.
 */
export function recentlyCollectedItems(state = GameState.state, count = 8) {
    const found = state?.collection?.discoveredItems;
    if (!found || typeof found !== 'object') return [];
    return keys(found).reverse().slice(0, Math.max(0, count));
}
