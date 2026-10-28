import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION } from '../state/StateSchema.js';

/**
 * The item stubs' store: one stub per item, its net flow merged here (never per render), a fade
 * five minutes after the item last moved, a right-click that clears or resets, and pins that keep
 * their count, never fade and are saved.
 */

let now = 1_000_000;
const advance = (ms) => { now += ms; };

beforeEach(() => {
    now = 1_000_000;
    ItemStubs.setClock(() => now);
    ItemStubs.reset();
});
afterEach(() => {
    ItemStubs.setClock(null);
    ItemStubs.reset();
});

describe('merging', () => {
    it('one stub per item, whatever its sources, showing the net flow', () => {
        ItemStubs.recordFlow('oak', { added: 5 });
        ItemStubs.recordFlow('oak', { added: 3 });
        ItemStubs.recordFlow('oak', { removed: 2 });
        ItemStubs.recordFlow('stone', { removed: 4 });
        const stubs = ItemStubs.getStubs();
        expect(stubs.map(s => s.itemId).sort()).toEqual(['oak', 'stone']);
        const oak = ItemStubs.getStub('oak');
        expect([oak.added, oak.removed, ItemStubs.netOf(oak)]).toEqual([8, 2, 6]);
        expect(ItemStubs.netOf(ItemStubs.getStub('stone'))).toBe(-4);
    });

    it('a stub whose gains and spending cancel out is not drawn (no "New! +0"), and comes back in its place when its item moves', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.markNew('bait');
        ItemStubs.recordFlow('bait', { added: 1 });
        ItemStubs.recordFlow('bait', { removed: 1 });
        ItemStubs.recordFlow('stone', { added: 1 });
        expect(ItemStubs.getStub('bait').isNew).toBe(true);
        expect(ItemStubs.getStubs().map(s => s.itemId)).toEqual(['oak', 'stone']);
        ItemStubs.recordFlow('bait', { added: 2 });
        expect(ItemStubs.getStubs().map(s => s.itemId)).toEqual(['oak', 'bait', 'stone']);
    });

    it('a pinned stub is a tracker: still drawn at +0', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.pin('oak');
        ItemStubs.recordFlow('oak', { removed: 1 });
        expect(ItemStubs.getStubs().map(s => s.itemId)).toEqual(['oak']);
    });

    it('ignores changes that move nothing, and bulk changes with no item', () => {
        ItemStubs.recordFlow('oak', {});
        ItemStubs.recordFlow(null, { added: 3 });
        ItemStubs.recordFlow('oak', { added: 0, removed: 0 });
        expect(ItemStubs.getStubs()).toEqual([]);
    });

    it('replaces only the stub that moved, so a memoised row redraws only for its own item', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.recordFlow('stone', { added: 1 });
        const stoneBefore = ItemStubs.getStub('stone');
        const oakBefore = ItemStubs.getStub('oak');
        ItemStubs.recordFlow('oak', { added: 1 });
        expect(ItemStubs.getStub('stone')).toBe(stoneBefore);
        expect(ItemStubs.getStub('oak')).not.toBe(oakBefore);
    });

    it('tells listeners once for a burst, not once per change', () => {
        vi.useFakeTimers();
        try {
            const heard = vi.fn();
            const off = ItemStubs.subscribe(heard);
            for (let i = 0; i < 50; i++) ItemStubs.recordFlow('oak', { added: 1 });
            expect(heard).not.toHaveBeenCalled();
            vi.advanceTimersByTime(ItemStubs.EMIT_MS);
            expect(heard).toHaveBeenCalledTimes(1);
            off();
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the order calm: new at the bottom, a new pin at the bottom of the pins, an unpinned stub at the top of the rest', () => {
        const order = () => ItemStubs.getStubs().map(s => s.itemId);
        for (const id of ['a', 'b', 'c', 'd']) ItemStubs.recordFlow(id, { added: 1 });
        expect(order()).toEqual(['a', 'b', 'c', 'd']);
        ItemStubs.pin('c');
        ItemStubs.pin('a');
        expect(order()).toEqual(['c', 'a', 'b', 'd']);
        ItemStubs.unpin('c');
        expect(order()).toEqual(['a', 'c', 'b', 'd']);
        ItemStubs.recordFlow('e', { added: 1 });
        ItemStubs.recordFlow('b', { added: 5 });
        expect(order()).toEqual(['a', 'c', 'b', 'd', 'e']);
        ItemStubs.unpin('a');
        expect(order()).toEqual(['a', 'c', 'b', 'd', 'e']);
    });

    it('a stub cleared and started again joins the bottom', () => {
        vi.useFakeTimers();
        try {
            for (const id of ['a', 'b', 'c']) ItemStubs.recordFlow(id, { added: 1 });
            ItemStubs.remove('a');
            vi.advanceTimersByTime(ItemStubs.LEAVE_MS);
            ItemStubs.recordFlow('a', { added: 1 });
            expect(ItemStubs.getStubs().map(s => s.itemId)).toEqual(['b', 'c', 'a']);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('fading', () => {
    it('fades five minutes after the item last changed, then goes', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        advance(ItemStubs.FADE_MS - 1);
        ItemStubs.prune();
        expect(ItemStubs.getStub('oak').fading).toBe(false);
        advance(1);
        ItemStubs.prune();
        expect(ItemStubs.getStub('oak').fading).toBe(true);
        advance(ItemStubs.FADE_OUT_MS);
        ItemStubs.prune();
        expect(ItemStubs.getStub('oak')).toBeNull();
    });

    it('keeps a stub while its item keeps flowing', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        for (let i = 0; i < 10; i++) {
            advance(ItemStubs.FADE_MS - 1000);
            ItemStubs.recordFlow('oak', { added: 1 });
            ItemStubs.prune();
        }
        expect(ItemStubs.getStub('oak').added).toBe(11);
    });

    it('a change while fading brings it back', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        advance(ItemStubs.FADE_MS);
        ItemStubs.prune();
        ItemStubs.recordFlow('oak', { removed: 1 });
        expect(ItemStubs.getStub('oak').fading).toBe(false);
    });

    it('Clear all slides every unpinned stub out, then they go, and the pins stay', () => {
        vi.useFakeTimers();
        try {
            ItemStubs.recordFlow('oak', { added: 1 });
            ItemStubs.recordFlow('stone', { added: 1 });
            ItemStubs.pin('stone');
            ItemStubs.clearUnpinned();
            expect(ItemStubs.getStub('oak').leaving).toBe(true);
            expect(ItemStubs.hasUnpinned()).toBe(false);
            vi.advanceTimersByTime(ItemStubs.LEAVE_MS);
            expect(ItemStubs.getStubs().map(s => s.itemId)).toEqual(['stone']);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('right-click', () => {
    it('clears an unpinned stub: it slides out, then goes', () => {
        vi.useFakeTimers();
        try {
            ItemStubs.recordFlow('oak', { added: 7 });
            ItemStubs.remove('oak');
            expect(ItemStubs.getStub('oak').leaving).toBe(true);
            vi.advanceTimersByTime(ItemStubs.LEAVE_MS);
            expect(ItemStubs.getStub('oak')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('the next flow of a cleared item starts a fresh stub at +0, even while the old one slides out', () => {
        vi.useFakeTimers();
        try {
            ItemStubs.recordFlow('oak', { added: 7 });
            ItemStubs.remove('oak');
            advance(10);
            ItemStubs.recordFlow('oak', { added: 2 });
            const oak = ItemStubs.getStub('oak');
            expect([oak.leaving, ItemStubs.netOf(oak), oak.firstAt]).toEqual([false, 2, now]);
            vi.advanceTimersByTime(ItemStubs.LEAVE_MS);
            expect(ItemStubs.netOf(ItemStubs.getStub('oak'))).toBe(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('on a pinned stub resets it to +0 and keeps it pinned', () => {
        ItemStubs.recordFlow('oak', { added: 9, removed: 1 });
        ItemStubs.pin('oak');
        ItemStubs.remove('oak');
        const oak = ItemStubs.getStub('oak');
        expect([oak.pinned, oak.leaving, ItemStubs.netOf(oak)]).toEqual([true, false, 0]);
    });

    it('a stub on its way out cannot be pinned', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.remove('oak');
        ItemStubs.pin('oak');
        expect(ItemStubs.getStub('oak').pinned).toBe(false);
    });
});

describe('arriving', () => {
    it('a stub is fresh (it slides in) only just after it appears', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        expect(ItemStubs.isFresh(ItemStubs.getStub('oak'))).toBe(true);
        advance(ItemStubs.ARRIVE_MS);
        ItemStubs.recordFlow('oak', { added: 1 });
        expect(ItemStubs.isFresh(ItemStubs.getStub('oak'))).toBe(false);
    });
});

describe('first find', () => {
    it('the stub of an item found for the first time is new, whichever event comes first', () => {
        ItemStubs.markNew('copper');            // the discovery is heard before the Bank change
        ItemStubs.recordFlow('copper', { added: 1 });
        expect(ItemStubs.getStub('copper').isNew).toBe(true);

        ItemStubs.recordFlow('tin', { added: 1 });
        ItemStubs.markNew('tin');
        expect(ItemStubs.getStub('tin').isNew).toBe(true);

        ItemStubs.recordFlow('oak', { added: 1 });
        expect(ItemStubs.getStub('oak').isNew).toBe(false);
    });

    it('seeing a new stub (hover) clears its New and leaves others alone', () => {
        ItemStubs.recordFlow('copper', { added: 1 });
        ItemStubs.markNew('copper');
        ItemStubs.recordFlow('tin', { added: 1 });
        ItemStubs.markNew('tin');
        ItemStubs.clearNew('copper');
        expect(ItemStubs.getStub('copper').isNew).toBe(false);
        expect(ItemStubs.getStub('tin').isNew).toBe(true);
        ItemStubs.recordFlow('copper', { added: 1 });
        expect(ItemStubs.getStub('copper').isNew).toBe(false);
    });

    it('pinning a new stub clears its New', () => {
        ItemStubs.recordFlow('copper', { added: 1 });
        ItemStubs.markNew('copper');
        ItemStubs.pin('copper');
        expect(ItemStubs.getStub('copper').isNew).toBe(false);
    });
});

describe('pins', () => {
    it('a pinned stub keeps its count (since the stub appeared) and never fades', () => {
        ItemStubs.recordFlow('oak', { added: 40 });
        ItemStubs.pin('oak');
        expect(ItemStubs.netOf(ItemStubs.getStub('oak'))).toBe(40);
        ItemStubs.recordFlow('oak', { added: 12 });
        ItemStubs.recordFlow('oak', { removed: 2 });
        advance(ItemStubs.FADE_MS * 10);
        ItemStubs.prune();
        const oak = ItemStubs.getStub('oak');
        expect(oak.pinned).toBe(true);
        expect([oak.added, oak.removed]).toEqual([52, 2]);
    });

    it('reset sets a pinned stub back to +0', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.pin('oak');
        ItemStubs.recordFlow('oak', { added: 9 });
        ItemStubs.resetPin('oak');
        expect(ItemStubs.netOf(ItemStubs.getStub('oak'))).toBe(0);
        expect(ItemStubs.getStub('oak').pinned).toBe(true);
    });

    it('unpinned, it fades five minutes from then', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        ItemStubs.pin('oak');
        advance(ItemStubs.FADE_MS * 2);
        ItemStubs.unpin('oak');
        ItemStubs.prune();
        expect(ItemStubs.getStub('oak')).not.toBeNull();
        advance(ItemStubs.FADE_MS + ItemStubs.FADE_OUT_MS);
        ItemStubs.prune();
        ItemStubs.prune();
        expect(ItemStubs.getStub('oak')).toBeNull();
    });

    it('serialize and load round-trip the pins, in pin order', () => {
        for (const id of ['oak', 'stone', 'tin']) ItemStubs.recordFlow(id, { added: 1 });
        ItemStubs.pin('stone');
        advance(1);
        ItemStubs.pin('oak');
        ItemStubs.recordFlow('oak', { added: 340, removed: 0 });
        ItemStubs.recordFlow('stone', { removed: 7 });
        const saved = ItemStubs.serializePins();
        expect(saved).toEqual([
            { itemId: 'stone', added: 1, removed: 7 },
            { itemId: 'oak', added: 341, removed: 0 }
        ]);
        ItemStubs.reset();
        ItemStubs.loadPins(saved);
        expect(ItemStubs.serializePins()).toEqual(saved);
        expect(ItemStubs.getStubs().every(s => s.pinned)).toBe(true);
    });

    it('a malformed pin is skipped, never a reason for a load to fail', () => {
        ItemStubs.loadPins([null, { itemId: '' }, { itemId: 'oak', added: 'x', removed: -3 }, 7]);
        expect(ItemStubs.serializePins()).toEqual([{ itemId: 'oak', added: 0, removed: 0 }]);
        expect(() => ItemStubs.loadPins(undefined)).not.toThrow();
    });
});

describe('pins in the save', () => {
    it('the schema declares ui.pinnedStubs, empty in a new game', () => {
        GameState.initNew();
        expect(GameState.state.ui.pinnedStubs).toEqual([]);
    });

    it('a save from before pins loads with none', () => {
        GameState.initNew();
        const state = JSON.parse(JSON.stringify(GameState.serialize().state));
        delete state.ui.pinnedStubs;
        const migrated = migrateState(state, GAME_VERSION);
        expect(migrated.ui.pinnedStubs).toEqual([]);
    });

    it('pins written into the save come back through a save and load', () => {
        GameState.initNew();
        GameState.state.ui.pinnedStubs = [{ itemId: 'oak', added: 12, removed: 3 }];
        const json = JSON.stringify(GameState.serialize());
        const migrated = migrateState(JSON.parse(json).state, GAME_VERSION);
        ItemStubs.loadPins(migrated.ui.pinnedStubs);
        const oak = ItemStubs.getStub('oak');
        expect([oak.pinned, oak.added, oak.removed]).toEqual([true, 12, 3]);
    });
});
