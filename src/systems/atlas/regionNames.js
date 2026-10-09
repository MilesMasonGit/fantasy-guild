// Region names and the Atlas's words, all in one place

/**
 * Everything the player reads about Regions lives here, so translating the Atlas means translating
 * this file.
 */
export const TEXT = Object.freeze({
    STARTER_CAMP: 'Starter Camp',
    /** The practical name of a Region written from no maps at all (the dev's test Region). */
    BLANK_REGION: 'Blank Region',
    /** The noun of a practical name with modifiers but no base map. */
    LAND: 'Land',
    AND: 'and',

    REFUSE_NO_GAME: 'No game is running',
    REFUSE_NO_REGION: 'There is no such Region',
    REFUSE_ALREADY_HERE: 'The guild is already there',
    REFUSE_ARCHIVED: 'Restore that Region from the archive first',
    REFUSE_CATCHING_UP: 'Wait until the time away has played',
    REFUSE_ACTIVE: 'The guild is in that Region',
    REFUSE_STARTER: 'The Starter Camp cannot be abandoned',
    REFUSE_EMPTY_NAME: 'A Region needs a name'
});

/** The longest flavour name, generated or typed. */
export const FLAVOUR_NAME_MAX = 32;

/**
 * A Region's practical name, from what it was written with: the modifiers' words first, then the
 * base maps' ("Overgrown Forest", "Granite Forest and Mountain"). Each word once, in slot order.
 *
 * @param {Array<{word: string, modifier?: boolean}>} parts one per ingredient
 */
export function practicalName(parts = []) {
    const words = (modifier) => [...new Set(parts
        .filter(p => p && typeof p.word === 'string' && p.word.trim() && !!p.modifier === modifier)
        .map(p => p.word.trim()))];
    const modifiers = words(true);
    const bases = words(false);
    if (!modifiers.length && !bases.length) return TEXT.BLANK_REGION;
    return [...modifiers, bases.length ? joinAnd(bases) : TEXT.LAND].join(' ');
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

function mulberry32(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
