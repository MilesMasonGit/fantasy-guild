// FS — Fishing spots (brief 850 F1). The first scenario that fishes.
//
// Water is ground: the Region stands on a stored terrain map with a sea along its foot and a lake up
// on its left (`src/tests/fixtures/fishingWater.js`, the map the spot tests use), and fishing spots
// arrive on it by themselves, are fished, move on by chance after a catch or drift off unworked,
// and arrive again. Two Fishing Huts (camps), one by the sea and one by the lake, keep four heroes
// on whichever spots are in their reach; a hero whose spot left walks to the next.
//
// What it exercises each tick: `FishingSpots.tick` (each kind's clock; a landing's darts and
// placement test), the place-filtered catch pools (`GroundRules.placeAt`, `catchPools.poolsAt`)
// through `Flags` and `WorkCheck` for every fisher, the catch and its bait, the move-on roll, and
// the `spot_unworked` timed change. Rods and bait are bench items; the catch is bench fish.
//
// The mat is pinned to the 1920 × 1040 the water map was drawn for. Its types are registered here,
// in this scenario's own process, so no other scenario's content or work changes.

import { GameState } from '../../src/state/GameState.js';
import * as EquipmentManager from '../../src/systems/equipment/EquipmentManager.js';
import { registerTokenTypes } from '../../src/config/registries/tokenRegistry.js';
import { registerItems } from '../../src/config/registries/itemRegistry.js';
import { standOnWater } from '../../src/tests/fixtures/fishingWater.js';

const MAT_STEPS = 12;
const MAT_ASPECT = 1040 / 1920;

const fish = (id, name) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' });

registerItems({
    bench_trout: fish('bench_trout', 'Bench Trout'),
    bench_cod: fish('bench_cod', 'Bench Cod'),
    bench_oyster: fish('bench_oyster', 'Bench Oyster'),
    bench_bait: { id: 'bench_bait', name: 'Bench Bait', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    bench_rod: {
        id: 'bench_rod', name: 'Bench Rod', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood',
        tool: { kind: 'fishing_rod', tier: 1 }
    }
});

const WORK = { skill: 'fishing', skillRequired: 1, cycleTimeMs: 4000, xp: 2, inputs: [], outputs: [] };
const rodPool = (catches, tags = {}) => ({ tool: 'fishing_rod', bait: 'bench_bait', catches, ...tags });

registerTokenTypes({
    /** The plain spot: its catch by the water it sits on. */
    bench_spot: {
        id: 'bench_spot', name: 'Bench Fishing Spot', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        sprite: 't_fish_spot', uses: null, requiresHero: true, standsOn: ['water'], staysPut: true, config: { ...WORK },
        spot: { water: ['sea', 'fresh'], everyMinutes: 0.5, most: 6, leaveChance: 10, unworkedMinutes: 3 },
        catchPools: [
            rodPool([{ itemId: 'bench_trout', weight: 3 }, { itemId: 'bench_cod', weight: 1 }], { water: ['fresh'] }),
            rodPool([{ itemId: 'bench_cod', weight: 3 }, { itemId: 'bench_oyster', weight: 1 }], { water: ['sea'], biomes: ['coast'] }),
            rodPool([{ itemId: 'bench_cod', weight: 1 }], { water: ['sea'] })
        ]
    },
    /** A rare kind: the warm sea only, a fixed catch. */
    bench_rare_spot: {
        id: 'bench_rare_spot', name: 'Bench Oyster Bed', tokenType: 'resource', rarity: 'rare', theme: 'fixture',
        sprite: 't_fish_spot', uses: null, requiresHero: true, standsOn: ['water'], staysPut: true, config: { ...WORK },
        spot: { water: ['sea'], biomes: ['coast'], everyMinutes: 3, most: 1, leaveChance: 5, unworkedMinutes: 5 },
        catchPools: [rodPool([{ itemId: 'bench_oyster', weight: 1 }])]
    },
    /** A Fishing Hut: its heroes work the fishing Tokens in its reach, one each. */
    bench_fishing_hut: {
        id: 'bench_fishing_hut', name: 'Bench Fishing Hut', tokenType: 'camp', rarity: 'common', theme: 'fixture',
        sprite: 't_market_fish', uses: null, requiresHero: false, camp: { skill: 'fishing' }
    }
});

/** By the sea, and by the lake: dry points, each with water in its reach. */
const HUT_BY_SEA = { x: 960, y: 740 };
const HUT_BY_LAKE = { x: 640, y: 360 };

export default {
    id: 'FS',
    name: 'Fishing spots',
    ticks: () => ({ warmup: 3000, measure: 3000 }),
    build({ fixtures, setMatTuning }) {
        const { placeAt, makeHeroes, orderAt, inventory } = fixtures;
        setMatTuning('matSteps', MAT_STEPS);
        setMatTuning('matAspect', MAT_ASPECT);
        standOnWater({ biome: { coast: 1 } });

        placeAt('bench_hall', 1500, 520);
        placeAt('bench_fishing_hut', HUT_BY_SEA.x, HUT_BY_SEA.y);
        placeAt('bench_fishing_hut', HUT_BY_LAKE.x, HUT_BY_LAKE.y);

        GameState.state.inventory.maxSlots = 64;
        inventory.addItem('bench_rod', 4);
        inventory.addItem('bench_bait', 100000);

        const heroes = makeHeroes(4, { fishing: 30 });
        heroes.forEach((hero, i) => {
            EquipmentManager.equipItem(hero.id, 'bench_rod');
            EquipmentManager.equipItem(hero.id, 'bench_bait');
            orderAt(hero.id, i < 2 ? HUT_BY_SEA : HUT_BY_LAKE);
        });
    }
};
