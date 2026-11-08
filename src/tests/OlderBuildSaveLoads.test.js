// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { RETIRED_SECTIONS, RETIRED_FIELDS } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ A save an earlier build of this version wrote, end to end through a slot: it carries the
 * sections and fields that build still wrote (cards, recruitment, the inert Bank caps, rarities,
 * the sidebar quest list, the retired hero and Region fields), it loads, plays on, and the next save
 * carries none of them.
 */

const SLOT = 0;
const slotKey = () => SaveManager.getSlotKey(SLOT);

/** Rewrite the slot's save the way an earlier build of this version wrote it. */
function writeOlderBuildSave() {
    const data = JSON.parse(localStorage.getItem(slotKey()));
    expect(data.version).toBe(GAME_VERSION);
    const s = data.state;
    s.recruitment = { candidates: [] };
    s.cards = { idCounter: 1 };
    s.inventory.slots = { max: 20, used: 0 };
    s.inventory.maxStack = 1e12;
    s.inventory.maxStackBonus = 0;
    for (const def of Object.values(s.inventory.groupDefs)) def.isCustom = false;
    s.progress.unlockedRarities = ['common', 'uncommon'];
    s.progress.discoveredTasksByBiome = {};
    s.quests.active = [];
    s.quests.nextQuestAt = null;
    s.collection.provenance = { token_oak_forest: { item_oak_wood: true } };
    s.ui.newDiscoveries = { item_oak_wood: true };
    for (const region of Object.values(s.atlas.regions || {})) region.settledAt = 0;
    for (const hero of s.heroes) Object.assign(hero, { classId: null, traitId: null, createdAt: 0, woundedUntil: null, statuses: [] });
    localStorage.setItem(slotKey(), JSON.stringify(data));
    return data;
}

/** Every retired key still found in a saved state, as `section.field` paths. */
function retiredKeysIn(state) {
    const found = [];
    for (const key of RETIRED_SECTIONS) if (key in state) found.push(key);
    for (const [key, fields] of Object.entries(RETIRED_FIELDS)) {
        for (const f of fields) if (state[key] && f in state[key]) found.push(`${key}.${f}`);
    }
    for (const [id, def] of Object.entries(state.inventory?.groupDefs || {})) if ('isCustom' in def) found.push(`groupDefs.${id}.isCustom`);
    for (const [id, r] of Object.entries(state.atlas?.regions || {})) if ('settledAt' in r) found.push(`regions.${id}.settledAt`);
    for (const h of state.heroes || []) {
        for (const f of ['classId', 'traitId', 'createdAt']) if (f in h) found.push(`heroes.${h.id}.${f}`);
    }
    return found;
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    localStorage.clear();
});

describe('⭐ a save an earlier build of this version wrote loads end to end', () => {
    it('loads from its slot, plays on, and saves again without the retired fields', async () => {
        SaveManager.newGame(SLOT);
        const hero = generateHero({ name: 'Old Hand' });
        GameState.state.heroes.push(hero);
        const forest = placeAt('token_oak_forest', 700, 400);
        GameState.state.time.gameTimeMs = 4321;
        SaveManager.save(false);

        const written = writeOlderBuildSave();
        expect(retiredKeysIn(written.state).length).toBeGreaterThanOrEqual(15);

        expect(await SaveManager.loadSlot(SLOT, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(4321);
        expect(GameState.state.board.tokens[forest.id].typeId).toBe('token_oak_forest');
        const loaded = GameState.state.heroes.find(h => h.id === hero.id);
        expect(loaded.name).toBe('Old Hand');
        expect(loaded.woundedUntil).toBeNull();
        expect(loaded.statuses).toEqual([]);
        expect(retiredKeysIn(GameState.state)).toEqual([]);

        GameState.state.time.gameTimeMs += 1000;
        expect(SaveManager.save(false)).toBe(true);
        const resaved = JSON.parse(localStorage.getItem(slotKey()));
        expect(retiredKeysIn(resaved.state)).toEqual([]);
        expect(resaved.state.time.gameTimeMs).toBe(5321);

        expect(await SaveManager.loadSlot(SLOT, { catchUp: false })).toBe(true);
        expect(GameState.state.heroes.find(h => h.id === hero.id).name).toBe('Old Hand');
    });
});
