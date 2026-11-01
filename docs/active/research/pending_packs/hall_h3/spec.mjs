// The H3 star list: what each star does, rank by rank, before prices.
const r2 = (n) => Math.round(n * 1000) / 1000;
let seq = 0;
export function provides(starId, rank, type, value, { bucket = 'percentage', category, to } = {}) {
    seq += 1;
    return {
        id: `stm_${starId}_${rank}_${seq}`, keyword: 'provides',
        payload: { type, bucket, value: r2(value), ...(category ? { category } : {}) },
        chargeDelta: 0, to: to || { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
    };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Per-rank steps (a rank holds its whole effect: rank r = r steps).
export const STEP = { xp: 0.15, yield: 0.07, speed: -0.06, rest: -0.10, reach: 0.15, wound: -0.10 };

// Skills with content, the tiers their content spans (the ledger first-fill and fix packs' plan tiers).
export const SKILLS = [
    { id: 'forestry', name: 'Forestry', tiers: [0, 2], angle: 0,
      names: { xp: 'Woodsman’s Lore', yield: 'Heartwood', speed: 'Keen Axes' },
      token: { id: 'star_forestry_regrowth', name: 'Green Thumb', tiers: [0], desc: 'Felled Oak and Fir grow back sooner.', to: [{ mode: 'tag', value: 'Oak' }, { mode: 'tag', value: 'Fir' }] },
      camp: { id: 'star_forestry_camp_reach', name: 'Logging Roads', desc: 'A Logging Camp hands out work further away.', token: 'token_logging_camp' } },
    { id: 'mining', name: 'Mining', tiers: [0, 2], angle: -30,
      names: { xp: 'Miner’s Lore', yield: 'Rich Seams', speed: 'Quick Picks' },
      token: { id: 'star_mining_vein_rest', name: 'Deep Veins', desc: 'An ore vein or outcrop rests for less time before it refills.', to: [{ mode: 'tag', value: 'Ore' }] },
      camp: { id: 'star_mining_camp_reach', name: 'Long Rails', desc: 'A Mining Camp hands out work further away.', token: 'token_mining_camp' } },
    { id: 'smithing', name: 'Smithing', tiers: [0, 2], angle: -60,
      names: { xp: 'Smith’s Lore', yield: 'Fine Castings', speed: 'Hot Forges' } },
    { id: 'fishing', name: 'Fishing', tiers: [0, 2], angle: 30,
      names: { xp: 'Angler’s Lore', yield: 'Full Nets', speed: 'Quick Casts' },
      camp: { id: 'star_fishing_camp_reach', name: 'Long Piers', desc: 'A Fishing Hut hands out work further away.', token: 'token_fishing_hut' } },
    { id: 'farming', name: 'Farming', tiers: [0, 1, 2], angle: 60,
      names: { xp: 'Farmer’s Almanac', yield: 'Bumper Crops', speed: 'Busy Hands' },
      token: { id: 'star_farming_refill', name: 'Orchard Care', desc: 'Bushes, fruit trees, the grapevine and the beehive refill sooner.',
               to: ['token_redberry_bush', 'token_blackberry_bush', 'token_blueberry_bush', 'token_strawberry_bush', 'token_apple_tree', 'token_cherry_tree', 'token_peach_tree', 'token_grapevine', 'token_beehive'].map(value => ({ mode: 'id', value })) },
      camp: { id: 'star_farming_camp_reach', name: 'Wide Fields', desc: 'A Farmstead hands out work further away.', token: 'token_farmstead' } },
    { id: 'cooking', name: 'Cooking', tiers: [0, 1, 2], angle: 122,
      names: { xp: 'Family Recipes', yield: 'Generous Portions', speed: 'Hot Stoves' } },
    { id: 'crafting', name: 'Crafting', tiers: [0, 1, 2], angle: 155,
      names: { xp: 'Pattern Book', yield: 'Thrifty Cuts', speed: 'Nimble Fingers' } },
    { id: 'construction', name: 'Construction', tiers: [0, 2], xpTiers: [0, 2], angle: -155,
      names: { xp: 'Builder’s Lore', yield: null, speed: 'Swift Builders' } },
    { id: 'alchemy', name: 'Alchemy', tiers: [2], angle: -122,
      names: { xp: 'Alchemist’s Notes', yield: 'Strong Brews', speed: 'Steady Stills' },
      token: { id: 'star_alchemy_herb_refill', name: 'Wild Herbs', desc: 'Wild Lavender refills sooner.', to: [{ mode: 'id', value: 'token_wild_lavender' }] } }
];

// The Well's basic outputs: item, its tier, per-lap step (about a quarter of one hero's Bare rate a rank).
export const WELL = [
    { item: 'item_oak_wood', name: 'Oak Wood', title: 'Woodpile', tiers: range(0, 2), at: { x: -0.25, y: 1.0 }, links: ['wishing_well'], tag: 'left' },
    { item: 'item_copper_ore', name: 'Copper Ore', title: 'Copper Spring', tiers: range(0, 2), at: { x: 0.25, y: 1.0 }, links: ['wishing_well'], tag: 'right' },
    { item: 'item_stone', name: 'Stone', title: 'Rubble Heap', tiers: range(0, 2), at: { x: -0.25, y: 1.3 }, links: ['star_well_oak_wood'], tag: 'left' },
    { item: 'item_coal', name: 'Coal', title: 'Coal Seam', tiers: range(0, 2), at: { x: 0.25, y: 1.3 }, links: ['star_well_copper_ore'], tag: 'right' },
    { item: 'item_raw_shrimp', name: 'Raw Shrimp', title: 'Shrimp Pool', tiers: range(0, 2), at: { x: -0.25, y: 1.6 }, links: ['star_well_stone'], tag: 'left' },
    { item: 'item_iron_ore', name: 'Iron Ore', title: 'Iron Spring', tiers: [2], at: { x: 0.25, y: 1.6 }, links: ['star_well_coal'], tag: 'right' },
    { item: 'item_fir_wood', name: 'Fir Wood', title: 'Fir Woodpile', tiers: [2], at: { x: -0.25, y: 1.9 }, links: ['star_well_raw_shrimp'], tag: 'left' }
];

export const HEARTH = [
    { id: 'star_infirmary', name: 'Infirmary', desc: 'A wounded hero recovers sooner.', tiers: range(0, 2), at: { x: 0.28, y: -0.98 }, links: ['roster_size'], tag: 'right', kind: 'wound' },
    { id: 'star_larder', name: 'Larder', desc: 'Every hero may carry a second Food.', tiers: [1], at: { x: -0.28, y: -0.98 }, links: ['roster_size'], tag: 'left', kind: 'food' },
    { id: 'star_trinket_case', name: 'Trinket Case', desc: 'Every hero may wear one more Trinket.', tiers: [2], at: { x: 0, y: -1.25 }, links: ['star_larder', 'star_infirmary'], tag: 'above', kind: 'trinket' }
];
