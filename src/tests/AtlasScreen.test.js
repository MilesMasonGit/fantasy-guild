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
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import {
    getUpgradeDef
} from '../config/guildUpgrades.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { AtlasScreen, ATLAS_TAB } from '../ui/components/atlas/AtlasScreen.jsx';
import { RegionList } from '../ui/components/atlas/RegionList.jsx';
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
 * ⭐ The Atlas screen: the World page and the Region list over the Atlas engine. Abandon asks first
 * and refuses the Region the guild is in; the Token Cap upgrade raises the cap. The World page's
 * own behaviour is `WorldPage.test.js`'s.
 */

const OAK = 'fixture_producer';
const SITE = 'fixture_screen_site';
registerTokenTypes({
    [SITE]: { id: SITE, name: 'Screen Site', tokenType: 'resource', landmark: true, rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature' }
});
const WOOD_ITEM = 'map_test_screen_wood';
const THICKET_ITEM = 'mod_test_screen_thicket';
registerItems({
    [WOOD_ITEM]: {
        id: WOOD_ITEM, name: 'Wood Map', type: 'map', stackable: true,
        cartography: { biome: 'forest', points: 16, nodes: [{ typeId: OAK, weight: 1 }], camps: [], treasures: [] }
    },
    [THICKET_ITEM]: {
        id: THICKET_ITEM, name: 'Thicket', type: 'modifier', stackable: true,
        cartography: { effects: [{ kind: 'density', typeId: OAK, points: 4 }] }
    }
});

const q = (container, sel) => container.querySelector(sel);
/** Show Region `id` on the right page (outside `act`, so the page is drawn before its Travel is pressed). */
const pick = (container, id) => fireEvent.click(container.querySelector(`[data-region-select="${id}"]`));
const pressTravel = (container, id) => fireEvent.click(container.querySelector(`[data-region-travel="${id}"]`));

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

describe('the Region list', () => {
    const renderList = () => {
        const onTravel = vi.fn();
        const view = render(React.createElement(function Harness() {
            const [message, setMessage] = React.useState(null);
            const [version, setVersion] = React.useState(0);
            React.useEffect(() => EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, () => setVersion(v => v + 1)), []);
            return React.createElement(RegionList, { version, onTravel, message, onMessage: setMessage });
        }));
        return { ...view, onTravel };
    };
    const page = (container) => q(container, '[data-region-detail]');

    it('lists each Region on the left page with its names; the active one shows the hero flag and is shown first', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const starter = Atlas.activeRegionId();
        const { container } = renderList();
        const left = q(container, '[data-tome-left]');
        const here = q(left, `[data-region-row="${starter}"]`);
        expect(here.getAttribute('data-region-active')).toBe('true');
        expect(q(here, '[data-region-here]')).toBeTruthy();
        expect(here.textContent).toContain(TEXT.STARTER_CAMP);
        expect(here.textContent).not.toContain('Settled day');
        expect(here.textContent).not.toContain('Token');
        const other = q(left, `[data-region-row="${region.id}"]`);
        expect(other.textContent).toContain(region.flavourName);
        expect(other.textContent).toContain('Wood');
        // The rows hold no actions: those are on the right page, and no row is.
        expect(q(left, '[data-region-travel], [data-region-rename], [data-region-archive], [data-region-abandon]')).toBeNull();
        expect(q(container, '[data-tome-right] [data-region-row]')).toBeNull();
        expect(page(container).getAttribute('data-region-detail')).toBe(starter);
        expect(q(here, '[data-region-select]').getAttribute('aria-pressed')).toBe('true');
        expect(q(page(container), '[data-region-travel]')).toBeNull();
    });

    it('a click on a row shows that Region on the right page, with Travel', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const { container, onTravel } = renderList();
        fireEvent.click(q(container, `[data-region-select="${region.id}"]`));
        expect(page(container).getAttribute('data-region-detail')).toBe(region.id);
        expect(q(container, `[data-region-select="${region.id}"]`).getAttribute('aria-pressed')).toBe('true');
        expect(q(container, `[data-region-row="${region.id}"] [data-region-selected]`)).toBeTruthy();
        expect(q(container, `[data-region-row="${Atlas.activeRegionId()}"] [data-region-selected]`)).toBeNull();
        expect(page(container).textContent).toContain(region.flavourName);
        fireEvent.click(q(page(container), `[data-region-travel="${region.id}"]`));
        expect(onTravel).toHaveBeenCalledWith(region.id);
    });

    it('the right page says what the Region holds: its ground, its Tokens, heroes with a flag there, its landmarks, its Tokens by type', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM], biome: { forest: 1, mountain: 1 }, ground: { main: 'mountain' } });
        Atlas.getRegion(region.id).board.tokens = {
            a: { typeId: OAK }, b: { typeId: OAK }, s: { typeId: SITE }, h: { typeId: 'token_guild_hall' }
        };
        Atlas.getRegion(region.id).board.flags = { hero_a: { x: 1, y: 1, plantedAt: 0 } };
        const { container } = renderList();
        fireEvent.click(q(container, `[data-region-select="${region.id}"]`));
        const stat = (id) => q(page(container), `[data-region-stat="${id}"] dd`).textContent;
        expect(stat('ground')).toBe('Mountain, Forest');
        expect(stat('tokens')).toBe('3');
        expect(stat('heroes')).toBe('1');
        expect(q(page(container), `[data-region-landmark="${SITE}"]`).textContent).toContain('Screen Site');
        expect(q(page(container), `[data-region-landmark="${OAK}"]`)).toBeNull();
        // Its other Tokens as sprites with counts; the Hall travels with the guild and is not listed.
        const held = [...page(container).querySelectorAll('[data-region-token]')].map(e => [e.getAttribute('data-region-token'), e.getAttribute('data-count')]);
        expect(held).toEqual([[OAK, '2']]);
        // The Starter Camp, with no map behind it, is meadow.
        fireEvent.click(q(container, `[data-region-select="${Atlas.activeRegionId()}"]`));
        expect(stat('ground')).toBe('Meadow');
        expect(q(page(container), '[data-region-landmarks]')).toBeNull();
    });

    it('Abandon asks first, and refuses the Region the guild is in and the Starter Camp', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const { container } = renderList();

        const activeAbandon = q(page(container), '[data-region-abandon]');
        expect(activeAbandon.disabled).toBe(true);
        expect(activeAbandon.getAttribute('title')).toBe(TEXT.REFUSE_ACTIVE);
        fireEvent.click(activeAbandon);
        expect(q(container, '[data-region-abandon-confirm]')).toBeNull();

        fireEvent.click(q(container, `[data-region-select="${region.id}"]`));
        fireEvent.click(q(container, `[data-region-abandon="${region.id}"]`));
        expect(q(container, `[data-region-abandon-confirm="${region.id}"]`)).toBeTruthy();
        expect(Atlas.getRegion(region.id)).toBeTruthy();
        fireEvent.click(q(container, `[data-region-abandon-no="${region.id}"]`));
        expect(q(container, '[data-region-abandon-confirm]')).toBeNull();
        expect(Atlas.getRegion(region.id)).toBeTruthy();

        fireEvent.click(q(container, `[data-region-abandon="${region.id}"]`));
        fireEvent.click(q(container, `[data-region-abandon-yes="${region.id}"]`));
        expect(Atlas.getRegion(region.id)).toBeNull();
        expect(q(container, `[data-region-row="${region.id}"]`)).toBeNull();
        // The page goes back to the Region the guild is in.
        expect(page(container).getAttribute('data-region-detail')).toBe(Atlas.activeRegionId());
    });

    it('the Starter Camp cannot be abandoned from elsewhere either', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const starter = Atlas.activeRegionId();
        expect(Atlas.travel(region.id).success).toBe(true);
        const { container } = renderList();
        expect(page(container).getAttribute('data-region-detail')).toBe(region.id);
        fireEvent.click(q(container, `[data-region-select="${starter}"]`));
        const button = q(container, `[data-region-abandon="${starter}"]`);
        expect(button.disabled).toBe(true);
        expect(button.getAttribute('title')).toBe(TEXT.REFUSE_STARTER);
    });

    it('renames the flavour name inline: Enter keeps it, Escape does not', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const { container } = renderList();
        fireEvent.click(q(container, `[data-region-select="${region.id}"]`));
        fireEvent.click(q(container, `[data-region-rename="${region.id}"]`));
        let input = q(page(container), `[data-region-rename-input="${region.id}"]`);
        fireEvent.change(input, { target: { value: '  Copper Hollow  ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(Atlas.getRegion(region.id).flavourName).toBe('Copper Hollow');
        expect(q(container, `[data-region-row="${region.id}"]`).textContent).toContain('Copper Hollow');
        expect(page(container).textContent).toContain('Copper Hollow');

        fireEvent.click(q(container, `[data-region-rename="${region.id}"]`));
        input = q(container, `[data-region-rename-input="${region.id}"]`);
        fireEvent.change(input, { target: { value: 'Never Mind' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        fireEvent.blur(input);
        expect(Atlas.getRegion(region.id).flavourName).toBe('Copper Hollow');

        fireEvent.click(q(container, `[data-region-rename="${region.id}"]`));
        input = q(container, `[data-region-rename-input="${region.id}"]`);
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(Atlas.getRegion(region.id).flavourName).toBe('Copper Hollow');
        expect(q(container, '[data-region-message]').textContent).toBe(TEXT.REFUSE_EMPTY_NAME);
    });

    it('archives a Region into the archive list and restores it', () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const { container } = renderList();
        // The Region the guild is in cannot be archived: no button.
        expect(q(page(container), '[data-region-archive]')).toBeNull();
        fireEvent.click(q(container, `[data-region-select="${region.id}"]`));
        fireEvent.click(q(container, `[data-region-archive="${region.id}"]`));
        expect(Atlas.getRegion(region.id).archived).toBe(true);
        // The archive sits behind a toggle at the foot of the list.
        expect(q(container, '[data-region-archive-list]')).toBeNull();
        expect(page(container).getAttribute('data-region-detail')).toBe(Atlas.activeRegionId());
        fireEvent.click(q(container, '[data-region-archive-toggle]'));
        const archive = q(container, '[data-region-archive-list]');
        expect(q(archive, `[data-region-row="${region.id}"]`)).toBeTruthy();
        fireEvent.click(q(archive, `[data-region-select="${region.id}"]`));
        expect(q(page(container), `[data-region-travel="${region.id}"]`)).toBeNull();
        expect(q(page(container), `[data-region-archive="${region.id}"]`)).toBeNull();
        fireEvent.click(q(page(container), `[data-region-restore="${region.id}"]`));
        expect(q(container, '[data-region-archive-list]')).toBeNull();
        expect(q(container, '[data-region-archive-toggle]')).toBeNull();
        expect(Atlas.getRegion(region.id).archived).toBe(false);
        expect(page(container).getAttribute('data-region-detail')).toBe(region.id);
    });
});

describe('the Atlas screen', () => {
    const screen = ({ dragging = false, ...props } = {}) => render(React.createElement(
        DeckDndContext.Provider, { value: { activePayload: dragging ? { kind: 'token' } : null, isDragging: dragging } },
        React.createElement(AtlasScreen, { onClose: vi.fn(), ...props })
    ));

    it('travels from the list and closes', async () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pick(container, region.id);
        await act(async () => { pressTravel(container, region.id); });
        expect(Atlas.activeRegionId()).toBe(region.id);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('refuses to travel while a catch-up runs, and says why', async () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const starter = Atlas.activeRegionId();
        catchUp.running = true;
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pick(container, region.id);
        await act(async () => { pressTravel(container, region.id); });
        expect(Atlas.activeRegionId()).toBe(starter);
        expect(q(container, '[data-region-message]').textContent).toBe(TEXT.REFUSE_CATCHING_UP);
        expect(onClose).not.toHaveBeenCalled();
    });

    // Rewritten with classless heroes: there is no promotion ceremony left to close.
    it('ends a drag before the guild travels', async () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const order = [];
        const onKey = (e) => { if (e.key === 'Escape' && e.code === 'Escape') order.push('drag ended'); };
        document.addEventListener('keydown', onKey);
        const off = EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => order.push('travelled'));
        try {
            const { container } = screen({
                dragging: true,
                onClose: () => order.push('closed')
            });
            pick(container, region.id);
            await act(async () => {
                pressTravel(container, region.id);
                await new Promise(r => setTimeout(r, 120));
            });
            expect(order).toEqual(['drag ended', 'travelled', 'closed']);
        } finally {
            document.removeEventListener('keydown', onKey);
            off();
        }
    });

    it('without a drag sends no Escape', async () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const keys = [];
        const onKey = (e) => keys.push(e.key);
        document.addEventListener('keydown', onKey);
        try {
            const { container } = screen();
            pick(container, region.id);
            await act(async () => { pressTravel(container, region.id); });
            expect(keys).toEqual([]);
            expect(Atlas.activeRegionId()).toBe(region.id);
        } finally {
            document.removeEventListener('keydown', onKey);
        }
    });

    it('opens on the World page; Escape closes it', () => {
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        expect(q(container, `[data-atlas-tab="${ATLAS_TAB.WORLD}"]`).getAttribute('aria-selected')).toBe('true');
        expect(q(container, '[data-world-page]').closest('.hidden')).toBeNull();
        expect(q(container, '[data-region-list]').closest('.hidden')).toBeTruthy();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('lies on the table as a tome: a press on the table closes it, a press on the book does not', () => {
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        fireEvent.pointerDown(q(container, '[data-atlas-screen]'));
        fireEvent.pointerDown(q(container, '[data-tome-pages]'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.pointerDown(q(container, '[data-atlas-overlay]'));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(q(container, '[data-atlas-close]'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('lays the World over both pages: the map on the left, the chosen place and its button on the right', () => {
        World.createWorld({ seed: 3 });
        const { container } = screen();
        const left = q(container, '[data-world-page] [data-tome-left]');
        const right = q(container, '[data-world-page] [data-tome-right]');
        expect(q(left, '[data-world-cell="0,0"]')).toBeTruthy();
        expect(q(right, '[data-world-detail="0,0"]')).toBeTruthy();
        fireEvent.click(q(left, '[data-world-cell="1,0"]'));
        expect(q(right, '[data-world-detail="1,0"]')).toBeTruthy();
        expect(q(right, '[data-world-settle="1,0"]')).toBeTruthy();
    });

    it('redraws the list when the Atlas changes (ATLAS_CHANGED has a listener now)', () => {
        expect(Object.keys(NO_LISTENER)).not.toContain(ENGINE_EVENTS.ATLAS_CHANGED);
        const { container } = screen();
        let region;
        act(() => { ({ region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] })); });
        expect(q(container, `[data-region-row="${region.id}"]`)).toBeTruthy();
        act(() => { Atlas.rename(region.id, 'Fresh Name'); });
        expect(q(container, `[data-region-row="${region.id}"]`).textContent).toContain('Fresh Name');
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
