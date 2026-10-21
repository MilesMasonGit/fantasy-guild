// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { SkillIcon } from '../ui/components/base/SkillIcon.jsx';
import { inspectBubbles } from '../ui/components/drawer/InspectBubbles.jsx';
import { STEP_MS } from '../ui/components/board/frameClock.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** The Token inspection: live ring bubbles, sharp skill icons, no map-mode controls, the popup's shape. */

const TOKEN = { x: 400, y: 300 };
const h = React.createElement;

function put(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const mount = (...els) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, ...els))
);

const ring = (c, name) => c.querySelector(`[data-inspect-bubble="${name}"] [data-ring]`);
const text = (c, name) => ring(c, name)?.getAttribute('data-ring-text');
const fraction = (c, name) => Number(ring(c, name)?.getAttribute('data-ring-fraction'));

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
    ];
});

describe('inspection bubbles', () => {
    it('shows charges, time and XP as the mat ring bubbles', () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        expect(ring(container, 'charges').getAttribute('data-ring')).toBe('charges');
        expect(text(container, 'charges')).toBe('5k');
        expect(ring(container, 'time').getAttribute('data-ring')).toBe('cycle');
        expect(text(container, 'time')).toBe('12s');
        expect(ring(container, 'xp').getAttribute('data-ring')).toBe('xp');
        expect(text(container, 'xp')).toBe('+4');
    });

    it('charges follow the Token when one is spent', async () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        expect(text(container, 'charges')).toBe('5k');
        await act(async () => {
            forest.usesRemaining = 2500;
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: forest.id });
        });
        expect(text(container, 'charges')).toBe('2.5k');
        expect(fraction(container, 'charges')).toBeCloseTo(0.5, 2);
        await act(async () => {
            forest.usesRemaining = 7;
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: forest.id });
        });
        expect(text(container, 'charges')).toBe('7');
    });

    it('time and XP fill with the work cycle while a hero works the Token', async () => {
        vi.useFakeTimers();
        const forest = put(TOKEN, 'fixture_producer');
        Flags.plant('h1', TOKEN);
        expect(BoardState.workerOf(forest.id)).toBe('h1');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        expect(fraction(container, 'time')).toBe(0);
        expect(text(container, 'time')).toBe('12s');

        // Live rings draw on the shared step (`STEP_MS`), like the mat's cycle ring. With no mat
        // ring to read here, from the engine's last progress.
        const step = () => act(async () => { vi.advanceTimersByTime(STEP_MS + 20); });
        const tick = (elapsedMs) => act(async () => {
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                instanceId: forest.id, percent: (elapsedMs / 12000) * 100, elapsedMs, cycleTimeMs: 12000
            });
        });
        await tick(3000);
        await step();
        expect(text(container, 'time')).toBe('9s');
        expect(fraction(container, 'time')).toBeCloseTo(0.25, 2);
        expect(fraction(container, 'xp')).toBeCloseTo(0.25, 2);
        expect(text(container, 'xp')).toBe('+4');
        await tick(9000);
        await step();
        expect(text(container, 'time')).toBe('3s');
        expect(fraction(container, 'time')).toBeCloseTo(0.75, 2);

        await act(async () => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: forest.id }); });
        await step();
        expect(fraction(container, 'time')).toBe(0);
        expect(text(container, 'time')).toBe('12s');
    });

    it('a Token nobody works shows its whole cycle, whatever a stale tick said', async () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        await act(async () => {
            EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: forest.id, elapsedMs: 6000, cycleTimeMs: 12000 });
        });
        expect(text(container, 'time')).toBe('12s');
        expect(fraction(container, 'time')).toBe(0);
    });

    it('from the Shop (no instance) it shows the starting values', () => {
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer' }));
        expect(text(container, 'charges')).toBe('5k');
        expect(text(container, 'time')).toBe('12s');
    });

    it('wording: unlimited charges read infinity, and no XP or cycle leaves that bubble out', () => {
        const b = inspectBubbles({ uses: null, startingUses: null, cycleMs: 0, xp: 0 });
        expect(b.charges.text).toBe('∞');
        expect(b.time).toBeNull();
        expect(b.xp).toBeNull();
    });
});

describe('skill icons are sharp', () => {
    it('draws at a whole multiple of the 16 px art, pixelated', () => {
        const { container } = render(h(SkillIcon, { skillId: 'mining', size: 32 }));
        const img = container.querySelector('img');
        expect(img.style.imageRendering).toBe('pixelated');
        expect(img.style.width).toBe('32px');
        expect(32 % 16).toBe(0);
    });

    it('the inspection Skill Req icon is pixelated', () => {
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', hideSprite: true }));
        const img = container.querySelector('img[alt="Forestry"]');
        expect(img).toBeTruthy();
        expect(img.style.width).toBe('32px');
        expect(img.style.imageRendering).toBe('pixelated');
    });
});

describe('⭐ Disallow and Demolish left the inspect pop-up for the map modes', () => {
    const rect = { left: 400, top: 300, right: 464, bottom: 364, width: 64, height: 64, x: 400, y: 300 };
    const popup = (instance) => mount(h(TokenInspectPopup, {
        typeId: instance.typeId, instanceId: instance.id, anchorRect: rect, onClose: () => {}
    }));
    const noModeControls = (root) => {
        expect(root.querySelector('[data-disallow-switch]')).toBeNull();
        expect(root.querySelector('[role="switch"]')).toBeNull();
        expect(root.querySelector('[data-demolish]')).toBeNull();
        const words = [...root.querySelectorAll('button')].map(b => b.textContent);
        expect(words).not.toContain('Demolish');
        expect(words).not.toContain('Cancel demolition');
    };

    it('a Token a hero works has no Disallow switch and no Demolish button', () => {
        const forest = put(TOKEN, 'fixture_producer');
        popup(forest);
        noModeControls(document.body);
    });

    it('a marked Token has no Cancel demolition, and the Guild Hall no refusal line', () => {
        const forest = put(TOKEN, 'fixture_producer');
        forest.demolish = true;
        popup(forest);
        noModeControls(document.body);
        cleanup();
        const hall = put({ x: 880, y: 560 }, 'token_guild_hall');
        popup(hall);
        noModeControls(document.body);
    });

    it('the mat bubble still follows a Token disallowed', async () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(MatBoard));
        expect(container.querySelector('[data-bubble="disallow"]')).toBeNull();
        await act(async () => { Flags.setDisallowed(forest.id, true); });
        expect(container.querySelector('[data-bubble="disallow"]')).not.toBeNull();
    });
});

describe('the Origin line', () => {
    const origin = (c) => c.querySelector('[data-lifecycle-lines]')?.textContent || '';

    it('shows in a dev build, and in a perf build with Debug Mode; never in a shipped build', () => {
        const forest = put(TOKEN, 'fixture_producer');
        forest.origin = 'spawned';
        const props = { typeId: 'fixture_producer', instanceId: forest.id };

        const dev = mount(h(TokenInspection, props));
        expect(origin(dev.container)).toContain('Origin (dev)');
        cleanup();

        vi.stubEnv('DEV', false);
        vi.stubEnv('MODE', 'production');
        const spy = vi.spyOn(SettingsManager, 'get').mockImplementation((k) => (k === 'debugMode' ? false : undefined));
        try {
            const shipped = mount(h(TokenInspection, props));
            expect(origin(shipped.container)).not.toContain('Origin');
            cleanup();

            // A shipped build has no Debug Mode: one left on from before changes nothing.
            spy.mockImplementation((k) => (k === 'debugMode' ? true : undefined));
            expect(origin(mount(h(TokenInspection, props)).container)).not.toContain('Origin');
            cleanup();

            vi.stubEnv('MODE', 'perf');
            expect(origin(mount(h(TokenInspection, props)).container)).toContain('Origin (dev)');
        } finally {
            spy.mockRestore();
            vi.unstubAllEnvs();
        }
    });
});
