// Fantasy Guild - Tutorial Quests Specification
//
// The tutorial walks the Token Lifecycle loop: recruit a hero, plant their flag,
// gather, collect the loot, buy at the Shop, build on a Foundation, craft, farm
// and explore. Every step is completable in a new game with no dev tools, and
// every `targetType` is reported by `QuestManager` from an event the engine (or,
// for `open_bank`, the React layer) really publishes.
// `QuestTutorialChain.test.js` drives each step through the real systems.
//
// Step ids are not reused from an older chain: an old save's
// `completedTutorials` must not tick off a new step that merely shares a number
// with an old one. Old ids a save still carries are ignored.
//
// `match` narrows a target to one Token type, item or skill: a quest with a
// `match` only counts a report whose metadata carries every listed value.
//
// Rewards are small placeholder items, live `item_*` ids only.

/** The default tutorial reward, and what a step with no rewards of its own pays. */
export const TUTORIAL_REWARD_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 })
]);

const reward = (itemId, quantity) => Object.freeze([Object.freeze({ itemId, quantity })]);

export const TUTORIAL_QUESTS = [
    {
        id: 'tut_recruit',
        title: 'Recruit a Hero',
        instruction: 'Open the Guild Hall (purple orb, top left) and buy Bunk Beds to recruit your first Hero. The first one is free.',
        targetType: 'hero_recruited',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_flag',
        title: 'Plant a Flag',
        instruction: 'Drag your Hero from the Hero Dock onto the mat beside the Oak Forest. Their flag marks where they work.',
        targetType: 'hero_deployed',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_log',
        title: 'Log an Oak Tree',
        instruction: 'The Oak Forest grows Oak Trees from Oak Seeds. Let your Hero log 3 times.',
        targetType: 'cycle_completed',
        match: { typeId: 'token_oak_tree' },
        requiredCount: 3,
        rewardItems: reward('item_oak_seed', 2)
    },
    {
        id: 'tut_collect',
        title: 'Collect Loot',
        instruction: 'Hover over the items your Hero drops on the mat to collect 10 of them.',
        targetType: 'loot_collected',
        requiredCount: 10,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_bank',
        title: 'Item Bank',
        instruction: 'Open your Item Bank (yellow orb on the left). Its Upkeep button shows what your Tokens use up.',
        targetType: 'open_bank',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_shop',
        title: 'Visit the Shop',
        instruction: 'Open the Shop (green orb on the left) and buy something. A Quarry gives Stone.',
        targetType: 'token_purchased',
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_foundation',
        title: 'Buy a Foundation',
        instruction: 'Buy a Wood Foundation at the Shop. Buildings are built on Foundations.',
        targetType: 'token_purchased',
        match: { typeId: 'token_wood_foundation' },
        requiredCount: 1,
        rewardItems: reward('item_oak_wood', 5)
    },
    {
        id: 'tut_workbench',
        title: 'Build a Workbench',
        instruction: 'Click the Wood Foundation, choose Workbench, and let a Hero build it with Construction.',
        targetType: 'token_built',
        match: { typeId: 'token_workbench' },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    },
    {
        id: 'tut_charcoal',
        title: 'Craft Charcoal',
        instruction: 'Set the Workbench to Charcoal and let a Hero craft one. Charcoal is fuel for cooking.',
        targetType: 'item_produced',
        match: { itemId: 'item_charcoal' },
        requiredCount: 1,
        rewardItems: reward('item_wheat_seed', 2)
    },
    {
        id: 'tut_farmland',
        title: 'Plant Farmland',
        instruction: 'Buy Farmland at the Shop, choose Wheat Field or Apple Orchard, and let a Hero plant it with Farming.',
        targetType: 'token_built',
        match: { fromTypeId: 'token_farmland' },
        requiredCount: 1,
        rewardItems: reward('item_wheat_seed', 2)
    },
    {
        id: 'tut_wheat',
        title: 'Harvest Wheat',
        instruction: 'A Wheat Field grows Wheat Sprouts that ripen. Harvest Ripe Wheat once.',
        targetType: 'cycle_completed',
        match: { typeId: 'token_ripe_wheat' },
        requiredCount: 1,
        rewardItems: reward('item_torch', 1)
    },
    {
        id: 'tut_explore',
        title: 'Explore a Map',
        instruction: 'Buy an Oak Forest Map at the Shop. Each exploration uses a cooked Shrimp and a Torch from the Bank.',
        targetType: 'cycle_completed',
        match: { skill: 'explore' },
        requiredCount: 1,
        rewardItems: TUTORIAL_REWARD_ITEMS
    }
].map((quest, step) => ({ ...quest, step }));

/** The template for a tutorial id, or undefined for an id the chain no longer has. */
export function tutorialTemplate(id) {
    return TUTORIAL_QUESTS.find(t => t.id === id);
}
