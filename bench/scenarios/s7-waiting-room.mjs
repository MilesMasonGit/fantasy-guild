// S7 — Waiting for room (CR3-201, round 3 review R3). Z §4 Wave 3 step 4.
//
// Everything that has to wait for room on the mat re-runs its placement
// search every tick until room appears (R3 CR3-201). No other scenario has
// anything waiting, so none of them can see that cost. This board has two:
//
//   * a Forest under its family cap with nowhere for a tree to land: every
//     tick its clock is held full and `SpawnerSystem.attemptSpawn` searches
//     (`EffectActions.spawn` → `MatPlacement.findSpot`, then `forceSpot`,
//     which tries a push and then a 640 u fallback search);
//   * a Foundation, worked by a hero, building a 2×2 station that has no room
//     to stand: `Foundations.hasRoomToBuild` → `forceSpot` every tick.
//
// The mat is the 8-step one, packed with placed passives on a 120 u lattice
// (placed Tokens cannot be pushed by a spawn or a build, SP-68), with the
// holes filled until not even a tree fits anywhere. The passives keep the rest
// of the engine ticking (cycles, loot, the Bank) as background.
//
// Its types and its one recipe are registered here, in this scenario's own
// process (each run is a fresh Node process), so no other scenario's content
// — or work — changes.

import * as BoardState from '../../src/systems/board/BoardState.js';
import * as MatPlacement from '../../src/systems/board/MatPlacement.js';
import * as StationRecipe from '../../src/systems/board/StationRecipe.js';
import { registerTokenTypes } from '../../src/config/registries/tokenRegistry.js';
import { registerRecipePools } from '../../src/config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../../src/systems/effects/statements.js';

const MAT_STEPS = 8;
const STEP = 120;
const MARGIN = 64;

registerTokenTypes({
    /** A Foundation (Token Lifecycle 6.1) that builds the 2×2 station below. */
    bench_foundation: {
        id: 'bench_foundation', name: 'Bench Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        sprite: 'skill_industry', foundation: { kind: 'bench_stone', skill: 'construction' }
    },
    /** What it builds: a 2×2 station — too big for any gap on this mat. */
    bench_big_station: {
        id: 'bench_big_station', name: 'Bench Big Station', tokenType: 'station', rarity: 'common',
        theme: 'fixture', uses: 100, size: 2, sprite: 'skill_industry',
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_bench_big_station', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    }
});

registerRecipePools({
    construction: [{
        id: 'bench_build_big_station', name: 'Build Big Station', levelRequirement: 1,
        foundationKinds: ['bench_stone'],
        inputs: [{ itemId: 'item_coal', quantity: 1 }],
        outputs: [{ tokenId: 'bench_big_station', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 3000, xp: 10
    }]
});

export default {
    id: 'S7',
    name: 'Waiting for room',
    ticks: () => ({ warmup: 300, measure: 1500 }),
    build({ fixtures, setMatTuning }) {
        const { placeAt, lattice, makeHeroes, plant } = fixtures;
        setMatTuning('matSteps', MAT_STEPS);
        // ⚠️ The packed mat is over the game's Token cap (80); lifted, or the spawner would wait on
        // the cap and never run the no-room search this scenario measures.
        setMatTuning('tokenCap', 2000);
        const w = MAT_STEPS * 160;
        const h = Math.round(w * 0.64);

        placeAt('bench_hall', 80 + 160 * 3, 80 + 160 * 2);

        const points = lattice(w, h, STEP, MARGIN);
        const forestAt = points[Math.floor(points.length / 2) + 2];
        const foundationAt = points[Math.floor(points.length / 4) + 1];
        for (const p of points) {
            if (p === forestAt || p === foundationAt) continue;
            if (MatPlacement.isLegal('fixture_passive', p)) placeAt('fixture_passive', p.x, p.y);
        }
        const forest = placeAt('bench_forest', forestAt.x, forestAt.y);
        const foundation = placeAt('bench_foundation', foundationAt.x, foundationAt.y);

        // Fill every hole a tree could still use within reach of either of
        // them: the spawn's and the build's fallback search looks 640 u out
        // (`ARRIVAL_FALLBACK_REACH`) from a point beside the bearer.
        const REACH = 800;
        for (const from of [forestAt, foundationAt]) {
            for (let spot; (spot = MatPlacement.findSpot('bench_tree', from, { reach: REACH }));) {
                placeAt('fixture_passive', spot.x, spot.y);
            }
        }
        if (!forest || !foundation || MatPlacement.findSpot('bench_tree', forestAt, { reach: REACH })) {
            throw new Error('S7: the mat still has room, so nothing would wait');
        }

        // The Foundation: its build picked, coal in the Bank, a builder pinned to it.
        StationRecipe.setSelectedRecipe(BoardState.getTokenById(foundation.id), 'bench_build_big_station');
        fixtures.inventory.addItem('item_coal', 10, 'bench');
        const [builder] = makeHeroes(1, { construction: 50 });
        plant(builder.id, { x: foundation.x, y: foundation.y }, { pin: true });
    }
};
