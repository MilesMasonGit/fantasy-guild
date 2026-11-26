import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { GameState } from '../../state/GameState.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { recipesUnlockedByLevelUp } from './recipeUnlocks.js';
import { guildHeroes } from '../hero/summoned.js';

/**
 * The news a catch-up's quiet bus keeps from the banners and the item stubs (every route is a
 * `UI_LISTENER`): recipes unlocked, first finds, items a full Bank refused, heroes knocked out, mastery ranks reached.
 * Heard as plain engine listeners while it plays, handed over afterwards (`routing.js`).
 *
 * ⚠️ Only reads. Nothing here may change the game or draw a random number: a catch-up must play
 * exactly as it would without it.
 */

/**
 * Start listening. `stop({ gained, net })` unsubscribes and returns the news; `gained` and `net`
 * are the catch-up's own Bank counts (`{ itemId: quantity }`), for how much of each first find
 * came in.
 * @returns {{ stop: (counts?: {gained?: object, net?: object}) => {
 *   recipes: {heroId: string, heroName: string, skillId: string, recipes: {id: string, name: string, itemId: string|null}[]}[],
 *   finds: {itemId: string, count: number}[],
 *   bankFull: string[],
 *   stackFull: string[],
 *   knockouts: {heroId: string, heroName: string, times: number, fled: number, lost: string[]}[],
 *   mastery: {kind: string, kindName: string, rank: number, ranks: number, effectId: string|null, scale: number}[]
 * } }}
 */
export function startNewsCollector() {
    /** heroId|skillId → row, in the order first heard. */
    const recipes = new Map();
    const finds = [];
    const bankFull = [];
    const stackFull = [];
    /** heroId → row. */
    const knockouts = new Map();
    /** kind → its highest rank reached, in the order first heard. */
    const mastery = new Map();

    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, heroName, skillId, oldLevel, newLevel } = {}) => {
            // The same reading the live banner makes, at the same moment.
            const unlocked = recipesUnlockedByLevelUp(listRecipes(), guildHeroes(GameState.heroes), { heroId, skillId, oldLevel, newLevel });
            if (!unlocked.length) return;
            const key = `${heroId}|${skillId}`;
            if (!recipes.has(key)) {
                const name = heroName || GameState.heroes.find(h => h?.id === heroId)?.name || 'A hero';
                recipes.set(key, { heroId, heroName: name, skillId, recipes: [] });
            }
            const row = recipes.get(key);
            for (const r of unlocked) {
                if (row.recipes.some(x => x.id === r.id)) continue;
                row.recipes.push({ id: r.id, name: r.name || r.id, itemId: r.outputs?.[0]?.itemId || null });
            }
        }),
        EventBus.subscribe(ENGINE_EVENTS.ITEM_DISCOVERED, ({ itemId } = {}) => {
            if (itemId && !finds.includes(itemId)) finds.push(itemId);
        }),
        EventBus.subscribe(ENGINE_EVENTS.BANK_FULL, ({ itemId, reason } = {}) => {
            const list = reason === 'stack' ? stackFull : bankFull;
            if (itemId && !list.includes(itemId)) list.push(itemId);
        }),
        // A hero who fled under Valiant was still carried home wounded: counted, `fled` saying how often.
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, ({ heroId, heroName, lost, fled } = {}) => {
            if (!heroId) return;
            if (!knockouts.has(heroId)) {
                const name = heroName || GameState.heroes.find(h => h?.id === heroId)?.name || 'Your hero';
                knockouts.set(heroId, { heroId, heroName: name, times: 0, fled: 0, lost: [] });
            }
            const row = knockouts.get(heroId);
            row.times++;
            if (fled) row.fled++;
            for (const what of Array.isArray(lost) ? lost : []) if (!row.lost.includes(what)) row.lost.push(what);
        }),
        EventBus.subscribe(ENGINE_EVENTS.MASTERY_RANK_UP, ({ kind, kindName, rank, ranks, effectId, scale } = {}) => {
            if (!kind || !(rank > 0)) return;
            if ((mastery.get(kind)?.rank || 0) >= rank) return;
            mastery.set(kind, { kind, kindName: kindName || kind, rank, ranks: ranks || rank, effectId: effectId || null, scale: scale ?? 1 });
        })
    ];

    return {
        stop({ gained = {}, net = {} } = {}) {
            for (const off of offs) off();
            return {
                recipes: [...recipes.values()],
                finds: finds.map(itemId => ({ itemId, count: Math.max(1, gained[itemId] || 0, net[itemId] || 0) })),
                bankFull,
                stackFull,
                knockouts: [...knockouts.values()],
                mastery: [...mastery.values()]
            };
        }
    };
}

/** Whether a catch-up's news has anything to say. */
export function hasNews(news) {
    return !!news && (news.recipes?.length > 0 || news.finds?.length > 0
        || news.bankFull?.length > 0 || news.stackFull?.length > 0 || news.knockouts?.length > 0
        || news.mastery?.length > 0);
}
