// The QA fixture sky for the Guild Hall's stars: a constellation per skill and every star kind.
// ⚠️ Never written to `data/`: a test fixture.

import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';

export const QA_VEIN = 'token_copper_ore_vein';
export const QA_MINING_CAMP = 'token_mining_camp';

let ruleSeq = 0;
/** A standing Provides, as a star's rank holds it. `to` aims it at some Tokens. */
function provides(type, value, { bucket = 'percentage', category, to } = {}) {
    ruleSeq += 1;
    return {
        id: `stm_qa_hall_${ruleSeq}`, keyword: 'provides',
        payload: { type, bucket, value, ...(category ? { category } : {}) },
        chargeDelta: 0, to: to || { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
    };
}

const oak = (n) => [{ itemId: 'item_oak_wood', quantity: n }];
const ore = (n) => [{ itemId: 'item_copper_ore', quantity: n }];

/**
 * The fixture sky: a Mining and a Forestry constellation linked to the Hall, two stars joining the
 * Hearth and two the Well. Every kind the machinery holds, at small numbers so each shows at once:
 * XP, yield and work speed for a skill; a vein's rest and a tree's regrowth (Grow Time aimed at a
 * Token and at a tag); the Well's Copper Ore and Coal; the Infirmary; a second Food. No star widens a
 * camp: every camp works the one standard reach.
 */
export function qaHallSky() {
    ruleSeq = 0;
    const star = (id, constellation, name, description, node, links, ranks, tag) => ({
        id, constellation, name, description, node, links, ...(tag ? { tag } : {}), ranks
    });
    const ranks = (rows) => rows.map(([tier, price, rules, lines = []]) => ({ tier, price, rules, lines }));
    const stars = [
        star('qa_mining_xp', 'qa_mining', 'Miner’s Lore', 'Mining teaches more.', { x: 0.62, y: -0.2 }, ['hall'], ranks([
            [1, ore(10), [provides(EFFECT_TYPES.XP_BONUS, 0.5, { category: 'mining' })]],
            [1, ore(20), [provides(EFFECT_TYPES.XP_BONUS, 1, { category: 'mining' })]],
            [2, ore(40), [provides(EFFECT_TYPES.XP_BONUS, 2, { category: 'mining' })]]
        ])),
        star('qa_mining_yield', 'qa_mining', 'Rich Seams', 'Mining work brings up more.', { x: 0.95, y: -0.38 }, ['qa_mining_xp'], ranks([
            [1, ore(15), [provides(EFFECT_TYPES.YIELD, 0.5, { category: 'mining' })]],
            [2, ore(30), [provides(EFFECT_TYPES.YIELD, 1, { category: 'mining' })]]
        ])),
        star('qa_mining_speed', 'qa_mining', 'Quick Picks', 'Mining work goes faster.', { x: 0.98, y: -0.06 }, ['qa_mining_xp'], ranks([
            [1, ore(15), [provides(EFFECT_TYPES.WORK_TIME, -0.2, { category: 'mining' })]],
            [2, ore(30), [provides(EFFECT_TYPES.WORK_TIME, -0.4, { category: 'mining' })]]
        ])),
        star('qa_vein_rest', 'qa_mining', 'Deep Veins', 'A Copper Ore Vein rests for less time.', { x: 1.3, y: -0.3 }, ['qa_mining_yield'], ranks([
            [1, ore(20), [provides(EFFECT_TYPES.GROW_TIME, -0.25, { to: { mode: 'id', value: QA_VEIN } })]],
            [2, ore(40), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'id', value: QA_VEIN } })]]
        ]), 'right'),
        star('qa_forestry_xp', 'qa_forestry', 'Woodsman’s Lore', 'Forestry teaches more.', { x: -0.72, y: -0.3 }, ['hall'], ranks([
            [1, oak(10), [provides(EFFECT_TYPES.XP_BONUS, 0.5, { category: 'forestry' })]],
            [2, oak(30), [provides(EFFECT_TYPES.XP_BONUS, 1, { category: 'forestry' })]]
        ])),
        star('qa_oak_regrow', 'qa_forestry', 'Green Thumb', 'Oak regrows faster.', { x: -1.1, y: -0.42 }, ['qa_forestry_xp'], ranks([
            [1, oak(20), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'tag', value: 'Oak' } })]]
        ]), 'left'),
        star('qa_infirmary', 'hearth', 'Infirmary', 'A wounded hero recovers sooner.', { x: 0.36, y: -0.74 }, ['roster_size'], ranks([
            [1, oak(10), [provides(EFFECT_TYPES.WOUND_TIME, -0.2)]],
            [2, oak(20), [provides(EFFECT_TYPES.WOUND_TIME, -0.4)]],
            [3, oak(40), [provides(EFFECT_TYPES.WOUND_TIME, -0.6)]]
        ]), 'right'),
        star('qa_food_slot', 'hearth', 'Larder', 'Every hero may carry a second Food.', { x: -0.36, y: -0.74 }, ['roster_size'], ranks([
            [1, oak(20), [provides(EFFECT_TYPES.LOADOUT_SLOTS, 1, { bucket: 'flat', category: 'food' })]]
        ]), 'left'),
        star('qa_well_copper', 'well', 'Copper Spring', 'The Guild Hall draws Copper Ore every lap. No hero needed.', { x: 0.4, y: 0.74 }, ['wishing_well'], ranks([
            [1, oak(10), [], ore(10)],
            [1, oak(20), [], ore(20)],
            [2, oak(40), [], ore(30)]
        ]), 'right'),
        star('qa_well_coal', 'well', 'Coal Seam', 'The Guild Hall draws Coal every lap. No hero needed.', { x: -0.4, y: 0.74 }, ['wishing_well'], ranks([
            [1, oak(10), [], [{ itemId: 'item_coal', quantity: 5 }]]
        ]), 'left')
    ];
    return {
        constellations: {
            qa_mining: { id: 'qa_mining', name: 'Mining', label: { x: 1.0, y: -0.62 }, skill: 'mining' },
            qa_forestry: { id: 'qa_forestry', name: 'Forestry', label: { x: -1.02, y: -0.62 }, skill: 'forestry' }
        },
        stars: Object.fromEntries(stars.map(s => [s.id, s]))
    };
}

/** Put the fixture sky beside the authored one (the fixture wins an id they share), and redraw. */
export function installQaSky() {
    const authored = authoredHallSky();
    const qa = qaHallSky();
    const put = registerHallSky({
        constellations: { ...authored.constellations, ...qa.constellations },
        stars: { ...authored.stars, ...qa.stars }
    });
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
    return { constellations: put.constellations.length, stars: put.stars.length };
}
