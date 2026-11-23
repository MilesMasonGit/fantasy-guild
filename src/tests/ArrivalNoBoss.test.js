import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { resetMatTuning } from '../config/matTuning.js';
import worldData from '../../data/world.json';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A boss comes from a camp only: a settled place's arrival never rolls one. The world rings'
 * `bossChance` and `bosses` stay in the data until a content pack clears them, and are ignored.
 */

const bossIds = new Set(Object.values(worldData.arrival || {}).flatMap(r => (r.bosses || []).map(b => b.id)));

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
});

describe('arrivals roll no loose boss', () => {
    it('the data still lists bosses with a chance (the pack has not cleared them yet)', () => {
        expect(bossIds.size).toBeGreaterThan(0);
        expect(Object.values(worldData.arrival).some(r => r.bossChance > 0)).toBe(true);
    });

    it('the world tables read from the data carry no boss chance and no bosses', () => {
        const tables = normaliseWorldTables(worldData);
        for (const ring of Object.values(tables.arrival)) {
            expect(ring).not.toHaveProperty('bossChance');
            expect(ring).not.toHaveProperty('bosses');
            expect(ring.enemies.length).toBeGreaterThan(0);
        }
    });

    it('no world, over many seeds, has a place arriving with a boss', () => {
        for (let seed = 1; seed <= 12; seed++) {
            GameState.initNew();
            EngineBootstrap.createDefaultGameData();
            World.createWorld({ seed: seed * 977 });
            const rows = World.currentWorld().cells.flatMap(c => c.arrival || []);
            expect(rows.length).toBeGreaterThan(0);
            expect(rows.some(r => r.boss)).toBe(false);
            expect(rows.filter(r => bossIds.has(r.typeId))).toEqual([]);
        }
    });

    it('a stored world from before still listing a boss puts down only its other enemies', () => {
        EngineBootstrap.createDefaultGameData();
        const res = Arrival.occupy([
            { typeId: 'token_wolf_alpha', count: 1, boss: true },
            { typeId: 'token_wolf', count: 2 }
        ], { seed: 3 });
        const placed = res.ids.map(id => BoardState.getTokenById(id).typeId);
        expect(placed).toEqual(['token_wolf', 'token_wolf']);
    });
});
