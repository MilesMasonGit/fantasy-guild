import { describe, it, expect } from 'vitest';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { advanceTime } from '../systems/core/DevTools.js';

/**
 * CR3-305 stage 1 — the "everything may have changed" moments say so with one
 * event, `GAME_RESET { reason }`, so a surface can stop listening to the
 * catch-all `state_changed`. (The new-game / load boot publishes it from
 * `EngineBootstrap.onSlotSelected`; that path needs the whole engine and is
 * covered by the running game.)
 */
describe('GAME_RESET (CR3-305 stage 1)', () => {
    it('the dev time-skip announces it once, after the ticks ran', () => {
        const order = [];
        const off = [
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, (p) => order.push(['reset', p.reason])),
            EventBus.subscribe(ENGINE_EVENTS.STATE_CHANGED, () => order.push(['state']))
        ];
        let ticks = 0;
        try {
            const res = advanceTime(1, { loop: { runHandlers: () => { ticks++; order.push(['tick']); } }, stepMs: 30_000 });
            expect(res.ok).toBe(true);
        } finally { off.forEach(f => f()); }
        expect(ticks).toBe(2);
        expect(order).toEqual([['tick'], ['tick'], ['reset', 'dev_time_skip'], ['state']]);
    });
});
