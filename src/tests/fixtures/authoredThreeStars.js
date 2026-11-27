// Bunk Beds, Bank Tabs and the Wishing Well as authored stars, with their constellations, beside the
// shipped sky: `data/hallStars.json` as it reads once the content agent's three-star pack is Synced.
// ⚠️ Never written to `data/`: a test fixture. Its numbers are its own (Water 12 a rank, prices in
// Copper Ore and Oak Wood), so a test can tell them from the stars of `hallSky.js` (10 a rank).

import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';

/** Water the fixture's Wishing Well pays a lap at rank r. */
export const FIXTURE_WATER_PER_RANK = 12;

const ranks = (count, price, lines = () => []) => Array.from({ length: count }, (_, i) => ({
    tier: Math.min(i, 3), price: price(i + 1), rules: [], lines: lines(i + 1)
}));

/** The three stars and their constellations alone, in the file's shape. */
export function authoredThree() {
    return {
        constellations: {
            hearth: { id: 'hearth', name: 'The Hearth', label: { x: 0, y: -0.85 } },
            vault: { id: 'vault', name: 'The Vault', label: { x: -0.78, y: 0.3 } },
            well: { id: 'well', name: 'The Well', label: { x: 0, y: 0.85 } }
        },
        stars: {
            roster_size: {
                id: 'roster_size', constellation: 'hearth', name: 'Bunk Beds',
                description: 'Room for one more hero a rank.', node: { x: 0, y: -0.55 }, links: ['hall'], outline: 't_bunk_bed',
                // Rank 1 is held from a new game, for the hero made on the new-game screen.
                ranks: ranks(8, r => (r === 1 ? [] : [{ itemId: 'item_oak_wood', quantity: 25 * r }]))
            },
            bank_tabs: {
                id: 'bank_tabs', constellation: 'vault', name: 'Bank Tabs',
                description: 'Another Bank tab a rank.', node: { x: -0.55, y: 0 }, links: ['hall'], outline: 'i_key_gold',
                ranks: ranks(15, r => [{ itemId: 'item_copper_ore', quantity: 20 * r }])
            },
            wishing_well: {
                id: 'wishing_well', constellation: 'well', name: 'Wishing Well',
                description: 'The Guild Hall draws Water every lap.', node: { x: 0, y: 0.55 }, links: ['hall'], outline: 'i_water',
                ranks: ranks(10, r => [{ itemId: 'item_oak_wood', quantity: 5 * r }], r => [{ itemId: 'item_water', quantity: FIXTURE_WATER_PER_RANK * r }])
            }
        }
    };
}

/** The shipped sky with the three authored beside it: what a Sync of the pack writes. */
export function skyWithAuthoredThree() {
    const shipped = authoredHallSky();
    const three = authoredThree();
    return {
        constellations: { ...shipped.constellations, ...three.constellations },
        stars: { ...shipped.stars, ...three.stars }
    };
}

/** Put that sky in, as the registry would load it, and re-read the ranks. */
export function installAuthoredThree() {
    const put = registerHallSky(skyWithAuthoredThree());
    GuildUpgradeManager.recompute();
    return put;
}
