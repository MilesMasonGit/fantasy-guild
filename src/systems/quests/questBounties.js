// Fantasy Guild - Quest bounties and rewards (a leaf module)
//
// Random bounty generation, its content pools and the reward rule. It was
// part of QuestManager.js; QuestTokens needed only these, and importing
// QuestManager for them formed an import cycle (CR3-023 group 3). This module
// imports neither QuestManager nor QuestTokens. Moved unchanged: the order of
// its Math.random draws is part of the bench's identical-work gate.

import { TUTORIAL_REWARD_ITEMS } from './tutorialQuests.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * What a random bounty pays (slice 2.2, SP-65). Quests used to reward a Map;
 * they pay items now. A placeholder amount (TL-5), in a live `item_*` id.
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
 * A quest from a save made before slice 2.2 carries `rewardMapId` and no
 * `rewardItems`; it pays the default for its kind instead of a Map, so an old
 * save cannot claim a Map (or the gold the last Guild Hall Map drop held).
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
 * Content pools for random bounties: items a new game can make (Token
 * Lifecycle §6), each with the range a bounty asks for. Placeholders (TL-5).
 *
 * Bounties used to be sized from a random Map's gold price (the Map shop and
 * the bursts retired in 9.1, gold in 9.4); the ranges replace that.
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
 * Exported so the boot-time content check can confirm these creatures exist
 * (CR2-108). It is read, never written.
 *
 * ⚠️ An `id` is an enemy **Token** id: `combat_victory` carries the Token's id
 * as `enemyId` (enemies are Tokens since 2026-09-06). The old `goblin`,
 * `wolf`, `bandit` and `skeleton` ids matched nothing, so no hunt could ever
 * finish (Token Lifecycle 9.5). The Goblin Camp is the only enemy a new game
 * can buy (§6).
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
