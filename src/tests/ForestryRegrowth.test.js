import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Growth from '../systems/board/Growth.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { growsTermsOf } from '../config/registries/tokenConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Forestry regrowth: a felled tree's Stump grows back only while its own Forest stands (its clock
 * stands still without it, and no other Forest takes it in), at its fixed time and for free. A
 * growth that needs no Forest may still pay a cost from the Bank; with none it is stopped and says
 * so. A Sapling whose Forest goes finishes growing.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const SEEDLING = 'fixture_fo_seedling';
registerItems({
    [SEEDLING]: {
        id: SEEDLING, name: 'Fixture Seedling', type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
        stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});

const plain = (id, extra) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra
});
registerTokenTypes({
    fo_forest: plain('fo_forest', { tokenType: 'buff' }),
    fo_fast_forest: plain('fo_fast_forest', {
        tokenType: 'buff',
        statements: [{ id: 'stm_fo_fast', keyword: 'provides', to: { mode: 'tag', value: 'FoOak' },
            payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 } }]
    }),
    fo_birch_forest: plain('fo_birch_forest', { tokenType: 'buff' }),
    fo_stump: plain('fo_stump', {
        tags: ['FoOak'],
        grows: { into: 'fo_sapling', afterMs: 20000, needsNearby: ['fo_forest', 'fo_fast_forest'], cost: [{ itemId: SEEDLING, quantity: 1 }] }
    }),
    fo_free_stump: plain('fo_free_stump', { tags: ['FoOak'], grows: { into: 'fo_sapling', afterMs: 20000, needsNearby: ['fo_forest'] } }),
    fo_paid_stump: plain('fo_paid_stump', { tags: ['FoOak'], grows: { into: 'fo_sapling', afterMs: 20000, cost: [{ itemId: SEEDLING, quantity: 1 }] } }),
    fo_sapling: plain('fo_sapling', { tags: ['FoOak'], grows: { into: 'fo_tree', afterMs: 10000 } }),
    fo_tree: plain('fo_tree', {
        tags: ['FoOak'], uses: 3,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    })
});

const AT = { x: 800, y: 500 };
const typeAt = () => BoardState.tokensAtPoint(AT.x, AT.y)[0]?.typeId ?? null;
const tokenAt = () => BoardState.tokensAtPoint(AT.x, AT.y)[0] ?? null;
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) TimedChanges.tick(step); };
const seedlings = () => InventoryManager.getItemCount(SEEDLING);

/** Put a Token down as the game does: on the mat, and the neighbourhood rebuilt around it. */
function arrive(typeId, x, y) {
    const t = placeAt(typeId, x, y);
    TileModifiers.rebuildAround([{ x, y }]);
    return t;
}
/** Make `forest` the Token's own, as a Forest's planting does. */
function own(instance, forest) {
    BoardState.setTether(instance, forest.id);
    return instance;
}
/** Take one off as the game does. */
function leave(instance) {
    const at = { x: instance.x, y: instance.y };
    BoardState.removeToken(instance.id);
    TileModifiers.rebuildAround([at]);
}

/** Every `GROWTH_ALERT_CHANGED` published, in order. */
function alertLog() {
    const log = [];
    const off = EventBus.subscribe(BOARD_EVENTS.GROWTH_ALERT_CHANGED, (p) => log.push({ alert: p.alert, needs: [...(p.needs || [])] }));
    return { log, off };
}

let watch;
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
    watch = alertLog();
});

afterEach(() => {
    watch.off();
    clearMat();
    vi.restoreAllMocks();
});

describe('the terms a growth asks', () => {
    it('nothing for a plain growth: the shared empty terms', () => {
        const terms = growsTermsOf({ grows: { into: 'x', afterMs: 1000 } });
        expect(terms).toEqual({ needsNearby: [], cost: [] });
        expect(growsTermsOf({})).toBe(terms);
    });

    it('needs nearby: blanks dropped, duplicates once; its cost dropped (its Forest regrows it for free); kept per block', () => {
        const def = {
            grows: {
                into: 'x', afterMs: 1000, needsNearby: ['a', ' ', 'a', 'b', 7],
                cost: [{ itemId: 's', quantity: 1 }]
            }
        };
        const terms = growsTermsOf(def);
        expect(terms).toEqual({ needsNearby: ['a', 'b'], cost: [] });
        expect(growsTermsOf(def)).toBe(terms);
        expect(Object.isFrozen(terms.needsNearby)).toBe(true);
    });

    it('a cost on a growth that needs no Forest: summed by item, bad lines dropped', () => {
        const def = {
            grows: { into: 'x', afterMs: 1000, cost: [{ itemId: 's', quantity: 1 }, { itemId: 's', quantity: 2 }, { itemId: '', quantity: 1 }, { itemId: 't', quantity: 0 }] }
        };
        expect(growsTermsOf(def)).toEqual({ needsNearby: [], cost: [{ itemId: 's', quantity: 3 }] });
    });
});

describe('⭐ a Stump regrows only while its own Forest stands', () => {
    it('with its own Forest it grows in its time, for free', () => {
        InventoryManager.addItem(SEEDLING, 3);
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        own(arrive('fo_stump', AT.x, AT.y), forest);
        tick(19900);
        expect(typeAt()).toBe('fo_stump');
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
        expect(seedlings()).toBe(3);
        expect(watch.log).toEqual([]);
    });

    it('with none, its clock stands still: still a Stump after an hour, nothing paid, and it says what it needs once', () => {
        InventoryManager.addItem(SEEDLING, 3);
        const stump = arrive('fo_stump', AT.x, AT.y);
        tick(60 * 60_000, 1000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks?.growMs ?? 0).toBe(0);
        expect(seedlings()).toBe(3);
        expect(watch.log).toEqual([{ alert: ALERT.GROW_NEEDS_NEARBY, needs: ['fo_forest', 'fo_fast_forest'] }]);
        expect(Growth.growthAlertOf(stump.id)).toEqual({ alert: ALERT.GROW_NEEDS_NEARBY, needs: ['fo_forest', 'fo_fast_forest'] });
        expect(TimedChanges.nextGrowth(stump)).toMatchObject({ paused: true, stopped: false, inMs: 20000, into: 'fo_sapling' });
    });

    it('a Forest of another species does not count as its own, nor one of its species that is not its own', () => {
        const birch = arrive('fo_birch_forest', AT.x + 150, AT.y);
        arrive('fo_forest', AT.x, AT.y + 150);
        const stump = own(arrive('fo_stump', AT.x, AT.y), birch);
        InventoryManager.addItem(SEEDLING, 1);
        tick(30000, 1000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks?.growMs ?? 0).toBe(0);
    });

    it('⭐ a Forest planted beside it later does not take it in: a lone Stump stays a Stump', () => {
        const stump = arrive('fo_stump', AT.x, AT.y);
        tick(5000);
        arrive('fo_forest', AT.x, AT.y + 150);
        tick(60000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks?.growMs ?? 0).toBe(0);
        expect(watch.log.map(e => e.alert)).toEqual([ALERT.GROW_NEEDS_NEARBY]);
    });

    it('⭐ its Forest going stops the clock where it stands, for good: another arriving is not its own', () => {
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        const stump = own(arrive('fo_stump', AT.x, AT.y), forest);
        tick(12000);
        leave(forest);
        tick(30000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks.growMs).toBe(12000);
        arrive('fo_forest', AT.x - 150, AT.y);
        tick(30000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks.growMs).toBe(12000);
    });

    it('its own Forest speeds nothing: a Grow Time on the species leaves the regrowth at its fixed time', () => {
        const forest = arrive('fo_fast_forest', AT.x + 150, AT.y);
        const stump = own(arrive('fo_stump', AT.x, AT.y), forest);
        expect(TimedChanges.nextGrowth(stump)).toMatchObject({ totalMs: 20000, paused: false });
        tick(19900);
        expect(typeAt()).toBe('fo_stump');
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
    });

    it('⭐ a Sapling whose Forest goes finishes growing (only a Stump needs the Forest)', () => {
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        own(arrive('fo_stump', AT.x, AT.y), forest);
        tick(20000);
        expect(typeAt()).toBe('fo_sapling');
        leave(forest);
        tick(10000);
        expect(typeAt()).toBe('fo_tree');
    });

    it('⭐ ownership, not reach: its own Forest moved far off still regrows it; gone, it does not', () => {
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        const stump = own(arrive('fo_stump', AT.x, AT.y), forest);
        expect(Growth.gateMet(stump)).toBe(true);
        BoardState.setTokenPoint(forest.id, AT.x + 900, AT.y);
        TileModifiers.rebuildAround([{ x: AT.x + 150, y: AT.y }, { x: AT.x + 900, y: AT.y }]);
        expect(Growth.gateMet(stump)).toBe(true);
        leave(forest);
        expect(Growth.gateMet(stump)).toBe(false);
    });

    it('a growth that needs nothing nearby is not gated (today\'s Saplings)', () => {
        const sapling = arrive('fo_sapling', AT.x, AT.y);
        expect(Growth.gateMet(sapling)).toBe(true);
        tick(10000);
        expect(typeAt()).toBe('fo_tree');
    });
});

describe('a growth that needs no Forest may cost an item from the Bank', () => {
    it('none in the Bank: stopped at its finish, says "needs" once, and grows the tick a seedling comes', () => {
        const stump = arrive('fo_paid_stump', AT.x, AT.y);
        tick(25000);
        expect(typeAt()).toBe('fo_paid_stump');
        expect(stump.clocks.growMs).toBe(20000);
        expect(watch.log).toEqual([{ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEEDLING] }]);
        expect(TimedChanges.nextGrowth(stump)).toMatchObject({ stopped: true, paused: false, inMs: 0, short: [SEEDLING] });
        expect(Growth.isGrowingBack(stump)).toBe(false);

        InventoryManager.addItem(SEEDLING, 2);
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
        expect(seedlings()).toBe(1);
        expect(watch.log.map(e => e.alert)).toEqual([ALERT.GROW_NEEDS_ITEM, null]);
        expect(Growth.growthAlertOf(stump.id)).toBeNull();
    });

    it('a seedling lying on the mat pays too, and the Bank is asked first', () => {
        SpriteLayer.addSprite('item', SEEDLING, 1, { centre: { x: 200, y: 200 } });
        arrive('fo_paid_stump', AT.x, AT.y);
        tick(20000);
        expect(typeAt()).toBe('fo_sapling');
        expect(SpriteLayer.countOnBoard(SEEDLING)).toBe(0);

        InventoryManager.addItem(SEEDLING, 1);
        SpriteLayer.addSprite('item', SEEDLING, 1, { centre: { x: 200, y: 200 } });
        clearMat();
        arrive('fo_paid_stump', AT.x, AT.y);
        tick(20000);
        expect(typeAt()).toBe('fo_sapling');
        expect(seedlings()).toBe(0);
        expect(SpriteLayer.countOnBoard(SEEDLING)).toBe(1);
    });

    it('a gated growth never stops for want of a seedling, authored or not', () => {
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        own(arrive('fo_free_stump', AT.x, AT.y), forest);
        own(arrive('fo_stump', AT.x, AT.y + 300), forest);
        tick(20000);
        expect(BoardState.tokensAtPoint(AT.x, AT.y + 300)[0]?.typeId).toBe('fo_sapling');
        expect(typeAt()).toBe('fo_sapling');
    });

    it('a Stump with no Forest and no seedling says it needs the Forest, not the seedling (its clock never reaches the cost)', () => {
        const stump = arrive('fo_stump', AT.x, AT.y);
        tick(60000);
        expect(Growth.growthAlertOf(stump.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);
    });
});

describe('the alert follows the Token', () => {
    it('drops when a stopped Stump is marked for demolition, and when one leaves the mat', () => {
        const a = arrive('fo_paid_stump', AT.x, AT.y);
        const b = arrive('fo_stump', AT.x + 400, AT.y);
        tick(20100);
        expect(Growth.growthAlertOf(a.id)?.alert).toBe(ALERT.GROW_NEEDS_ITEM);
        expect(Growth.growthAlertOf(b.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);

        Demolition.mark(a);
        tick(100);
        expect(Growth.growthAlertOf(a.id)).toBeNull();

        leave(b);
        tick(100);
        expect(Growth.growthAlertOf(b.id)).toBeNull();
    });
});

describe('a regrowth falls due at the same moment whatever the step', () => {
    it('Stump → Sapling → Tree, for free, in 100 ms and in 1000 ms ticks', () => {
        const run = (step) => {
            GameState.initNew();
            InventoryManager.init();
            clearMat();
            TileModifiers.clearAll();
            InventoryManager.addItem(SEEDLING, 1);
            const forest = arrive('fo_forest', AT.x + 150, AT.y);
            own(arrive('fo_stump', AT.x, AT.y), forest);
            const seen = [{ at: 0, typeId: typeAt() }];
            for (let t = 0; t < 32000; t += step) {
                TimedChanges.tick(step);
                const now = typeAt();
                if (seen[seen.length - 1].typeId !== now) seen.push({ at: t + step, typeId: now });
            }
            return { seen, clocks: tokenAt().clocks ?? null, seedlings: seedlings() };
        };
        const small = run(100);
        expect(run(1000)).toEqual(small);
        expect(small.seen.map(s => s.typeId)).toEqual(['fo_stump', 'fo_sapling', 'fo_tree']);
        expect(small.seen.map(s => s.at)).toEqual([0, 20000, 30000]);
        expect(small.seedlings).toBe(1);
    });
});
