// The ring stars the pack proposes: ids, names, places in the sky, links and tiers. Prices come
// from the ledger (price.mjs).
export const CONSTELLATION = {
    id: 'compass', name: 'The Compass', label: { x: -1.86, y: 0.12 }
};

// Names say nothing of ring numbers (owner: no ring numbers for the player).
export const RINGS = [
    { ring: 2, id: 'star_ring_2', name: 'Charted Roads', node: { x: -0.98, y: -0.2 }, tier: 1,
      description: 'The guild charts the roads past its first borders: the next lands of the world map can be settled.' },
    { ring: 3, id: 'star_ring_3', name: 'Far Horizons', node: { x: -1.42, y: -0.2 }, tier: 2,
      description: 'The guild looks further out: the next lands of the world map can be settled.' },
    { ring: 4, id: 'star_ring_4', name: 'Wild Lands', node: { x: -1.86, y: -0.2 }, tier: 3,
      description: 'Past the charted lands lie the wilds: the next lands of the world map can be settled.' },
    { ring: 5, id: 'star_ring_5', name: 'Untamed Reaches', node: { x: -2.3, y: -0.2 }, tier: 3,
      description: 'Deeper into the wilds: the next lands of the world map can be settled.' },
    { ring: 6, id: 'star_ring_6', name: 'Edge of the World', node: { x: -2.74, y: -0.2 }, tier: 3,
      description: 'To the edge of the world: the last lands of the world map can be settled.' },
];

export function skyWith(prices = {}) {
    const stars = {};
    RINGS.forEach((r, i) => {
        stars[r.id] = {
            id: r.id, constellation: CONSTELLATION.id, name: r.name, description: r.description, node: r.node,
            links: [i === 0 ? 'hall' : RINGS[i - 1].id], opensRing: r.ring,
            ranks: [{ tier: r.tier, price: prices[r.id] || [{ itemId: 'item_oak_wood', quantity: 1 }], rules: [], lines: [] }],
        };
    });
    return { constellations: { [CONSTELLATION.id]: { ...CONSTELLATION } }, stars };
}
