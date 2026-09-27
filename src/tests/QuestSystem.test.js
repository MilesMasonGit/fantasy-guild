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
import './fixtures/fixtureItems.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name spots on the mat to place a Token on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** Put a Token on spot `i`, and plant a hero's flag there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

describe('Quest System & Multi-Tutorial Chain', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        QuestManager.init();
    });

    afterEach(() => {
        QuestManager.cleanup();
    });

    // ⚠️ Changed in slice 2.2 (SP-65): tutorial quests reward items, not a
    // Guild Hall Map. This used to assert `rewardMapId: 'map_guild_hall'`.
    it('initializes with 3 tutorial quests simultaneously, each rewarding items', () => {
        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(MAX_ACTIVE_QUESTS); // 3

        expect(active.map(q => q.id)).toEqual(['tutorial_1', 'tutorial_2', 'tutorial_3']);
        for (const q of active) {
            expect(q.rewardMapId).toBeUndefined();
            expect(q.rewardItems).toEqual([{ itemId: 'item_oak_wood', quantity: 10 }]);
        }
    });

    // ⚠️ Changed in slice 2.2 (SP-65): a claim pays items into the Bank and
    // puts no Map on the mat. This used to assert a reward Map landed in a
    // band of the mat.
    it('immediately replenishes an opened slot with the next tutorial quest when claimed, paying items', () => {
        // Claim Step 0 (Place a Token)
        EventBus.publish('token_placed', { instanceId: 'tok_24', typeId: 'token_guild_hall' });

        const res = QuestManager.claimQuest('tutorial_1');
        expect(res.success).toBe(true);
        expect(res.rewardItems.map(r => [r.itemId, r.quantity])).toEqual([['item_oak_wood', 10]]);

        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(GameState.state.board.maps).toBeUndefined();   // no Map box anywhere (9.1)
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)

        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(3);
        // Step 3 (Explore one Map, id: 'tutorial_4') should now be in the 3 active slots!
        const step4 = active.find(q => q.id === 'tutorial_4');
        expect(step4).toBeDefined();
        expect(step4.rewardItems).toEqual([{ itemId: 'item_oak_wood', quantity: 10 }]);

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

    // 'opens Guild Hall Maps in strict scripted sequence' went with the Map
    // bursts and the Guild Hall drop sequence (Token Lifecycle 9.1).

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
            refId: 'fixture_oak_wood',
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

        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'tok_10', typeId: 'token_oak_tree' });
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
        EventBus.publish('token_placed', { instanceId: 'tok_10', typeId: 'token_copper_pickaxe' });
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

    // 'enforces the 50-map cap on purchases' went with the Map purchase and the
    // Map cap (Token Lifecycle 9.1).

    it('handles collection quests with item deductions on claim', () => {
        const q = GameState.state.quests;
        // Inject a specific collection bounty
        const collectionQuest = {
            id: 'test_collection_1',
            isTutorial: false,
            type: 'collection',
            title: 'Collect 10 Oak Wood',
            targetType: 'item_collected',
            itemId: 'fixture_oak_wood',
            requiredCount: 10,
            currentCount: 0,
            // A bounty from a save made before slice 2.2 still names a
            // reward Map; it must pay the bounty's items instead.
            rewardMapId: 'map_test_map',
            rewardMapName: 'Test Map',
            status: 'active'
        };
        q.active.push(collectionQuest);

        // Add items to inventory
        InventoryManager.addItem('fixture_oak_wood', 15);
        QuestManager.tick(100);

        expect(collectionQuest.currentCount).toBe(10);

        const res = QuestManager.claimQuest('test_collection_1');
        expect(res.success).toBe(true);

        // Items deducted (15 - 10 = 5)
        expect(InventoryStore.getItems()['fixture_oak_wood'].quantity).toBe(5);
        // ⚠️ Changed in slice 2.2 (SP-65): the reward is items, not a Map.
        expect(GameState.state.board.maps).toBeUndefined();
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
    });

    // 'the Vault is open from the start — no tutorial gates it (FP-62)' went
    // with the Vault (Token Lifecycle 9.3).

    it('quests that pointed at the Vault still load without crashing (re-pointed in 9.5)', () => {
        // Their events have no publisher now; they must simply sit there.
        for (const t of ['open_vault', 'vault_withdrawn', 'vault_deposited', 'loot_token_placed']) {
            expect(() => QuestManager.reportProgress(t)).not.toThrow();
        }
        expect(() => QuestManager.getActiveQuests()).not.toThrow();
    });

    it('tutorial 5 is finished by moving a Token, and an old save’s copy is re-pointed on load', () => {
        const completeAndClaim = (id) => {
            const q = QuestManager.getActiveQuests().find(x => x.id === id);
            if (q) q.currentCount = q.requiredCount;
            return QuestManager.claimQuest(id);
        };
        completeAndClaim('tutorial_1');
        completeAndClaim('tutorial_2');
        const t5 = QuestManager.getActiveQuests().find(q => q.id === 'tutorial_5');
        expect(t5).toBeDefined();

        // A save written before 2026-09-21 holds the old, impossible target.
        t5.targetType = 'loot_token_placed';
        EventBus.publish('game_loaded', { slot: 0 });
        expect(t5.targetType).toBe('token_placed');

        put(12, BoardState.createTokenInstance('token_oak_forest'));
        expect(t5.currentCount).toBe(1);
    });
    // ------------------------------------------------------------------
    // One player action = one count (CR2-085, CR2-055/CR2-177). Pinned
    // 2026-08-25.
    //
    // These deliberately drive the ENGINE (`Placement.placeToken` /
    // `placeHero`) rather than publishing an event by hand, because the bug
    // was never in one publisher — it was that a single call raised TWO
    // events QuestManager both listened to. Only the real call path can
    // catch that coming back.
    //
    // `requiredCount` is raised first: at the authored target of 1 the
    // `Math.min` cap in `reportProgress` hides a doubling completely, which
    // is why this shipped unnoticed.
    // ------------------------------------------------------------------
    it('counts one placed Token exactly once, not twice', () => {
        const quest = QuestManager.getActiveQuests().find(q => q.targetType === 'token_placed');
        expect(quest).toBeDefined();
        quest.requiredCount = 10;
        quest.currentCount = 0;

        const res = put(10, BoardState.createTokenInstance('token_oak_forest'));
        expect(res.success).toBe(true);

        expect(quest.currentCount).toBe(1);
    });

    it('counts one deployed hero exactly once, not twice', () => {
        // A hero landing on a Token used to raise both
        // `hero_deployed` and `HERO_MOVED`, and both were counted.
        put(10, BoardState.createTokenInstance('token_oak_forest'));

        const quest = QuestManager.getActiveQuests().find(q => q.targetType === 'token_placed');
        quest.targetType = 'hero_deployed';
        quest.requiredCount = 10;
        quest.currentCount = 0;

        GameState.state.heroes = [{ id: 'hero_1', name: 'Tester', status: 'idle' }];
        const res = plant('hero_1', 10);
        expect(res.success).toBe(true);

        expect(quest.currentCount).toBe(1);
    });

    it('counts a dropped loot Token once as a placement and once as loot', () => {
        // `loot_token_placed` follows a real `placeToken`, so the placement is
        // already counted; the loot event must not count it a second time.
        const placedQuest = QuestManager.getActiveQuests().find(q => q.targetType === 'token_placed');
        placedQuest.requiredCount = 10;
        placedQuest.currentCount = 0;

        put(11, BoardState.createTokenInstance('token_oak_forest'));
        EventBus.publish('loot_token_placed', { instanceId: 'tok_11', typeId: 'token_oak_forest' });

        expect(placedQuest.currentCount).toBe(1);
    });

    it('does not count a Token redraw as a placement', () => {
        // `TILE_CHANGED` fires for clearing, depletion, restocks and vault
        // moves. None of those is the player placing a Token.
        const quest = QuestManager.getActiveQuests().find(q => q.targetType === 'token_placed');
        quest.requiredCount = 10;
        quest.currentCount = 0;

        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: 'tok_12', typeId: 'token_oak_forest' });

        expect(quest.currentCount).toBe(0);
    });
});
