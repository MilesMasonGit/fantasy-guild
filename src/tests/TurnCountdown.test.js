// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { growthLine, respawnLine, liveTimerSources } from '../ui/components/board/tokenTimers.js';
import { matW, matH } from '../config/matGeometry.js';
import * as Flags from '../systems/board/Flags.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q8**, as amended by brief 830 D3 (no plates on the mat): a
 * Token that changes on its own clock (here a growing Sapling) says when on its card's Events
 * lines, and nothing on the mat counts down, hovered or not ("the player will see the Token change").
 */

registerTokenTypes({
    fixture_q8_sapling: {
        id: 'fixture_q8_sapling', name: 'Fixture Q8 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        grows: { into: 'fixture_q8_tree', afterMs: 60000 }
    },
    fixture_q8_tree: {
        id: 'fixture_q8_tree', name: 'Fixture Q8 Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
    }
});

const h = React.createElement;
const AT = { x: 560, y: 520 };
const mount = (el) => render(
    h(DndContext, null, el)
);
const overlay = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);
/** Anything on the mat that reads like a countdown over the Token: none is drawn. */
const countdownOf = (container, id) => container.querySelector(`[data-idle-plate="${id}"], [data-token-overlay="${id}"] [data-plate-cell]`);

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

describe('the timer lines (FB-14)', () => {
    it('a growth says what it grows into and when, as the card words it', () => {
        const line = growthLine({ id: 's', typeId: 'fixture_q8_sapling' }, { inMs: 34000, totalMs: 60000, into: 'fixture_q8_tree' }, liveTimerSources());
        expect(line).toMatchObject({ text: '34s', icon: 'grow', tip: 'Grows into Fixture Q8 Tree in 34s' });
    });

    it('a resting Token’s line says when it refills', () => {
        const line = respawnLine({ id: 'v', typeId: 'fixture_q8_tree' }, { mode: 'refill', resting: true, inMs: 125000 }, liveTimerSources());
        expect(line.text).toBe('2m 5s');
        // Non-breaking between a time's parts, so the sentence never splits them.
        expect(line.tip).toBe('Exhausted · respawns in 2m 5s');
    });
});

describe('on the mat (brief 830 D3: no idle plate)', () => {
    it('⭐ a growing Sapling shows no countdown, hovered and rested on, nor in its last seconds', () => {
        vi.useFakeTimers();
        const sapling = BoardState.createTokenInstance('fixture_q8_sapling');
        Placement.placeTokenAt(sapling, AT);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        act(() => { fireEvent.pointerMove(root, { clientX: AT.x, clientY: AT.y }); });
        restHover();
        expect(overlay(container, sapling.id).querySelector('[data-token-name]')).not.toBeNull();
        expect(countdownOf(container, sapling.id)).toBeNull();
        act(() => { TimedChanges.tick(51000); vi.advanceTimersByTime(1000); });
        expect(countdownOf(container, sapling.id)).toBeNull();
        expect(overlay(container, sapling.id).textContent).toBe('Fixture Q8 Sapling');
    });
});
