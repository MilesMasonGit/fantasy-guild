// The in-engine half of bench/catchup/time.mjs, loaded THROUGH Vite (same module instances as
// the bench). Boots like the bench, builds S2, then runs `GameLoop.runHandlers(stepMs)` with the
// virtual wall clock advanced by each step, timing only the steps (checkpoint work is excluded).

import { boot, announceReady } from '../lib/harness.mjs';
import * as fixtures from '../fixtures.mjs';
import { fingerprint } from '../lib/fingerprint.mjs';
import { buildRealistic } from '../scenarios/realistic.mjs';
import { setMatTuning } from '../../src/config/matTuning.js';
import { GameLoop } from '../../src/systems/core/GameLoop.js';
import { GameState } from '../../src/state/GameState.js';
import { EventBus } from '../../src/systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../src/systems/board/boardEvents.js';

const now = () => performance.now();

function heapMb() {
    if (typeof globalThis.gc === 'function') { globalThis.gc(); globalThis.gc(); }
    return process.memoryUsage().heapUsed / 1048576;
}

/**
 * How many listeners the ENGINE alone puts on each event: S2 booted headless, with no UI. The
 * in-page timing (page.mjs) uses it to estimate a catch-up with the UI's listeners muted.
 */
export function engineListenerCounts(seed = 1) {
    boot(seed);
    buildRealistic({ fixtures, setMatTuning });
    announceReady();
    return Object.fromEntries([...EventBus.subscribers].map(([name, set]) => [name, set.size]).filter(([, n]) => n > 0));
}

export async function run({ stepMs = 1000, checkpointsMin = [60], seed = 1, warmupTicks = 0 } = {}) {
    const t0 = now();
    boot(seed);
    buildRealistic({ fixtures, setMatTuning });
    announceReady();
    const buildMs = now() - t0;

    // Counting completed cycles is a subscriber that changes nothing in the game.
    let cycles = 0;
    EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => { cycles++; });

    const clock = globalThis.__bench.clock;
    for (let i = 0; i < warmupTicks; i++) { clock.advance(100); GameLoop.runHandlers(100); }

    const start = GameState.state.time.gameTimeMs;
    const checkpoints = [];
    let steps = 0;
    let runMs = 0;
    for (const minutes of checkpointsMin) {
        const target = start + minutes * 60_000;
        const segStart = now();
        while (GameState.state.time.gameTimeMs < target) {
            const delta = Math.min(stepMs, target - GameState.state.time.gameTimeMs);
            clock.advance(delta);
            GameLoop.runHandlers(delta);
            steps++;
        }
        runMs += now() - segStart;
        checkpoints.push({
            gameMin: minutes, steps, wallS: runMs / 1000, msPerStep: runMs / steps,
            cycles, census: fixtures.census(), fingerprint: fingerprint(), heapMb: heapMb()
        });
    }
    return { node: process.version, buildMs, checkpoints };
}
