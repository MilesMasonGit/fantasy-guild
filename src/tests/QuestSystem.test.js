import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager, MAX_ACTIVE_QUESTS } from '../systems/quests/QuestManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryStore } from '../systems/inventory/InventoryStore.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Cartographer from '../systems/board/Cartographer.js';

describe('Quest System & Multi-Tutorial Chain', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        QuestManager.init();
    });

    afterEach(() => {
        QuestManager.cleanup();
    });

    it('initializes with 3 tutorial quests simultaneously rewarding Guild Hall Map', () => {
        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(MAX_ACTIVE_QUESTS); // 3

        expect(active[0].id).toBe('tutorial_1');
        expect(active[0].rewardMapId).toBe('map_guild_hall');
        expect(active[0].rewardMapName).toBe('Guild Hall Map');
        expect(active[1].id).toBe('tutorial_2');
        expect(active[1].rewardMapId).toBe('map_guild_hall');
        expect(active[2].id).toBe('tutorial_3');
        expect(active[2].rewardMapId).toBe('map_guild_hall');
    });

    it('immediately replenishes an opened slot with the next tutorial quest when claimed, delivering a BoardMap', () => {
        // Claim Step 0 (Recruit a Hero)
        EventBus.publish('hero_recruited', {});
        const initialMaps = BoardState.getBoardMaps().length;

        const res = QuestManager.claimQuest('tutorial_1');
        expect(res.success).toBe(true);
        expect(res.rewardMapId).toBe('map_guild_hall');

        // Spawns map on playmat in bottom-left coordinate quadrant
        const boardMaps = BoardState.getBoardMaps();
        expect(boardMaps.length).toBe(initialMaps + 1);
        const lastMap = boardMaps[boardMaps.length - 1];
        expect(lastMap.x).toBeGreaterThanOrEqual(10);
        expect(lastMap.x).toBeLessThanOrEqual(200);
        expect(lastMap.y).toBeGreaterThanOrEqual(250);

        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(3);
        // Step 3 (Deploy a Hero, id: 'tutorial_4') should now be in the 3 active slots!
        const step4 = active.find(q => q.id === 'tutorial_4');
        expect(step4).toBeDefined();
        expect(step4.rewardMapId).toBe('map_guild_hall');
    });

    it('opens Guild Hall Maps in strict scripted sequence regardless of open order', () => {
        // 1st open yields Drop 1 (Forest + Water)
        const burst1 = Cartographer.rollBurst('map_guild_hall');
        expect(burst1[0].refId).toBe('token_oak_forest');
        expect(burst1[1].refId).toBe('item_water');

        // 2nd open yields Drop 2 (Charcoal Kiln + Water)
        const burst2 = Cartographer.rollBurst('map_guild_hall');
        expect(burst2[0].refId).toBe('token_charcoal_kiln');
        expect(burst2[1].refId).toBe('item_water');

        // 3rd open yields Drop 3 (Copper Ore Vein + Copper Ore)
        const burst3 = Cartographer.rollBurst('map_guild_hall');
        expect(burst3[0].refId).toBe('token_copper_ore_vein');
        expect(burst3[1].refId).toBe('item_copper_ore');
    });

    it('completes item collection with a single stack of 10 items', () => {
        // Fast-forward claiming 1, 2, 3 so tutorial_6 enters active slots
        QuestManager.getActiveQuests().forEach(q => q.currentCount = q.requiredCount);
        QuestManager.claimQuest('tutorial_1');
        QuestManager.claimQuest('tutorial_2');
        QuestManager.claimQuest('tutorial_3');

        const active = QuestManager.getActiveQuests();
        const quest6 = active.find(q => q.id === 'tutorial_6');
        expect(quest6).toBeDefined();

        // Simulate collecting a stack of 10 items at once
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'item',
            refId: 'item_oak_wood',
            quantity: 10
        });

        expect(quest6.currentCount).toBe(10);
        expect(QuestManager.claimQuest('tutorial_6').success).toBe(true);
    });

    it('progresses Equip a Hero and Add a Context Token tutorial quests', () => {
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };

        // Fast forward so tutorial_8 (Equip a Hero) and tutorial_11 (Add a Context Token) can be reached
        for (let i = 1; i <= 7; i++) {
            completeAndClaim(`tutorial_${i}`);
        }

        const active = QuestManager.getActiveQuests();
        const equipQuest = active.find(q => q.id === 'tutorial_8');
        expect(equipQuest).toBeDefined();
        expect(equipQuest.title).toBe('Equip a Hero');

        // Test equipping hero
        EventBus.publish('hero_equipped', { heroId: 'hero_1', slot: 'weapon', itemId: 'item_copper_pickaxe' });
        expect(equipQuest.currentCount).toBe(1);
        expect(QuestManager.claimQuest('tutorial_8').success).toBe(true);

        // Fast forward to reach tutorial_11 (Add a Context Token)
        completeAndClaim('tutorial_9');
        completeAndClaim('tutorial_10');

        const contextQuest = QuestManager.getActiveQuests().find(q => q.id === 'tutorial_11');
        expect(contextQuest).toBeDefined();
        expect(contextQuest.title).toBe('Add a Context Token');

        // Test placing context token
        EventBus.publish('token_placed', { tile: 10, typeId: 'token_copper_pickaxe' });
        expect(contextQuest.currentCount).toBe(1);
        expect(QuestManager.claimQuest('tutorial_11').success).toBe(true);
    });

    it('prevents abandoning tutorial quests but allows abandoning bounties with 5-minute locked cooldown', () => {
        // Attempt to abandon a tutorial quest (should be rejected)
        const tutorialRes = QuestManager.abandonQuest('tutorial_1');
        expect(tutorialRes.success).toBe(false);
        expect(tutorialRes.reason).toContain('Tutorial quests cannot be abandoned');

        // Add a non-tutorial bounty
        const bounty = {
            id: 'bounty_abandon_test',
            isTutorial: false,
            type: 'hunt',
            title: 'Defeat 3 Goblins',
            targetType: 'enemy_hunted',
            requiredCount: 3,
            currentCount: 0,
            status: 'active'
        };
        GameState.state.quests.active.push(bounty);

        // Abandon bounty
        const abandonRes = QuestManager.abandonQuest('bounty_abandon_test');
        expect(abandonRes.success).toBe(true);

        const updatedActive = QuestManager.getActiveQuests();
        const abandonedSlot = updatedActive.find(q => q.status === 'abandoned');
        expect(abandonedSlot).toBeDefined();
        expect(abandonedSlot.readyAt).toBeGreaterThan(Date.now());

        // Fast-forward time past 5 minutes
        abandonedSlot.readyAt = Date.now() - 1000;
        QuestManager.tick(100);

        // Slot should now replenish with a fresh quest!
        const replenishedActive = QuestManager.getActiveQuests();
        expect(replenishedActive.some(q => q.id === 'bounty_abandon_test')).toBe(false);
    });

    it('enforces 50-map cap blocking claims and purchases when full', () => {
        // Fill playmat with 50 maps
        for (let i = 0; i < BoardState.MAX_MAP_LIMIT; i++) {
            BoardState.addBoardMap('token_map', 50, 50);
        }

        expect(BoardState.getTotalMapCount()).toBe(BoardState.MAX_MAP_LIMIT);
        expect(BoardState.hasMapSpace()).toBe(false);

        // Claiming quest should fail due to map cap
        const active = QuestManager.getActiveQuests();
        active[0].currentCount = active[0].requiredCount;
        const claimRes = QuestManager.claimQuest(active[0].id);
        expect(claimRes.success).toBe(false);
        expect(claimRes.reason).toContain('Map limit reached');

        // Cartographer purchase should also refuse
        const buyRes = Cartographer.buyMap('map_test_map');
        expect(buyRes.success).toBe(false);
        expect(buyRes.reason).toContain('Map limit reached');
    });

    it('handles collection quests with item deductions on claim', () => {
        const q = GameState.state.quests;
        // Inject a specific collection bounty
        const collectionQuest = {
            id: 'test_collection_1',
            isTutorial: false,
            type: 'collection',
            title: 'Collect 10 Oak Wood',
            targetType: 'item_collected',
            itemId: 'item_oak_wood',
            requiredCount: 10,
            currentCount: 0,
            rewardMapId: 'map_test_map',
            rewardMapName: 'Test Map',
            status: 'active'
        };
        q.active.push(collectionQuest);

        // Add items to inventory
        InventoryManager.addItem('item_oak_wood', 15);
        QuestManager.tick(100);

        expect(collectionQuest.currentCount).toBe(10);

        const initialMapCount = BoardState.getBoardMaps().length;
        const res = QuestManager.claimQuest('test_collection_1');
        expect(res.success).toBe(true);

        // Items deducted (15 - 10 = 5)
        expect(InventoryStore.getItems()['item_oak_wood'].quantity).toBe(5);
        expect(BoardState.getBoardMaps().length).toBe(initialMapCount + 1);
    });
});
