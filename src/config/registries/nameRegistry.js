// Name Registry

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
    'Rage', 'Scar', 'Tank', 'Ulfric', 'Viper', 'Wraith', 'Xerxes', 'Zane',

    // More classic fantasy
    'Alaric', 'Bryony', 'Caelan', 'Delphine', 'Eamon', 'Freya', 'Garrick', 'Hollis',
    'Ingrid', 'Jorah', 'Kestrel', 'Leander', 'Maren', 'Niamh', 'Oswin', 'Perrin',
    'Rhea', 'Seren', 'Tamsin', 'Ursa', 'Vesper', 'Wynne', 'Yvaine', 'Zara',

    // More short/punchy
    'Arc', 'Bolt', 'Cinder', 'Dart', 'Fang', 'Frost', 'Glint', 'Grey',
    'Haze', 'Jet', 'Kai', 'Lux', 'Mist', 'Nyx', 'Oak', 'Pyre',
    'Rook', 'Slate', 'Spark', 'Storm', 'Tide', 'Volt', 'Ward', 'Zed',

    // More whimsical
    'Acorn', 'Basil', 'Bumble', 'Clover', 'Daisy', 'Elder', 'Fig', 'Heather',
    'Holly', 'Jasmine', 'Kipper', 'Lavender', 'Mallow', 'Marigold', 'Nutmeg', 'Pippin',
    'Poppy', 'Puddle', 'Rosemary', 'Saffron', 'Sprout', 'Thistle', 'Tumble', 'Wisp',

    // More strong/warrior
    'Axel', 'Bjorn', 'Brand', 'Bruno', 'Cleave', 'Dirk', 'Einar', 'Grit',
    'Gunnar', 'Halvard', 'Hilda', 'Ivar', 'Kane', 'Leif', 'Mace', 'Orm',
    'Ragnar', 'Sigurd', 'Steel', 'Talon', 'Torvald', 'Ulf', 'Vargas', 'Warrick'
];

/**
 * A random first name, from those not in `taken` (compared without case or outer spaces), or from
 * every name when all are taken. One `Math.random()` draw either way.
 * @param {Iterable<string>} [taken] names already held on the roster
 * @returns {string}
 */
export function getRandomName(taken = []) {
    const held = new Set();
    for (const n of taken || []) if (typeof n === 'string') held.add(n.trim().toLowerCase());
    const free = FIRST_NAMES.filter(n => !held.has(n.toLowerCase()));
    const pool = free.length ? free : FIRST_NAMES;
    return pool[Math.floor(Math.random() * pool.length)];
}
