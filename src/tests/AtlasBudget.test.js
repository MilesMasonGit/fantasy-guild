import { describe as group, it, expect } from 'vitest';
import {
    budget, describe as describeBudget, nodeLimit, buildReserve, apportion,
    BUILD_RESERVE_SHARE, ROLE
} from '../systems/atlas/Budget.js';
import { FOREST, MOUNTAIN, COAST, OVERGROWN_FOREST, withGoblinCamp, withRuins } from './fixtures/atlasMaps.js';

/**
 * The generation engine's first half: map ingredients → how many of each Token a Region gets.
 * Synthetic ids where the arithmetic is the point, so content can be retuned freely.
 */

const base = (id, points, nodes, extra = {}) => ({ id, kind: 'base', biome: id, points, nodes, ...extra });

/** `{ typeId: count }` for one role. */
function countsOf(summary, role = ROLE.NODE) {
    const out = {};
    for (const e of summary.entries) if (e.role === role) out[e.typeId] = e.count;
    return out;
}

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
}

const CAP = 128;

group('the node budget', () => {
    group('is a pure function of the ingredients', () => {
        it('the same ingredients give the same budget, and the ingredients are not touched', () => {
            const ingredients = deepFreeze([structuredClone(FOREST), structuredClone(withGoblinCamp(MOUNTAIN))]);
            const a = budget(ingredients, { cap: CAP });
            const b = budget(ingredients, { cap: CAP });
            expect(a).toEqual(b);
            expect(a).not.toBe(b);
        });

        it('slot order does not matter', () => {
            const camped = withGoblinCamp(FOREST);
            const ruined = withRuins(MOUNTAIN);
            const slots = [camped, ruined, COAST];
            const reference = budget(slots, { cap: CAP });
            const orders = [[COAST, ruined, camped], [ruined, camped, COAST], [ruined, COAST, camped]];
            for (const order of orders) expect(budget(order, { cap: CAP })).toEqual(reference);
        });

        it('takes no seed, so a reroll cannot change it', () => {
            const slots = [FOREST, MOUNTAIN];
            const plain = budget(slots, { cap: CAP });
            expect(budget(slots, { cap: CAP, seed: 1 })).toEqual(plain);
            expect(budget(slots, { cap: CAP, seed: 987654 })).toEqual(plain);
            expect(JSON.stringify(plain)).not.toMatch(/seed/);
        });

        it('needs the cap given explicitly', () => {
            expect(() => budget([FOREST])).toThrow(/cap/);
            expect(() => budget([FOREST], { cap: Number.NaN })).toThrow(/cap/);
        });
    });

    group('a Base Map', () => {
        it('writes its points as nodes, split by its weights', () => {
            const summary = budget([base('forest', 40, [
                { typeId: 'oak', weight: 6 }, { typeId: 'redberry', weight: 1 }, { typeId: 'blackberry', weight: 1 }
            ])], { cap: CAP });
            expect(countsOf(summary)).toEqual({ oak: 30, redberry: 5, blackberry: 5 });
            expect(summary.total).toBe(40);
            expect(summary.clamped).toBe(false);
        });

        it('blends with another Base Map: each writes its share, so density stays the same', () => {
            const forest = base('forest', 40, [{ typeId: 'oak', weight: 1 }]);
            const mountain = base('mountain', 40, [{ typeId: 'copper', weight: 1 }]);
            expect(countsOf(budget([forest, mountain], { cap: CAP }))).toEqual({ oak: 20, copper: 20 });
            // Two of the same map make the same Region as one.
            expect(countsOf(budget([forest, forest], { cap: CAP }))).toEqual({ oak: 40 });
            // Two Forests and a Mountain lean two thirds forest.
            expect(countsOf(budget([forest, forest, mountain], { cap: CAP }))).toEqual({ oak: 27, copper: 13 });
        });

        it('brings its own camps and treasures, which a second copy does not double', () => {
            const jungle = base('jungle', 30, [{ typeId: 'oak', weight: 1 }], {
                camps: [{ typeId: 'den', count: 1 }],
                treasures: [{ typeId: 'ruins', count: 1 }]
            });
            const one = budget([jungle], { cap: CAP });
            const two = budget([jungle, jungle], { cap: CAP });
            expect(countsOf(one, ROLE.CAMP)).toEqual({ den: 1 });
            expect(countsOf(one, ROLE.TREASURE)).toEqual({ ruins: 1 });
            expect(countsOf(two, ROLE.CAMP)).toEqual({ den: 1 });
            expect(countsOf(two, ROLE.TREASURE)).toEqual({ ruins: 1 });
        });

        it('records biome weights for the terrain, one per Base Map slotted', () => {
            const forest = base('forest', 40, [{ typeId: 'oak', weight: 1 }], { biome: 'forest' });
            const mountain = base('mountain', 40, [{ typeId: 'copper', weight: 1 }], { biome: 'mountain' });
            expect(budget([forest, forest, mountain], { cap: CAP }).biomes).toEqual({ forest: 2, mountain: 1 });
        });
    });

    group('a recipe of another kind', () => {
        const forest = base('forest', 40, [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }]);

        it('is skipped and reported, not guessed at', () => {
            const summary = budget([forest, { id: 'leyline', kind: 'leyline' }], { cap: CAP });
            expect(countsOf(summary)).toEqual({ oak: 30, berry: 10 });
            expect(summary.ignored).toEqual([{ ingredientId: 'leyline', kind: 'leyline' }]);
        });

        it('a retired modifier changes nothing', () => {
            const modifier = { id: 'overgrown', kind: 'modifier', effects: [{ kind: 'density', typeId: 'oak', points: 16 }] };
            const summary = budget([forest, modifier], { cap: CAP });
            expect(countsOf(summary)).toEqual({ oak: 30, berry: 10 });
            expect(summary.ignored).toEqual([{ ingredientId: 'overgrown', kind: 'modifier' }]);
        });
    });

    group('counts by largest remainder', () => {
        it('hands out exactly the total, the biggest fractions first', () => {
            // 10 over thirds: 3.33 each, so one extra seat, to the first id.
            expect(apportion({ c: 1, a: 1, b: 1 }, 10)).toEqual({ a: 4, b: 3, c: 3 });
            // The classic case: 3.6 / 2.4 / 1.0 / 0.0 seats of 7 by 18:12:5:0.
            expect(apportion({ x: 18, y: 12, z: 5, w: 0 }, 7)).toEqual({ x: 4, y: 2, z: 1, w: 0 });
            expect(apportion({ x: 1 }, 0)).toEqual({ x: 0 });
            expect(apportion({}, 5)).toEqual({});
        });

        it('a budget\'s counts always sum to its total', () => {
            const odd = base('odd', 37, [
                { typeId: 'a', weight: 7 }, { typeId: 'b', weight: 5 }, { typeId: 'c', weight: 3 }, { typeId: 'd', weight: 1 }
            ]);
            const summary = budget([odd], { cap: CAP });
            const sum = summary.entries.reduce((n, e) => n + e.count, 0);
            expect(sum).toBe(summary.total);
            expect(summary.total).toBe(37);
        });
    });

    group('the Token cap', () => {
        it('keeps a reserve for building: half the cap', () => {
            expect(BUILD_RESERVE_SHARE).toBe(0.5);
            expect(buildReserve(128)).toBe(64);
            expect(nodeLimit(128)).toBe(64);
            expect(buildReserve(256)).toBe(128);
            expect(nodeLimit(256)).toBe(128);
            expect(nodeLimit(144)).toBe(72);
        });

        it('clamps the total to the cap less the reserve, trimming nodes in proportion', () => {
            const big = base('big', 120, [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }]);
            const at128 = budget([big], { cap: 128 });
            expect(at128.total).toBe(64);
            expect(at128.limit).toBe(64);
            expect(at128.wanted).toBe(120);
            expect(at128.clamped).toBe(true);
            expect(countsOf(at128)).toEqual({ oak: 48, berry: 16 });

            const at256 = budget([big], { cap: 256 });
            expect(at256.total).toBe(120);
            expect(at256.clamped).toBe(false);
        });

        it('keeps every camp and treasure when it trims, and takes their room from the nodes', () => {
            const big = base('big', 120, [{ typeId: 'oak', weight: 1 }], {
                camps: [{ typeId: 'goblin_camp', count: 2 }],
                treasures: [{ typeId: 'ruins', count: 1 }]
            });
            const summary = budget([big], { cap: 128 });
            expect(summary.total).toBe(64);
            expect(countsOf(summary, ROLE.CAMP)).toEqual({ goblin_camp: 2 });
            expect(countsOf(summary, ROLE.TREASURE)).toEqual({ ruins: 1 });
            expect(countsOf(summary)).toEqual({ oak: 61 });
        });

        it('trims even camps and treasures when they alone overflow a tiny cap', () => {
            const summary = budget([base('sites', 0, [], {
                camps: [{ typeId: 'goblin_camp', count: 5 }],
                treasures: [{ typeId: 'ruins', count: 5 }]
            })], { cap: 8 });
            expect(summary.total).toBe(4);
            expect(countsOf(summary, ROLE.CAMP)).toEqual({ goblin_camp: 2 });
            expect(countsOf(summary, ROLE.TREASURE)).toEqual({ ruins: 2 });
        });

        it('the sample Forest with Overgrown fits the base cap untrimmed', () => {
            const summary = budget([OVERGROWN_FOREST], { cap: 128 });
            expect(summary.clamped).toBe(false);
            expect(countsOf(summary)).toEqual({ token_oak_tree: 46, token_redberry_bush: 5, token_blackberry_bush: 5 });
        });
    });

    group('entries', () => {
        it('list nodes first (most first), then camps, then treasures, and drop zeros', () => {
            const summary = budget([
                base('b', 10, [{ typeId: 'few', weight: 1 }, { typeId: 'many', weight: 4 }, { typeId: 'none', weight: 0 }], {
                    treasures: [{ typeId: 'ruins' }],
                    camps: [{ typeId: 'den' }]
                })
            ], { cap: CAP });
            expect(summary.entries).toEqual([
                { typeId: 'many', role: ROLE.NODE, count: 8, biome: 'b' },
                { typeId: 'few', role: ROLE.NODE, count: 2, biome: 'b' },
                { typeId: 'den', role: ROLE.CAMP, count: 1, biome: null },
                { typeId: 'ruins', role: ROLE.TREASURE, count: 1, biome: null }
            ]);
        });

        it('an empty table writes nothing', () => {
            const summary = budget([], { cap: CAP });
            expect(summary.entries).toEqual([]);
            expect(summary.total).toBe(0);
            expect(summary.biomes).toEqual({});
        });
    });
});

group('biomes and ground', () => {
    const biomeOf = (summary, typeId) => summary.entries.find(e => e.typeId === typeId)?.biome;
    const forest = base('forest', 40, [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }], { biome: 'forest' });
    const mountain = base('mountain', 40, [{ typeId: 'copper', weight: 1 }, { typeId: 'stone', weight: 1 }], { biome: 'mountain' });
    const coast = base('coast', 20, [{ typeId: 'coast', weight: 1 }, { typeId: 'stone', weight: 1 }], { biome: 'coast' });

    it('each node carries the biome of the Base Map that writes it', () => {
        const summary = budget([forest, mountain], { cap: CAP });
        expect(biomeOf(summary, 'oak')).toBe('forest');
        expect(biomeOf(summary, 'copper')).toBe('mountain');
    });

    it('a node two maps write takes the biome that writes most of it', () => {
        // Stone: 10 from the Mountain's half, 5 from the Coast's half.
        expect(biomeOf(budget([mountain, coast], { cap: CAP }), 'stone')).toBe('mountain');
    });

    it('the main biome is the one writing the most nodes, not the one slotted first', () => {
        // One Forest (40) and one Coast (20): the Forest writes twice the nodes.
        expect(budget([coast, forest], { cap: CAP }).ground.main).toBe('forest');
        // Two Coasts and a Forest: 2 × 20/3 Coast nodes against 40/3 Forest ones.
        expect(budget([coast, coast, forest], { cap: CAP }).ground.main).toBe('coast');
    });

    it('camps and treasures take the ground where they land, so the budget gives them none', () => {
        const summary = budget([withRuins(withGoblinCamp(forest))], { cap: CAP });
        expect(summary.entries.filter(e => e.role !== ROLE.NODE).every(e => e.biome === null)).toBe(true);
    });

    it('says each biome\'s ground, and how much water the maps bring, blended like points', () => {
        const { water, ...rest } = budget([forest, mountain, coast], { cap: CAP }).ground;
        // The sea blends like points; the inland water is the main biome's (a forest's pond).
        // And each other biome its small water: the mountain a tarn, the Coast none (its sea is its share).
        expect(rest).toEqual({ main: 'forest', terrains: { coast: 'sand', forest: 'grass', mountain: 'rock' }, shore: ['coast'], inland: ['pond'], small: { mountain: 'tarn' } });
        expect(water).toBeCloseTo(0.1, 12);
        expect(budget([coast], { cap: CAP }).ground.water).toBe(0.3);
        expect(budget([coast], { cap: CAP }).ground.inland).toEqual([]);
        expect(budget([forest], { cap: CAP }).ground).toEqual({ main: 'forest', terrains: { forest: 'grass' }, water: 0, shore: [], inland: ['pond'], small: {} });
        expect(budget([mountain], { cap: CAP }).ground.inland).toEqual(['tarn', 'mountain_river']);
    });

    it('a Base Map may name its own ground and water', () => {
        const marsh = base('marsh', 20, [{ typeId: 'reed', weight: 1 }], { biome: 'marsh', terrain: 'mud', water: 0.2 });
        expect(budget([marsh], { cap: CAP }).ground).toEqual({ main: 'marsh', terrains: { marsh: 'mud' }, water: 0.2, shore: ['marsh'], inland: [], small: {} });
        // And one variety of inland water, which a biome's own rules would pick among.
        expect(budget([{ ...marsh, inland: 'lake' }], { cap: CAP }).ground.inland).toEqual(['lake']);
        expect(budget([{ ...marsh, inland: 'whirlpool' }], { cap: CAP }).ground.inland).toEqual([]);
        // An unknown biome with no ground of its own is grass, and dry.
        expect(budget([base('plains', 10, [{ typeId: 'tuft', weight: 1 }])], { cap: CAP }).ground.terrains).toEqual({ plains: 'grass' });
    });
});

group('describe(): the node summary in words', () => {
    const names = { oak: 'Oak Tree', berry: 'Redberry Bush', goblin_camp: 'Goblin Camp', ruins: 'Old Ruins' };
    const nameOf = (id) => names[id];

    it('one line per Token, with the count, grouped by role', () => {
        const summary = budget([
            base('forest', 40, [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }], {
                camps: [{ typeId: 'goblin_camp' }],
                treasures: [{ typeId: 'ruins' }]
            })
        ], { cap: CAP });
        const words = describeBudget(summary, { nameOf });
        expect(words.lines.map(l => l.text)).toEqual([
            '30 × Oak Tree', '10 × Redberry Bush', '1 × Goblin Camp', '1 × Old Ruins'
        ]);
        expect(words.lines.map(l => l.role)).toEqual([ROLE.NODE, ROLE.NODE, ROLE.CAMP, ROLE.TREASURE]);
        expect(words.headline).toBe('42 Tokens');
        expect(words.text.split('\n')[0]).toBe('42 Tokens');
    });

    it('says when the cap trimmed the map', () => {
        const summary = budget([base('big', 120, [{ typeId: 'oak', weight: 1 }])], { cap: 128 });
        const words = describeBudget(summary, { nameOf });
        expect(words.headline).toBe('64 Tokens (trimmed from 120 to fit the Token cap)');
    });

    it('takes the entries alone too, and names Tokens from the registry by default', () => {
        const words = describeBudget([{ typeId: 'token_oak_tree', role: ROLE.NODE, count: 3 }]);
        expect(words.lines[0].text).toMatch(/^3 × \S/);
        expect(words.lines[0].count).toBe(3);
    });
});
