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
import { holdsCopy, slotBacked } from '../systems/equipment/heldCopies.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as World from '../systems/world/World.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { setRenamesForTests, resetRenamesForTests } from '../config/registries/renameRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { resetMatTuning } from '../config/matTuning.js';
import { logger } from '../utils/Logger.js';

/**
 * A save written before a rename, loaded through the real load path once the CMS's table names the
 * rename: the Bank shows the stack under its new name, the hero's gear slot works, a Token of the
 * renamed type stands as its new type, and the save check names none of it.
 */

const OLD_LOGS = 'fixture_r2l_oak_wood';
const NEW_LOGS = 'fixture_r2l_oak_logs';
const OLD_SHIELD = 'fixture_r2l_tin_shield';
const NEW_SHIELD = 'fixture_r2l_copper_shield';
const SLOT = 0;
const NOW = 1_800_000_000_000;
const h = React.createElement;

registerItems({
    [NEW_LOGS]: { id: NEW_LOGS, name: 'R2 Oak Logs', type: 'material', stackable: true, tags: [], sprite: 'wood_oak', value: 1 },
    [NEW_SHIELD]: { id: NEW_SHIELD, name: 'R2 Copper Shield', type: 'armor', equipSlot: 'hand', offHand: true, stackable: true, tags: ['Armour', 'Shield'], sprite: 'wood_oak', value: 1 }
});

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Slot 0 holds a game played under the old names. */
function writeSlot() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const state = GameState.state;
    state.inventory.items[OLD_LOGS] = { itemId: OLD_LOGS, quantity: 500, dur: null };
    state.collection.discoveredItems[OLD_LOGS] = true;
    const hero = generateHero();
    hero.equipment[1] = OLD_SHIELD;
    hero.heldCopies = hero.equipment.map((_, i) => i === 1);
    state.heroes.push(hero);
    World.createWorld({ seed: 1 });
    const cell = state.world.cells.find(c => c.ring === 1 && c.requires?.items?.length);
    cell.requires.items[0] = { ...cell.requires.items[0], itemId: OLD_LOGS };
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW;
    localStorage.setItem(SaveManager.getSlotKey(SLOT), JSON.stringify(save));
    return { heroId: hero.id, cellId: cell.id };
}

async function loadAndPlay(ticks = 20) {
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
    resetRenamesForTests();
    vi.mocked(Date.now).mockRestore();
    vi.mocked(logger.warn).mockRestore();
    vi.mocked(logger.error).mockRestore();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a save loaded after its items were renamed in the CMS', () => {
    it('the old ids are gone from the data, the new ones are there', () => {
        expect(getItem(OLD_LOGS)).toBeNull();
        expect(getItem(OLD_SHIELD)).toBeNull();
        expect(getItem(NEW_LOGS)).not.toBeNull();
        expect(getItem(NEW_SHIELD)).not.toBeNull();
    });

    it('without the table the stack stays hidden under its old id (as before)', async () => {
        writeSlot();
        await loadAndPlay();
        expect(InventoryManager.getItemCount(OLD_LOGS)).toBe(500);
        expect(InventoryManager.getItemCount(NEW_LOGS)).toBe(0);
    });

    it('with the table: the Bank shows it, the gear slot works, the price asks the new item, nothing is a ghost', async () => {
        const { heroId, cellId } = writeSlot();
        setRenamesForTests({ items: { [OLD_LOGS]: NEW_LOGS, [OLD_SHIELD]: NEW_SHIELD } });
        await loadAndPlay();

        expect(InventoryManager.getItemCount(NEW_LOGS)).toBe(500);
        expect(GameState.state.inventory.items[OLD_LOGS]).toBeUndefined();
        const view = render(h(DeckDndProvider, null, h(BankTab)));
        const shown = [...view.container.querySelectorAll('[data-bank-item]')].map(e => e.getAttribute('data-bank-item'));
        expect(shown).toContain(NEW_LOGS);

        const hero = GameState.state.heroes.find(x => x.id === heroId);
        expect(hero.equipment[1]).toBe(NEW_SHIELD);
        expect(holdsCopy(hero, 1)).toBe(true);
        expect(slotBacked(hero, 1)).toBe(true);
        // The copy stayed in the hero's hands: none came back to the Bank, none was lost.
        expect(InventoryManager.getItemCount(NEW_SHIELD)).toBe(0);

        const cell = GameState.state.world.cells.find(c => c.id === cellId);
        expect(cell.requires.items[0].itemId).toBe(NEW_LOGS);
        expect(GameState.state.collection.discoveredItems[NEW_LOGS]).toBe(true);

        const ids = auditSaveContent(GameState.state).map(g => g.id);
        expect(ids).not.toContain(OLD_LOGS);
        expect(ids).not.toContain(OLD_SHIELD);
    });

    it('saved again and loaded again, it stays as it is', async () => {
        writeSlot();
        setRenamesForTests({ items: { [OLD_LOGS]: NEW_LOGS, [OLD_SHIELD]: NEW_SHIELD } });
        await loadAndPlay(5);
        const again = JSON.parse(GameState.serializeJson());
        expect(again.state.inventory.items[NEW_LOGS].quantity).toBe(500);
        again.savedAt = NOW;
        localStorage.setItem(SaveManager.getSlotKey(SLOT), JSON.stringify(again));
        await loadAndPlay(5);
        expect(InventoryManager.getItemCount(NEW_LOGS)).toBe(500);
    });
});
