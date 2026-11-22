// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { resetSpawnMotion, SPAWN_MS } from '../ui/components/board/spawnMotion.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { DragGhost } from '../ui/dnd/DragGhost.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';
import * as Flags from '../systems/board/Flags.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * UI motion and polish: a spawned Token pops out of its spawner, and a carried Bank item casts the
 * hard pixel shadow.
 */

const h = React.createElement;
const mount = (el) => render(
    h(DndContext, null, el)
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

    it('hops from the spawner up over it and lands on the Token spot, on both boxes (T-155)', async () => {
        const { child } = await spawnOne();
        const calls = forChild(child);
        expect(calls).toHaveLength(2);
        const k = calls[0].keyframes;
        // The spawner stands 400 mat units left of the new spot (whole art pixels of 2 units).
        expect(k[0].transform).toBe('translate(-400px, 0px)');
        expect(k.at(-1).transform).toBe('translate(0px, 0px)');
        // Up and over: well above the line between them in the middle of the hop.
        const mid = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(k[Math.floor(k.length / 2) - 1].transform);
        expect(Number(mid[2])).toBeLessThan(-40);
        expect(calls[0].options.duration).toBe(SPAWN_MS);
        expect(calls[0].options.composite).toBe('add');
        // Transform only, stepped, at its own size: nothing that moves layout, no scale.
        for (const f of k) {
            expect(Object.keys(f).filter(p => p !== 'offset' && p !== 'easing')).toEqual(['transform']);
            expect(f.transform).not.toMatch(/scale/);
        }
        expect(k.slice(0, -1).every(f => f.easing === 'steps(1, end)')).toBe(true);
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

describe('Bank drag ghost', () => {
    it('draws a carried item with the hard pixel shadow', () => {
        registerItems({ fixture_ghost: { id: 'fixture_ghost', name: 'Ghost', sprite: 'assets/items/ghost.png' } });
        setSpriteFxManifest({ sprites: { 'assets/items/ghost.png': { w: 32, h: 32, outlined: true } } });
        const { container } = render(h(DndContext, null,
            h(DragGhost, { payload: { kind: DRAG_KIND.ITEM, itemId: 'fixture_ghost' }, bold: true })));
        expect(container.querySelector('[data-sprite-shadow="true"]')).not.toBeNull();
        setSpriteFxManifest(null);
    });
});
