// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { migrateState, RETIRED_QUEST_TOKEN } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION, INITIAL_STATE } from '../state/StateSchema.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { LESSON_STEPS, GOAL_STEP, LIMES_MOMENTS } from '../systems/quests/lessonPlan.js';
import * as BoardState from '../systems/board/BoardState.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Bounties are cut. None arrives beside the Hall however long the guild plays, and an older save
 * with bounty Tokens on its mats loads without them, quietly: nothing is paid, and a half-done
 * bounty's progress is simply gone. Limes's lessons keep every report they count, and no report is
 * made that nothing counts.
 */

const SLOT = 0;
const slotKey = () => SaveManager.getSlotKey(SLOT);

/** A bounty Token as an older build saved it: a half-done hunt, and a collection already done. */
function oldBounty(id, x, y, quest) {
    return {
        id, typeId: RETIRED_QUEST_TOKEN, x, y, placedAt: 90, usesRemaining: null, cycleElapsedMs: 0,
        origin: 'spawned', quest: { id: `quest_1_${id}`, tutorial: false, rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }], ...quest }
    };
}

const HALF_DONE_HUNT = { title: 'Defeat 4 Goblins', type: 'hunt', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 4, currentCount: 2, done: false };
const DONE_COLLECTION = { title: 'Collect 10 Oak Wood', type: 'collection', targetType: 'item_collected', itemId: 'item_oak_wood', requiredCount: 10, currentCount: 10, done: true };

const questTokensIn = (board) => Object.values(board?.tokens || {}).filter(t => t?.typeId === RETIRED_QUEST_TOKEN);

beforeEach(() => localStorage.clear());

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    localStorage.clear();
});

describe('⭐ an older save with bounties on the mat', () => {
    it('loads from its slot without them: nothing paid, the Bank and the floor as they were', async () => {
        SaveManager.newGame(SLOT);
        const forest = placeAt('token_oak_forest', 700, 400);
        GameState.state.inventory.items.item_oak_wood = { quantity: 12 };
        SaveManager.save(false);

        const data = JSON.parse(localStorage.getItem(slotKey()));
        const s = data.state;
        s.board.tokens.q_hunt = oldBounty('q_hunt', 1000, 600, HALF_DONE_HUNT);
        s.board.tokens.q_col = oldBounty('q_col', 1100, 600, DONE_COLLECTION);
        s.quests = { clockMs: 120000 };
        const floorBefore = structuredClone(s.board.sprites);
        localStorage.setItem(slotKey(), JSON.stringify(data));

        expect(await SaveManager.loadSlot(SLOT, { catchUp: false })).toBe(true);
        expect(questTokensIn(GameState.state.board)).toEqual([]);
        expect(GameState.state.board.tokens[forest.id].typeId).toBe('token_oak_forest');
        const counts = Object.fromEntries(Object.entries(GameState.state.inventory.items).map(([id, e]) => [id, e.quantity]));
        expect(counts).toEqual({ item_oak_wood: 12 });
        expect(GameState.state.board.sprites).toEqual(floorBefore);
        expect('quests' in GameState.state).toBe(false);

        expect(SaveManager.save(false)).toBe(true);
        const resaved = JSON.parse(localStorage.getItem(slotKey())).state;
        expect(questTokensIn(resaved.board)).toEqual([]);
        expect('quests' in resaved).toBe(false);
    });

    it('every Region\'s frozen board loses its bounties too, and nothing else', () => {
        const old = structuredClone(INITIAL_STATE);
        old.board.tokens.q_live = oldBounty('q_live', 900, 500, HALF_DONE_HUNT);
        old.board.tokens.tree = { id: 'tree', typeId: 'token_oak_tree', x: 300, y: 300, placedAt: 1 };
        old.atlas = {
            ...old.atlas,
            regions: {
                r_away: { id: 'r_away', board: { tokens: {
                    q_away: oldBounty('q_away', 800, 500, DONE_COLLECTION),
                    rock: { id: 'rock', typeId: 'token_copper_ore_vein', x: 200, y: 200, placedAt: 2 }
                } } }
            }
        };
        old.quests = { clockMs: 500 };

        const migrated = migrateState(old, GAME_VERSION);
        expect(Object.keys(migrated.board.tokens)).toEqual(['tree']);
        expect(Object.keys(migrated.atlas.regions.r_away.board.tokens)).toEqual(['rock']);
        expect(migrated.quests).toBeUndefined();
        // The save handed in is left as it was.
        expect(Object.keys(old.board.tokens)).toEqual(['q_live', 'tree']);
    });

    it('the bounty Token type is gone from the game', () => {
        expect(getTokenType(RETIRED_QUEST_TOKEN)).toBeNull();
    });
});

describe('⭐ no bounty arrives beside the Hall', () => {
    afterAll(() => {
        for (const h of [...GameLoop.tickHandlers]) GameLoop.offTick(h.name);
        QuestManager.cleanup();
    });

    it('after ten minutes of play the mat holds only what was put there', () => {
        GameState.initNew();
        EngineBootstrap.init();
        GameLoop.stop();
        placeAt('token_guild_hall', 880, 560);
        const before = BoardState.tokens().map(t => t.id);
        for (let i = 0; i < 600; i++) GameLoop.runHandlers(1000);
        expect(BoardState.tokens().map(t => t.id)).toEqual(before);
        expect(GameLoop.tickHandlers.map(h => h.name)).not.toContain('quest_manager');
    });
});

describe('⭐ every lesson report is made, and no report is made that nothing counts', () => {
    afterEach(() => QuestManager.cleanup());

    it('the events QuestManager hears report only what a lesson step or moment counts', () => {
        GameState.initNew();
        QuestManager.cleanup();
        QuestManager.init();
        const reported = new Set();
        const spy = vi.spyOn(QuestManager, 'reportProgress').mockImplementation((type) => { reported.add(type); });
        try {
            // Every event the bounties once counted, as its publisher sends it.
            EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: 'tok_1', typeId: 'token_oak_tree' });
            EventBus.publish(ENGINE_EVENTS.TOKEN_PURCHASED, { typeId: 'token_wood_foundation' });
            EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, { typeId: 'token_workbench', fromTypeId: 'token_wood_foundation' });
            EventBus.publish(ENGINE_EVENTS.HERO_DEPLOYED, { heroId: 'h1', typeId: 'token_redberry_bush' });
            EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 'tok_1', typeId: 'token_oak_tree', failed: false, produced: ['item_oak_wood'] });
            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, { kind: 'item', refId: 'item_oak_wood', quantity: 2 });
            EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, {});
            EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: 'h2' });
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'wishing_well', count: 1 });
            EventBus.publish('ui_modal:opened', { modalId: 'bank' });
            EventBus.publish('ui:token_inspected', { instanceId: 'tok_1', typeId: 'token_oak_tree' });
            EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'created', cellId: '1,0' });
            EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'travelled' });
            EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { action: 'equip', heroId: 'h1', itemId: 'item_redberry' });
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'tok_1' });
            EventBus.publish(ENGINE_EVENTS.COMBAT_VICTORY, { enemyId: 'token_goblin' });
        } finally {
            spy.mockRestore();
        }
        const counted = new Set([...LESSON_STEPS, GOAL_STEP, ...Object.values(LIMES_MOMENTS)].map(s => s.targetType));
        for (const type of reported) expect(counted.has(type), `${type} is counted by no lesson`).toBe(true);
        for (const type of counted) expect(reported.has(type), `${type} is never reported`).toBe(true);
    });
});
