// Fantasy Guild bench — what a player waits on at the world map: settling a place, and reading the map.
//
// Vitest `bench` in the node environment (bench/micro/vitest.config.mjs). Run alone with
//   npm run bench:micro -- bench/micro/atlasWorld.bench.js
//
// Times, on shipped content and a fresh game:
// - `Atlas.settle` on an empty Atlas (the first place) and on the same Atlas with five Regions
//   already settled (the sixth), each over several fresh worlds; the median and the range print.
// - `worldView()` on the fresh world (no Region) and on a world with six settled Regions (the whole
//   first ring, each on its own cell).
// Not the browser: the screen's own work is not in these numbers. Machine-specific, like every bench.

import { bench, describe, vi } from 'vitest';
import { GameState } from '../../src/state/GameState.js';
import { EngineBootstrap } from '../../src/systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../../src/systems/board/SpriteLayer.js';
import { InventoryManager } from '../../src/systems/inventory/InventoryManager.js';
import * as Atlas from '../../src/systems/atlas/Atlas.js';
import * as World from '../../src/systems/world/World.js';
import { DEV_MAPS } from '../../src/systems/atlas/devMaps.js';
import { worldView } from '../../src/ui/components/atlas/worldView.js';

vi.mock('../../src/systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

const SEED = 4242;
const WORLDS = 5;
const NAMES = Object.keys(DEV_MAPS);

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: SEED });
}

/** Settle two dev recipes (a hybrid place) on ring-1 cell number `k`; returns the milliseconds it took. */
function settleOn(k, seed) {
    const cell = World.currentWorld().cells.filter(c => c.ring === 1)[k];
    const recipes = [DEV_MAPS[NAMES[k % NAMES.length]], DEV_MAPS[NAMES[(k + 1) % NAMES.length]]];
    const t0 = performance.now();
    const result = Atlas.settle({ ingredients: recipes, seed, cellId: cell.id, allowUnplaced: true });
    const ms = performance.now() - t0;
    if (!result.success) throw new Error(`settle ${k} refused: ${result.reason}`);
    return ms;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const line = (label, xs) => console.log(`${label}: median ${median(xs).toFixed(1)} ms (${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}, ${xs.length} worlds)`);

// Settle: the first place on a fresh Atlas, and the sixth with five already there.
{
    const first = [];
    const sixth = [];
    for (let w = 0; w < WORLDS; w++) {
        newGame();
        first.push(settleOn(0, SEED + w));
        for (let k = 1; k < 5; k++) settleOn(k, SEED + w + k);
        sixth.push(settleOn(5, SEED + w + 5));
    }
    line('Atlas.settle, first Region (empty Atlas)', first);
    line('Atlas.settle, sixth Region (five settled)', sixth);
}

// worldView: a fresh world, then the same world with the first ring settled.
newGame();
const fresh = [];
for (let i = 0; i < 20; i++) { const t0 = performance.now(); worldView(); fresh.push(performance.now() - t0); }
line('worldView(), fresh world (first call included)', fresh);
for (let k = 0; k < 6; k++) settleOn(k, SEED + k);
const six = [];
for (let i = 0; i < 20; i++) { const t0 = performance.now(); worldView(); six.push(performance.now() - t0); }
line('worldView(), six settled Regions (first call included)', six);

describe('world map', () => {
    bench('worldView(), six settled Regions', () => { worldView(); }, { time: 1000, warmupTime: 100 });
});
