import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setUpSkillLoopsScene, skillLoopsReadout, QA_TYPES } from '../ui/dev/skillLoopsDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's skill loops button (brief 230 S1a): the owner's way to see the speed-ups and the
 * never-wearing stations by clicking. It lays its Tokens out and reads the engine's own numbers.
 */

// As the game boots: a placement rebuilds the buffs around it through the runner's subscription.
beforeAll(() => BoardRunner.init());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
});

describe('the skill loops scene', () => {
    it('lays out the Sapling, the vein in its Minecarts, the Kitchen and the Windmill, and says what each does', () => {
        expect(setUpSkillLoopsScene()).toEqual({ ok: true });
        const count = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId).length;
        expect(count('token_oak_sapling')).toBe(1);
        expect(count(QA_TYPES.GROVE)).toBe(2);
        expect(count(QA_TYPES.MINECART)).toBe(5);
        expect(count(QA_TYPES.VEIN)).toBe(1);

        const lines = skillLoopsReadout();
        expect(lines[0]).toContain('grows in 12.0 s');
        expect(lines[1]).toContain('works in 2.0 s');
        expect(lines[1]).toContain('Stays where it stands');
        expect(lines[2]).toMatch(/unlimited \(5000 authored, ignored\)/);
        expect(lines[3]).toMatch(/unlimited \(1000 authored, ignored\)/);

        const vein = BoardState.tokens().find(t => t.typeId === QA_TYPES.VEIN);
        expect(Placement.moveTokenTo(vein.id, { x: vein.x + 300, y: vein.y }).success).toBe(false);
    });
});
