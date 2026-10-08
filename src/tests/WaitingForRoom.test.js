import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A failed search is now remembered while the board, the Mat Tuner and the
 * registry are all exactly as they were — so these pin that ANY of them
 * changing is seen at once, including the case R10 named: room appearing
 * because an unrelated Token MOVED away (not a removal).
 */

registerTokenTypes({
    fixture_wfr_forest: {
        id: 'fixture_wfr_forest', name: 'Fixture WFR Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_passive', weight: 1 }], allowance: 3, intervalMs: 5000, upkeep: [] }
    }
});

const FOREST_AT = { x: 200, y: 200 };

/** A 6-step mat packed with placed blockers at the minimum gap, clear only round `FOREST_AT`. */
function packedMat() {
    setMatTuning('matSteps', 6);
    setMatTuning('tokenCap', 2000);   // crowding is the point, not the Token cap
    const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
    const blockers = [];
    for (let x = 64; x <= matW() - 64; x += gap) {
        for (let y = 64; y <= matH() - 64; y += gap) {
            if (Math.hypot(x - FOREST_AT.x, y - FOREST_AT.y) < gap) continue;
            blockers.push(placeAt('fixture_kitchen', x, y));
        }
    }
    return blockers;
}

/** The blocker nearest a point. */
const nearestTo = (blockers, p) => blockers
    .map(b => ({ b, d: Math.hypot(b.x - p.x, b.y - p.y) }))
    .sort((a, b) => a.d - b.d)[0].b;

/** How many times a call scanned the mat (every real search starts with one). */
function scansDuring(fn) {
    const spy = vi.spyOn(BoardState, 'tokens');
    try {
        fn();
        return spy.mock.calls.length;
    } finally {
        spy.mockRestore();
    }
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
    SpawnerSystem.resetAlerts();
});

afterEach(() => resetMatTuning());

describe('⭐ a failed placement search is remembered only while nothing it reads has changed (CR3-201)', () => {
    it('asking the same failing question again does not search again', () => {
        const blockers = packedMat();
        const target = nearestTo(blockers, { x: 600, y: 400 });
        const P = { x: target.x, y: target.y };
        expect(MatPlacement.findSpot('fixture_producer', P)).toBeNull();
        expect(scansDuring(() => expect(MatPlacement.findSpot('fixture_producer', P)).toBeNull())).toBe(0);
    });

    it('a blocker MOVED away (no add, no remove) makes room at once', () => {
        const blockers = packedMat();
        const target = nearestTo(blockers, { x: 600, y: 400 });
        const P = { x: target.x, y: target.y };
        expect(MatPlacement.findSpot('fixture_producer', P)).toBeNull();

        // Onto another blocker's spot: no rules here, it just has to leave P.
        const elsewhere = nearestTo(blockers, { x: 64, y: matH() });
        BoardState.setTokenPoint(target.id, elsewhere.x, elsewhere.y);
        expect(MatPlacement.findSpot('fixture_producer', P)).toEqual({ x: P.x, y: P.y, nudge: 0 });
    });

    it('a Mat Tuner change is seen at once', () => {
        const blockers = packedMat();
        const target = nearestTo(blockers, { x: 600, y: 400 });
        const P = { x: (target.x + nearestTo(blockers.filter(b => b !== target), target).x) / 2, y: target.y };
        expect(MatPlacement.findSpot('fixture_producer', P, { reach: 0 })).toBeNull();

        setMatTuning('overlapPct', 95);    // hitboxes may overlap almost entirely
        expect(MatPlacement.findSpot('fixture_producer', P, { reach: 0 })).not.toBeNull();
    });

    it('a registry reload forgets what was remembered', () => {
        const blockers = packedMat();
        const target = nearestTo(blockers, { x: 600, y: 400 });
        const P = { x: target.x, y: target.y };
        expect(MatPlacement.findSpot('fixture_producer', P)).toBeNull();
        expect(scansDuring(() => MatPlacement.findSpot('fixture_producer', P))).toBe(0);
        registerTokenTypes({ fixture_wfr_unrelated: { id: 'fixture_wfr_unrelated', name: 'Fixture WFR Unrelated', uses: 1 } });
        expect(scansDuring(() => MatPlacement.findSpot('fixture_producer', P))).toBeGreaterThan(0);
    });
});

describe('⭐ a waiting spawner spawns the tick room appears (CR3-201, R10)', () => {
    it('room made by an unrelated Token MOVING away, not by a removal', () => {
        const blockers = packedMat();
        const forest = placeAt('fixture_wfr_forest', FOREST_AT.x, FOREST_AT.y);
        const spawned = () => BoardState.tokens().filter(t => t.typeId === 'fixture_passive');

        TimedChanges.tick(5000);
        TimedChanges.tick(100);
        TimedChanges.tick(100);
        expect(spawned()).toHaveLength(0);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toEqual({ alert: ALERT.SPAWN_NO_ROOM, needs: [] });

        // Every blocker within 300 u of the Forest walks off into the far corner,
        // piling up there (no rules apply to a bare setTokenPoint).
        for (const b of blockers) {
            if (Math.hypot(b.x - FOREST_AT.x, b.y - FOREST_AT.y) < 300) {
                BoardState.setTokenPoint(b.id, matW() - 64, matH() - 64);
            }
        }
        TimedChanges.tick(100);
        expect(spawned()).toHaveLength(1);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
    });
});
