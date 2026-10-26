// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { grantStarterTools } from '../systems/equipment/StarterTools.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { starterToolIds } from '../config/registries/toolKinds.js';
import { resetMatTuning } from '../config/matTuning.js';

/**
 * ⭐ The starter tools, once per game: a save from before tools were gear (no tools in its Bank,
 * never given any) receives one of each starter tool the first time it loads, so its heroes can
 * gather again; it never receives them twice.
 */

const NOW = 1_800_000_000_000;
const STARTERS = {
    fx_load_pick: { id: 'fx_load_pick', name: 'Fixture Load Pickaxe', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'pickaxe', tier: 1, starter: true } },
    fx_load_axe: { id: 'fx_load_axe', name: 'Fixture Load Woodaxe', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'woodaxe', tier: 1, starter: true } }
};

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Slot 0 holds a game from before tools: nothing in the Bank, no starter tools ever given. */
function writeOldSlot() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    delete GameState.state.progress.starterTools;
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW - 1000;
    localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
}

const TRAP = { fx_load_trap: { id: 'fx_load_trap', name: 'Fixture Load Trap', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_trap', tier: 1, starter: true } } };
const OTHER_TRAP = { fx_load_crab_trap: { id: 'fx_load_crab_trap', name: 'Fixture Crab Trap', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_trap', tier: 2 } } };

/** Slot 0 holds a game given its starter tools before the record named them (`starterTools: true`). */
function writeLegacySlot(setup = () => {}) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    for (const id of Object.keys(STARTERS)) InventoryManager.addItem(id, 1);
    GameState.state.progress.starterTools = true;
    setup();
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW - 1000;
    localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
}

async function load() {
    expect(await SaveManager.loadSlot(0)).toBe(true);
    await EngineBootstrap.onSlotSelected(0, false);
    GameLoop.stop();
}

const bank = () => Object.keys(GameState.state.inventory.items).filter(id => id.startsWith('fx_load_')).sort();

// The shipped starter tools, set aside so the fixtures stand in for them: content with none, then
// content with the fixtures as its only starters.
const SHIPPED_STARTERS = Object.fromEntries(starterToolIds(getAllItems()).map(id => [id, getAllItems()[id]]));
const hideShippedStarters = () => { for (const id of Object.keys(SHIPPED_STARTERS)) delete getAllItems()[id]; };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    hideShippedStarters();
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(Date.now).mockRestore();
    for (const id of [...Object.keys(STARTERS), ...Object.keys(TRAP), ...Object.keys(OTHER_TRAP)]) delete getAllItems()[id];
    registerItems(SHIPPED_STARTERS);
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a save from before tools were gear', () => {
    it('receives one of each starter tool on its first load, and never again', async () => {
        registerItems(STARTERS);
        writeOldSlot();
        await load();
        expect(bank()).toEqual(['fx_load_axe', 'fx_load_pick']);
        // The record names each starter given, so one marked Starter later is still given once.
        expect(GameState.state.progress.starterTools).toEqual(['fx_load_pick', 'fx_load_axe']);

        // Lost or sold since: a later load does not hand them out again.
        InventoryManager.removeItem('fx_load_pick', 1);
        InventoryManager.removeItem('fx_load_axe', 1);
        SaveManager.save(false);
        await load();
        expect(bank()).toEqual([]);
    });

    it('loaded before the content has starter tools, it is not marked, so it gets them once they exist', async () => {
        writeOldSlot();
        await load();
        expect(GameState.state.progress.starterTools).toBeUndefined();
        SaveManager.save(false);

        registerItems(STARTERS);
        await load();
        expect(bank()).toEqual(['fx_load_axe', 'fx_load_pick']);
    });

    it('with the shipped content, an old save receives its starter tools: one of each kind', async () => {
        registerItems(SHIPPED_STARTERS);
        writeOldSlot();
        await load();
        const held = Object.keys(GameState.state.inventory.items).filter(id => id in SHIPPED_STARTERS);
        expect(held.map(id => getAllItems()[id].tool.kind).sort()).toEqual(['fishing_rod', 'fishing_trap', 'pickaxe', 'sickle', 'woodaxe']);
        expect(held.every(id => InventoryManager.getItemCount(id) === 1)).toBe(true);
    });

    it('a Trap marked Starter joins the others, last in kind order (the content pack brings the item)', () => {
        registerItems({ ...TRAP, ...STARTERS });
        GameState.initNew();
        InventoryManager.init();
        expect(starterToolIds(getAllItems())).toEqual(['fx_load_pick', 'fx_load_axe', 'fx_load_trap']);
        expect(grantStarterTools()).toEqual(['fx_load_pick', 'fx_load_axe', 'fx_load_trap']);
    });

    it('a starter tool the Bank already holds is not doubled', () => {
        registerItems(STARTERS);
        GameState.initNew();
        InventoryManager.init();
        InventoryManager.addItem('fx_load_pick', 3);
        expect(grantStarterTools()).toEqual(['fx_load_axe']);
        expect(InventoryManager.getItemCount('fx_load_pick')).toBe(3);
        expect(grantStarterTools()).toEqual([]);
    });
});

describe('a save given its starter tools before the record named them', () => {
    it('with no trap, gets one Trap once, and never again on a later load; the record survives save and load', async () => {
        registerItems(STARTERS);
        writeLegacySlot();
        registerItems(TRAP);
        await load();
        expect(bank()).toEqual(['fx_load_axe', 'fx_load_pick', 'fx_load_trap']);
        expect(InventoryManager.getItemCount('fx_load_pick')).toBe(1);
        expect(InventoryManager.getItemCount('fx_load_trap')).toBe(1);
        expect(GameState.state.progress.starterTools).toEqual(['fx_load_pick', 'fx_load_axe', 'fx_load_trap']);

        InventoryManager.removeItem('fx_load_trap', 1);
        SaveManager.save(false);
        await load();
        expect(GameState.state.progress.starterTools).toEqual(['fx_load_pick', 'fx_load_axe', 'fx_load_trap']);
        expect(InventoryManager.getItemCount('fx_load_trap')).toBe(0);
    });

    it('already holding a trap of another make, in the Bank, gets none', async () => {
        registerItems({ ...STARTERS, ...OTHER_TRAP });
        writeLegacySlot(() => InventoryManager.addItem('fx_load_crab_trap', 1));
        registerItems(TRAP);
        await load();
        expect(InventoryManager.getItemCount('fx_load_trap')).toBe(0);
        expect(GameState.state.progress.starterTools).toContain('fx_load_trap');
    });

    it("a trap held in a hero's hands counts too", () => {
        registerItems({ ...STARTERS, ...OTHER_TRAP, ...TRAP });
        GameState.initNew();
        InventoryManager.init();
        GameState.state.progress.starterTools = true;
        GameState.state.heroes = [{ id: 'fx_hero', equipment: ['fx_load_crab_trap'], heldCopies: [true] }];
        expect(grantStarterTools()).toEqual(['fx_load_pick', 'fx_load_axe']);
        expect(InventoryManager.getItemCount('fx_load_trap')).toBe(0);
    });
});
