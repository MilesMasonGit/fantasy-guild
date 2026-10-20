import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as ItemStubs from '../systems/notifications/itemStubs.js';

/**
 * Collected loot flies to its own stub (owner, third look). The Bank is credited the moment the
 * loot is collected, before the flight starts; the stub holds that amount back from what it shows
 * until the flight lands, so its count ticks up as each item arrives. A stub made by the very
 * collection is drawn at once, so it slides out at +0 as the flight starts.
 */

let now = 1_000_000;

beforeEach(() => {
    now = 1_000_000;
    ItemStubs.setClock(() => now);
    ItemStubs.reset();
});
afterEach(() => {
    vi.useRealTimers();
    ItemStubs.setClock(null);
    ItemStubs.reset();
});

/** What collectSprite does, in its order: the Bank change first, then the flight. */
function collect(itemId, qty) {
    ItemStubs.recordFlow(itemId, { added: qty });
    return ItemStubs.holdForFlight(itemId, qty);
}

const shown = (itemId) => ItemStubs.shownNetOf(ItemStubs.getStub(itemId));

describe('the count ticks on landing, not before', () => {
    it('an existing stub keeps showing its old count until the flight lands', () => {
        ItemStubs.recordFlow('oak', { added: 10 });
        const hold = collect('oak', 3);
        expect(shown('oak')).toBe(10);
        // The Bank side of the stub has it already: nothing is counted twice or late.
        expect(ItemStubs.getStub('oak').added).toBe(13);
        ItemStubs.landFlight(hold);
        expect(shown('oak')).toBe(13);
        expect(ItemStubs.netOf(ItemStubs.getStub('oak'))).toBe(13);
    });

    it('each landing ticks its own amount, and tells the column at once', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.flush();
        const a = collect('oak', 2);
        const b = collect('oak', 5);
        const heard = vi.fn();
        const off = ItemStubs.subscribe(heard);
        ItemStubs.landFlight(a);
        expect(heard).toHaveBeenCalledTimes(1);
        expect(shown('oak')).toBe(3);
        ItemStubs.landFlight(b);
        expect(heard).toHaveBeenCalledTimes(2);
        expect(shown('oak')).toBe(8);
        off();
    });

    it('a spend while loot is in the air still shows at once', () => {
        ItemStubs.recordFlow('oak', { added: 4 });
        const hold = collect('oak', 3);
        ItemStubs.recordFlow('oak', { removed: 2 });
        expect(shown('oak')).toBe(2);
        ItemStubs.landFlight(hold);
        expect(shown('oak')).toBe(5);
    });

    it('landing twice, or landing nothing, changes nothing', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        const hold = collect('oak', 3);
        ItemStubs.landFlight(hold);
        ItemStubs.landFlight(hold);
        ItemStubs.landFlight(null);
        expect(shown('oak')).toBe(4);
    });
});

describe('a new item: its stub slides out at +0 as the flight starts', () => {
    it('is drawn at once, at +0, and counts each item once', () => {
        vi.useFakeTimers();
        const heard = vi.fn();
        const off = ItemStubs.subscribe(heard);
        const hold = collect('copper', 4);
        // Drawn now (not after the usual wait), showing +0.
        expect(heard).toHaveBeenCalledTimes(1);
        expect(shown('copper')).toBe(0);
        expect(ItemStubs.isFresh(ItemStubs.getStub('copper'))).toBe(true);
        // No second count when the wait runs out.
        vi.advanceTimersByTime(ItemStubs.EMIT_MS * 2);
        expect(ItemStubs.getStub('copper').added).toBe(4);
        ItemStubs.landFlight(hold);
        expect(shown('copper')).toBe(4);
        off();
    });

    it('a second collection of the same new item in one burst is held too, without drawing again', () => {
        const heard = vi.fn();
        const off = ItemStubs.subscribe(heard);
        const a = collect('copper', 1);
        const b = collect('copper', 1);
        expect(heard).toHaveBeenCalledTimes(1);
        expect(shown('copper')).toBe(0);
        expect(ItemStubs.getStub('copper').added).toBe(2);
        ItemStubs.landFlight(a);
        ItemStubs.landFlight(b);
        expect(shown('copper')).toBe(2);
        off();
    });

    it('a stub already drawn is not drawn early by a flight', () => {
        vi.useFakeTimers();
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.flush();
        const heard = vi.fn();
        const off = ItemStubs.subscribe(heard);
        collect('oak', 1);
        expect(heard).not.toHaveBeenCalled();
        off();
    });
});

describe('holds never outlive their stub', () => {
    it('an item with no stub holds nothing', () => {
        expect(ItemStubs.holdForFlight('nothing', 3)).toBeNull();
        expect(ItemStubs.holdForFlight('oak', 0)).toBeNull();
    });

    it('a pinned stub reset while loot flies shows +0, and the old flight does not count after', () => {
        ItemStubs.recordFlow('oak', { added: 5 });
        ItemStubs.pin('oak');
        const hold = collect('oak', 3);
        ItemStubs.resetPin('oak');
        expect(shown('oak')).toBe(0);
        ItemStubs.landFlight(hold);
        expect(shown('oak')).toBe(0);
        // A newer flight is still held as usual.
        const next = collect('oak', 2);
        expect(shown('oak')).toBe(0);
        ItemStubs.landFlight(next);
        expect(shown('oak')).toBe(2);
    });

    it('a cleared stub\'s flight does not tick the fresh stub that replaced it', () => {
        vi.useFakeTimers();
        ItemStubs.recordFlow('oak', { added: 5 });
        const old = collect('oak', 3);
        ItemStubs.remove('oak');
        vi.advanceTimersByTime(ItemStubs.LEAVE_MS + 1);
        const fresh = collect('oak', 2);
        ItemStubs.landFlight(old);
        expect(shown('oak')).toBe(0);
        ItemStubs.landFlight(fresh);
        expect(shown('oak')).toBe(2);
    });

    it('a saved pin counts loot still in the air: the Bank has it', () => {
        ItemStubs.recordFlow('oak', { added: 5 });
        ItemStubs.pin('oak');
        collect('oak', 3);
        expect(ItemStubs.serializePins()).toEqual([{ itemId: 'oak', added: 8, removed: 0 }]);
    });
});
