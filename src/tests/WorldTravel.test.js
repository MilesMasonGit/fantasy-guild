// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, NO_LISTENER } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as MatCap from '../systems/board/MatCap.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import {
    getUpgradeDef
} from '../config/guildUpgrades.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { WorldScreen } from '../ui/components/atlas/WorldScreen.jsx';
import { WorldDrawer } from '../ui/components/atlas/WorldDrawer.jsx';
import { BubbleMenu } from '../ui/components/nav/BubbleMenu.jsx';
import * as World from '../systems/world/World.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

const catchUp = vi.hoisted(() => ({ running: false }));
vi.mock('../systems/core/CatchUp.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isRunning: () => catchUp.running
}));

/**
 * ⭐ Travel from the world map screen over the Atlas engine: a carried Token is put down first, a
 * catch-up refuses with its reason. The map's own behaviour is `WorldMap.test.js`'s.
 */

const WOOD_ITEM = 'map_test_screen_wood';
registerItems({
    [WOOD_ITEM]: {
        id: WOOD_ITEM, name: 'Wood Map', type: 'material', stackable: true
    }
});

const q = (container, sel) => container.querySelector(sel);

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    catchUp.running = false;
    newGame();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the Token cap is fixed (brief 320 retired its star)', () => {
    it('keeps the cap at 128 whatever an old save ranked, and the Mat Tuner still wins', () => {
        expect(MatCap.matCap()).toBe(128);
        expect(getUpgradeDef('token_cap')).toBeNull();
        GameState.state.progress.guildUpgrades.token_cap = 4;
        expect(MatCap.matCap()).toBe(128);
        setMatTuning('tokenCap', 40);
        expect(MatCap.matCap()).toBe(40);
        resetMatTuning();
        expect(MatCap.matCap()).toBe(128);
    });
});

describe('travel from the world map', () => {
    // The screen and its drawer, as ReactRoot mounts them: the drawer holds the place and its Travel.
    const screen = ({ dragging = false, onClose = vi.fn(), ...props } = {}) => render(React.createElement(
        DeckDndContext.Provider, { value: { activePayload: dragging ? { kind: 'token' } : null, isDragging: dragging } },
        React.createElement(WorldScreen, { onClose, ...props }),
        React.createElement(WorldDrawer, { open: true, onClose })
    ));
    /** A place settled on the world's cell 1,0, chosen on the map. */
    const settledPlace = () => {
        World.createWorld({ seed: 3 });
        return Atlas.createRegion({ ingredients: [WOOD_ITEM], cellId: '1,0' }).region;
    };
    const pick = (container) => fireEvent.click(q(container, '[data-world-cell="1,0"]'));
    const pressTravel = (container) => fireEvent.click(q(container, '[data-world-travel="1,0"]'));

    it('travels from the panel and closes', async () => {
        const region = settledPlace();
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pick(container);
        await act(async () => { pressTravel(container); });
        expect(Atlas.activeRegionId()).toBe(region.id);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('refuses to travel while a catch-up runs, and says why', async () => {
        settledPlace();
        const starter = Atlas.activeRegionId();
        catchUp.running = true;
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pick(container);
        await act(async () => { pressTravel(container); });
        expect(Atlas.activeRegionId()).toBe(starter);
        expect(q(container, '[data-world-message]').textContent).toBe(TEXT.REFUSE_CATCHING_UP);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('ends a drag before the guild travels', async () => {
        settledPlace();
        const order = [];
        const onKey = (e) => { if (e.key === 'Escape' && e.code === 'Escape') order.push('drag ended'); };
        document.addEventListener('keydown', onKey);
        const off = EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => order.push('travelled'));
        try {
            const { container } = screen({ dragging: true, onClose: () => order.push('closed') });
            pick(container);
            await act(async () => {
                pressTravel(container);
                await new Promise(r => setTimeout(r, 120));
            });
            expect(order).toEqual(['drag ended', 'travelled', 'closed']);
        } finally {
            document.removeEventListener('keydown', onKey);
            off();
        }
    });

    it('without a drag sends no Escape', async () => {
        const region = settledPlace();
        const keys = [];
        const onKey = (e) => keys.push(e.key);
        document.addEventListener('keydown', onKey);
        try {
            const { container } = screen();
            pick(container);
            await act(async () => { pressTravel(container); });
            expect(keys).toEqual([]);
            expect(Atlas.activeRegionId()).toBe(region.id);
        } finally {
            document.removeEventListener('keydown', onKey);
        }
    });

    it('redraws when the Atlas changes (ATLAS_CHANGED has a listener)', () => {
        expect(Object.keys(NO_LISTENER)).not.toContain(ENGINE_EVENTS.ATLAS_CHANGED);
        const region = settledPlace();
        const { container } = screen();
        pick(container);
        act(() => { Atlas.rename(region.id, 'Fresh Name'); });
        expect(q(container, '[data-world-name]').textContent).toBe('Fresh Name');
    });
});

describe('the bubble', () => {
    it('the bubble menu has an Atlas bubble that toggles the atlas view', () => {
        const toggle = vi.fn();
        const ui = { nav: { isActive: (t) => t === 'atlas', toggle } };
        const { container } = render(React.createElement(BubbleMenu, { ui }));
        const bubble = q(container, '#atlas-bubble-target button');
        expect(bubble.getAttribute('aria-label')).toBe('Atlas');
        fireEvent.click(bubble, { clientX: 0, clientY: 0 });
        expect(toggle).toHaveBeenCalledWith('atlas');
        expect(container.querySelectorAll('nav button').length).toBe(6);
    });
});
