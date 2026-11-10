import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeReachEdge } from '../ui/dev/campsDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's reach-edge button (brief 560 R1): the one standard reach, seen by clicking. A camp
 * with an Oak Tree just inside its reach and one just outside, and a hand sent to it: the hand fells
 * the inside tree and never touches the outside one.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); });

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
});

afterEach(() => resetMatTuning());

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

describe('the reach-edge scene', () => {
    it('⭐ a tree 20 u inside the reach is felled; one 20 u outside is never touched', () => {
        const r = placeReachEdge();
        expect(r).toMatchObject({ ok: true, reach: STANDARD_REACH_U, insideWorked: true, outsideWorked: false, inReach: 1 });
        expect(r.inside).toBeLessThan(STANDARD_REACH_U);
        expect(r.outside).toBeGreaterThan(STANDARD_REACH_U);

        const hand = GameState.state.heroes.find(h => h.name === 'QA Edge hand');
        const trees = BoardState.tokens().filter(t => t.typeId === 'token_oak_tree');
        expect(trees).toHaveLength(2);
        const camp = BoardState.tokens().find(t => t.typeId === 'qa_camp_edge');
        const [inside, outside] = [...trees].sort((a, b) => Math.hypot(a.x - camp.x, a.y - camp.y) - Math.hypot(b.x - camp.x, b.y - camp.y));
        const outsideUses = outside.usesRemaining;

        let workedInside = false;
        for (let s = 0; s < 60; s++) {
            run(1000);
            const on = BoardState.workTokenOf(hand.id);
            expect(on).not.toBe(outside.id);
            if (on === inside.id) workedInside = true;
        }
        expect(workedInside).toBe(true);
        expect(BoardState.getTokenById(outside.id)?.usesRemaining).toBe(outsideUses);
    });
});
