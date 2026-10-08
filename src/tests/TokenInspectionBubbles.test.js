// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
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

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** The Token inspection: live ring bubbles, sharp skill icons, the Disallow switch, the popup's shape. */

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
afterEach(() => cleanup());
beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
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
        const forest = put(TOKEN, 'fixture_producer');
        Flags.plant('h1', TOKEN);
        expect(BoardState.workerOf(forest.id)).toBe('h1');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        expect(fraction(container, 'time')).toBe(0);

        const tick = (elapsedMs) => act(async () => {
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                instanceId: forest.id, percent: (elapsedMs / 12000) * 100, elapsedMs, cycleTimeMs: 12000
            });
        });
        await tick(3000);
        expect(text(container, 'time')).toBe('9s');
        expect(fraction(container, 'time')).toBeCloseTo(0.25, 2);
        expect(fraction(container, 'xp')).toBeCloseTo(0.25, 2);
        await tick(9000);
        expect(text(container, 'time')).toBe('3s');
        expect(fraction(container, 'time')).toBeCloseTo(0.75, 2);

        await act(async () => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: forest.id }); });
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
        const img = container.querySelector('img[alt="Logging"]');
        expect(img).toBeTruthy();
        expect(img.style.width).toBe('32px');
        expect(img.style.imageRendering).toBe('pixelated');
    });
});

describe('the Disallow switch', () => {
    const sw = (c) => c.querySelector('[data-disallow-switch] [role="switch"]');

    it('switching it on and off disallows and allows, and the mat bubble follows', async () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(
            h(MatBoard),
            h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id })
        );
        expect(sw(container).getAttribute('aria-checked')).toBe('false');
        expect(container.querySelector('[data-bubble="disallow"]')).toBeNull();

        await act(async () => { fireEvent.click(sw(container)); });
        expect(Flags.isDisallowed(forest)).toBe(true);
        expect(sw(container).getAttribute('aria-checked')).toBe('true');
        expect(container.querySelector('[data-bubble="disallow"]')).not.toBeNull();

        await act(async () => { fireEvent.click(sw(container)); });
        expect(Flags.isDisallowed(forest)).toBe(false);
        expect(sw(container).getAttribute('aria-checked')).toBe('false');
        expect(container.querySelector('[data-bubble="disallow"]')).toBeNull();
    });

    it('says Disallow, not Heroes may work this', () => {
        const forest = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        const row = container.querySelector('[data-disallow-switch]');
        expect(row.textContent).toBe('Disallow');
        expect(container.textContent).not.toContain('Heroes may work this');
    });
});

describe('the Origin line', () => {
    const origin = (c) => c.querySelector('[data-lifecycle-lines]')?.textContent || '';

    it('shows in a dev build and is gone from a shipped build without Debug Mode', () => {
        const forest = put(TOKEN, 'fixture_producer');
        forest.origin = 'spawned';
        const props = { typeId: 'fixture_producer', instanceId: forest.id };

        const dev = mount(h(TokenInspection, props));
        expect(origin(dev.container)).toContain('Origin (dev)');
        cleanup();

        vi.stubEnv('DEV', false);
        const spy = vi.spyOn(SettingsManager, 'get').mockImplementation((k) => (k === 'debugMode' ? false : undefined));
        try {
            const shipped = mount(h(TokenInspection, props));
            expect(origin(shipped.container)).not.toContain('Origin');
            cleanup();

            spy.mockImplementation((k) => (k === 'debugMode' ? true : undefined));
            expect(origin(mount(h(TokenInspection, props)).container)).toContain('Origin (dev)');
        } finally {
            spy.mockRestore();
            vi.unstubAllEnvs();
        }
    });
});

describe('the popup shape', () => {
    it('has the speech bubbles look: rounded, yellow-bordered, a turned-square tail', () => {
        const forest = put(TOKEN, 'fixture_producer');
        const rect = { top: 400, bottom: 480, left: 400, right: 480, width: 80, height: 80 };
        const { container } = mount(h(TokenInspectPopup, {
            typeId: 'fixture_producer', instanceId: forest.id, anchorRect: rect, onClose: () => {}
        }));
        const tail = container.querySelector('[data-inspect-tail]');
        expect(tail).not.toBeNull();
        expect(tail.className).toContain('rotate-45');
        expect(tail.className).toContain('border-yellow-500/70');
        const popup = tail.parentElement;
        expect(popup.className).toContain('rounded-md');
        expect(popup.className).toContain('border-yellow-500/70');
        expect(popup.className).toContain('bg-yellow-950/95');
    });
});
