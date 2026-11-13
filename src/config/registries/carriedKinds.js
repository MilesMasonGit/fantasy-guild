// the kinds of thing a hero uses up as they work and fight, which a Preservation rule may name

/**
 * How a carried item is being used up at the moment it would be spent: what a Preservation rule
 * names when it covers a kind of thing rather than one item. A use, not a property of the item: an
 * item drunk as a fight starts is a fight elixir there, and at a work cycle of its skill a work
 * potion.
 *
 * `food` and `drink` are the loadout's own categories (`equipmentCategories.js`); `potion` and
 * `elixir` the doses' (`consumableRule.DOSE`); `ammo` (an arrow a Ranged hero shoots) and `bait` (what
 * a hero fishes with) are named here for the first time.
 *
 * ⚠️ These ids sit in a rule's `category` beside skill ids and item ids, so none may ever equal one.
 */
export const CARRIED_KIND = Object.freeze({
    AMMO: 'ammo',
    BAIT: 'bait',
    FOOD: 'food',
    DRINK: 'drink',
    POTION: 'potion',
    ELIXIR: 'elixir'
});

/**
 * Each kind in the CMS's order: its picker label, the phrase a rule's sentence says ("ammo is not
 * used up"), and the picker's hint.
 */
export const CARRIED_KINDS = Object.freeze([
    { id: CARRIED_KIND.AMMO, label: 'Ammo', phrase: 'ammo', hint: 'An arrow, each time a Ranged hero shoots one.' },
    { id: CARRIED_KIND.FOOD, label: 'Food', phrase: 'Food', hint: 'A meal, each time a hurt hero eats one, in a fight or out.' },
    { id: CARRIED_KIND.DRINK, label: 'Drink', phrase: 'a drink', hint: 'A drink, each time a hero starts a new dose as a work cycle starts.' },
    { id: CARRIED_KIND.POTION, label: 'Potion', phrase: 'a potion', hint: 'A potion: a work potion drunk for each cycle of its skill, or a Consumable its own rule spends as it fires.' },
    { id: CARRIED_KIND.ELIXIR, label: 'Fight elixir', phrase: 'a fight elixir', hint: 'An elixir, each time a new dose is drunk as a fight starts.' },
    { id: CARRIED_KIND.BAIT, label: 'Bait', phrase: 'bait', hint: 'Bait, each time a catch would spend one.' }
]);

const BY_ID = new Map(CARRIED_KINDS.map(kind => [kind.id, kind]));

/**
 * The kinds of dose a hero drinks (`consumableRule.DOSE` uses the same ids): what a Long-lasting
 * Brews or Strong Drink rule may name, in words for a sentence about every hero's.
 */
export const DOSE_KINDS = Object.freeze([
    { id: CARRIED_KIND.DRINK, plural: 'drinks', unit: 'cycle' },
    { id: CARRIED_KIND.POTION, plural: 'potions', unit: 'cycle' },
    { id: CARRIED_KIND.ELIXIR, plural: 'fight elixirs', unit: 'fight' }
]);

/** The ids of {@link DOSE_KINDS}. */
export const DOSE_KIND_IDS = Object.freeze(DOSE_KINDS.map(kind => kind.id));

/** The dose kind with this id, or null. */
export function getDoseKind(id) {
    return DOSE_KINDS.find(kind => kind.id === id) || null;
}

/** "drinks", "fight elixirs"; with no kind named, all three; an id that is no kind, as written. */
export function doseKindsPhrase(id) {
    if (!id) return 'drinks, potions and fight elixirs';
    return getDoseKind(id)?.plural || String(id);
}

/** The kind with this id, or null. */
export function getCarriedKind(id) {
    return BY_ID.get(id) || null;
}

/** Whether `id` names a carried kind. */
export function isCarriedKind(id) {
    return BY_ID.has(id);
}
