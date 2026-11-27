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
//
// ⚠️ The hour is played without the shipped skill perks (`withoutShippedPerks`, as the tests do). A
// perk that rolls (Forestry's Double Loot) makes the Bank a dice roll, and steps and ticks never draw
// the same dice, so its luck reads as a step-size difference: up to 1.6 % on seeds 1 to 5, one seed
// in six outside the gate's 1 %. Perks are content too: a CMS edit of one would move this work.

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
import * as MatResize from '../../src/systems/board/MatResize.js';
import { loadSavedState } from '../../src/systems/core/LoadedState.js';
import { withoutShippedPerks } from '../../src/tests/fixtures/noPerks.js';
import { buildRealistic } from './realistic.mjs';

export const HOUR_MS = 3_600_000;
const WARMUP_TICKS = 1000;

export const FINGERPRINT = { stableIds: true };

function totals() {
    const s = GameState.state;
    let bankItems = 0;
    const byItem = {};
    for (const [itemId, entry] of Object.entries(s.inventory?.items || {})) {
        const quantity = Number(entry?.quantity) || 0;
        bankItems += quantity;
        byItem[itemId] = quantity;
    }
    let heroXp = 0;
    for (const hero of s.heroes || []) {
        for (const skill of Object.values(hero.skills || {})) heroXp += Number(skill?.xp) || 0;
    }
    return { bankItems, heroXp, byItem };
}

export function build(ctx) {
    // Before the heroes are made, so none ever holds one.
    withoutShippedPerks();
    buildRealistic(ctx);
}

/**
 * Warm up, save, load, then `play(savedAt)` one game-hour. Returns what the hour produced (for the
 * fidelity check), the wall time of `play` alone, and the counts that join the fingerprint.
 */
export async function hourAfterLoad(ctx, play) {
    ctx.runTicks(WARMUP_TICKS);
    // ⚠️ The warm-up has S2's two hunters fight their camps' prefilled goblins back to back, which
    // leaves them at 5–9 HP of 35. A run of bad rolls then knocks one out, its order ends and half the
    // hour's kills go with it, in whichever of S8, S8L and S8F the dice fall that way. They start whole.
    for (const hero of GameState.state.heroes || []) if (hero.hp) hero.hp.current = hero.hp.max;

    // Saved and loaded as `SaveManager.save` / `loadSlot` and `onSlotSelected` do.
    const data = JSON.parse(GameState.serializeJson());
    const state = migrateState(data.state, data.version);
    const check = validateSaveData({ version: data.version, state });
    if (!check.valid) throw new Error(`the S2 save does not load: ${check.errors.join('; ')}`);
    loadSavedState(state);
    MatResize.fitToMat();
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    DiscoveryManager.init();
    AudioSystem.init();
    InventoryManager.init();

    let cycles = 0;
    let depleted = 0;
    let kills = 0;
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => { cycles++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => { depleted++; }),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p?.outcome === 'victory') kills++; })
    ];
    const before = totals();
    const t0 = ctx.now();
    const steps = await play(data.savedAt);
    const runMs = ctx.now() - t0;
    offs.forEach(off => off());
    const after = totals();
    const bankByItem = {};
    for (const itemId of new Set([...Object.keys(before.byItem), ...Object.keys(after.byItem)])) {
        const gain = (after.byItem[itemId] || 0) - (before.byItem[itemId] || 0);
        if (gain) bankByItem[itemId] = gain;
    }

    return {
        runMs,
        steps,
        gains: {
            bankItems: after.bankItems - before.bankItems,
            heroXp: Math.round(after.heroXp - before.heroXp),
            cycles,
            depleted,
            kills
        },
        bankByItem,
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
