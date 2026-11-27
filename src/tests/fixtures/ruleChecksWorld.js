// Test fixture: the pace world (`paceWorld.js`) for the ledger's rule checks (`LedgerRuleChecks.test.js`):
// a Tin Vein beside the Copper one (two pieces of work a Mining star boosts), and three chains at the
// Still: Plank (one oak), Copper Mash (two ore) and Copper Cake (two mash), with the small sky.

import { paceContent } from './paceWorld.js';
import { paceHallSky } from './paceHallSky.js';

const out = (itemId, chance = 100, minQty = 1, maxQty = minQty) => ({ itemId, chance, minQty, maxQty });
const recipe = (id, name, xp, inputs, output) => ({
    id, name, skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 6000, xp,
    inputs: inputs.map(([itemId, quantity]) => ({ itemId, quantity })), outputs: [out(output)]
});

/** The pace world with a Tin Vein beside the Copper one, and chains at the Still: Plank (oak), Mash (2 ore) into Cake (2 mash). */
export function ruleContent({ sky = true } = {}) {
    const c = paceContent();
    c.tokens.token_tin_vein = { ...structuredClone(c.tokens.token_vein), id: 'token_tin_vein', name: 'Tin Vein' };
    c.starterCamp.tokens.push({ typeId: 'token_tin_vein', x: 4, y: 0 });
    for (const [id, name] of [['item_plank', 'Plank'], ['item_mash', 'Copper Mash'], ['item_cake', 'Copper Cake']]) {
        c.items[id] = { id, name, type: 'material', plan: { tier: 0 } };
    }
    c.recipes.push(
        recipe('recipe_plank', 'Plank', 1, [['item_oak_wood', 1]], 'item_plank'),
        recipe('recipe_mash', 'Copper Mash', 3, [['item_copper_ore', 2]], 'item_mash'),
        recipe('recipe_cake', 'Copper Cake', 10, [['item_mash', 2]], 'item_cake')
    );
    if (sky) c.hallSky = paceHallSky();
    return c;
}
