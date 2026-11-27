// Bunk Beds, Bank Tabs and the Wishing Well for a test sky: the game reads all three by id and has
// no stand-in, so a test whose own sky leaves them out merges these in. Their numbers are the ones
// the game's old built-in stand-ins carried (rank n costs 10·n Oak Wood, the Well pays 10·n Water),
// so a test that pins those numbers pins this fixture, not the shipped data.
// ⚠️ Never written to `data/`: a test fixture.

import { BANK_TABS_STAR, ROSTER_STAR, WISHING_WELL_STAR, BANK_TAB_SLOTS, RANKS_BY_ID, HALL_NODE } from '../../config/guildUpgrades.js';
import { normaliseHallSky } from '../../config/hallStars.js';

export const PLACEHOLDER_PRICE_ITEM = 'item_oak_wood';
export const PLACEHOLDER_PRICE_PER_RANK = 10;
/** Water the fixture's Wishing Well pays a lap at rank r. */
export const REQUIRED_WATER_PER_RANK = 10;

/**
 * A price list, one entry per rank: rank n costs `perRank·n` of `itemId`. `freeFirstRank` makes rank 1
 * cost nothing (Bunk Beds' first is held from a new game; the fixture's Well's first is free too).
 */
export function placeholderPrices(maxRank, { itemId = PLACEHOLDER_PRICE_ITEM, perRank = PLACEHOLDER_PRICE_PER_RANK, freeFirstRank = false } = {}) {
    return Array.from({ length: maxRank }, (_, i) => {
        const rank = i + 1;
        if (freeFirstRank && rank === 1) return [];
        return [{ itemId, quantity: perRank * rank }];
    });
}

function ranks(maxRank, priceOptions = {}, lines = () => []) {
    return placeholderPrices(maxRank, priceOptions).map((price, i) => ({ price, rules: [], lines: lines(i + 1) }));
}

/** The three stars and their constellations alone, in `data/hallStars.json`'s shape. */
export function requiredThree() {
    return {
        constellations: {
            hearth: { id: 'hearth', name: 'The Hearth', label: { x: 0, y: -0.8 } },
            vault: { id: 'vault', name: 'The Vault', label: { x: -0.72, y: 0.3 } },
            well: { id: 'well', name: 'The Well', label: { x: 0, y: 0.8 } }
        },
        stars: {
            [BANK_TABS_STAR]: {
                id: BANK_TABS_STAR, constellation: 'vault', name: 'Bank Tabs',
                description: `Unlock another Bank tab: ${BANK_TAB_SLOTS} more kinds of items in storage.`,
                node: { x: -0.5, y: 0 }, links: [HALL_NODE], outline: 'i_key_gold',
                ranks: ranks(RANKS_BY_ID[BANK_TABS_STAR])
            },
            [ROSTER_STAR]: {
                id: ROSTER_STAR, constellation: 'hearth', name: 'Bunk Beds',
                description: 'Expand guild sleeping quarters to recruit new heroes and increase roster capacity.',
                node: { x: 0, y: -0.5 }, links: [HALL_NODE], outline: 't_bunk_bed',
                ranks: ranks(RANKS_BY_ID[ROSTER_STAR], { freeFirstRank: true })
            },
            [WISHING_WELL_STAR]: {
                id: WISHING_WELL_STAR, constellation: 'well', name: 'Wishing Well',
                description: 'The Guild Hall draws fresh Water as Passive Production every lap. No hero needed.',
                node: { x: 0, y: 0.5 }, links: [HALL_NODE], outline: 'i_water',
                ranks: ranks(10, { freeFirstRank: true }, rank => [{ itemId: 'item_water', quantity: REQUIRED_WATER_PER_RANK * rank }])
            }
        }
    };
}

/** The three's star ids, in the fixture's order. */
export const REQUIRED_THREE_IDS = Object.freeze(Object.keys(requiredThree().stars));

/**
 * `sky` (the file's shape or normalised; null for none) with the three and their constellations put in
 * first wherever it lacks one of their ids, in the file's shape. The sky's own entries stay as written.
 */
export function withRequiredThree(sky = null) {
    const own = normaliseHallSky(sky || {});
    const three = requiredThree();
    const haveC = new Set(own.constellations.map(c => c.id));
    const haveS = new Set(own.stars.map(s => s.id));
    const raw = (collection) => (Array.isArray(collection) ? Object.fromEntries(collection.map(v => [v?.id, v])) : { ...(collection || {}) });
    const missing = (record, have) => Object.fromEntries(Object.entries(record).filter(([id]) => !have.has(id)));
    return {
        constellations: { ...missing(three.constellations, haveC), ...raw(sky?.constellations) },
        stars: { ...missing(three.stars, haveS), ...raw(sky?.stars) }
    };
}
