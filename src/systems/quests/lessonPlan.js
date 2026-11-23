// Fantasy Guild - Limes's lessons: the steps in order and what counts for each
//
// Every word Limes says is in `limesText.js`. Where a step speaks and what it outlines is the UI's
// (`ui/components/limes/lessonScreens.js`). The progress is `LimesLessons.js`.
//
// A step counts a report `QuestManager` makes from an event the engine really publishes, whose
// metadata carries every value its `match` names. A step counting a report `QuestManager` does not
// make yet needs its subscription added there. Steps count
// whether or not they are the one showing, so a step done early is simply done when its turn comes.

/**
 * ⭐ The ids the lessons name, in one place. The opening's own content (brief 480 L2: the scrap
 * heap, the rusty tools) is not all wired in yet, so today's starting content stands in: a null
 * id is a step that waits for that content and is left out until it is set.
 */
export const LESSON_TARGETS = Object.freeze({
    /** Lesson 1: the bush a hero gathers bare-handed. */
    berryBush: 'token_redberry_bush',
    /** Lesson 3: the scrap heap a hero searches for rusty tools. Null until the content has one. */
    scrapHeap: null,
    /** Lesson 3: the woodaxe outlined in the Bank (any woodaxe equipped counts). Today the starter Copper Woodaxe. */
    woodaxe: 'item_copper_woodaxe',
    /** Lesson 4: the tree outlined. */
    tree: 'token_oak_tree',
    /** Lesson 5: the Guild Hall star whose next rank brings a second hero. */
    bunkBeds: 'roster_size',
    /** Lesson 6: the Foundation bought in the Shop. */
    foundation: 'token_wood_foundation',
    /** Lesson 6: Crafting's building, built on that Foundation; lesson 7 crafts at it. */
    craftBuilding: 'token_workbench',
    /** Lesson 7: what Limes suggests crafting there (any craft counts). */
    craftItem: 'item_charcoal',
    /** Lesson 8: the weapon outlined in the Bank (any weapon equipped counts). Null until the content has a first sword. */
    weapon: null,
    /** Lesson 8: the food outlined in the Bank, what lesson 1 gathers (any food equipped counts). */
    food: 'item_redberry',
    /** Lesson 8: the safe first foe outlined (any win counts): the small slime by the Hall. */
    foe: 'token_small_slime'
});

const T = LESSON_TARGETS;

/**
 * One step: `lesson` is its number in the concept's list (several steps may share one),
 * `targetType` the report it counts, `match` what that report's metadata must carry, `count` how
 * many it needs, `needs` the {@link LESSON_TARGETS} entry it waits for (left out while that is
 * null).
 */
const step = ({ match = null, count = 1, needs = null, ...rest }) =>
    Object.freeze({ ...rest, match: match ? Object.freeze(match) : null, count, needs });

/** ⭐ The lessons, in the concept's order. Step ids are kept in saves: never reuse one for another step. */
export const LESSON_STEPS = Object.freeze([
    step({ id: 'bush', lesson: 1, targetType: 'hero_deployed', match: { typeId: T.berryBush } }),
    step({ id: 'collect', lesson: 2, targetType: 'loot_collected' }),
    step({ id: 'heap', lesson: 3, targetType: 'cycle_completed', match: { typeId: T.scrapHeap }, needs: 'scrapHeap' }),
    step({ id: 'axe', lesson: 3, targetType: 'hero_equipped', match: { toolKind: 'woodaxe' } }),
    step({ id: 'chop', lesson: 4, targetType: 'cycle_completed', match: { skill: 'forestry', gathered: true } }),
    step({ id: 'bunk_beds', lesson: 5, targetType: 'guild_upgrade_purchased', match: { upgradeId: T.bunkBeds } }),
    step({ id: 'foundation', lesson: 6, targetType: 'token_purchased', match: { typeId: T.foundation } }),
    step({ id: 'build', lesson: 6, targetType: 'token_built', match: { typeId: T.craftBuilding } }),
    step({ id: 'craft', lesson: 7, targetType: 'cycle_completed', match: { crafted: true } }),
    step({ id: 'weapon', lesson: 8, targetType: 'hero_equipped', match: { weapon: true }, needs: 'weapon' }),
    step({ id: 'food', lesson: 8, targetType: 'hero_equipped', match: { category: 'food' } }),
    step({ id: 'fight', lesson: 8, targetType: 'combat_victory' })
]);

/** After the lessons, one goal carries the rest of the Starter Camp: settle a place on the world map. */
export const GOAL_STEP = step({ id: 'settle', lesson: 9, targetType: 'place_settled' });

/**
 * Limes's big moments after (or beside) the lessons: a line said once, when the report first comes.
 * Only the first settle for now.
 */
export const LIMES_MOMENTS = Object.freeze({
    first_settle: Object.freeze({ targetType: 'place_settled', match: null })
});

/** The lesson steps the content can hold today: those waiting for a missing id are left out. */
export function lessonSteps() {
    return LESSON_STEPS.filter(s => !s.needs || T[s.needs]);
}

/** Every step in order, the goal last. */
export function allSteps() {
    return [...lessonSteps(), GOAL_STEP];
}

/** Whether report `targetType` with `metadata` counts for `entry` (a step or a moment). */
export function reportCounts(entry, targetType, metadata) {
    if (!entry || entry.targetType !== targetType) return false;
    if (!entry.match) return true;
    return Object.entries(entry.match).every(([k, v]) => metadata?.[k] === v);
}
