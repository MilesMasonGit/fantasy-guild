// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Occupation from '../systems/board/Occupation.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import { resetMatTuning } from '../config/matTuning.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { PriceRows } from '../ui/components/atlas/WorldPrice.jsx';
import { stockSettleCoins } from './fixtures/worldQa.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ A save meets content deleted (or renamed) in the CMS since it was made: the world's cells were
 * written at the new game, so they can name an enemy or an item the data no longer has. Neither may
 * strand the save, and nothing is taken out of it: restoring the id restores the thing.
 */

const GONE_ENEMY = 'token_fixture_deleted_enemy';
const GONE_ITEM = 'item_fixture_deleted_ore';

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: 4242 });
}

function ringOneCell() {
    return World.currentWorld().cells.find(c => c.ring === 1);
}

/** Every hero level and Bank item the cell asks for. */
function meet(cell) {
    GameState.state.progress.rosterLimit = 4;
    const hero = HeroManager.addHero(generateHero());
    for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
    for (const { itemId, qty } of cell.requires.items) if (getItem(itemId)) InventoryManager.addItem(itemId, qty);
    stockSettleCoins(cell);
    return hero;
}

/** A Bank stack of an item the data has no definition for, as a save made before the delete holds. */
function holdGhost(itemId, quantity) {
    GameState.inventory.items[itemId] = { itemId, quantity, dur: null };
}

beforeAll(() => {
    Flags.init();
    Arrival.init();
});
afterAll(() => {
    Flags.teardown();
    Arrival.teardown();
    resetMatTuning();
});
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    newGame();
});
afterEach(() => cleanup());

describe('⭐ a held mat whose arrival enemy was deleted', () => {
    it('the fixture ids are missing from the data', () => {
        expect(getTokenType(GONE_ENEMY)).toBeFalsy();
        expect(getItem(GONE_ITEM)).toBeFalsy();
    });

    it('⭐ a save held by an enemy whose type is gone loads unheld; the ghost stays on the mat', () => {
        const cell = ringOneCell();
        const hero = meet(cell);
        const settled = World.settleCell(cell.id);
        expect(settled.success, settled.reason).toBe(true);
        const ids = settled.arrival.ids;
        // Beat all but one, then the CMS deletes the last one's type under the save.
        for (const id of ids.slice(1)) {
            BoardState.removeToken(id);
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: id });
        }
        const ghostId = ids[0];
        BoardState.getTokenById(ghostId).typeId = GONE_ENEMY;

        const data = JSON.parse(GameState.serializeJson());
        loadSavedState(migrateState(data.state, data.version));
        expect(GameState.state.board.arrival.cleared).toBe(false);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});

        expect(Occupation.standingEnemies()).toEqual([]);
        expect(Occupation.isOccupied()).toBe(false);
        // The place works: a node is no longer refused as held.
        const node = BoardState.tokens().find(t => BoardState.isFixture(t));
        expect(Flags.orderRefusal(hero.id, node)?.reason).not.toBe(Flags.SKIP.OCCUPIED);
        // Nothing removed: the ghost and its arrival record are still there.
        const ghost = BoardState.getTokenById(ghostId);
        expect(ghost?.typeId).toBe(GONE_ENEMY);
        expect(GameState.state.board.arrival.ids).toEqual(ids);
    });

    it('a held mat with a real enemy still standing beside the ghost stays held', () => {
        const cell = ringOneCell();
        meet(cell);
        const { arrival } = World.settleCell(cell.id);
        expect(arrival.ids.length).toBeGreaterThanOrEqual(2);
        BoardState.getTokenById(arrival.ids[0]).typeId = GONE_ENEMY;
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(Occupation.isOccupied()).toBe(true);
        expect(Occupation.standingEnemies().map(t => t.id)).toEqual(arrival.ids.slice(1));
    });

    it('⭐ a place not yet settled whose stored arrival names a gone enemy leaves it out', () => {
        const cell = ringOneCell();
        meet(cell);
        const real = cell.arrival.map(r => ({ ...r }));
        cell.arrival.unshift({ typeId: GONE_ENEMY, count: 2 });
        const { arrival } = World.settleCell(cell.id);
        const placed = arrival.ids.map(id => BoardState.getTokenById(id).typeId);
        expect(placed).not.toContain(GONE_ENEMY);
        expect(placed).toHaveLength(real.reduce((n, r) => n + r.count, 0));
        expect(arrival.unplaced).toEqual([]);
        // The stored world keeps the row: restoring the id restores it.
        expect(cell.arrival[0]).toEqual({ typeId: GONE_ENEMY, count: 2 });
    });

    it('an arrival of nothing but gone enemies holds nothing', () => {
        const res = Arrival.occupy([{ typeId: GONE_ENEMY, count: 3 }], { seed: 1 });
        expect(res).toEqual({ ids: [], unplaced: [] });
        expect(Occupation.isOccupied()).toBe(false);
    });
});

describe('⭐ a place priced in a deleted item', () => {
    it('⭐ the row is not asked, the map says so, and settling takes nothing of the hidden stack', () => {
        const cell = ringOneCell();
        meet(cell);
        cell.requires.items.push({ itemId: GONE_ITEM, qty: 50 });
        holdGhost(GONE_ITEM, 7);

        const price = World.priceOf(cell);
        expect(price.items.map(r => r.itemId)).not.toContain(GONE_ITEM);
        expect(price.dropped).toEqual([GONE_ITEM]);
        expect(price.met).toBe(true);

        const { container } = render(React.createElement(PriceRows, { price }));
        const note = container.querySelector('[data-world-price-dropped]');
        expect(note?.textContent).toContain(GONE_ITEM);
        expect(container.querySelector(`[data-world-price-item="${GONE_ITEM}"]`)).toBeNull();

        const settled = World.settleCell(cell.id);
        expect(settled.success, settled.reason).toBe(true);
        expect(GameState.inventory.items[GONE_ITEM]?.quantity).toBe(7);
        expect(cell.requires.items.at(-1)).toEqual({ itemId: GONE_ITEM, qty: 50 });
    });

    it('a price with no gone item says nothing more', () => {
        const price = World.priceOf(ringOneCell());
        expect(price.dropped).toEqual([]);
        const { container } = render(React.createElement(PriceRows, { price }));
        expect(container.querySelector('[data-world-price-dropped]')).toBeNull();
    });
});
