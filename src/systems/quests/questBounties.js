// Fantasy Guild - Quest bounties and rewards (a leaf module)
//
// Random bounty generation, its content pools and the reward rule.
// ⚠️ Imports neither QuestManager nor QuestTokens, which would form an import
// cycle. The order of its Math.random draws is part of the bench's
// identical-work gate.

import { TUTORIAL_REWARD_ITEMS } from './tutorialQuests.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { isMapItem, bountyWeightOf } from '../atlas/mapItems.js';

/**
 * What a random bounty pays: a placeholder amount, in a live `item_*` id.
 */
export const BOUNTY_REWARD_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 })
]);

/** A fresh, mutable copy of a reward list, safe to store on a quest. */
export function copyReward(list) {
    return (list || []).map(r => ({ itemId: r.itemId, quantity: r.quantity }));
}

/**
 * What claiming a quest pays, as `[{ itemId, quantity, name }]`.
 *
 * A quest from an older save carries `rewardMapId` and no `rewardItems`; it
 * pays the default for its kind, so an old save cannot claim a Map.
 */
export function questReward(quest) {
    const list = Array.isArray(quest?.rewardItems) && quest.rewardItems.length
        ? quest.rewardItems
        : ((quest?.tutorial || quest?.isTutorial) ? TUTORIAL_REWARD_ITEMS : BOUNTY_REWARD_ITEMS);
    return list
        .filter(r => r?.itemId && r.quantity > 0)
        .map(r => ({ itemId: r.itemId, quantity: r.quantity, name: getItem(r.itemId)?.name || r.itemId }));
}

/**
 * What a claimed bounty may pay besides its items: one map, `chance` of the time. Placeholders.
 *
 * ⚠️ Drawn when the bounty is claimed ({@link drawBountyMap}), never when it appears: a bounty's
 * roll draws the same random numbers whether or not maps exist, so the bench (where bounties
 * appear and are never claimed) does the same work.
 */
export const BOUNTY_MAP_REWARD = Object.freeze({ chance: 0.25, quantity: 1 });

/** Every map a bounty may pay, `[{ itemId, weight }]` in id order: each map's own bounty weight. */
export function bountyMapPool(items = getAllItems()) {
    return Object.entries(items || {})
        .filter(([, def]) => isMapItem(def))
        .map(([id, def]) => ({ itemId: def.id || id, weight: bountyWeightOf(def) }))
        .filter(entry => entry.weight > 0)
        .sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
}

/**
 * The map a claimed bounty pays, or null: none for a tutorial step, none when no map can be paid
 * (and then nothing is drawn), else one draw for the chance and one to pick by weight.
 *
 * @returns {{itemId: string, quantity: number, name: string}|null}
 */
export function drawBountyMap(quest, random = Math.random, pool = bountyMapPool()) {
    if (!quest || quest.tutorial || quest.isTutorial || pool.length === 0) return null;
    if (!(random() < BOUNTY_MAP_REWARD.chance)) return null;
    const total = pool.reduce((n, entry) => n + entry.weight, 0);
    let roll = random() * total;
    const pick = pool.find(entry => (roll -= entry.weight) < 0) || pool[pool.length - 1];
    return { itemId: pick.itemId, quantity: BOUNTY_MAP_REWARD.quantity, name: getItem(pick.itemId)?.name || pick.itemId };
}

/**
 * Content pools for random bounties: items a new game can make, each with the
 * range a bounty asks for. Placeholders.
 */
export const RANDOM_ITEMS = [
    { id: 'item_oak_wood', name: 'Oak Wood', min: 10, max: 25 },
    { id: 'item_copper_ore', name: 'Copper Ore', min: 8, max: 20 },
    { id: 'item_stone', name: 'Stone', min: 8, max: 20 },
    { id: 'item_copper_ingot', name: 'Copper Ingot', min: 2, max: 5 },
    { id: 'item_charcoal', name: 'Charcoal', min: 4, max: 10 },
    { id: 'item_wheat', name: 'Wheat', min: 5, max: 15 }
];

/**
 * Exported so the boot-time content check can confirm these creatures exist.
 * It is read, never written.
 *
 * ⚠️ An `id` is an enemy **Token** id: `combat_victory` carries the Token's id
 * as `enemyId`, so an id matching no Token means no hunt could ever finish. The
 * Goblin Camp is the only enemy a new game can buy.
 */
export const RANDOM_HUNTS = [
    { id: 'token_goblin', name: 'Goblins', min: 2, max: 5 }
];

/** An integer from `min` to `max`, both included. */
function rollBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextId() {
    return `quest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * One random bounty's content (not yet on the mat). Hunts and collections
 * are balanced against `existing`, the quests already out (a list of quest
 * objects; `QuestManager.createRandomQuest` defaults it to the quest Tokens').
 */
export function createRandomQuest(existing) {
    const huntCount = existing.filter(qu => qu?.type === 'hunt').length;
    const collectionCount = existing.filter(qu => qu?.type === 'collection').length;
    const isHunt = huntCount < collectionCount ? true : collectionCount < huntCount ? false : Math.random() > 0.5;

    if (isHunt) {
        const hunt = RANDOM_HUNTS[Math.floor(Math.random() * RANDOM_HUNTS.length)];
        const count = rollBetween(hunt.min, hunt.max);
        return {
            id: nextId(),
            isTutorial: false,
            type: 'hunt',
            title: `Defeat ${count} ${hunt.name}`,
            targetType: 'enemy_hunted',
            enemyId: hunt.id,
            requiredCount: count,
            currentCount: 0,
            rewardItems: copyReward(BOUNTY_REWARD_ITEMS)
        };
    } else {
        const item = RANDOM_ITEMS[Math.floor(Math.random() * RANDOM_ITEMS.length)];
        const requiredCount = rollBetween(item.min, item.max);
        return {
            id: nextId(),
            isTutorial: false,
            type: 'collection',
            title: `Collect ${requiredCount} ${item.name}`,
            targetType: 'item_collected',
            itemId: item.id,
            requiredCount: requiredCount,
            currentCount: InventoryStore.getItems()?.[item.id]?.quantity || 0,
            rewardItems: copyReward(BOUNTY_REWARD_ITEMS)
        };
    }
}
