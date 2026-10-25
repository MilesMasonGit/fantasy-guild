import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setUpSkillLoopsScene, skillLoopsReadout, QA_TYPES, setUpWaitingScene, addCoalVein, waitingReadout, QA_WAIT_TYPES } from '../ui/dev/skillLoopsDev.js';
import * as Flags from '../systems/board/Flags.js';
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
beforeAll(() => { BoardRunner.init(); Flags.init(); });

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

describe('the waiting scene (brief 230 S1b)', () => {
    const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

    it('a miner waits silently for the resting vein; the furnace stops for Coal; a Coal Vein sends the smith mining', () => {
        GameState.state.heroes = [];
        expect(setUpWaitingScene()).toEqual({ ok: true });
        const count = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId).length;
        expect(count(QA_WAIT_TYPES.VEIN)).toBe(1);
        expect(count(QA_WAIT_TYPES.FURNACE)).toBe(1);
        expect(InventoryManager.getItemCount('item_coal')).toBe(1);

        run(12000);
        const lines = waitingReadout();
        expect(lines[0]).toMatch(/QA Copper Vein: resting, back in/);
        expect(lines[1]).toBe('QA Miner: Waiting for QA Copper Vein (not idle)');
        expect(lines[2]).toBe('QA Furnace: stopped, needs Coal; Coal in the Bank: 0');
        expect(lines[3]).toBe('QA Smith: Working: QA Furnace (counts as idle)');

        expect(addCoalVein()).toEqual({ ok: true });
        run(1500);
        const smith = GameState.state.heroes.find(h => h.name === 'QA Smith');
        expect(BoardState.getTokenById(Flags.statusOf(smith.id).instanceId)?.typeId).toBe(QA_WAIT_TYPES.COAL);
    });
});
