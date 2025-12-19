// Fantasy Guild - Name Registry
// Phase 6: Hero Registries

/**
 * NameRegistry - Name pools for hero generation
 * 
 * Names are divided into pools that can be mixed for variety.
 * All names are gender-neutral for simplicity.
 */

/**
 * Fantasy-style first names
 */
export const FIRST_NAMES = [
    // Classic fantasy
    'Aldric', 'Brynn', 'Cedric', 'Dara', 'Elric', 'Fiona', 'Gareth', 'Helena',
    'Isolde', 'Jasper', 'Kira', 'Lucian', 'Mira', 'Nolan', 'Orla', 'Pierce',
    'Quinn', 'Rowan', 'Sage', 'Theron', 'Una', 'Vale', 'Wren', 'Xander',

    // Short/punchy names
    'Ash', 'Blaze', 'Cole', 'Drake', 'Ember', 'Flint', 'Gale', 'Hawk',
    'Ivy', 'Jinx', 'Knox', 'Luna', 'Moss', 'Nova', 'Onyx', 'Pax',
    'Quill', 'Rune', 'Sky', 'Thorn', 'Umber', 'Vex', 'Wolf', 'Zephyr',

    // Whimsical names
    'Bramble', 'Cricket', 'Dusty', 'Echo', 'Fern', 'Ginger', 'Hazel', 'Iris',
    'Juniper', 'Kindle', 'Lark', 'Maple', 'Nettle', 'Olive', 'Pepper', 'Quince',
    'Reed', 'Sorrel', 'Tansy', 'Urchin', 'Violet', 'Willow', 'Yarrow', 'Zinnia',

    // Strong/warrior names
    'Ajax', 'Brock', 'Crag', 'Dusk', 'Edge', 'Forge', 'Grim', 'Hammer',
    'Iron', 'Jolt', 'Krag', 'Lance', 'Magnus', 'Nero', 'Odin', 'Pike',
    'Rage', 'Scar', 'Tank', 'Ulfric', 'Viper', 'Wraith', 'Xerxes', 'Zane'
];

/**
 * Optional title prefixes (used rarely for flavor)
 */
export const TITLE_PREFIXES = [
    'Sir', 'Lady', 'Lord', 'Elder', 'Young', 'Old', 'Mad', 'Wise',
    'Swift', 'Bold', 'Brave', 'Grim', 'Sly', 'Keen', 'Wild', 'Fair'
];

/**
 * Optional nicknames/epithets (appended sometimes)
 */
export const EPITHETS = [
    'the Bold', 'the Brave', 'the Swift', 'the Wise', 'the Strong',
    'the Cunning', 'the Fierce', 'the Quiet', 'the Lucky', 'the Cursed',
    'Ironhand', 'Shadowfoot', 'Firebrand', 'Stormborn', 'Nightwalker',
    'Goldtooth', 'Redbeard', 'Blackwood', 'Whitewolf', 'Greycloak'
];

/**
 * Get a random first name
 * @returns {string}
 */
export function getRandomName() {
    return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
}

/**
 * Get a random name with optional embellishments
 * @param {number} titleChance - Chance (0-1) to add a title prefix
 * @param {number} epithetChance - Chance (0-1) to add an epithet
 * @returns {string}
 */
export function getRandomFullName(titleChance = 0, epithetChance = 0) {
    let name = getRandomName();

    if (Math.random() < titleChance) {
        const prefix = TITLE_PREFIXES[Math.floor(Math.random() * TITLE_PREFIXES.length)];
        name = `${prefix} ${name}`;
    }

    if (Math.random() < epithetChance) {
        const epithet = EPITHETS[Math.floor(Math.random() * EPITHETS.length)];
        name = `${name} ${epithet}`;
    }

    return name;
}

/**
 * Get total name count
 * @returns {number}
 */
export function getNameCount() {
    return FIRST_NAMES.length;
}
