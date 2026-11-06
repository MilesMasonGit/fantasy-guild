// The QA fixture's ring stars: the Guild Hall stars of the ring stars' change pack
// (`2026-11-06-ring-stars`), so a dev build can show the world map's locked rings before the pack
// is synced. ⚠️ A fixture, gone on reload; never written to `data/`. Mirrors the pack: when the
// owner changes the stars in the CMS, the synced ones win (`installRingStars` adds none then).

const star = (id, name, x, links, opensRing, tier, itemId, quantity, description) => ({
    id, constellation: 'compass', name, description, node: { x, y: -0.2 }, links, opensRing,
    ranks: [{ tier, price: [{ itemId, quantity }], rules: [], lines: [] }]
});

/** The pack's constellation and its five ring stars, in the file's shape. */
export function qaRingStarSky() {
    return {
        constellations: { compass: { id: 'compass', name: 'The Compass', label: { x: -1.86, y: 0.12 } } },
        stars: {
            star_ring_2: star('star_ring_2', 'Charted Roads', -0.98, ['hall'], 2, 1, 'item_cherry', 1700,
                'The guild charts the roads past its first borders: the next lands of the world map can be settled.'),
            star_ring_3: star('star_ring_3', 'Far Horizons', -1.42, ['star_ring_2'], 3, 2, 'item_trout', 12000,
                'The guild looks further out: the next lands of the world map can be settled.'),
            star_ring_4: star('star_ring_4', 'The Wilds', -1.86, ['star_ring_3'], 4, 3, 'item_watermelon', 110000,
                'Past the charted lands lie the wilds: the next lands of the world map can be settled.'),
            star_ring_5: star('star_ring_5', 'Untamed Reaches', -2.3, ['star_ring_4'], 5, 3, 'item_watermelon', 160000,
                'Deeper into the wilds: the next lands of the world map can be settled.'),
            star_ring_6: star('star_ring_6', "World's Edge", -2.74, ['star_ring_5'], 6, 3, 'item_watermelon', 230000,
                'To the edge of the world: the last lands of the world map can be settled.')
        }
    };
}
