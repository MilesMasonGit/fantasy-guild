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
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as MatCap from '../systems/board/MatCap.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import {
    getUpgradeDef, cartographySlotsForRank, tokenCapForRank, CARTOGRAPHY_SLOTS_BASE, CARTOGRAPHY_SLOTS_MAX,
    TOKEN_CAP_BASE, TOKEN_CAP_MAX_RANK
} from '../config/guildUpgrades.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { AtlasScreen, ATLAS_TAB } from '../ui/components/atlas/AtlasScreen.jsx';
import { CartographyTable, REROLL_COOLDOWN_MS, fitSlots } from '../ui/components/atlas/CartographyTable.jsx';
import { RegionList } from '../ui/components/atlas/RegionList.jsx';
import { contentsOf } from '../ui/components/atlas/PlanContents.jsx';
import { BubbleMenu } from '../ui/components/nav/BubbleMenu.jsx';
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
 * ⭐ The Atlas screen: the Region list and the Cartography table over the Atlas engine. Nothing
 * leaves the Bank until Settle; the table never slots more copies than the Bank holds; Abandon asks
 * first and refuses the Region the guild is in; the Token Cap and Cartography Table upgrades raise
 * the cap and the slot count.
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

const bank = (id) => InventoryManager.getItemCount(id);
const regionCount = () => Object.keys(GameState.state.atlas.regions).length;
const q = (container, sel) => container.querySelector(sel);
/** Show Region `id` on the right page (outside `act`, so the page is drawn before its Travel is pressed). */
const pick = (container, id) => fireEvent.click(container.querySelector(`[data-region-select="${id}"]`));
const pressTravel = (container, id) => fireEvent.click(container.querySelector(`[data-region-travel="${id}"]`));
const slotItems = (container) => [...container.querySelectorAll('[data-cartography-slot]')].map(b => b.getAttribute('data-slot-item'));

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
    Cartography.clearStock();
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
    Cartography.clearStock();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the upgrades: Token Cap and Cartography Table (D-9)', () => {
    it('the Token Cap rank raises matCap() by 16 a rank, from 128 to 256', () => {
        expect(MatCap.matCap()).toBe(TOKEN_CAP_BASE);
        expect(TOKEN_CAP_BASE).toBe(128);
        for (const id of ['item_oak_wood', 'item_stone', 'item_copper_ingot', 'item_fir_wood', 'item_iron_ingot']) InventoryManager.addItem(id, 2000);
        expect(GuildUpgradeManager.purchase('token_cap').success).toBe(true);
        expect(MatCap.matCap()).toBe(144);
        expect(MatCap.canPlaceMore(144)).toBe(true);
        expect(MatCap.canPlaceMore(145)).toBe(false);
        for (let i = 1; i < TOKEN_CAP_MAX_RANK; i++) expect(GuildUpgradeManager.purchase('token_cap').success).toBe(true);
        expect(MatCap.matCap()).toBe(256);
        expect(GuildUpgradeManager.purchase('token_cap').success).toBe(false);
        // A save holding more ranks than there are still caps at the top.
        GameState.state.progress.guildUpgrades.token_cap = 12;
        expect(MatCap.matCap()).toBe(256);
        expect(tokenCapForRank(-3)).toBe(128);
    });

    it('the Mat Tuner dev override still wins over the rank', () => {
        GameState.state.progress.guildUpgrades.token_cap = 2;
        setMatTuning('tokenCap', 40);
        expect(MatCap.matCap()).toBe(40);
        resetMatTuning();
        expect(MatCap.matCap()).toBe(160);
    });

    it('prices both tracks by the planes: ranks 1-2 in oak, stone and copper, 3-4 in fir and iron, later ranks the placeholder', () => {
        const itemsOf = (price) => price.map(p => p.itemId).sort();
        for (const id of ['token_cap', 'cartography_slots']) {
            const def = getUpgradeDef(id);
            expect(def.prices).toHaveLength(def.maxRank);
            for (const rank of [1, 2]) expect(itemsOf(def.prices[rank - 1]), `${id} ${rank}`).toEqual(['item_copper_ingot', 'item_oak_wood', 'item_stone']);
            for (const rank of [3, 4]) expect(itemsOf(def.prices[rank - 1]), `${id} ${rank}`).toEqual(['item_fir_wood', 'item_iron_ingot']);
            for (let rank = 5; rank <= def.maxRank; rank++) expect(def.prices[rank - 1], `${id} ${rank}`).toEqual([{ itemId: 'item_oak_wood', quantity: 10 * rank }]);
            // Each rank of a plane costs more than the one before it.
            for (const [a, b] of [[0, 1], [2, 3]]) {
                for (const p of def.prices[b]) expect(p.quantity).toBeGreaterThan(def.prices[a].find(q => q.itemId === p.itemId).quantity);
            }
        }
        expect(getUpgradeDef('token_cap').maxRank).toBe(8);
        expect(getUpgradeDef('cartography_slots').maxRank).toBe(CARTOGRAPHY_SLOTS_MAX - CARTOGRAPHY_SLOTS_BASE);
    });

    it('the table has 4 slots to start and one more per rank, up to 8', () => {
        expect([0, 1, 4, 9].map(cartographySlotsForRank)).toEqual([4, 5, 8, 8]);
        const { container, rerender } = render(React.createElement(CartographyTable, { version: 0 }));
        expect(container.querySelectorAll('[data-cartography-slot]').length).toBe(4);
        GameState.state.progress.guildUpgrades.cartography_slots = 2;
        rerender(React.createElement(CartographyTable, { version: 1 }));
        expect(container.querySelectorAll('[data-cartography-slot]').length).toBe(6);
    });
});

describe('the Cartography table', () => {
    it('slots one item per click, never more copies than the Bank holds, and greys out what is all slotted', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        InventoryManager.addItem(THICKET_ITEM, 2);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        const wood = q(container, `[data-map-item="${WOOD_ITEM}"]`);
        const thicket = q(container, `[data-map-item="${THICKET_ITEM}"]`);

        fireEvent.click(wood);
        expect(slotItems(container)).toEqual([WOOD_ITEM, '', '', '']);
        expect(wood.disabled).toBe(true);
        expect(wood.getAttribute('data-slotted-out')).toBe('true');
        fireEvent.click(wood);
        expect(slotItems(container)).toEqual([WOOD_ITEM, '', '', '']);

        fireEvent.click(thicket);
        expect(thicket.getAttribute('data-slotted-out')).toBe('false');
        expect(thicket.textContent).toContain('×1');
        fireEvent.click(thicket);
        fireEvent.click(thicket);
        expect(slotItems(container)).toEqual([WOOD_ITEM, THICKET_ITEM, THICKET_ITEM, '']);

        // Clicking a slot takes its map back out.
        fireEvent.click(q(container, '[data-cartography-slot="0"]'));
        expect(slotItems(container)).toEqual(['', THICKET_ITEM, THICKET_ITEM, '']);
        expect(wood.disabled).toBe(false);
        // Nothing has left the Bank.
        expect([bank(WOOD_ITEM), bank(THICKET_ITEM)]).toEqual([1, 2]);
    });

    it('stops slotting when every slot is full', () => {
        InventoryManager.addItem(THICKET_ITEM, 9);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        const thicket = q(container, `[data-map-item="${THICKET_ITEM}"]`);
        for (let i = 0; i < 6; i++) fireEvent.click(thicket);
        expect(slotItems(container)).toEqual(Array(4).fill(THICKET_ITEM));
        expect(thicket.disabled).toBe(true);
    });

    it('empties a slot whose map the Bank no longer holds', () => {
        const held = new Map([[WOOD_ITEM, { count: 1 }], [THICKET_ITEM, { count: 2 }]]);
        expect(fitSlots([WOOD_ITEM, WOOD_ITEM, THICKET_ITEM, THICKET_ITEM, THICKET_ITEM], 4, held))
            .toEqual([WOOD_ITEM, null, THICKET_ITEM, THICKET_ITEM]);
    });

    it('shows what the slotted maps write as Token sprites with counts, biggest first, over the preview of their Region', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        InventoryManager.addItem(THICKET_ITEM, 1);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        expect(q(container, '[data-map-preview="empty"]')).toBeTruthy();
        expect(q(container, '[data-plan-contents]')).toBeNull();
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        fireEvent.click(q(container, `[data-map-item="${THICKET_ITEM}"]`));
        const plan = Atlas.preview([WOOD_ITEM, THICKET_ITEM], { seed: 1 });
        expect(q(container, '[data-plan-headline]').textContent).toBe(`${plan.summary.total} Tokens`);
        const shown = [...container.querySelectorAll('[data-plan-token]')].map(li => [li.getAttribute('data-plan-token'), Number(li.getAttribute('data-count'))]);
        expect(shown).toEqual(contentsOf(plan.summary).map(e => [e.typeId, e.count]));
        expect(q(container, `[data-plan-token="${OAK}"]`).textContent).toBe(`×${plan.summary.entries[0].count}`);
        expect(q(container, 'canvas[data-map-preview]')).toBeTruthy();
        expect(q(container, '[data-map-preview="empty"]')).toBeNull();
    });

    it('lists the contents biggest first, whatever their role', () => {
        const summary = { entries: [
            { typeId: 'a', role: 'node', count: 3 }, { typeId: 'b', role: 'node', count: 9 },
            { typeId: 'c', role: 'camp', count: 12 }, { typeId: 'd', role: 'treasure', count: 3 }
        ] };
        expect(contentsOf(summary).map(e => e.typeId)).toEqual(['c', 'b', 'a', 'd']);
        expect(contentsOf(null)).toEqual([]);
    });

    it('rerolls the layout but not the contents, then waits out the cooldown', () => {
        vi.useFakeTimers();
        InventoryManager.addItem(WOOD_ITEM, 1);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        const seed = () => q(container, 'canvas[data-map-preview]').getAttribute('data-preview-seed');
        const contents = q(container, '[data-plan-contents]').textContent;
        const before = seed();
        const reroll = q(container, '[data-cartography-reroll]');
        fireEvent.click(reroll);
        expect(seed()).not.toBe(before);
        expect(q(container, '[data-plan-contents]').textContent).toBe(contents);
        expect(reroll.disabled).toBe(true);
        act(() => { vi.advanceTimersByTime(REROLL_COOLDOWN_MS - 10); });
        expect(reroll.disabled).toBe(true);
        act(() => { vi.advanceTimersByTime(20); });
        expect(reroll.disabled).toBe(false);
    });

    it('emptying the slots, or closing, takes nothing; there is no Cancel', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        InventoryManager.addItem(THICKET_ITEM, 1);
        const regions = regionCount();
        const { container, unmount } = render(React.createElement(CartographyTable, { version: 0 }));
        expect(q(container, '[data-cartography-cancel]')).toBeNull();
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        fireEvent.click(q(container, `[data-map-item="${THICKET_ITEM}"]`));
        fireEvent.click(q(container, '[data-cartography-slot="0"]'));
        fireEvent.click(q(container, '[data-cartography-slot="1"]'));
        expect(slotItems(container)).toEqual(['', '', '', '']);
        expect(q(container, '[data-map-preview="empty"]')).toBeTruthy();
        // An empty slot takes nothing out.
        fireEvent.click(q(container, '[data-cartography-slot="2"]'));
        expect(slotItems(container)).toEqual(['', '', '', '']);
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        unmount();
        expect([bank(WOOD_ITEM), bank(THICKET_ITEM), regionCount()]).toEqual([1, 1, regions]);
    });

    it('Settle takes the slotted maps and adds a Region, then offers to travel there', async () => {
        InventoryManager.addItem(WOOD_ITEM, 2);
        InventoryManager.addItem(THICKET_ITEM, 1);
        const regions = regionCount();
        const onTravel = vi.fn();
        const { container } = render(React.createElement(CartographyTable, { version: 0, onTravel }));
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        fireEvent.click(q(container, `[data-map-item="${THICKET_ITEM}"]`));
        fireEvent.click(q(container, '[data-cartography-settle]'));

        expect([bank(WOOD_ITEM), bank(THICKET_ITEM)]).toEqual([1, 0]);
        expect(regionCount()).toBe(regions + 1);
        const region = Atlas.list().at(-1);
        expect(region.practicalName).toBe('Thicket Wood');
        expect(region.active).toBe(false);
        expect(slotItems(container)).toEqual(['', '', '', '']);
        expect(q(container, '[data-cartography-settled]').textContent).toContain(region.flavourName);

        fireEvent.click(q(container, '[data-settled-travel]'));
        expect(onTravel).toHaveBeenCalledWith(region.id);
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
        React.createElement(AtlasScreen, { onClose: vi.fn(), closePromotion: vi.fn(), ...props })
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
        const closePromotion = vi.fn();
        const { container } = screen({ onClose, closePromotion });
        pick(container, region.id);
        await act(async () => { pressTravel(container, region.id); });
        expect(Atlas.activeRegionId()).toBe(starter);
        expect(q(container, '[data-region-message]').textContent).toBe(TEXT.REFUSE_CATCHING_UP);
        expect(onClose).not.toHaveBeenCalled();
        expect(closePromotion).not.toHaveBeenCalled();
    });

    it('ends a drag and closes the promotion ceremony before the guild travels', async () => {
        const { region } = Atlas.createRegion({ ingredients: [WOOD_ITEM] });
        const order = [];
        const onKey = (e) => { if (e.key === 'Escape' && e.code === 'Escape') order.push('drag ended'); };
        document.addEventListener('keydown', onKey);
        const off = EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => order.push('travelled'));
        try {
            const { container } = screen({
                dragging: true,
                onClose: () => order.push('closed'),
                closePromotion: () => order.push('promotion closed')
            });
            pick(container, region.id);
            await act(async () => {
                pressTravel(container, region.id);
                await new Promise(r => setTimeout(r, 120));
            });
            expect(order).toEqual(['drag ended', 'promotion closed', 'travelled', 'closed']);
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

    it('Escape closes it; the Cartography tab keeps its slots across tabs', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        const onClose = vi.fn();
        const { container } = screen({ onClose, initialTab: ATLAS_TAB.CARTOGRAPHY });
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.REGIONS}"]`));
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.CARTOGRAPHY}"]`));
        expect(slotItems(container)[0]).toBe(WOOD_ITEM);
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

    it('lays Cartography over both pages: the maps on the left; the slots, preview, contents and buttons down the right', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        const { container } = screen({ initialTab: ATLAS_TAB.CARTOGRAPHY });
        const left = q(container, '[data-cartography] [data-tome-left]');
        const right = q(container, '[data-cartography] [data-tome-right]');
        expect(q(left, `[data-map-item="${WOOD_ITEM}"] img`)).toBeTruthy();
        expect(q(left, '[data-cartography-slot]')).toBeNull();
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        const order = ['[data-cartography-slots]', 'canvas[data-map-preview]', '[data-plan-contents]', '[data-cartography-reroll]', '[data-cartography-settle]']
            .map(sel => q(right, sel));
        expect(order.every(Boolean)).toBe(true);
        for (let i = 1; i < order.length; i++) {
            expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
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

    it('the Bank changing under an open table keeps the layout shown', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        const { container } = screen({ initialTab: ATLAS_TAB.CARTOGRAPHY });
        fireEvent.click(q(container, `[data-map-item="${WOOD_ITEM}"]`));
        const seed = () => q(container, 'canvas[data-map-preview]').getAttribute('data-preview-seed');
        const before = seed();
        act(() => { InventoryManager.addItem('item_oak_wood', 3); });
        expect(seed()).toBe(before);
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
        expect(container.querySelectorAll('nav button').length).toBe(5);
    });
});
