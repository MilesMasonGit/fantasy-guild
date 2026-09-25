// Fantasy Guild - Developer tools (Token Lifecycle slice 0.2, DP-11)
//
// Engine-side helpers behind the QA panel (`ui/components/TestDashboard.jsx`).
// Kept out of the component so they can be unit-tested and called from the
// console (`window.Game` exposes the managers they drive).

import { GameLoop } from './GameLoop.js';
import { EventBus } from './EventBus.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getAllItems, getItem } from '../../config/registries/itemRegistry.js';
import { MAX_TICK_DELTA_MS } from '../../config/loopConstants.js';

// ---------------------------------------------------------------------------
// Give item
// ---------------------------------------------------------------------------

/**
 * Every live item id, sorted. Only `item_*` ids: the registry also holds
 * legacy ids without the prefix, which mask data bugs and are not what a test
 * should use.
 * @returns {string[]}
 */
export function listGivableItemIds() {
    return Object.keys(getAllItems())
        .filter(id => id.startsWith('item_'))
        .sort();
}

/**
 * Put `amount` of `itemId` into the Bank through `InventoryManager.addItem`,
 * the one real add path. Whatever the Bank cannot hold follows that path's
 * normal overflow (D-138: it becomes a sprite on the mat), so nothing is lost.
 *
 * @param {string} itemId
 * @param {number} amount - whole number, at least 1
 * @param {object} [deps] - injection seam for tests
 * @returns {{ ok: boolean, added: number, overflow: number, error?: string }}
 *   `overflow` is the part that did not fit in the Bank and went to the mat.
 */
export function giveItem(itemId, amount, { inventory = InventoryManager } = {}) {
    const id = String(itemId ?? '').trim();
    const n = Math.floor(Number(amount));
    if (!id) return { ok: false, added: 0, overflow: 0, error: 'No item id given.' };
    if (!getItem(id)) return { ok: false, added: 0, overflow: 0, error: `Unknown item id: ${id}` };
    if (!Number.isFinite(n) || n < 1) {
        return { ok: false, added: 0, overflow: 0, error: 'Amount must be a whole number of at least 1.' };
    }

    const added = inventory.addItem(id, n, 'dev_give_item');
    return { ok: true, added, overflow: n - added };
}

// ---------------------------------------------------------------------------
// Advance timers
// ---------------------------------------------------------------------------

/**
 * Game time each fast-forward step delivers. Equal to the largest delta the
 * live loop itself ever delivers (`MAX_TICK_DELTA_MS`, the CR2-041 clamp), so
 * no system sees a delta it could not also see in real play. `BoardRunner`
 * completes at most one work cycle per tick and floors cycles at 1000 ms, so a
 * larger step would silently lose cycles.
 */
export const DEV_ADVANCE_STEP_MS = MAX_TICK_DELTA_MS;

/**
 * Hard ceiling on steps per call, so one click can never freeze the page for
 * minutes. At the default 1000 ms step this is 2 hours of game time. A request
 * past it advances exactly the capped amount and reports `capped: true`.
 */
export const DEV_ADVANCE_MAX_STEPS = 7200;

/**
 * Fast-forward the live game by `minutes` of game time by driving the real
 * tick handlers (`GameLoop.runHandlers`) in fixed steps. Every system that
 * advances by the tick's `delta` moves together — including clocks added
 * later, with no change here.
 *
 * ⚠️ Systems that read the wall clock (`Date.now()`) instead of `delta` do NOT
 * move: quest-abandon cooldowns, live-effect expiry, sprite absorb timers, and
 * the item/XP rate trackers.
 *
 * Runs whether or not the game is paused — it is an explicit request. If the
 * Time Bank is spending, its handler drains by the advanced time like any tick.
 *
 * @param {number} minutes - game minutes to advance (may be fractional)
 * @param {object} [opts]
 * @param {{ runHandlers: (delta: number) => void }} [opts.loop] - test seam
 * @param {number} [opts.stepMs]   - defaults to DEV_ADVANCE_STEP_MS
 * @param {number} [opts.maxSteps] - defaults to DEV_ADVANCE_MAX_STEPS
 * @returns {{ ok: boolean, advancedMs: number, steps: number, capped: boolean, error?: string }}
 */
export function advanceTime(minutes, {
    loop = GameLoop,
    stepMs = DEV_ADVANCE_STEP_MS,
    maxSteps = DEV_ADVANCE_MAX_STEPS
} = {}) {
    const requestedMs = Number(minutes) * 60_000;
    if (!Number.isFinite(requestedMs) || requestedMs <= 0) {
        return { ok: false, advancedMs: 0, steps: 0, capped: false, error: 'Minutes must be a positive number.' };
    }

    const capMs = stepMs * maxSteps;
    const capped = requestedMs > capMs;
    let remaining = Math.min(requestedMs, capMs);

    let steps = 0;
    let advancedMs = 0;
    while (remaining > 0) {
        const delta = Math.min(stepMs, remaining);
        loop.runHandlers(delta);
        remaining -= delta;
        advancedMs += delta;
        steps++;
    }

    EventBus.publish('state_changed');
    return { ok: true, advancedMs, steps, capped };
}

// ---------------------------------------------------------------------------
// Spawner kind counts (placeholder)
// ---------------------------------------------------------------------------

/**
 * Live Spawner kind counts for the QA panel, as `[{ kind, count, cap }]`.
 * There are no Spawners yet: this returns `[]` and the panel shows
 * "No spawners yet". The Spawner slice replaces the body; the panel already
 * renders any rows this returns.
 * @returns {Array<{ kind: string, count: number, cap: number }>}
 */
export function getSpawnerKindCounts() {
    return [];
}
