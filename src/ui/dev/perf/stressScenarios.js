// Stress scenarios in the running game.
// ⚠️ DEV BUILDS ONLY: reached only through `perfHarness.js`, which is itself only ever
// imported behind `import.meta.env.DEV`.
// One copy of each scenario: the boards are the headless benchmark's (`bench/scenarios/`),
// imported as-is. Their builders only need `{ fixtures, setMatTuning }`, and
// `bench/fixtures.mjs` only imports game modules, so Vite serves both to the browser
// unchanged. Nothing here copies a layout: if S2 changes in the bench, it changes here too.
// (The bench's Node-only parts, its seeded clock, fake `localStorage` and harness, are NOT
// imported.)
// What starting one does to the player's things:
// * **Saves are never touched.** If a slot is loaded, it is saved once (the save autosave
// would have made), then the page is detached from it: no slot, no autosave, no save on
// unload. The stress board lives only in this tab.
// * **Settings and Mat Tuner values are not kept.** The Mat Tuner is reset to its shipped
// defaults (as the bench runs), the bench turns loot auto-collect on, and S3/S4 resize the
// mat; all of those write to `localStorage`. The keys are put back byte-for-byte after the
// build, so the change lasts for this page only. Reload to get your own back.
// * **`data/*.json` is never read or written for this.** Fixture Tokens are registered in
// memory (`registerTokenTypes`), for this page only.
// Differences from the bench, on purpose:
// * No seeded `Math.random` and no virtual clock: this is the real game on the real wall
// clock, so two runs do not do identical work. The bench is the place for exact comparisons;
// this is the place for frames.
// * S6 (long idle) is not offered: in game, 'S2 left running for an hour' is the soak test,
// and that is `?stress=realistic` plus time.

import { GameLoop } from '../../../systems/core/GameLoop.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { SaveManager } from '../../../systems/core/SaveManager.js';
import { DiscoveryManager } from '../../../systems/core/DiscoveryManager.js';
import { AudioSystem } from '../../../systems/core/AudioSystem.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { GameState } from '../../../state/GameState.js';
import * as TileModifiers from '../../../systems/board/TileModifiers.js';
import { setMatTuning, resetMatTuning, isMatTuned } from '../../../config/matTuning.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';

/** Fired once a stress board is live, so ReactRoot can close the slot picker. */
export const STRESS_STARTED_EVENT = UI_EVENTS.DEV_STRESS_STARTED;

const PROTECTED_KEYS = ['fantasy_guild_mat_tuning', 'fantasy_guild_settings'];

/**
 * Scenario name → the bench module that builds it. The names are what
 * `?stress=` takes; the ids (S1…S5) and the bench's file names work too.
 */
export const STRESS_SCENARIOS = [
    { name: 'quiet', id: 'S1', label: 'S1 Quiet Hall', load: () => import('../../../../bench/scenarios/s1-quiet-hall.mjs') },
    { name: 'realistic', id: 'S2', label: 'S2 Realistic late game', load: () => import('../../../../bench/scenarios/s2-realistic.mjs') },
    { name: 'torture', id: 'S3', label: 'S3 Torture', load: () => import('../../../../bench/scenarios/s3-torture.mjs') },
    { name: 'push', id: 'S4', label: 'S4 Push storm', load: () => import('../../../../bench/scenarios/s4-push-storm.mjs') },
    { name: 'rebuild', id: 'S5', label: 'S5 Rebuild storm', load: () => import('../../../../bench/scenarios/s5-rebuild-storm.mjs') }
];

const ALIASES = {
    'quiet-hall': 'quiet', 'push-storm': 'push', 'rebuild-storm': 'rebuild', 'late': 'realistic'
};

export function resolveStress(name) {
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    const canonical = ALIASES[key] || key;
    return STRESS_SCENARIOS.find(s => s.name === canonical || s.id.toLowerCase() === canonical) || null;
}

/** Run `fn`, then put the protected localStorage keys back exactly as they were. */
async function withStorageKept(fn) {
    const before = PROTECTED_KEYS.map(k => {
        try { return [k, globalThis.localStorage?.getItem(k)]; } catch { return [k, undefined]; }
    });
    try {
        return await fn();
    } finally {
        for (const [k, v] of before) {
            try {
                if (v === undefined) continue;
                if (v === null) globalThis.localStorage?.removeItem(k);
                else globalThis.localStorage?.setItem(k, v);
            } catch { /* storage unavailable — nothing was written either */ }
        }
    }
}

/** Stop saving: the stress board must never land in a save slot. */
function detachFromSaves() {
    if (SaveManager.getCurrentSlot() !== null) {
        // The player's real game, saved as autosave would have — BEFORE the
        // stress board replaces it in memory.
        SaveManager.save(false);
    }
    if (SaveManager.autoSaveTimer) {
        clearInterval(SaveManager.autoSaveTimer);
        SaveManager.autoSaveTimer = null;
    }
    // With no slot, save() refuses and the beforeunload save is skipped.
    SaveManager.currentSlot = null;
}

/**
 * Build a stress scenario in the running game and start the loop. Mirrors the bench's `boot()`
 * + `announceReady()` (bench/lib/harness.mjs), then starts the real wall-clock loop as
 * `onSlotSelected` does.
 * @param {string} name see `STRESS_SCENARIOS`
 * @returns {Promise<object>} what was built, for the report
 */
export async function buildStress(name) {
    const entry = resolveStress(name);
    if (!entry) {
        throw new Error(`Unknown stress scenario "${name}". Try: ${STRESS_SCENARIOS.map(s => s.name).join(', ')}`);
    }

    const [fixtures, mod] = await Promise.all([
        import('../../../../bench/fixtures.mjs'),
        entry.load()
    ]);
    const scenario = mod.default;

    const t0 = performance.now();
    detachFromSaves();
    GameLoop.stop();

    // A new game as `onSlotSelected(…, true)` makes one, minus `createDefaultGameData`: the
    // board comes from the scenario.
    GameState.initNew();
    DiscoveryManager.init();
    AudioSystem.init();
    InventoryManager.init();

    const ctx = { fixtures, setMatTuning, now: () => performance.now() };
    let custom = null;
    // The bench runs every Mat Tuner value at its shipped default, and so must this: a tuned
    // walk speed or mat size on this device would make a different board. Reset for this page
    // only (the stored values are put back below), which also undoes a previous scenario's mat
    // resize.
    const matTuningWasCustom = isMatTuned();
    await withStorageKept(async () => {
        resetMatTuning();
        await scenario.build(ctx);
        // `announceReady()` in the bench harness.
        TileModifiers.rebuildAll();
        // S4 is not a tick scenario: it times single operations (arrivals, drops, the mat
        // shrink). Run them here, in the browser, and report.
        if (typeof scenario.custom === 'function') {
            custom = await scenario.custom(ctx);
        }
    });

    EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'dev_stress' });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
    EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
    GameLoop.start();

    const buildMs = performance.now() - t0;
    const census = fixtures.census();
    EventBus.publish(STRESS_STARTED_EVENT, { name: entry.name, id: entry.id });

    return {
        name: entry.name,
        id: entry.id,
        label: entry.label,
        buildMs: Math.round(buildMs),
        census,
        // True when this device's Mat Tuner differed from the defaults (it was
        // reset to defaults for this page only).
        matTuningWasCustom,
        // S4 only: the timed single operations, measured in this browser.
        operations: custom
    };
}
