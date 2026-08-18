import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getMap } from '../config/registries/mapRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * The burst — the game's headline reward beat (D-142, D-155, D-167).
 *
 * ⚠️ These tests pin the *mechanics*. They cannot pin the thing the phase is
 * actually for: whether a 3–6 item burst **feels** like a reward. D-167 flags
 * that the spectacle rests on presentation rather than volume, and that if it
 * reads flat the lever is presentation first and volume second — a judgement
 * only made by watching it.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const WOODLAND = 'map_woodland';

/** A Woodland Map Token instance, as bought. */
function aMap(typeId = 'token_map_woodland') {
    return BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.inventory.maxSlots = 50;
    // Auto-collect would tidy the burst away before it could be counted.
    GameState.state.settings = { ...(GameState.state.settings || {}), autoCollect: false };
});

describe('A burst yields 3–6 things (D-167)', () => {
    it('never rolls outside the band, across many bursts', () => {
        for (let i = 0; i < 300; i++) {
            const n = Cartographer.rollBurst(WOODLAND).length;
            expect(n).toBeGreaterThanOrEqual(Cartographer.BURST_MIN);
            expect(n).toBeLessThanOrEqual(Cartographer.BURST_MAX);
        }
    });

    it('draws only from that Map\'s own pool', () => {
        // A Map's loot pool is the ONLY meaning "biome" has (D-139). If an
        // entry can leak between Maps, themes stop meaning anything at all.
        const allowed = new Set(getMap(WOODLAND).pool.map(e => e.refId));

        for (let i = 0; i < 200; i++) {
            for (const entry of Cartographer.rollBurst(WOODLAND)) {
                expect(allowed.has(entry.refId)).toBe(true);
            }
        }
    });

    it('reaches every entry in the pool eventually, including the rarest', () => {
        const seen = new Set();
        for (let i = 0; i < 4000; i++) {
            for (const entry of Cartographer.rollBurst(WOODLAND)) seen.add(entry.refId);
        }
        for (const entry of getMap(WOODLAND).pool) {
            expect(seen.has(entry.refId)).toBe(true);
        }
    });

    it('contains a Manager in its pool — a Map is a complete kit (D-139)', () => {
        // Producers, their context, their buffs, THEIR MANAGER and their
        // enemies. One purchase eventually yields everything needed to run the
        // theme properly, including the automation that survives unattended.
        const pool = getMap(WOODLAND).pool.map(e => e.refId);
        expect(pool).toContain('token_lumber_camp');
        expect(pool.some(id => id.startsWith('token_bear') || id.includes('cow'))).toBe(true);
    });
});

describe('Opening from the Tray (D-155)', () => {
    it('populates the Tray directly with tokens when opened in the Tray', () => {
        const result = Cartographer.openMap(aMap(), 'tray');

        expect(result.success).toBe(true);
        const tokenEntries = result.contents.filter(e => e.kind === 'token');
        const itemEntries = result.contents.filter(e => e.kind === 'item');

        // Tokens that fit into Tray are in the Tray
        expect(BoardState.getTray().length).toBe(tokenEntries.length);
        // Items scatter onto the board as sprites
        expect(SpriteLayer.getSprites().length).toBe(itemEntries.length);
    });

    it('scatters excess tokens onto the board as sprites when the Tray is full', () => {
        // Fill Tray to max capacity
        while (BoardState.getTray().length < BoardState.TRAY_CAPACITY) {
            BoardState.addToTray(BoardState.createTokenInstance('token_forest', 100));
        }
        expect(BoardState.hasTraySpace()).toBe(false);

        const result = Cartographer.openMap(aMap(), 'tray');
        expect(result.success).toBe(true);
        // All burst contents land as sprites because Tray has no room
        expect(SpriteLayer.getSprites().length).toBe(result.contents.length);
    });

    it('is a SINGLE burst — the Map is spent, not reusable', () => {
        const map = aMap();
        expect(map.usesRemaining).toBe(1);

        BoardState.addToTray(map);
        const taken = BoardState.takeFromTray(0);
        Cartographer.openMap(taken, 'tray');

        // The map itself is consumed, and only new burst tokens are in the Tray
        expect(BoardState.getTray().some(t => t.typeId === 'token_map_woodland')).toBe(false);
    });

    it('refuses to burst something that is not a Map', () => {
        const forest = BoardState.createTokenInstance('token_forest', 5000);
        expect(Cartographer.openMap(forest, 'tray').success).toBe(false);
    });
});

describe('Maps freely sit overtop of the playmat (D-155)', () => {
    it('places a Map onto the board maps layer without occupying a grid cell', () => {
        const origin = 10;
        const result = Placement.placeToken(origin, aMap());

        expect(result.success).toBe(true);
        // The tile remains unoccupied by any token
        expect(BoardState.getToken(origin)).toBeNull();
        // The map sits as a board map overtop of the playmat
        const maps = BoardState.getBoardMaps().filter(s => s.typeId === 'token_map_woodland');
        expect(maps).toHaveLength(1);
    });

    it('bursts open from the playmat and scatters its contents', () => {
        const origin = 10;
        Placement.placeToken(origin, aMap());

        const map = BoardState.getBoardMaps().find(s => s.typeId === 'token_map_woodland');
        const instance = BoardState.removeBoardMap(map.id);
        const result = Cartographer.openMap(instance, origin);

        expect(result.success).toBe(true);
        expect(SpriteLayer.getSprites().length).toBe(result.contents.length);
    });

    it('bursts open from exact pixel coordinates of a free-sitting map', () => {
        const pixelOrigin = { x: 300, y: 400 };
        const result = Cartographer.openMap(aMap(), pixelOrigin);

        expect(result.success).toBe(true);
        const sprites = SpriteLayer.getSprites();
        expect(sprites.length).toBeGreaterThan(0);
        for (const s of sprites) {
            expect(s.fromX).toBe(364); // 300 + 128 / 2
            expect(s.fromY).toBe(464); // 400 + 128 / 2
        }
    });

    it('a Map does not block heroes or tokens placed on the grid tile underneath', () => {
        const origin = 10;
        Placement.placeToken(origin, aMap());
        // A regular token can be placed on the tile without conflict
        const forest = BoardState.createTokenInstance('token_forest', 5000);
        Placement.placeToken(origin, forest);
        expect(BoardState.getToken(origin)?.typeId).toBe('token_forest');

        Placement.placeHero('hero_1', origin);
        GameState.state.heroes = [{
            id: 'hero_1', name: 'Test', status: 'idle', level: 50,
            skills: { logging: { level: 50, xp: 1000 } }, hp: { current: 100, max: 100 }
        }];

        for (let i = 0; i < 600; i++) BoardRunner.tick(100);

        expect(BoardState.getToken(origin)?.usesRemaining).toBeLessThan(5000);
    });
});

describe('Discovery is driven by the burst, not the purchase (D-159)', () => {
    it('marks what actually came out, and reports the first sightings', () => {
        const result = Cartographer.openMap(aMap(), null);

        for (const entry of result.contents) {
            expect(Cartographer.isDiscovered(entry.refId)).toBe(true);
        }
        // Everything in the first burst is new by definition.
        expect(new Set(result.firstSeen).size).toBe(new Set(result.contents.map(c => c.refId)).size);
    });

    it('reports a repeat sighting as not-first', () => {
        Cartographer.markDiscovered('token_forest');
        const result = Cartographer.openMap(aMap(), null);
        expect(result.firstSeen).not.toContain('token_forest');
    });
});

describe('Bursts are random with no reliability guarantee (D-154)', () => {
    it('⚠️ can hand the player a burst with no producer in it at all', () => {
        // A genuine accepted cost, recorded as risk 16. Its two mitigations
        // arrive elsewhere — selling (D-146, built) and crafting (D-144, later)
        // — so the exposure is the first hour. This test exists to make the
        // exposure explicit rather than to assert it is fine.
        let sawABurstWithoutForests = false;
        for (let i = 0; i < 200 && !sawABurstWithoutForests; i++) {
            const contents = Cartographer.rollBurst(WOODLAND);
            if (!contents.some(e => e.refId === 'token_forest')) sawABurstWithoutForests = true;
        }
        expect(sawABurstWithoutForests).toBe(true);
    });
});
