// Fantasy Guild bench — the ground plan's build time (terrain roadmap B3).
//
// Vitest `bench` in the node environment (bench/micro/vitest.config.mjs). Run alone with
//   npx vitest bench --config bench/micro/vitest.config.mjs --run bench/micro/groundPlan.bench.js
//
// The plan of the Forest + Coast dev Region (the costliest of the three hybrids) on the shipped
// mat, laid out the way settle lays it out (`layoutOptions`, the dev recipes, a Token cap of 128).
// Its bar: 60 ms at 1×. The first build of a cold module is printed too: a travel builds once.
// Not the browser, and not the screen pass (T2 measures both with performance marks).

import { bench, describe } from 'vitest';
import { budget } from '../../src/systems/atlas/Budget.js';
import { layout } from '../../src/systems/atlas/Layout.js';
import { layoutOptions, shippedMat } from '../../src/systems/atlas/layoutInputs.js';
import { DEV_MAPS } from '../../src/systems/atlas/devMaps.js';
import { seedFromText } from '../../src/systems/atlas/seededRandom.js';
import { regionGround } from '../../src/systems/atlas/regionGround.js';
import { buildGroundPlan } from '../../src/systems/board/TerrainSurface.js';

const RECIPES = {
    'Forest + Coast': ['forest', 'coast'],
    'Mountain + Coast': ['mountain', 'coast'],
    'Forest + Mountain': ['forest', 'mountain']
};

function region(names, seedText) {
    const summary = budget(names.map(n => DEV_MAPS[n]), { cap: 128 });
    const seed = seedFromText(seedText);
    const result = layout(summary, layoutOptions(summary, seed));
    return { seed, ground: summary.ground, terrain: result.terrain };
}

const mat = shippedMat();
const regions = Object.fromEntries(Object.entries(RECIPES).map(([label, names]) => [label, region(names, `bench-${label}`)]));

// The cold build, once, before the loops warm anything.
{
    const r = regions['Forest + Coast'];
    const t0 = performance.now();
    const plan = buildGroundPlan(regionGround(r, mat));
    const ms = performance.now() - t0;
    const counts = {};
    for (const ch of r.terrain.cells) {
        const t = r.terrain.legend[parseInt(ch, 36)];
        counts[t] = (counts[t] || 0) + 1;
    }
    console.log(`Forest + Coast: ${plan.width} × ${plan.height} plan, cells ${JSON.stringify(counts)}, ${plan.props.length} props; first build ${ms.toFixed(1)} ms`);
}

describe('ground plan, shipped mat', () => {
    for (const [label, r] of Object.entries(regions)) {
        bench(label, () => {
            buildGroundPlan(regionGround(r, mat));
        }, { time: 2000, warmupTime: 200 });
    }
});
