import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { addCoins, getCoins } from '../systems/inventory/Coins.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as World from '../systems/world/World.js';
import { priceRows, settledInRing } from '../systems/world/frontier.js';
import { resetMatTuning } from '../config/matTuning.js';
import { normaliseWorldTables, placePriceFactor, grownPrice, PLACE_PRICE_GROWTH_DEFAULT } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { setWorldTablesForTests, resetWorldTablesForTests } from '../config/registries/worldTablesRegistry.js';
import { ringStarsOf } from '../systems/world/ringStars.js';
import { authoredStars } from '../config/guildUpgrades.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Each further place settled in a ring costs a quarter more than the one before (owner,
 * 2026-11-27): the coins and every item quantity grow, rounded; the level asked does not; the count
 * is the places this guild has settled in that ring, in the order the player chose, and starts
 * again in the next ring.
 */

const COINS = { 1: 2100, 2: 13000, 3: 150000 };

function tables(extra = {}) {
    const p = PLACEHOLDER_WORLD_TABLES.prices;
    return {
        ...PLACEHOLDER_WORLD_TABLES,
        prices: { 1: { ...p[1], coins: COINS[1] }, 2: { ...p[2], coins: COINS[2] }, 3: { ...p[3], coins: COINS[3] } },
        ...extra
    };
}

const world = () => World.currentWorld();
const ringCells = (n) => world().cells.filter(c => c.ring === n);

/** Everything `cell` asks now put in place (its levels on one hero, its items and coins), then settled. */
function settle(cell) {
    const price = World.priceOf(cell);
    const hero = HeroManager.getAllHeroes()[0];
    for (const { skill, need } of price.skills) addXP(hero.id, skill, Math.max(0, xpForLevel(need) - (hero.skills[skill]?.xp || 0)));
    for (const { itemId, need, have } of price.items) if (need > have) InventoryManager.addItem(itemId, need - have);
    if (price.coins?.short) addCoins(price.coins.need - price.coins.have);
    const result = World.settleCell(cell.id);
    expect(result.success, `${cell.id}: ${result.reason}`).toBe(true);
    return result;
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    setWorldTablesForTests(tables());
    World.createWorld({ seed: 4242 });
    GameState.state.progress.rosterLimit = 4;
    HeroManager.addHero(generateHero());
    // Every ring's star lit, so ring 2 can be settled here.
    for (const star of authoredStars()) {
        if (ringStarsOf([star]).length) GameState.state.progress.guildUpgrades[star.id] = 1;
    }
});
afterEach(() => {
    resetMatTuning();
    resetWorldTablesForTests();
});

describe('the growth setting (pure)', () => {
    it('is 1.25 when the tables say none, and reads a written one', () => {
        expect(PLACE_PRICE_GROWTH_DEFAULT).toBe(1.25);
        expect(normaliseWorldTables(PLACEHOLDER_WORLD_TABLES).placePriceGrowth).toBe(1.25);
        expect(normaliseWorldTables(tables({ placePriceGrowth: 1.5 })).placePriceGrowth).toBe(1.5);
        expect(placePriceFactor({}, 2)).toBe(1.5625);
    });

    it('a growth under 1 or not a number is 1.25, with an issue', () => {
        for (const bad of [0.8, 'fast', -1]) {
            const t = normaliseWorldTables(tables({ placePriceGrowth: bad }));
            expect(t.placePriceGrowth).toBe(1.25);
            expect(t.issues.some(i => /place price growth/.test(i))).toBe(true);
        }
        expect(normaliseWorldTables(tables()).issues.some(i => /place price growth/.test(i))).toBe(false);
    });

    it('the 1st, 2nd and 3rd place: x1, x1.25, x1.5625, rounded to whole numbers', () => {
        const t = normaliseWorldTables(tables());
        expect([0, 1, 2].map(n => grownPrice(2100, t, n))).toEqual([2100, 2625, 3281]);
        expect([0, 1, 2].map(n => grownPrice(7, t, n))).toEqual([7, 9, 11]);
        expect(grownPrice(2100, t, 8)).toBe(12517);
    });

    it('priceRows grows coins and items by the factor, never the levels', () => {
        const cell = { requires: { items: [{ itemId: 'a', qty: 10 }, { itemId: 'b', qty: 3 }], skills: [{ skill: 'mining', level: 5 }] } };
        const rows = priceRows(cell, {
            itemCount: () => 0, skillLevel: () => 5, coinsAsked: () => 2100, coinCount: () => 0, priceFactor: () => 1.5625
        });
        expect(rows.items.map(r => r.need)).toEqual([16, 5]);
        expect(rows.coins.need).toBe(3281);
        expect(rows.skills).toEqual([{ skill: 'mining', need: 5, have: 5, short: false }]);
    });

    it('counts the settled cells of one ring only, the cell itself left out', () => {
        const w = { cells: [{ id: 'a', ring: 1 }, { id: 'b', ring: 1 }, { id: 'c', ring: 1 }, { id: 'd', ring: 2 }] };
        const settled = new Set(['a', 'b', 'd']);
        expect(settledInRing(w, settled, 1, 'c')).toBe(2);
        expect(settledInRing(w, settled, 1, 'a')).toBe(1);
        expect(settledInRing(w, settled, 2, 'e')).toBe(1);
    });
});

describe('⭐ settling places in order', () => {
    it('⭐ the 1st, 2nd and 3rd place in ring 1 ask x1, x1.25, x1.5625 in coins and items; the level does not move', () => {
        const [a, b, c] = ringCells(1);
        const first = World.priceOf(a);
        expect(first.coins.need).toBe(2100);
        expect(first.items.map(r => r.need)).toEqual(a.requires.items.map(i => i.qty));
        const paid = settle(a);
        expect(paid.price.coins.need).toBe(2100);

        const second = World.priceOf(b);
        expect(second.coins.need).toBe(2625);
        expect(second.items.map(r => r.need)).toEqual(b.requires.items.map(i => Math.round(i.qty * 1.25)));
        expect(second.skills.map(s => s.need)).toEqual(b.requires.skills.map(s => s.level));
        const coinsBefore = getCoins();
        const bank = Object.fromEntries(second.items.map(r => [r.itemId, Math.max(r.have, r.need)]));
        settle(b);
        expect(coinsBefore + Math.max(0, 2625 - coinsBefore) - getCoins()).toBe(2625);
        for (const r of second.items) expect(InventoryManager.getItemCount(r.itemId), r.itemId).toBe(bank[r.itemId] - r.need);

        const third = World.priceOf(c);
        expect(third.coins.need).toBe(3281);
        expect(third.items.map(r => r.need)).toEqual(c.requires.items.map(i => Math.round(i.qty * 1.5625)));
        expect(third.skills.map(s => s.need)).toEqual(c.requires.skills.map(s => s.level));
    });

    it('⭐ the order is the player\'s: whichever place is settled second asks the second price', () => {
        const cells = ringCells(1);
        const last = cells[cells.length - 1];
        expect(World.priceOf(last).coins.need).toBe(2100);
        settle(last);
        expect(World.priceOf(cells[0]).coins.need).toBe(2625);
        expect(World.priceOf(cells[1]).coins.need).toBe(2625);
    });

    it('⭐ the count starts again in the next ring', () => {
        const ones = ringCells(1);
        settle(ones[0]);
        settle(ones[1]);
        expect(World.priceOf(ones[2]).coins.need).toBe(3281);
        const states = World.cellStatesNow();
        const outer = ringCells(2).find(c => states.get(c.id) === 'frontier');
        expect(outer).toBeTruthy();
        expect(World.priceOf(outer).coins.need).toBe(13000);
        expect(World.priceOf(outer).items.map(r => r.need)).toEqual(outer.requires.items.map(i => i.qty));
    });

    it('a world settled before keeps working: the stored price is the first place\'s, grown when read', () => {
        const [a, b] = ringCells(1);
        const stored = JSON.stringify(b.requires);
        settle(a);
        expect(JSON.stringify(b.requires)).toBe(stored);
        expect(World.regionIdOfCell(a.id)).toBeTruthy();
    });

    it('the growth in the tables is the one used', () => {
        setWorldTablesForTests(tables({ placePriceGrowth: 2 }));
        const [a, b] = ringCells(1);
        settle(a);
        expect(World.priceOf(b).coins.need).toBe(4200);
    });
});
