import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Demolition from '../systems/board/Demolition.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { nearRadius } from '../systems/board/nearby.js';
import { setUpForestryScene, giveBirchSeedling, forestryReadout, QA_FOREST_TYPES as T, FOREST_SPOTS } from '../ui/dev/forestryDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Forestry button (brief 230 S2a): the owner's way to see the Forestry rulings by
 * clicking. It lays its Tokens out, and the engine does the rest.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
});

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const at = (p) => BoardState.tokensAtPoint(p.x, p.y)[0] ?? null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the Forestry scene', () => {
    it('⭐ shows every ruling by itself: a felled Oak regrows, the Forest plants within reach, the wild Stump waits, the Birch Stump stops', () => {
        expect(setUpForestryScene()).toEqual({ ok: true });
        const forester = GameState.state.heroes.find(h => h.name === 'QA Forester');
        const wild = at(FOREST_SPOTS.wildStump);
        expect(Demolition.refusalOf(wild)).toBeNull();

        // The Forester fells the first Oak (two 2 s logs): a Stump, waited for silently.
        run(5000);
        const felled = FOREST_SPOTS.oaks.map(at).find(t => t?.typeId === T.OAK_STUMP);
        expect(felled).toBeTruthy();

        // The Forest plants its third tree within its reach, paying a seedling.
        run(15000);
        const planted = BoardState.tokens().filter(t => t.typeId === T.OAK_SAPLING && !FOREST_SPOTS.oaks.some(p => p.x === t.x && p.y === t.y));
        expect(planted).toHaveLength(1);
        expect(dist(planted[0], FOREST_SPOTS.oakForest)).toBeLessThanOrEqual(nearRadius());

        // The wild Stump never moves on; the Birch Stump has stopped for its seedling.
        expect(at(FOREST_SPOTS.wildStump).typeId).toBe(T.OAK_STUMP);
        expect(Growth.growthAlertOf(wild.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);
        const birch = at(FOREST_SPOTS.birchStump);
        expect(Growth.growthAlertOf(birch.id)).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: ['item_birch_seedling'] });

        const lines = forestryReadout();
        expect(lines.some(l => /^QA Oak Forest: \d\/3 trees in its reach/.test(l))).toBe(true);
        expect(lines.some(l => l.startsWith('Wild QA Oak Stump: waiting for QA Oak Forest in reach') && l.includes('can be cleared'))).toBe(true);
        expect(lines).toContain('QA Birch Stump: stopped, needs Birch Seedling');

        // A seedling given: the Birch Stump grows on.
        giveBirchSeedling();
        run(200);
        expect(at(FOREST_SPOTS.birchStump).typeId).toBe(T.BIRCH_SAPLING);

        // The felled Oak comes back: Stump (14 s with the Forest), Sapling (20 s), Oak, felled again.
        const seen = FOREST_SPOTS.oaks.map(() => []);
        for (let t = 0; t < 60000; t += 100) {
            BoardRunner.tick(100);
            FOREST_SPOTS.oaks.forEach((p, i) => {
                const type = at(p)?.typeId;
                if (seen[i][seen[i].length - 1] !== type) seen[i].push(type);
            });
        }
        expect(seen.some(list => list.join(' ').includes(`${T.OAK_SAPLING} ${T.OAK} ${T.OAK_STUMP}`))).toBe(true);
        expect(forester).toBeTruthy();
    });

    it('while only Stumps and Saplings stand in reach, the Forester waits for one, not idle', () => {
        setUpForestryScene();
        const forester = GameState.state.heroes.find(h => h.name === 'QA Forester');
        let waited = false;
        for (let t = 0; t < 30000 && !waited; t += 100) {
            BoardRunner.tick(100);
            const w = Flags.waitingOf(forester.id);
            waited = w?.kind === 'node' && [T.OAK_STUMP, T.OAK_SAPLING].includes(BoardState.getTokenById(w.instanceId)?.typeId)
                && !BoardRunner.isHeroIdle(forester.id);
        }
        expect(waited).toBe(true);
        expect(forestryReadout().some(l => /^QA Forester: Waiting for QA Oak (Stump|Sapling) \(not idle\)$/.test(l))).toBe(true);
    });
});
