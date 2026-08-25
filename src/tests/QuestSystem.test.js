import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager, MAX_ACTIVE_QUESTS } from '../systems/quests/QuestManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryStore } from '../systems/inventory/InventoryStore.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
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
        // Claim Step 0 (Place a Token)
        EventBus.publish('token_placed', { tile: 24, typeId: 'token_guild_hall' });
        const initialMaps = BoardState.getBoardMaps().length;

        const res = QuestManager.claimQuest('tutorial_1');
        expect(res.success).toBe(true);
        expect(res.rewardMapId).toBe('map_guild_hall');

        // Spawns map on playmat in bottom-left coordinate quadrant
        const boardMaps = BoardState.getBoardMaps();
        expect(boardMaps.length).toBe(initialMaps + 1);
        const lastMap = boardMaps[boardMaps.length - 1];
        expect(lastMap.x).toBeGreaterThanOrEqual(10);
        expect(lastMap.x).toBeLessThanOrEqual(450);
        expect(lastMap.y).toBeGreaterThanOrEqual(250);

        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(3);
        // Step 3 (Explore one Map, id: 'tutorial_4') should now be in the 3 active slots!
        const step4 = active.find(q => q.id === 'tutorial_4');
        expect(step4).toBeDefined();
        expect(step4.rewardMapId).toBe('map_guild_hall');

        // Test tutorial_3 (Upgrade Guild Hall Production)
        const step3 = active.find(q => q.id === 'tutorial_3');
        expect(step3).toBeDefined();
        expect(step3.title).toBe('Upgrade Guild Hall Production');

        // Upgrading roster_size (Recruit a Hero) should NOT progress tutorial_3
        EventBus.publish('guild_upgrades_updated', { upgradeId: 'roster_size', rank: 1 });
        expect(step3.currentCount).toBe(0);

        // Upgrading wishing_well SHOULD progress tutorial_3
        EventBus.publish('guild_upgrades_updated', { upgradeId: 'wishing_well', rank: 1 });
        expect(step3.currentCount).toBe(1);
    });

    it('opens Guild Hall Maps in strict scripted sequence regardless of open order', () => {
        // 1st open yields Drop 1 (Campfire)
        const burst1 = Cartographer.rollBurst('map_guild_hall');
        expect(burst1.length).toBe(1);
        expect(burst1[0].refId).toBe('token_campfire');

        // 2nd open yields Drop 2 (Redberry Bush)
        const burst2 = Cartographer.rollBurst('map_guild_hall');
        expect(burst2.length).toBe(1);
        expect(burst2[0].refId).toBe('token_redberry_bush');

        // 3rd open yields Drop 3 (Oak Tree)
        const burst3 = Cartographer.rollBurst('map_guild_hall');
        expect(burst3.length).toBe(1);
        expect(burst3[0].refId).toBe('token_oak_tree');

        // 4th open yields Drop 4 (Rusty Woodaxe)
        const burst4 = Cartographer.rollBurst('map_guild_hall');
        expect(burst4.length).toBe(1);
        expect(burst4[0].refId).toBe('token_rusty_woodaxe');

        // 5th open yields Drop 5 (200 Shrimp Trawler Potions)
        const burst5 = Cartographer.rollBurst('map_guild_hall');
        expect(burst5.length).toBe(1);
        expect(burst5[0].kind).toBe('item');
        expect(burst5[0].refId).toBe('item_shrimp_trawler_potion');
        expect(burst5[0].quantity).toBe(200);

        // 6th open yields Drop 6 (Copper Rubble)
        const burst6 = Cartographer.rollBurst('map_guild_hall');
        expect(burst6.length).toBe(1);
        expect(burst6[0].refId).toBe('token_copper_rubble');

        // 7th open yields Drop 7 (Rusty Pickaxe)
        const burst7 = Cartographer.rollBurst('map_guild_hall');
        expect(burst7.length).toBe(1);
        expect(burst7[0].refId).toBe('token_rusty_pickaxe');

        // 8th open yields Drop 8 (Furnace)
        const burst8 = Cartographer.rollBurst('map_guild_hall');
        expect(burst8.length).toBe(1);
        expect(burst8[0].refId).toBe('token_furnace');

        // 9th open yields Drop 9 (Shrimp Coast)
        const burst9 = Cartographer.rollBurst('map_guild_hall');
        expect(burst9.length).toBe(1);
        expect(burst9[0].refId).toBe('token_shrimp_coast');

        // 10th open yields Drop 10 (Fishing Net)
        const burst10 = Cartographer.rollBurst('map_guild_hall');
        expect(burst10.length).toBe(1);
        expect(burst10[0].refId).toBe('token_fishing_net');

        // 11th open yields Drop 11 (Cooking Pot)
        const burst11 = Cartographer.rollBurst('map_guild_hall');
        expect(burst11.length).toBe(1);
        expect(burst11[0].refId).toBe('token_cooking_pot');

        // 12th open yields Drop 12 (Coins - 2000 GP)
        const burst12 = Cartographer.rollBurst('map_guild_hall');
        expect(burst12.length).toBe(1);
        expect(burst12[0].kind).toBe('item');
        expect(burst12[0].refId).toBe('item_coins');
        expect(burst12[0].quantity).toBe(2000);
    });

    it('completes item collection with a single stack of 10 items', () => {
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };
        for (let i = 1; i <= 7; i++) {
            completeAndClaim(`tutorial_${i}`);
        }

        const active = QuestManager.getActiveQuests();
        const quest8 = active.find(q => q.id === 'tutorial_8');
        expect(quest8).toBeDefined();
        expect(quest8.title).toBe('Collect Items');

        // Simulate collecting a stack of 10 items at once
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'item',
            refId: 'item_oak_wood',
            quantity: 10
        });

        expect(quest8.currentCount).toBe(10);
        expect(QuestManager.claimQuest('tutorial_8').success).toBe(true);
    });

    it('progresses Exhaust one Token (tutorial_9) when a token is depleted', () => {
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };
        for (let i = 1; i <= 8; i++) {
            completeAndClaim(`tutorial_${i}`);
        }

        const active = QuestManager.getActiveQuests();
        const exhaustQuest = active.find(q => q.id === 'tutorial_9');
        expect(exhaustQuest).toBeDefined();
        expect(exhaustQuest.title).toBe('Exhaust one Token');

        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: 10, typeId: 'token_oak_tree' });
        expect(exhaustQuest.currentCount).toBe(1);
        expect(QuestManager.claimQuest('tutorial_9').success).toBe(true);
    });

    it('progresses Equip a Hero and Add a Context Token tutorial quests', () => {
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };

        // Fast forward so tutorial_11 (Equip a Hero) and tutorial_14 (Add a Context Token) can be reached
        for (let i = 1; i <= 10; i++) {
            completeAndClaim(`tutorial_${i}`);
        }

        const active = QuestManager.getActiveQuests();
        const equipQuest = active.find(q => q.id === 'tutorial_11');
        expect(equipQuest).toBeDefined();
        expect(equipQuest.title).toBe('Equip a Hero');

        // Test equipping hero.
        //
        // ⚠️ This publishes the event the ENGINE publishes. It used to publish
        // `hero_equipped`, which nothing in the game has ever published — the
        // test was the only publisher, so it proved a quest step that no real
        // equip could move (CR2-088). `EquipmentManager.equipItem` announces
        // `hero_equipment_changed` with `action: 'equip'`; asserting against
        // that is what makes tutorial_11 provably completable by playing.
        EventBus.publish('hero_equipment_changed', { heroId: 'hero_1', slot: 'weapon', itemId: 'item_copper_pickaxe', action: 'equip' });
        expect(equipQuest.currentCount).toBe(1);
        expect(QuestManager.claimQuest('tutorial_11').success).toBe(true);

        // Fast forward to reach tutorial_14 (Add a Context Token)
        completeAndClaim('tutorial_12');
        completeAndClaim('tutorial_13');

        const contextQuest = QuestManager.getActiveQuests().find(q => q.id === 'tutorial_14');
        expect(contextQuest).toBeDefined();
        expect(contextQuest.title).toBe('Add a Context Token');

        // Test placing context token
        EventBus.publish('token_placed', { tile: 10, typeId: 'token_copper_pickaxe' });
        expect(contextQuest.currentCount).toBe(1);
        expect(QuestManager.claimQuest('tutorial_14').success).toBe(true);
    });

    it('prevents abandoning tutorial quests but allows abandoning bounties with 5-minute locked cooldown', () => {
        // Attempt to abandon a tutorial quest (should be rejected)
        const tutorialRes = QuestManager.abandonQuest('tutorial_1');
        expect(tutorialRes.success).toBe(false);
        expect(tutorialRes.reason).toBe('Tutorial quests cannot be abandoned');

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

    it('locks sending tokens to vault until Place a Dropped Token (tutorial_5) completes (even before claiming)', () => {
        // Fast forward 1 and 2 so tutorial_4 and tutorial_5 enter active quests
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };
        completeAndClaim('tutorial_1');
        completeAndClaim('tutorial_2');

        // Starts locked with 0 progress on tutorial_5
        expect(QuestManager.isTokenVaultSendUnlocked()).toBe(false);

        // Attempting to return a placed token to vault should fail
        Placement.placeToken(10, BoardState.createTokenInstance('token_oak_forest'));
        const refuseRes = Placement.returnTokenToVault(10);
        expect(refuseRes.success).toBe(false);
        expect(refuseRes.reason).toContain('Token Vault storage unlocks after completing');

        // Attempting to send a floor token sprite to vault should fail
        SpriteLayer.addSprite('token', 'token_charcoal_kiln', 1, 0, 10);
        const spriteId = SpriteLayer.getSprites().find(s => s.refId === 'token_charcoal_kiln')?.id;
        expect(SpriteLayer.sendTokenToVault(spriteId)).toBe(false);

        // Progress tutorial_5 to complete (without claiming)
        EventBus.publish('loot_token_placed', { tile: 12, typeId: 'token_oak_forest' });
        expect(QuestManager.isTokenVaultSendUnlocked()).toBe(true);

        // Now returning placed token to vault succeeds
        const successRes = Placement.returnTokenToVault(10);
        expect(successRes.success).toBe(true);

        // Sending floor token sprite to vault succeeds
        expect(SpriteLayer.sendTokenToVault(spriteId)).toBe(true);
    });
});
