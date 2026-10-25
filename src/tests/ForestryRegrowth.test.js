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
 * Forestry regrowth (brief 230 S2a): a felled tree's Stump grows back into a Sapling only with a
 * Forest of its species in reach (its clock stands still without one), and pays one seedling from
 * the Bank when it does; with none it is stopped and says so. A Sapling whose Forest goes finishes
 * growing. The Forest answer is cached per Token, refreshed by the neighbourhood rebuild.
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

    it('needs nearby: blanks dropped, duplicates once; cost summed by item, bad lines dropped; kept per block', () => {
        const def = {
            grows: {
                into: 'x', afterMs: 1000, needsNearby: ['a', ' ', 'a', 'b', 7],
                cost: [{ itemId: 's', quantity: 1 }, { itemId: 's', quantity: 2 }, { itemId: '', quantity: 1 }, { itemId: 't', quantity: 0 }]
            }
        };
        const terms = growsTermsOf(def);
        expect(terms).toEqual({ needsNearby: ['a', 'b'], cost: [{ itemId: 's', quantity: 3 }] });
        expect(growsTermsOf(def)).toBe(terms);
        expect(Object.isFrozen(terms.needsNearby)).toBe(true);
    });
});

describe('⭐ a Stump regrows only with a Forest of its species in reach', () => {
    it('with one in reach it grows in its time and pays one seedling', () => {
        InventoryManager.addItem(SEEDLING, 3);
        arrive('fo_forest', AT.x + 150, AT.y);
        arrive('fo_stump', AT.x, AT.y);
        tick(19900);
        expect(typeAt()).toBe('fo_stump');
        expect(seedlings()).toBe(3);
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
        expect(seedlings()).toBe(2);
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

    it('a Forest of another species does not count, nor one out of reach', () => {
        arrive('fo_birch_forest', AT.x + 150, AT.y);
        arrive('fo_forest', AT.x + 400, AT.y);
        const stump = arrive('fo_stump', AT.x, AT.y);
        InventoryManager.addItem(SEEDLING, 1);
        tick(30000, 1000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks?.growMs ?? 0).toBe(0);
    });

    it('⭐ a Forest planted beside it later starts its clock from where it stood, and the alert drops', () => {
        InventoryManager.addItem(SEEDLING, 1);
        const stump = arrive('fo_stump', AT.x, AT.y);
        tick(5000);
        expect(stump.clocks?.growMs ?? 0).toBe(0);
        arrive('fo_forest', AT.x, AT.y + 150);
        tick(19900);
        expect(typeAt()).toBe('fo_stump');
        expect(Growth.growthAlertOf(stump.id)).toBeNull();
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
        expect(watch.log.map(e => e.alert)).toEqual([ALERT.GROW_NEEDS_NEARBY, null]);
    });

    it('⭐ its Forest going stops the clock where it stands; another arriving carries on from there', () => {
        InventoryManager.addItem(SEEDLING, 1);
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        const stump = arrive('fo_stump', AT.x, AT.y);
        tick(12000);
        leave(forest);
        tick(30000);
        expect(typeAt()).toBe('fo_stump');
        expect(stump.clocks.growMs).toBe(12000);
        arrive('fo_forest', AT.x - 150, AT.y);
        tick(7900);
        expect(typeAt()).toBe('fo_stump');
        tick(100);
        expect(typeAt()).toBe('fo_sapling');
    });

    it('a Forest that speeds its species halves the regrowth too, and the floor and the gate work together', () => {
        InventoryManager.addItem(SEEDLING, 1);
        const stump = arrive('fo_stump', AT.x, AT.y);
        arrive('fo_fast_forest', AT.x + 150, AT.y);
        expect(TimedChanges.nextGrowth(stump)).toMatchObject({ totalMs: 10000, paused: false });
        tick(10000);
        expect(typeAt()).toBe('fo_sapling');
    });

    it('⭐ a Sapling whose Forest goes finishes growing (only a Stump needs the Forest)', () => {
        InventoryManager.addItem(SEEDLING, 1);
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        arrive('fo_stump', AT.x, AT.y);
        tick(20000);
        expect(typeAt()).toBe('fo_sapling');
        leave(forest);
        tick(10000);
        expect(typeAt()).toBe('fo_tree');
    });

    it('⭐ the answer is kept per Token, not scanned per tick: a Forest moved with no rebuild is not seen until the rebuild', () => {
        const forest = arrive('fo_forest', AT.x + 150, AT.y);
        const stump = arrive('fo_stump', AT.x, AT.y);
        expect(Growth.gateMet(stump)).toBe(true);
        // Moved out of reach behind the rebuild's back: the kept answer stands.
        BoardState.setTokenPoint(forest.id, AT.x + 600, AT.y);
        expect(Growth.gateMet(stump)).toBe(true);
        // The rebuild a real move makes (both ends) is what refreshes it.
        TileModifiers.rebuildAround([{ x: AT.x + 150, y: AT.y }, { x: AT.x + 600, y: AT.y }]);
        expect(Growth.gateMet(stump)).toBe(false);
    });

    it('a growth that needs nothing nearby is not gated (today\'s Saplings)', () => {
        const sapling = arrive('fo_sapling', AT.x, AT.y);
        expect(Growth.gateMet(sapling)).toBe(true);
        tick(10000);
        expect(typeAt()).toBe('fo_tree');
    });
});

describe('⭐ every regrowth costs a seedling from the Bank', () => {
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

    it('a free gated growth (no cost) never stops for want of one', () => {
        arrive('fo_forest', AT.x + 150, AT.y);
        arrive('fo_free_stump', AT.x, AT.y);
        tick(20000);
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
    it('Stump → Sapling → Tree, one seedling, in 100 ms and in 1000 ms ticks', () => {
        const run = (step) => {
            GameState.initNew();
            InventoryManager.init();
            clearMat();
            TileModifiers.clearAll();
            InventoryManager.addItem(SEEDLING, 1);
            arrive('fo_forest', AT.x + 150, AT.y);
            arrive('fo_stump', AT.x, AT.y);
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
        expect(small.seedlings).toBe(0);
    });
});
