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
import { EngineContext } from '../ui/context/EngineContext';
import {
    DRAW_SWITCHES, applyOffFromUrl, setDrawn, drawnSwitches, isDrawn, resetDrawSwitches
} from '../ui/dev/perf/drawSwitches.js';
import { MatToken } from '../ui/components/board/MatToken.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';
import { AnimatedHeroSprite } from '../ui/components/board/AnimatedHeroSprite.jsx';
import { NotificationColumn } from '../ui/ReactRoot.jsx';
import { shadowLayer, outlineLayer, sheetOutlineLayer, setSpriteFxManifest } from '../ui/utils/spriteFx.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../ui/components/base/ToastContainer.jsx', () => ({
    default: () => React.createElement('i', { 'data-toasts': true })
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Perf draw switches: each one only stops DRAWING. Everything here runs with the harness
 * compiled in (the test build is a dev build); a normal production build folds `isDrawn` to
 * `true` (see `scripts/check-perf-build.mjs`).
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

beforeEach(() => {
    resetDrawSwitches();
    resetMatTuning();
});
afterEach(() => {
    cleanup();
    resetDrawSwitches();
    vi.useRealTimers();
});

describe('the registry', () => {
    it('lists the fifteen switches, all on by default', () => {
        expect(DRAW_SWITCHES).toHaveLength(15);
        expect(Object.values(drawnSwitches()).every(Boolean)).toBe(true);
        expect(DRAW_SWITCHES.every(isDrawn)).toBe(true);
    });

    it('takes ?off=a,b once from the URL', () => {
        applyOffFromUrl('?stress=realistic&off=rings,speech');
        expect(isDrawn('rings')).toBe(false);
        expect(isDrawn('speech')).toBe(false);
        expect(isDrawn('dock')).toBe(true);
    });

    it('turns one off and back on', () => {
        setDrawn('dock', false);
        expect(drawnSwitches().dock).toBe(false);
        setDrawn('dock', true);
        expect(drawnSwitches().dock).toBe(true);
    });

    it('warns once about an unknown name and ignores it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        applyOffFromUrl('?off=nope');
        setDrawn('nope', false);
        setDrawn('nope', true);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(Object.keys(drawnSwitches())).toEqual(DRAW_SWITCHES);
        warn.mockRestore();
    });
});

describe('side UI', () => {
    it('notifications and bin draw by default and not when off', () => {
        const on = mount(h(NotificationColumn));
        expect(on.container.querySelector('[data-toasts]')).not.toBeNull();
        expect(on.container.querySelector('[data-discard-bin]')).not.toBeNull();
        cleanup();

        setDrawn('notifications', false);
        setDrawn('bin', false);
        const off = mount(h(NotificationColumn));
        expect(off.container.querySelector('[data-toasts]')).toBeNull();
        expect(off.container.querySelector('[data-discard-bin]')).toBeNull();
    });
});

describe('mat overlays', () => {
    const hunt = {
        id: 'q_hunt', tutorial: false, title: 'Defeat 3 Goblins', type: 'hunt',
        targetType: 'enemy_hunted', enemyId: 'token_goblin',
        requiredCount: 3, currentCount: 1,
        rewardItems: [{ itemId: 'item_oak_wood', quantity: 5 }], done: false
    };
    function questToken() {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [];
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 560);
        QuestManager.init();
        const q = QuestTokens.spawnQuest(hunt);
        return h(MatToken, { id: q.id, typeId: q.typeId, x: q.x, y: q.y, size: 1, z: 10, isHovered: true });
    }

    it('rings and tooltips', () => {
        const el = questToken();
        const on = mount(el);
        expect(on.container.querySelector('[data-ring="quest"]')).not.toBeNull();
        expect(document.body.querySelector('[data-quest-tooltip]')).not.toBeNull();
        cleanup();

        setDrawn('rings', false);
        setDrawn('tooltips', false);
        const off = mount(el);
        expect(off.container.querySelector('[data-ring]')).toBeNull();
        expect(document.body.querySelector('[data-quest-tooltip]')).toBeNull();
        QuestManager.cleanup();
    });

    it('alerts and speech layers on the mat', () => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        const alert = {
            instanceId: 'gone_1', x: 400, y: 400, severity: 'red', type: 'token_exhausted',
            name: 'Oak', message: 'Token Exhausted: Oak'
        };
        const on = mount(h(MatBoard));
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, alert); });
        expect(on.container.querySelector('[data-mat-point-alert]')).not.toBeNull();
        expect(on.container.querySelector('[data-hero-bubbles]')).not.toBeNull();
        cleanup();

        setDrawn('alerts', false);
        setDrawn('speech', false);
        const off = mount(h(MatBoard));
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, alert); });
        expect(off.container.querySelector('[data-mat-point-alert]')).toBeNull();
        expect(off.container.querySelector('[data-hero-bubbles]')).toBeNull();
    });
});

describe('motion', () => {
    const frameOf = (container) => container.querySelector('[role="img"]').style.backgroundPosition;

    it('enemyAnim off: the enemy sheet never advances', () => {
        vi.useFakeTimers();
        const run = () => {
            const { container } = render(h(AnimatedEnemySprite, { src: 'ani_cow.png', size: 64 }));
            const first = frameOf(container);
            act(() => { vi.advanceTimersByTime(500); });
            return [first, frameOf(container)];
        };
        const [a, b] = run();
        expect(b).not.toBe(a);
        cleanup();
        setDrawn('enemyAnim', false);
        const [c, d] = run();
        expect(d).toBe(c);
    });

    it('heroAnim off: the hero sheet shows one frame and stays', () => {
        vi.useFakeTimers();
        const run = () => {
            const { container } = render(h(AnimatedHeroSprite, { src: 'x.png', size: 64, animationState: 'walk' }));
            const root = container.firstChild;
            const first = root.getAttribute('data-hero-frame');
            act(() => { vi.advanceTimersByTime(1000); });
            return [first, root.getAttribute('data-hero-frame')];
        };
        const [a, b] = run();
        expect(b).not.toBe(a);
        cleanup();
        setDrawn('heroAnim', false);
        const [c, d] = run();
        expect(d).toBe(c);
    });

    it('walkDraw off: a walking hero is not given the glide transition', () => {
        GameState.initNew();
        const props = { heroId: 'h1', name: 'h1', left: 100, top: 100, z: 5, moving: true };
        const glide = () => mount(h(MatHero, props)).container.querySelector('[data-board-hero]').style.transition;
        expect(glide()).toContain('linear');
        cleanup();
        setDrawn('walkDraw', false);
        expect(glide()).toBe('none');
    });
});

describe('mat art', () => {
    it('spriteFx off: no shadow or outline pictures', () => {
        setSpriteFxManifest({ sprites: {
            'assets/a.png': { w: 64, h: 64, outlined: true },
            'assets/s.png': { w: 256, h: 64, cols: 4, outlined: true }
        } });
        expect(shadowLayer('/assets/a.png', 64)).not.toBeNull();
        expect(outlineLayer('/assets/a.png', 64, 'hover')).not.toBeNull();
        expect(sheetOutlineLayer('/assets/s.png', 'hover')).not.toBeNull();
        setDrawn('spriteFx', false);
        expect(shadowLayer('/assets/a.png', 64)).toBeNull();
        expect(outlineLayer('/assets/a.png', 64, 'hover')).toBeNull();
        expect(sheetOutlineLayer('/assets/s.png', 'hover')).toBeNull();
        setSpriteFxManifest(null);
    });
});
