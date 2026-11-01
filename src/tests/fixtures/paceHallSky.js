// Fantasy Guild — test fixture: a Guild Hall sky for the pace world (`paceWorld.js`), read by the
// ledger's Hall tests. A Mining constellation linked to the Hall: Lore (+50 % then +100 % Mining XP),
// Quick Picks (-20 % Mining work time, behind Lore), Deep Veins (-50 % rest, aimed at the Copper Vein,
// behind Quick Picks), a Gold Leaf no one should buy (+1 % yield for 100,000 Oak Wood), a plane-1
// Rich Seams, and Long Rails (a wider Mining Camp, which the calculator does not read). A Spring at
// the Well pays 10 Copper Ore a lap; an Infirmary at the Hearth shortens a wound.

const provides = (id, type, value, { bucket = 'percentage', category, to } = {}) => ({
    id: `stm_ph_${id}`, keyword: 'provides', to: to || { mode: 'all', value: '' }, reach: 'board', target: null, when: null,
    payload: { type, bucket, value, ...(category ? { category } : {}) }
});
const ore = (n) => [{ itemId: 'item_copper_ore', quantity: n }];
const oak = (n) => [{ itemId: 'item_oak_wood', quantity: n }];
const rank = (tier, price, rules = [], lines = []) => ({ tier, price, rules, lines });
const star = (id, constellation, name, links, ranks) => ({ id, constellation, name, description: `${name}.`, node: { x: 0.5, y: 0 }, links, ranks });

export function paceHallSky() {
    const stars = [
        star('ph_lore', 'ph_mining', 'Lore', ['hall'], [
            rank(0, ore(10), [provides('lore1', 'XP_BONUS', 0.5, { category: 'mining' })]),
            rank(0, ore(20), [provides('lore2', 'XP_BONUS', 1, { category: 'mining' })])
        ]),
        star('ph_quick', 'ph_mining', 'Quick Picks', ['ph_lore'], [rank(0, ore(15), [provides('quick', 'WORK_TIME', -0.2, { category: 'mining' })])]),
        star('ph_deep', 'ph_mining', 'Deep Veins', ['ph_quick'], [rank(0, ore(20), [provides('deep', 'GROW_TIME', -0.5, { to: { mode: 'id', value: 'token_vein' } })])]),
        star('ph_gold', 'ph_mining', 'Gold Leaf', ['ph_lore'], [rank(0, oak(100000), [provides('gold', 'YIELD', 0.01, { category: 'mining' })])]),
        star('ph_rich', 'ph_mining', 'Rich Seams', ['ph_lore'], [rank(1, ore(10), [provides('rich', 'YIELD', 0.5, { category: 'mining' })])]),
        star('ph_rails', 'ph_mining', 'Long Rails', ['ph_lore'], [rank(0, ore(5), [provides('rails', 'CAMP_REACH', 0.5, { to: { mode: 'id', value: 'token_mining_camp' } })])]),
        star('ph_spring', 'well', 'Spring', ['wishing_well'], [rank(0, oak(10), [], ore(10)), rank(null, oak(20), [], ore(20))]),
        star('ph_infirmary', 'hearth', 'Infirmary', ['roster_size'], [rank(0, oak(10), [provides('wound', 'WOUND_TIME', -0.2)])])
    ];
    return {
        constellations: { ph_mining: { id: 'ph_mining', name: 'Mining', label: { x: 1, y: -0.5 }, skill: 'mining' } },
        stars: Object.fromEntries(stars.map(s => [s.id, s]))
    };
}
