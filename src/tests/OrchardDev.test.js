import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setUpOrchardScene, putOrchardByLoneTree, orchardReadout, QA_ORCHARD as T, ORCHARD_SPOTS, BARE_SPRITE } from '../ui/dev/orchardDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Orchards buttons (brief 230 S2b): the owner's way to see the Orchard rulings by
 * clicking. They lay their Tokens out, and the engine does the rest.
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

describe('the Orchards scene', () => {
    it('⭐ shows every ruling by itself: picked bare, Bare as its picture, fruiting again beside the Orchard; the lone tree stays Bare', () => {
        expect(putOrchardByLoneTree().ok).toBe(false);
        expect(setUpOrchardScene()).toEqual({ ok: true });
        const fruiting = at(ORCHARD_SPOTS.fruiting);
        const bare = at(ORCHARD_SPOTS.bare);
        const lone = at(ORCHARD_SPOTS.lone);
        for (const t of [fruiting, bare, lone]) {
            expect(t.typeId).toBe(T.TREE);
            expect(FixedTokens.isFixed(t)).toBe(true);
        }
        expect(Respawn.restingSpriteOf(bare)).toBe(BARE_SPRITE);
        expect(Respawn.restingSpriteOf(lone)).toBe(BARE_SPRITE);
        expect(Respawn.restingSpriteOf(fruiting)).toBeNull();
        expect(InventoryManager.getItemCount('item_apple_seed')).toBe(5);

        run(200);
        // The second tree fruits again in 18 s (30 s, the Orchard −40 %); the lone one waits.
        expect(Respawn.nextRespawn(bare)).toMatchObject({ paused: false, totalMs: 18000 });
        expect(Respawn.nextRespawn(lone)).toMatchObject({ paused: true });
        expect(Growth.growthAlertOf(lone.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);
        expect(orchardReadout().join('\n')).toMatch(/Lone tree: Bare, waiting for QA Apple Orchard in reach/);

        // Three picks, and the tree beside it is Bare too.
        run(12000);
        expect(Respawn.isResting(fruiting)).toBe(true);
        expect(Respawn.restingSpriteOf(fruiting)).toBe(BARE_SPRITE);
        run(7000);
        expect(Respawn.isResting(bare)).toBe(false);

        // The Orchard plants its third tree within its reach.
        run(40000);
        const family = BoardState.tokens().filter(t => t.typeId === T.SAPLING || (t.typeId === T.TREE && t.id !== lone.id));
        expect(family).toHaveLength(3);
        expect(Respawn.isResting(lone)).toBe(true);
        expect(Number(lone.clocks?.respawnMs) || 0).toBe(0);

        // An Orchard beside the lone tree: it fruits again.
        expect(putOrchardByLoneTree()).toEqual({ ok: true });
        run(18200);
        expect(Respawn.isResting(lone)).toBe(false);
        expect(Growth.growthAlertOf(lone.id)).toBeNull();
    });

    it('the picker waits silently while both trees beside the Orchard are Bare', () => {
        setUpOrchardScene();
        // The fruiting tree's three picks, then both are Bare.
        let waited = false;
        for (let t = 0; t < 20000; t += 100) {
            BoardRunner.tick(100);
            if (orchardReadout().some(l => /QA Picker: Waiting for QA Apple Tree \(not idle\)/.test(l))) waited = true;
        }
        expect(waited).toBe(true);
    });
});
