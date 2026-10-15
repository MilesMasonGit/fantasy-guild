// Fantasy Guild bench — the ground's screen pass (terrain roadmap B3).
//
// Vitest `bench` in the node environment (bench/micro/vitest.config.mjs). Run alone with
//   npx vitest bench --config bench/micro/vitest.config.mjs --run bench/micro/groundScreen.bench.js
//
// The Forest + Coast dev Region's plan, resampled onto the screen's ground pixels at the fits that
// matter: 0.74 (art step 1, the most pixels: about 1.09 M), 0.8 (about the bench's 1600 × 1000
// window) and 1 (the plan's own grid). Sheets are flat stand-ins of the real size; the pass reads
// them the same way. Its bar: 15 ms at 1×. Not the browser (T2 marks it there).

import { bench, describe } from 'vitest';
import { budget } from '../../src/systems/atlas/Budget.js';
import { layout } from '../../src/systems/atlas/Layout.js';
import { layoutOptions, shippedMat } from '../../src/systems/atlas/layoutInputs.js';
import { DEV_MAPS } from '../../src/systems/atlas/devMaps.js';
import { seedFromText } from '../../src/systems/atlas/seededRandom.js';
import { regionGround } from '../../src/systems/atlas/regionGround.js';
import { buildGroundPlan } from '../../src/systems/board/TerrainSurface.js';
import { buildScreenPass, screenGrid } from '../../src/ui/components/board/groundScreen.js';

const steps = (fit) => Math.max(1, Math.round(2 * fit));
const unitAt = (fit) => steps(fit) / fit;

const summary = budget(['forest', 'coast'].map(n => DEV_MAPS[n]), { cap: 128 });
const seed = seedFromText('bench-Forest + Coast');
const result = layout(summary, layoutOptions(summary, seed));
const mat = shippedMat();
const plan = buildGroundPlan(regionGround({ seed, ground: summary.ground, terrain: result.terrain }, mat));

const sheet = new Uint8ClampedArray(64 * 64 * 4);
for (let i = 0; i < sheet.length; i += 4) { sheet[i] = (i * 7) & 255; sheet[i + 1] = (i * 3) & 255; sheet[i + 2] = 90; sheet[i + 3] = 255; }
const prop = new Uint8ClampedArray(64 * 64 * 4);
for (let i = 0; i < prop.length; i += 4) { prop[i] = 200; prop[i + 3] = (i / 4) % 3 ? 255 : 0; }
const options = (fit, out) => ({ mat, unit: unitAt(fit), sheet: () => sheet, prop: () => prop, out });

// The first pass of a cold module, once, before the loops warm anything.
{
    const t0 = performance.now();
    const pass = buildScreenPass(plan, options(0.74));
    console.log(`Forest + Coast at fit 0.74: ${pass.cols} × ${pass.rows} ground pixels, ${plan.props.length} props; first pass ${(performance.now() - t0).toFixed(1)} ms`);
}

describe('screen pass, Forest + Coast, shipped mat', () => {
    for (const fit of [0.74, 0.8, 1]) {
        const grid = screenGrid(mat, unitAt(fit));
        const out = new Uint8ClampedArray(grid.cols * grid.rows * 4);
        bench(`fit ${fit} (${grid.cols} × ${grid.rows})`, () => {
            buildScreenPass(plan, options(fit, out));
        }, { time: 2000, warmupTime: 200 });
    }
});
