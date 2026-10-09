// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatToken } from '../ui/components/board/MatToken.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { posterItemLayout, POSTER_CENTRE } from '../ui/components/board/QuestPoster.jsx';
import { resetSpawnMotion, SPAWN_MS } from '../ui/components/board/spawnMotion.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { DragGhost } from '../ui/dnd/DragGhost.jsx';
import { overlayFilter } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';
import * as Flags from '../systems/board/Flags.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../ui/components/base/ToastContainer.jsx', () => ({
    default: () => null, ToastContainer: () => null
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * UI motion and polish: a spawned Token pops out of its spawner, the quest billboard carries the
 * item it wants, and a carried Bank item casts the hard pixel shadow.
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
}

let animateCalls;
beforeEach(() => {
    resetDrawSwitches();
    resetMatTuning();
    resetSpawnMotion();
    Flags.init();
    animateCalls = [];
    HTMLElement.prototype.animate = function (keyframes, options) {
        animateCalls.push({ el: this, keyframes, options });
        return { cancel() {} };
    };
});
afterEach(() => {
    cleanup();
    delete HTMLElement.prototype.animate;
    Flags.teardown();
    resetDrawSwitches();
});

describe('spawn pop-out', () => {
    /** A spawner, then a new Token landing at (900, 500) and the spawn event, all in one act. */
    async function spawnOne() {
        newGame();
        const spawner = placeAt('fixture_tool', 500, 500);
        const view = mount(h(MatBoard));
        let child;
        await act(async () => {
            child = placeAt('fixture_tool_gated', 900, 500);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: child.id, typeId: child.typeId });
            EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, {
                spawnerId: spawner.id, instanceId: child.id, typeId: child.typeId, name: 'x'
            });
        });
        return { view, spawner, child };
    }
    const forChild = (child) => animateCalls.filter(c => c.el.getAttribute('data-token-id') === child.id);

    it('plays from the spawner toward the Token spot, on both boxes', async () => {
        const { child } = await spawnOne();
        const calls = forChild(child);
        expect(calls).toHaveLength(2);
        const [first, last] = calls[0].keyframes;
        // The spawner stands 400 mat units left of the new spot.
        expect(first.transform).toContain('translate(-400px, 0px)');
        expect(last.transform).toContain('translate(0px, 0px)');
        expect(calls[0].options.duration).toBe(SPAWN_MS);
        expect(calls[0].options.composite).toBe('add');
        // Transform only: nothing that moves layout.
        expect(Object.keys(first)).toEqual(['transform']);
    });

    it('does not play when the Token was already on the mat', () => {
        newGame();
        const tok = placeAt('fixture_tool_gated', 900, 500);
        mount(h(MatBoard));
        expect(forChild(tok)).toHaveLength(0);
    });

    it('does not play with the spawnMotion switch off', async () => {
        setDrawn('spawnMotion', false);
        const { child } = await spawnOne();
        expect(forChild(child)).toHaveLength(0);
    });
});

describe('quest billboard', () => {
    const collection = {
        id: 'q_col', tutorial: false, title: 'Gather', type: 'collection',
        targetType: 'item_collected', itemId: 'fixture_oak_wood',
        requiredCount: 3, currentCount: 0, rewardItems: [], done: false
    };

    it('draws the target item centred on the poster, at a whole-pixel scale', () => {
        newGame();
        registerItems({ fixture_oak_wood: { id: 'fixture_oak_wood', name: 'Oak', sprite: 'assets/items/oak.png' } });
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 560);
        QuestManager.init();
        const q = QuestTokens.spawnQuest(collection);
        const { container } = mount(h(MatToken, { id: q.id, typeId: q.typeId, x: q.x, y: q.y, z: 10 }));
        const art = container.querySelector('[data-token-art="true"]');
        const imgs = [...art.querySelectorAll('img')];
        // The billboard and the item: two pictures.
        expect(imgs.length).toBeGreaterThanOrEqual(2);
        const item = imgs[imgs.length - 1];
        const size = parseFloat(item.style.width);
        const left = parseFloat(item.style.left);
        const top = parseFloat(item.style.top);
        // At fit 1 the board draws 128 px art, so the 32 px item is drawn 64 across.
        expect(size).toBe(64);
        const boxPx = parseFloat(art.style.width);
        expect(left + size / 2).toBeCloseTo(boxPx / 2 + (POSTER_CENTRE.x - 32) * 2, 5);
        expect(top + size / 2).toBeCloseTo(boxPx / 2 + (POSTER_CENTRE.y - 32) * 2, 5);
        QuestManager.cleanup();
    });

    it('layout: centred on the poster at any fit, and a whole multiple on screen', () => {
        for (const fit of [1, 0.5, 0.37, 0.21]) {
            const steps = Math.max(1, Math.round(2 * fit));
            const artPx = (64 * steps) / fit;
            const { size, left, top } = posterItemLayout(artPx, artPx, fit);
            expect(left + size / 2).toBeCloseTo(artPx * POSTER_CENTRE.x / 64, 5);
            expect(top + size / 2).toBeCloseTo(artPx * POSTER_CENTRE.y / 64, 5);
            expect(size * fit).toBeCloseTo(32 * steps, 5);
        }
    });

    it('draws nothing extra for a quest with no item', () => {
        newGame();
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 560);
        QuestManager.init();
        const q = QuestTokens.spawnQuest({ ...collection, id: 'q_h', type: 'hunt', itemId: undefined, enemyId: 'token_goblin' });
        const { container } = mount(h(MatToken, { id: q.id, typeId: q.typeId, x: q.x, y: q.y, z: 10 }));
        expect(container.querySelectorAll('[data-token-art="true"] img')).toHaveLength(1);
        QuestManager.cleanup();
    });
});

describe('Bank drag ghost', () => {
    it('draws a carried item with the hard pixel shadow and no soft one', () => {
        registerItems({ fixture_ghost: { id: 'fixture_ghost', name: 'Ghost', sprite: 'assets/items/ghost.png' } });
        setSpriteFxManifest({ sprites: { 'assets/items/ghost.png': { w: 32, h: 32, outlined: true } } });
        const { container } = render(h(DndContext, null,
            h(DragGhost, { payload: { kind: DRAG_KIND.ITEM, itemId: 'fixture_ghost' }, bold: true })));
        expect(container.querySelector('[data-sprite-shadow="true"]')).not.toBeNull();
        expect(overlayFilter(DRAG_KIND.ITEM, true)).not.toContain('drop-shadow');
        setSpriteFxManifest(null);
    });
});
