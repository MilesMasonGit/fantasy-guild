// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { auditSaveContent } from '../systems/core/ContentAudit.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryFormatter } from '../systems/inventory/InventoryFormatter.js';
import { collectedOf } from '../systems/progression/collectionLog.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Settling from '../systems/world/Settling.js';
import * as World from '../systems/world/World.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getItem, getAllItems } from '../config/registries/itemRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { bannerForRegion } from '../ui/components/atlas/regionBanner.js';
import { resetMatTuning } from '../config/matTuning.js';
import { logger } from '../utils/Logger.js';

/**
 * A save can outlive its content: a Sync deletes an item (24 map and modifier items went at once)
 * while a slot's Bank still holds a stack of it, a hero still wears it, and a Region or a world cell
 * still names it. Such a save loads and plays through the real load path. The stack stays in the
 * save, because a half-finished rename brings it back the moment the new name matches; the Bank just
 * cannot show it.
 */

/** Items the seed-maps Sync deleted: a Base Map and a Modifier. */
const GONE_MAP = 'map_forest';
const GONE_MODIFIER = 'mod_overgrown';
const SLOT = 0;
const NOW = 1_800_000_000_000;
const h = React.createElement;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const liveItem = () => Object.values(getAllItems()).find(def => def.type === 'material').id;

/** Slot 0 holds a game whose Bank, one hero and the collection name items the content has lost. */
function writeSlot(prepare = () => {}) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const state = GameState.state;
    state.inventory.items[GONE_MAP] = { itemId: GONE_MAP, quantity: 3, dur: null };
    state.inventory.items[GONE_MODIFIER] = { itemId: GONE_MODIFIER, quantity: 1, dur: null };
    state.inventory.items[liveItem()] = { itemId: liveItem(), quantity: 5, dur: null };
    state.collection.discoveredItems[GONE_MAP] = true;
    state.collection.itemLifetimeCounts = { ...state.collection.itemLifetimeCounts, [GONE_MAP]: 3 };
    state.collection.firstKillDrops = { token_goblin: true };
    const hero = generateHero();
    hero.equipment[0] = GONE_MAP;
    state.heroes.push(hero);
    prepare(state);
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW;
    localStorage.setItem(SaveManager.getSlotKey(SLOT), JSON.stringify(save));
}

async function loadAndPlay(ticks = 30) {
    expect(await SaveManager.loadSlot(SLOT)).toBe(true);
    await EngineBootstrap.onSlotSelected(SLOT, false);
    GameLoop.stop();
    for (let i = 0; i < ticks; i++) GameLoop.runHandlers(100);
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(Date.now).mockRestore();
    vi.mocked(logger.warn).mockRestore();
    vi.mocked(logger.error).mockRestore();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a save holding items the content no longer has', () => {
    it('names real deleted items, so these tests mean what they say', () => {
        expect(getItem(GONE_MAP)).toBeNull();
        expect(getItem(GONE_MODIFIER)).toBeNull();
    });

    it('loads and plays, the Bank keeping the stacks and the audit naming them', async () => {
        writeSlot();
        await loadAndPlay();
        const items = GameState.state.inventory.items;
        expect(items[GONE_MAP].quantity).toBe(3);
        expect(items[GONE_MODIFIER].quantity).toBe(1);
        expect(items[liveItem()].quantity).toBe(5);

        const ghosts = auditSaveContent(GameState.state);
        expect(ghosts.map(g => g.id).sort()).toEqual([GONE_MAP, GONE_MODIFIER].sort());
        expect(ghosts.find(g => g.id === GONE_MAP).places).toContain('in the Bank');
        expect(ghosts.find(g => g.id === GONE_MAP).places.some(p => p.startsWith('equipped by'))).toBe(true);
    });

    it('the Bank shows what it can, and the rest of the game still takes items', async () => {
        writeSlot();
        await loadAndPlay();
        const view = render(h(DeckDndProvider, null, h(BankTab)));
        const shown = [...view.container.querySelectorAll('[data-bank-item]')].map(e => e.getAttribute('data-bank-item'));
        expect(shown).toContain(liveItem());
        expect(shown).not.toContain(GONE_MAP);
        expect(shown).not.toContain(GONE_MODIFIER);
        expect(InventoryFormatter.getDisplayInventory().map(e => e.id)).not.toContain(GONE_MAP);

        InventoryManager.addItem(liveItem(), 2);
        expect(InventoryManager.getItemCount(liveItem())).toBe(7);
        // A stack of what no longer exists cannot be added to, and that is said, not thrown.
        expect(() => InventoryManager.addItem(GONE_MAP, 1)).not.toThrow();
        expect(InventoryManager.getItemCount(GONE_MAP)).toBe(3);
    });

    it('saves again and loads again the same', async () => {
        writeSlot();
        await loadAndPlay(5);
        const again = JSON.parse(GameState.serializeJson());
        expect(again.state.inventory.items[GONE_MAP].quantity).toBe(3);
        again.savedAt = NOW;
        localStorage.setItem(SaveManager.getSlotKey(SLOT), JSON.stringify(again));
        await loadAndPlay(5);
        expect(GameState.state.inventory.items[GONE_MAP].quantity).toBe(3);
    });

    it('the collection log reads past them', async () => {
        writeSlot();
        await loadAndPlay(1);
        expect(collectedOf().items.has(GONE_MAP)).toBe(true);
    });

    it('a Region written from them still reads: its name, and the banner of its ground', async () => {
        writeSlot(() => {
            Atlas.createRegion({
                ingredients: [GONE_MAP, GONE_MODIFIER], seed: 7,
                ground: { main: 'forest', terrains: { forest: 'grass' }, water: 0, shore: [], inland: [], small: {} }
            });
        });
        await loadAndPlay(5);
        const region = Atlas.list().find(r => r.ingredients?.includes(GONE_MAP)) || Atlas.list().at(-1);
        expect(Atlas.getRegion(region.id).ingredients).toEqual([GONE_MAP, GONE_MODIFIER]);
        expect(typeof bannerForRegion(region)).toBe('string');
    });

    it('a kept world whose cell still lists a modifier extra settles without it', async () => {
        writeSlot(() => { World.createWorld({ seed: 1 }); });
        await loadAndPlay(1);
        const cell = GameState.state.world.cells.find(c => c.ring === 1);
        const chests = cell.extras.filter(e => e.kind === 'treasure').length;
        cell.extras = [...cell.extras, { id: GONE_MODIFIER, kind: 'modifier', value: 10 }];
        const written = Settling.writePlace(cell);
        expect(written.success).toBe(true);
        expect(written.mat.treasures.reduce((n, t) => n + t.count, 0)).toBe(chests);
    });
});
