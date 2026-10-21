// Fantasy Guild - the cartographer's tutorial chain
//
// One step at a time, in the Starter Camp: heroes, flags and gathering; building and crafting; a
// first fight; then the Atlas (an endgame site, the first maps, writing the first world and moving
// the guild into it). Every step is completable in a new game with no dev tools once the owner's
// Starter Camp and maps exist, and every `targetType` is reported by `QuestManager` from an event
// the engine (or, for `token_inspected`, the React layer) really publishes.
// `QuestTutorialChain.test.js` drives each step through the real systems.
//
// Every word a step shows lives in `tutorialText.js`.
//
// Step ids are not reused from an older chain: an old save's `completedTutorials` must not tick
// off a new step that merely shares a name with an old one. Old ids a save still carries are
// ignored, and an old step's Token is taken off the mat.
//
// `match` narrows a target: a quest with a `match` only counts a report whose metadata carries
// every listed value.
//
// Rewards are small placeholder items, live `item_*` ids only. `firstMaps` adds the first maps,
// read from the item registry when the step is claimed ({@link firstMapsReward}).

import { getAllItems } from '../../config/registries/itemRegistry.js';
import { isBaseMap, upcycleOf } from '../atlas/mapItems.js';
import { TUTORIAL_TEXT } from './tutorialText.js';

/** The default tutorial reward, and what a step with no rewards of its own pays. */
export const TUTORIAL_REWARD_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 })
]);

const reward = (itemId, quantity) => Object.freeze([Object.freeze({ itemId, quantity })]);

/** How many of each first map the tutorial pays. */
export const FIRST_MAPS_QUANTITY = 1;

/**
 * The first maps, as `[{ itemId, quantity }]` in id order: one of each Base Map that no map trades
 * up into (the lowest tier). Empty while no map is authored, so the step then pays only its items.
 */
export function firstMapsReward(items = getAllItems()) {
    const defs = Object.entries(items || {}).map(([id, def]) => ({ id: def?.id || id, def }));
    const tradedUpInto = new Set(defs.map(({ def }) => upcycleOf(def)?.itemId).filter(Boolean));
    return defs
        .filter(({ id, def }) => isBaseMap(def) && !tradedUpInto.has(id))
        .map(({ id }) => id)
        .sort()
        .map(itemId => ({ itemId, quantity: FIRST_MAPS_QUANTITY }));
}

const STEPS = [
    {
        id: 'cart_recruit',
        targetType: 'hero_recruited',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_tool',
        targetType: 'hero_equipped',
        match: { tool: true },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_flag',
        targetType: 'hero_deployed',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_gather',
        targetType: 'cycle_completed',
        match: { gathered: true },
        requiredCount: 3,
        rewardItems: reward('item_oak_seedling', 2)
    },
    {
        id: 'cart_loot',
        targetType: 'loot_collected',
        requiredCount: 10,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_foundation',
        targetType: 'token_purchased',
        match: { typeId: 'token_wood_foundation' },
        requiredCount: 1,
        rewardItems: reward('item_oak_wood', 5)
    },
    {
        id: 'cart_station',
        targetType: 'token_built',
        match: { fromTypeId: 'token_wood_foundation' },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_craft',
        targetType: 'cycle_completed',
        match: { crafted: true },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_fight',
        targetType: 'combat_victory',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_inspect',
        targetType: 'token_inspected',
        match: { landmark: true },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS,
        firstMaps: true
    },
    {
        id: 'cart_settle',
        targetType: 'region_settled',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_travel',
        targetType: 'region_travelled',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    }
];

export const TUTORIAL_QUESTS = STEPS.map((quest, step) => {
    const text = TUTORIAL_TEXT.steps[quest.id];
    return { ...quest, title: text.title, says: text.says, instruction: text.instruction, step };
});

/** The template for a tutorial id, or undefined for an id the chain no longer has. */
export function tutorialTemplate(id) {
    return TUTORIAL_QUESTS.find(t => t.id === id);
}
