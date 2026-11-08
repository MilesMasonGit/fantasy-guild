// Region names and the Atlas's words, all in one place

import { mulberry32 } from './seededRandom.js';

/**
 * Everything the player reads about Regions lives here, so translating the Atlas means translating
 * this file.
 */
export const TEXT = Object.freeze({
    STARTER_CAMP: 'Starter Camp',
    /** The practical name of a Region written from no maps at all (the dev's test Region). */
    BLANK_REGION: 'Blank Region',
    AND: 'and',

    REFUSE_NO_GAME: 'No game is running',
    REFUSE_NO_REGION: 'There is no such Region',
    REFUSE_ALREADY_HERE: 'The guild is already there',
    REFUSE_ARCHIVED: 'Restore that Region from the archive first',
    REFUSE_CATCHING_UP: 'Wait until the time away has played',
    REFUSE_ACTIVE: 'The guild is in that Region',
    REFUSE_STARTER: 'The Starter Camp cannot be abandoned',
    REFUSE_EMPTY_NAME: 'A Region needs a name',
    REFUSE_NO_MAPS: 'Nothing to write a Region from',
    REFUSE_NO_ROOM: 'Not everything fits on this layout: reroll'
});

/** The longest flavour name, generated or typed. */
export const FLAVOUR_NAME_MAX = 32;

/**
 * A Region's practical name, from what it was written with ("Forest", "Forest and Mountain"). Each
 * word once, in slot order.
 *
 * @param {Array<{word: string}>} parts one per ingredient
 */
export function practicalName(parts = []) {
    const words = [...new Set(parts
        .filter(p => p && typeof p.word === 'string' && p.word.trim())
        .map(p => p.word.trim()))];
    return words.length ? joinAnd(words) : TEXT.BLANK_REGION;
}

/** "a", "a and b", "a, b and c". */
function joinAnd(list) {
    if (list.length <= 1) return list[0] || '';
    return `${list.slice(0, -1).join(', ')} ${TEXT.AND} ${list[list.length - 1]}`;
}

/** Storybook place names: a first word, then a place ("Mossy Hollow") or an ending ("Fernmere"). */
const FLAVOUR_FIRST = Object.freeze([
    'Mossy', 'Old Oak', 'Amber', 'Fern', 'Willow', 'Thistle', 'Bramble', 'Hazel',
    'Misty', 'Golden', 'Elder', 'Honey', 'Clover', 'Rowan', 'Foxglove', 'Copper'
]);
const FLAVOUR_PLACE = Object.freeze([
    'Hollow', 'Dell', 'Vale', 'Glen', 'Meadow', 'Hill', 'Reach', 'Ford', 'Heath', 'Fold', 'Bend', 'Green'
]);
const FLAVOUR_ENDING = Object.freeze(['brook', 'wood', 'mere', 'field', 'stead', 'combe']);

/**
 * A flavour name generated from a seed: the same seed always gives the same name. Uses its own
 * generator, never `Math.random`, so naming a Region cannot change what the game rolls next.
 */
export function flavourName(seed = 0) {
    const random = mulberry32(Number(seed) || 0);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const first = pick(FLAVOUR_FIRST);
    const compound = !first.includes(' ') && random() < 0.4;
    const name = compound ? `${first}${pick(FLAVOUR_ENDING)}` : `${first} ${pick(FLAVOUR_PLACE)}`;
    return name.slice(0, FLAVOUR_NAME_MAX);
}
