// What S8, S8L and S8F share: S2, warmed up as S2 is, saved and loaded the way a player's slot is,
// then one game-hour played three ways. Not a scenario itself.
//
//   S8   the game's catch-up (`CatchUp.run`), as on load: 1000 ms steps, the game clock, the bus
//        quiet, toasts and sounds off, slices with yields. The bench's virtual wall clock stands
//        still through it, as the real one nearly does.
//   S8L  the same hour as 3,600 plain `GameLoop.runHandlers(1000)`, the virtual clock moving with
//        each step, as live play's would.
//   S8F  the same hour at today's 100 ms ticks: the reference for the fidelity check.
//
// `run.mjs` fails with WORK CHANGED unless S8 and S8L end identically (the catch-up mode itself
// changes nothing), and unless S8L's production is within 1 % of S8F's (1000 ms steps play like
// 100 ms ticks). Their fingerprints leave the wall-clock time out of ids (`stableIds`): a Token or
// loot id carries the real time it was made at, which differs by design.

import { GameState } from '../../src/state/GameState.js';
import { EventBus } from '../../src/systems/core/EventBus.js';
import { GameLoop } from '../../src/systems/core/GameLoop.js';
import { DiscoveryManager } from '../../src/systems/core/DiscoveryManager.js';
import { AudioSystem } from '../../src/systems/core/AudioSystem.js';
import { InventoryManager } from '../../src/systems/inventory/InventoryManager.js';
import { migrateState } from '../../src/systems/core/SaveMigration.js';
import { validateSaveData } from '../../src/state/StateSchema.js';
import { ENGINE_EVENTS } from '../../src/systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../src/systems/board/boardEvents.js';
import { buildRealistic } from './realistic.mjs';

export const HOUR_MS = 3_600_000;
const WARMUP_TICKS = 1000;

export const FINGERPRINT = { stableIds: true };

function totals() {
    const s = GameState.state;
    let bankItems = 0;
    for (const entry of Object.values(s.inventory?.items || {})) bankItems += Number(entry?.quantity) || 0;
    let heroXp = 0;
    for (const hero of s.heroes || []) {
        for (const skill of Object.values(hero.skills || {})) heroXp += Number(skill?.xp) || 0;
    }
    return { bankItems, heroXp };
}

export function build(ctx) {
    buildRealistic(ctx);
}

/**
 * Warm up, save, load, then `play(savedAt)` one game-hour. Returns what the hour produced (for the
 * fidelity check), the wall time of `play` alone, and the counts that join the fingerprint.
 */
export async function hourAfterLoad(ctx, play) {
    ctx.runTicks(WARMUP_TICKS);

    // Saved and loaded as `SaveManager.save` / `loadSlot` and `onSlotSelected` do.
    const data = JSON.parse(GameState.serializeJson());
    const state = migrateState(data.state, data.version);
    const check = validateSaveData({ version: data.version, state });
    if (!check.valid) throw new Error(`the S2 save does not load: ${check.errors.join('; ')}`);
    await GameState.initFromSave(state);
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    DiscoveryManager.init();
    AudioSystem.init();
    InventoryManager.init();

    let cycles = 0;
    let depleted = 0;
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => { cycles++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => { depleted++; })
    ];
    const before = totals();
    const t0 = ctx.now();
    const steps = await play(data.savedAt);
    const runMs = ctx.now() - t0;
    offs.forEach(off => off());
    const after = totals();

    return {
        runMs,
        steps,
        gains: {
            bankItems: after.bankItems - before.bankItems,
            heroXp: Math.round(after.heroXp - before.heroXp),
            cycles,
            depleted
        },
        identity: { cycles, depleted, steps, gameTimeMs: GameState.state.time.gameTimeMs }
    };
}

/** Plain steps through the tick handlers, the virtual wall clock moving with each, as live. */
export function plainSteps(stepMs) {
    const clock = globalThis.__bench.clock;
    for (let played = 0; played < HOUR_MS; played += stepMs) {
        clock.advance(stepMs);
        GameLoop.runHandlers(stepMs);
    }
    return HOUR_MS / stepMs;
}
