// S1 — Quiet Hall: the floor. The Guild Hall, one hero, five Tokens.
//
// What an early game looks like: nothing crowded, one hero walking between a
// few producers beside the Hall. Any cost here is cost every player pays.

export default {
    id: 'S1',
    name: 'Quiet Hall',
    ticks: () => ({ warmup: 2000, measure: 5000 }),

    build({ fixtures }) {
        const { placeAt, makeHeroes, plant } = fixtures;
        // The shipped 11-step mat is 1760 × 1126; the Hall stands in the middle.
        placeAt('bench_hall', 880, 563);
        placeAt('fixture_producer', 560, 563);
        placeAt('fixture_producer', 560, 403);
        placeAt('fixture_producer_alt', 400, 563);
        placeAt('fixture_producer_alt', 560, 723);
        placeAt('bench_mill', 1200, 563);

        const [hero] = makeHeroes(1);
        plant(hero.id, { x: 560, y: 563 });
    }
};
