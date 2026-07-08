// Fantasy Guild - Event Batch Coalescing (Deck Loop rework, Phase 3 §3H)

import { EventBus } from './EventBus.js';

/**
 * EventBatch — collects events raised during a single LoopRunner tick and
 * fires each unique event once at the end, instead of letting 12 areas each
 * trigger their own `inventory_updated` cascade (roadmap Appendix B,
 * pattern 5).
 *
 * Two capture paths:
 * 1. Explicit — loop-engine code calls `EventBatch.queue(name, payload)`.
 * 2. Implicit — while a batch is open, EventBus.publish() diverts events on
 *    the BATCHABLE whitelist into the batch via the batch-sink hook. This
 *    catches deep call chains (TransactionProcessor, InventoryManager, ...)
 *    without rewriting every system.
 *
 * Dedupe key: the event name, plus `payload.areaId` for area-scoped events —
 * so `area:card_completed` for two different areas fires twice (correct),
 * while three `inventory_updated` from three completions fire once.
 *
 * Only recalculation-style broadcasts are whitelisted. Events whose
 * individual payloads carry meaning (`combat_victory`, `loot_generated`,
 * `audio:play`, ...) must NOT be batched — dropping duplicates would drop
 * real information.
 */
const BATCHABLE = new Set([
    'inventory_updated',
    'heroes_updated',
    'cards_updated',
    'state_changed'
]);

export const EventBatch = {
    _active: false,
    /** @type {Map<string, { name: string, payload: Object }>} */
    _pending: new Map(),

    isActive() {
        return this._active;
    },

    /** Open a batch. Whitelisted EventBus.publish calls are captured until flush(). */
    begin() {
        if (this._active) return;
        this._active = true;
        this._pending.clear();
        EventBus.setBatchSink((name, payload) => {
            if (!BATCHABLE.has(name)) return false;
            this.queue(name, payload);
            return true;
        });
    },

    /**
     * Queue an event into the open batch (last payload wins per dedupe key).
     * Falls back to an immediate publish when no batch is open, so callers
     * don't need to care whether they're inside a tick.
     */
    queue(name, payload = {}) {
        if (!this._active) {
            EventBus.publish(name, payload);
            return;
        }
        const key = payload && payload.areaId ? `${name}::${payload.areaId}` : name;
        this._pending.set(key, { name, payload });
    },

    /** Close the batch and fire each unique pending event once. */
    flush() {
        if (!this._active) return;
        // Unhook first: events published by flush-triggered subscribers must
        // pass straight through, not re-enter the (now closed) batch.
        EventBus.setBatchSink(null);
        this._active = false;
        const pending = [...this._pending.values()];
        this._pending.clear();
        for (const { name, payload } of pending) {
            EventBus.publish(name, payload);
        }
    }
};
