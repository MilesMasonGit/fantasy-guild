// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { walkerSortY } from '../ui/components/board/matLayers.js';
import { heroBoxAt } from '../ui/components/board/MatHero.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

const renders = { MatBoard: 0 };
vi.mock('../ui/dev/perf/PerfProfiler.jsx', async (orig) => ({
    ...(await orig()),
    usePerfRenderCount: (id) => { renders[id] = (renders[id] || 0) + 1; }
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **walking does not re-render the mat.** A walking enemy's or hero's box
 * follows the engine by itself; `MatBoard` re-renders for a walker only when
 * it changes who is in front of whom (it crosses another Token or a flag), or
 * starts, stops or turns. Before this, every step of every walker re-rendered
 * the whole mat (R5: 8.8 a game-second at S2, 239 of 265 from enemy steps
 * alone).
 */

registerTokenTypes({
    fixture_wnr_camp: {
        id: 'fixture_wnr_camp', name: 'Fixture WNR Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 4, intervalMs: 99999999, upkeep: [] }
    }
});

const h = React.createElement;
const mount = () => render(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, h(MatBoard))));

function seeded(seed = 11) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

describe('walkerSortY — a stand-in y that sorts like the real one', () => {
    it('sits between its neighbours, and holds still until it crosses one', () => {
        expect(walkerSortY(150, [100, 200])).toBe(150);
        expect(walkerSortY(110, [100, 200])).toBe(150);
        expect(walkerSortY(190, [100, 200])).toBe(150);
        expect(walkerSortY(210, [100, 200])).toBe(201);
        expect(walkerSortY(90, [100, 200])).toBe(99);
    });

    it('a tie keeps the real y, so the tie rules apply unchanged', () => {
        expect(walkerSortY(100, [100, 200])).toBe(100);
    });

    it('alone on the mat it is a constant', () => {
        expect(walkerSortY(123, [])).toBe(walkerSortY(456, []));
    });
});

describe('⭐ on the mat (CR3-008)', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => { cleanup(); EnemyMotion.setRandomForTests(); HeroMotion.setRandomForTests(); BoardState.setInstantArrival(true); });

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [];
    });

    it('an enemy’s steps move its boxes without re-rendering MatBoard, except when it crosses something', async () => {
        setMatTuning('enemyWalkSpeed', 100);
        setMatTuning('enemyPotterRadius', 160);
        EnemyMotion.setRandomForTests(seeded());
        const camp = placeAt('fixture_wnr_camp', 800, 500);
        const enemy = placeAt('fixture_enemy', 920, 500);
        enemy.tether = camp.id;

        const { container } = mount();
        const art = () => container.querySelector(`[data-token-id="${enemy.id}"][data-token-art]`);
        const overlay = () => container.querySelector(`[data-token-overlay="${enemy.id}"]`);
        const half = parseFloat(art().style.width) / 2;

        // What MatBoard must re-render for: the enemy's place in the stack and
        // whether (and which way) it walks.
        const signature = () => {
            const f = EnemyMotion.walkFacingOf(enemy.id);
            return `${f}|${f == null ? enemy.y : walkerSortY(enemy.y, [camp.y])}`;
        };

        let quietSteps = 0;
        let quietRenders = 0;
        for (let i = 0; i < 300; i++) {
            const before = signature();
            const r0 = renders.MatBoard;
            const p0 = { x: enemy.x, y: enemy.y };
            await act(async () => { EnemyMotion.tick(100); });
            const moved = enemy.x !== p0.x || enemy.y !== p0.y;
            if (moved && signature() === before) {
                quietSteps++;
                quietRenders += renders.MatBoard - r0;
                // ...and the boxes are where the engine says, all the same.
                for (const el of [art(), overlay()]) {
                    expect(drawnPoint(el)).toEqual({ x: enemy.x - half, y: enemy.y - half });
                }
            }
        }
        expect(quietSteps).toBeGreaterThan(50);
        expect(quietRenders).toBe(0);
    });

    it('a hero’s walk moves their figure without re-rendering MatBoard', async () => {
        BoardState.setInstantArrival(false);
        setMatTuning('flagRadius', 400);
        setMatTuning('walkSpeed', 120);
        setMatTuning('potterRadius', 0);
        GameState.state.heroes = [{ id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
        placeAt('fixture_producer', 1500, 500);

        const { container } = mount();
        await act(async () => { Flags.plant('h1', { x: 1200, y: 500 }); });
        const fig = () => container.querySelector('[data-board-hero="h1"]');
        expect(fig()).not.toBeNull();

        let steps = 0;
        let stepRenders = 0;
        for (let i = 0; i < 60 && HeroMotion.isWalking('h1'); i++) {
            const r0 = renders.MatBoard;
            const facing0 = BoardState.heroBodyOf('h1')?.facing;
            await act(async () => { BoardRunner.tick(100); });
            if (!HeroMotion.isWalking('h1') || BoardState.heroBodyOf('h1')?.facing !== facing0) continue;
            steps++;
            stepRenders += renders.MatBoard - r0;
            const at = heroBoxAt(HeroMotion.bodyView('h1'));
            expect(drawnPoint(fig())).toEqual({ x: at.left, y: at.top });
        }
        expect(steps).toBeGreaterThan(5);
        expect(stepRenders).toBe(0);
    });
});
