import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../../config/registries/enemyProfile.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { resolveRecipe } from '../../../systems/board/RecipeResolver.js';
import { linesOf } from '../../../systems/board/PassiveProduction.js';
import { FIND_CATEGORY } from '../../hooks/useMatFind.js';

/**
 * What the Controls strip's Find lights on the mat (`useMatFind.js` holds what is asked).
 * - **Heroes, Tokens, Enemies, Items**: every hero, every Token that is not an enemy, every enemy,
 *   every piece of loot on the floor.
 * - **The search box**: a hero, Token or enemy whose name holds the words (any case), and a Token
 *   that makes an item whose name holds them: what its chosen recipe makes, or its own work's
 *   output, or what it pays out on a timer. Floor loot is never lit by the box.
 */

/** The game's answers, read live. Tests pass their own. */
export const LIVE_FIND_READERS = Object.freeze({
    tokenName: (typeId) => tokenName(typeId),
    isEnemy: (typeId) => isEnemyDef(getTokenType(typeId)),
    itemName: (itemId) => getItem(itemId)?.name || itemId,
    madeItemIds
});

/** The items a Token on the mat makes as it stands: its chosen recipe's, its own work's, its timer's. */
export function madeItemIds(tokenId) {
    const instance = BoardState.getTokenById(tokenId);
    if (!instance) return [];
    const def = getTokenType(instance.typeId);
    const ids = new Set();
    const { recipe } = resolveRecipe(tokenId, instance);
    for (const o of recipe?.outputs ?? def?.config?.outputs ?? []) if (o?.itemId) ids.add(o.itemId);
    for (const line of linesOf(instance, def)) if (line?.itemId) ids.add(line.itemId);
    return [...ids];
}

const holds = (name, query) => typeof name === 'string' && name.toLowerCase().includes(query);

/**
 * What a find lights, by kind: sets of Token instance ids, hero ids and loot ids. Null when nothing
 * is asked, so the mat draws as it always does.
 * @param {{category?: string, text?: string}|null} find
 * @param {{ tokens?: {id: string, typeId: string}[], heroes?: {heroId: string, name?: string}[],
 *   loot?: {id: string}[] }} mat  only the kinds the caller draws
 * @param {typeof LIVE_FIND_READERS} [readers]
 */
export function foundOnMat(find, { tokens = [], heroes = [], loot = [] } = {}, readers = LIVE_FIND_READERS) {
    if (!find) return null;
    const found = { tokens: new Set(), heroes: new Set(), loot: new Set() };
    const { category } = find;
    if (category) {
        if (category === FIND_CATEGORY.HEROES) for (const h of heroes) found.heroes.add(h.heroId);
        if (category === FIND_CATEGORY.ITEMS) for (const l of loot) found.loot.add(l.id);
        if (category === FIND_CATEGORY.TOKENS || category === FIND_CATEGORY.ENEMIES) {
            const enemies = category === FIND_CATEGORY.ENEMIES;
            for (const t of tokens) if (!!readers.isEnemy(t.typeId) === enemies) found.tokens.add(t.id);
        }
        return found;
    }
    const query = String(find.text || '').trim().toLowerCase();
    if (!query) return null;
    for (const h of heroes) if (holds(h.name, query)) found.heroes.add(h.heroId);
    for (const t of tokens) {
        if (holds(readers.tokenName(t.typeId), query)
            || readers.madeItemIds(t.id).some(itemId => holds(readers.itemName(itemId), query))) {
            found.tokens.add(t.id);
        }
    }
    return found;
}

/**
 * How one thing on the mat draws under a find: `'match'` (a white outline), `'dim'` (faded a
 * little) or null (no find: as always).
 * @param {ReturnType<typeof foundOnMat>} found
 * @param {'tokens'|'heroes'|'loot'} kind
 */
export function findMarkOf(found, kind, id) {
    if (!found) return null;
    return found[kind].has(id) ? 'match' : 'dim';
}
