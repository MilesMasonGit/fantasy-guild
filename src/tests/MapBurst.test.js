import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
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

});

describe('Maps freely sit overtop of the playmat (D-155)', () => {
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
