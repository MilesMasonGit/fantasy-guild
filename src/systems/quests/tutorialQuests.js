// Fantasy Guild - the cartographer's tutorial chain
//
// One step at a time, in the Starter Camp: heroes, orders and gathering; building, crafting and a
// first camp; the Starter Camp's end (a first copper tool made and a goblin beaten, which pays the first maps); then the
// Atlas (writing the first world and moving the guild into it). Every step is completable in a new
// game with no dev tools once the owner's Starter Camp and maps exist, and every `targetType` is
// reported by `QuestManager` from an event the engine really publishes. ⚠️ No step may ask for a
// `landmark` Token until the shipped content has one: such a step can never be done and stalls the
// chain (the `token_inspected` report is kept for when it does).
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
import { isBaseMap, upcycleOf, givenByTutorial } from '../atlas/mapItems.js';
import { TUTORIAL_TEXT } from './tutorialText.js';

/** The default tutorial reward, and what a step with no rewards of its own pays. */
export const TUTORIAL_REWARD_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 })
]);

const reward = (itemId, quantity) => Object.freeze([Object.freeze({ itemId, quantity })]);

/** How many of each first map the tutorial pays. */
export const FIRST_MAPS_QUANTITY = 1;

/**
 * The first maps, as `[{ itemId, quantity }]` in id order: one of each Base Map ticked "given by
 * the tutorial" in the CMS. ⚠️ While no map is ticked (content from before the box), one of each
 * Base Map that no map trades up into instead, so a new game is never left without a map to settle.
 * Empty while no map is authored, so the step then pays only its items.
 */
export function firstMapsReward(items = getAllItems()) {
    const defs = Object.entries(items || {}).map(([id, def]) => ({ id: def?.id || id, def }));
    let first = defs.filter(({ def }) => givenByTutorial(def));
    if (!first.length) {
        const tradedUpInto = new Set(defs.map(({ def }) => upcycleOf(def)?.itemId).filter(Boolean));
        first = defs.filter(({ id, def }) => isBaseMap(def) && !tradedUpInto.has(id));
    }
    return first
        .map(({ id }) => id)
        .sort()
        .map(itemId => ({ itemId, quantity: FIRST_MAPS_QUANTITY }));
}

/** The Goblin the Starter Camp's end asks the player to beat. */
export const TUTORIAL_GOBLIN = 'token_goblin';

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
    // The id is older than its words (a hero sent to work, then to a tree): kept, so a save past it
    // is not asked again.
    {
        id: 'cart_flag',
        targetType: 'hero_deployed',
        match: { skill: 'forestry' },
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
    // Any camp counts; the words name the Logging Camp, the one a Wood Foundation builds from wood.
    {
        id: 'cart_camp',
        targetType: 'token_built',
        match: { camp: true },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    // The Starter Camp's end: a first tool made (copper is the camp's only metal), then a goblin
    // beaten, which pays the first maps.
    {
        id: 'cart_copper_tool',
        targetType: 'item_produced',
        match: { tool: true },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'cart_goblin',
        targetType: 'enemy_hunted',
        match: { enemyId: TUTORIAL_GOBLIN },
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
