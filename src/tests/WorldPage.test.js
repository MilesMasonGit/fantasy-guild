// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import { CELL_STATE } from '../systems/world/frontier.js';
import { STRICT_RINGS } from '../config/worldTablesShape.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { t } from '../i18n/index.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { AtlasScreen } from '../ui/components/atlas/AtlasScreen.jsx';
import { shortWords } from '../ui/components/atlas/WorldPage.jsx';
import {
    shownRings, cellRadius, cellCentre, mapSize, iconsPerCell, RINGS_AHEAD, MIN_RADIUS, MAX_RADIUS
} from '../ui/components/atlas/worldMapLayout.js';
import { meetFrontierPrices } from '../ui/dev/worldDev.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { TUTORIAL_TEXT } from '../systems/quests/tutorialText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Atlas's World page: the run's hex world on the left page, the chosen place on the right.
 * Every strict ring shows from the start; the hover over a cell lists what it yields and its price
 * as have/need; Settle is offered only on the frontier, greyed with what is short until the guild
 * can pay, and settling closes the book with the guild in its new place; a settled place offers
 * Travel. A save from before the world shows one line.
 */

const q = (container, sel) => container.querySelector(sel);

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: 77 });
    GameState.state.progress.rosterLimit = 4;
}

const screen = (props = {}) => render(React.createElement(
    DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
    React.createElement(AtlasScreen, { onClose: vi.fn(), ...props })
));
const cellOf = (id) => World.currentWorld().cells.find(c => c.id === id);
const pickCell = (container, id) => fireEvent.click(q(container, `[data-world-cell="${id}"]`));

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
beforeEach(() => newGame());
afterEach(() => {
    cleanup();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the map\'s geometry (pure)', () => {
    it('shows every strict ring from the start, and the wild rings two past the furthest settled place', () => {
        const world = { rings: 6, cells: [{ id: 'a', ring: 0 }, { id: 'b', ring: 1 }, { id: 'c', ring: 2 }, { id: 'd', ring: 3 }, { id: 'e', ring: 5 }] };
        expect(shownRings(world, new Set(['a']))).toBe(STRICT_RINGS);
        expect(shownRings(world, new Set(['a', 'b']))).toBe(STRICT_RINGS);
        expect(shownRings(world, new Set(['a', 'c']))).toBe(2 + RINGS_AHEAD);
        expect(shownRings(world, new Set(['a', 'e']))).toBe(6);
        expect(shownRings(null, new Set())).toBe(0);
    });

    it('fits the rings shown into the page in whole pixels, within its bounds', () => {
        const r = cellRadius(3, 584, 740);
        expect(Number.isInteger(r)).toBe(true);
        const size = mapSize(3, r);
        expect(size.width).toBeLessThanOrEqual(584);
        expect(size.height).toBeLessThanOrEqual(740);
        expect(cellRadius(6, 20, 20)).toBe(MIN_RADIUS);
        expect(cellRadius(1, 5000, 5000)).toBe(MAX_RADIUS);
    });

    it('puts flat-topped neighbours side by side, and fits more icons in a bigger cell', () => {
        expect(cellCentre({ q: 0, r: 0 }, 40)).toEqual({ x: 0, y: 0 });
        expect(cellCentre({ q: 1, r: 0 }, 40)).toEqual({ x: 60, y: 35 });
        expect(cellCentre({ q: 0, r: 1 }, 40)).toEqual({ x: 0, y: 69 });
        expect(iconsPerCell(MIN_RADIUS)).toBe(1);
        expect(iconsPerCell(53)).toBe(2);
        expect(iconsPerCell(MAX_RADIUS)).toBe(3);
    });
});

describe('⭐ the World page', () => {
    it('⭐ draws the strict rings, the Hall\'s cell settled with the guild\'s flag, ring 1 the frontier, the rest beyond', () => {
        const { container } = screen();
        const cells = [...container.querySelectorAll('[data-world-cell]')];
        expect(cells).toHaveLength(1 + 6 + 12 + 18);
        const stateOf = (id) => q(container, `[data-world-cell="${id}"]`).getAttribute('data-world-state');
        for (const cell of World.currentWorld().cells.filter(c => c.ring <= STRICT_RINGS)) {
            const want = cell.ring === 0 ? CELL_STATE.SETTLED : cell.ring === 1 ? CELL_STATE.FRONTIER : CELL_STATE.BEYOND;
            expect(stateOf(cell.id), cell.id).toBe(want);
        }
        expect(q(container, '[data-world-here]').closest('[data-world-cell]').getAttribute('data-world-cell')).toBe('0,0');
        // The Hall's cell is shown first, settled, with no Settle.
        expect(q(container, '[data-world-detail="0,0"]')).toBeTruthy();
        expect(q(container, '[data-world-settle]')).toBeNull();
    });

    it('each cell shows its first outputs as item sprites', () => {
        const { container } = screen();
        const cell = cellOf('1,0');
        const icons = [...q(container, '[data-world-cell="1,0"]').querySelectorAll('img')].map(img => img.getAttribute('src'));
        expect(icons.length).toBeGreaterThan(0);
        expect(icons.length).toBeLessThanOrEqual(World.outputsOf(cell).length);
    });

    it('⭐ the hover lists what a cell yields and its price as have/need, red when short', () => {
        const cell = cellOf('1,0');
        const [first] = cell.requires.items;
        InventoryManager.addItem(first.itemId, 3);
        const have = InventoryManager.getItemCount(first.itemId);
        const { container } = screen();
        fireEvent.pointerEnter(q(container, '[data-world-cell="1,0"]'), { clientX: 400, clientY: 300 });
        const tip = document.querySelector('[data-world-tip="1,0"]');
        expect(tip).toBeTruthy();
        for (const id of World.outputsOf(cell)) expect(tip.textContent).toContain(getItem(id)?.name || id);
        const row = tip.querySelector(`[data-world-price-item="${first.itemId}"]`);
        expect(row.textContent).toContain(`${have}/${first.qty}`);
        expect(row.querySelector('.tabular-nums').className).toContain('color-ui-red');
        const skill = cell.requires.skills[0];
        expect(tip.querySelector(`[data-world-price-skill="${skill.skill}"]`).textContent).toContain(`0/${skill.level}`);
        expect(tip.textContent).toContain(t('worldMap.frontier'));
    });

    it('Settle greys out and says what is short until the guild can pay; then it settles, and the book closes', async () => {
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pickCell(container, '1,0');
        const settle = () => q(container, '[data-world-settle="1,0"]');
        expect(settle().disabled).toBe(true);
        const price = World.priceOf(cellOf('1,0'));
        expect(q(container, '[data-world-message]').textContent).toBe(shortWords(price));
        expect(shortWords(price)).toMatch(/^Short of /);

        act(() => {
            const hero = HeroManager.addHero(generateHero());
            for (const { skill, level } of cellOf('1,0').requires.skills) addXP(hero.id, skill, xpForLevel(level));
            for (const { itemId, qty } of cellOf('1,0').requires.items) InventoryManager.addItem(itemId, qty);
        });
        expect(settle().disabled).toBe(false);
        expect(q(container, '[data-world-message]')).toBeNull();
        expect(q(container, '[data-world-cell="1,0"]').getAttribute('data-world-ready')).toBe('true');
        await act(async () => { fireEvent.click(settle()); });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(World.activeCellId()).toBe('1,0');
        expect(Atlas.activeRegion().cellId).toBe('1,0');
    });

    it('a cell beyond the frontier offers nothing to press, only why', () => {
        const { container } = screen();
        const beyond = World.currentWorld().cells.find(c => c.ring === 2);
        pickCell(container, beyond.id);
        expect(q(container, `[data-world-detail="${beyond.id}"]`)).toBeTruthy();
        expect(q(container, '[data-world-settle]')).toBeNull();
        expect(q(container, '[data-world-travel]')).toBeNull();
        expect(q(container, '[data-world-detail-state]').textContent).toBe(t('worldMap.beyond'));
    });

    it('a settled place elsewhere offers Travel, and travelling closes the book', async () => {
        const hero = HeroManager.addHero(generateHero());
        const cell = cellOf('0,1');
        for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level));
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        expect(World.settleCell('0,1').success).toBe(true);
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        expect(q(container, '[data-world-detail="0,1"]')).toBeTruthy();
        expect(q(container, '[data-world-travel]')).toBeNull();
        pickCell(container, '0,0');
        await act(async () => { fireEvent.click(q(container, '[data-world-travel="0,0"]')); });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(World.activeCellId()).toBe('0,0');
    });

    it('a save from before the world shows one line and no map', () => {
        GameState.state.world = null;
        const { container } = screen();
        expect(q(container, '[data-world-none]').textContent).toBe(t('worldMap.noWorld'));
        expect(q(container, '[data-world-map]')).toBeNull();
    });
});

describe('the QA panel\'s frontier prices', () => {
    it('tops up what the frontier asks and raises the first hero, so every ring 1 cell can be paid', () => {
        expect(meetFrontierPrices()).toMatchObject({ success: false });
        HeroManager.addHero(generateHero());
        const result = meetFrontierPrices();
        expect(result).toMatchObject({ success: true, cells: 6 });
        for (const cell of World.currentWorld().cells.filter(c => c.ring === 1)) expect(World.priceOf(cell).met, cell.id).toBe(true);
    });
});

describe('the cartographer on the World page', () => {
    it('while the tutorial\'s last step asks for a first place, its words head the right page; then they go', () => {
        const { container: before } = screen();
        expect(q(before, '[data-world-note]')).toBeNull();
        cleanup();

        const quests = GameState.state.quests;
        for (const step of TUTORIAL_QUESTS.slice(0, -1)) quests.completedTutorials.push(step.id);
        for (const token of QuestTokens.tutorialTokens()) BoardState.removeToken(token.id);
        expect(QuestTokens.ensureTutorial()).toBe(true);
        const { container } = screen();
        const note = q(container, '[data-world-note]');
        expect(note.textContent).toContain(TUTORIAL_TEXT.steps.cart_first_place.title);
        expect(note.textContent).toContain(TUTORIAL_TEXT.speaker);
        cleanup();

        QuestTokens.tutorialTokens()[0].quest.done = true;
        expect(q(screen().container, '[data-world-note]')).toBeNull();
    });
});
