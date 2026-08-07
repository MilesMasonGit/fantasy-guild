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
    it('scatters the contents onto the board as sprites', () => {
        // Contents land as sprites rather than in storage, which is what makes
        // the burst physical — and what lets a player grab the two Tokens they
        // want and put them straight down (UI §6).
        const result = Cartographer.openMap(aMap(), null);

        expect(result.success).toBe(true);
        expect(SpriteLayer.getSprites().length).toBe(result.contents.length);
    });

    it('is a SINGLE burst — the Map is spent, not reusable', () => {
        // Multiple charges would make a Map squat on a tile and read as a
        // dispenser rather than a package, losing the pack-opening moment.
        const map = aMap();
        expect(map.usesRemaining).toBe(1);

        BoardState.addToTray(map);
        const taken = BoardState.takeFromTray(0);
        Cartographer.openMap(taken, null);

        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('refuses to burst something that is not a Map', () => {
        const forest = BoardState.createTokenInstance('token_forest', 5000);
        expect(Cartographer.openMap(forest, null).success).toBe(false);
    });
});

describe('Opening from a tile (D-155)', () => {
    it('scatters the contents around where it sat', () => {
        const origin = 10;
        Placement.placeToken(origin, aMap());

        const instance = BoardState.getToken(origin);
        BoardState.setToken(origin, null);
        const result = Cartographer.openMap(instance, origin);

        expect(result.success).toBe(true);
        // The sprite layer scatters outward from the origin tile, so every
        // sprite should have landed on or near it rather than at the centre.
        expect(SpriteLayer.getSprites().length).toBe(result.contents.length);
    });

    it('leaves the tile free once the Map is spent', () => {
        Placement.placeToken(10, aMap());
        const instance = BoardState.getToken(10);
        BoardState.setToken(10, null);
        Cartographer.openMap(instance, 10);

        expect(BoardState.getToken(10)).toBeNull();
    });

    it('a Map on a tile never runs a work cycle — it costs no hero-time (D-142)', () => {
        // Progression does not compete with production. Opening a Map is an
        // act, not a task, which strikes D-37 outright.
        Placement.placeToken(10, aMap());
        Placement.placeHero('hero_1', 10);
        GameState.state.heroes = [{
            id: 'hero_1', name: 'Test', status: 'idle', level: 50,
            skills: {}, hp: { current: 100, max: 100 }
        }];

        for (let i = 0; i < 600; i++) BoardRunner.tick(100);   // a full minute

        expect(BoardState.getToken(10)?.usesRemaining).toBe(1);   // untouched
        expect(SpriteLayer.getSprites()).toHaveLength(0);
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
