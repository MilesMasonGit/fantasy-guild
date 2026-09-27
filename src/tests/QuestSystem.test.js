import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager, MAX_ACTIVE_QUESTS, RANDOM_HUNTS, RANDOM_ITEMS } from '../systems/quests/QuestManager.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryStore } from '../systems/inventory/InventoryStore.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import './fixtures/fixtureItems.js';

/**
 * The quest machinery: slots, claiming, abandoning, bounties, and counting one
 * action once. The tutorial chain's steps themselves are driven through the
 * real systems in `QuestTutorialChain.test.js` (Token Lifecycle 9.5).
 */

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name spots on the mat to place a Token on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** Put a Token on spot `i`, and plant a hero's flag there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

const ids = TUTORIAL_QUESTS.map(t => t.id);
const find = (id) => QuestManager.getActiveQuests().find(q => q.id === id);
const completeAndClaim = (id) => {
    const q = find(id);
    if (q) q.currentCount = q.requiredCount;
    return QuestManager.claimQuest(id);
};

describe('Quest System & Multi-Tutorial Chain', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        QuestManager.init();
    });

    afterEach(() => {
        QuestManager.cleanup();
    });

    it('initializes with the first 3 tutorial quests, each rewarding items', () => {
        const active = QuestManager.getActiveQuests();
        expect(active.length).toBe(MAX_ACTIVE_QUESTS); // 3
        expect(active.map(q => q.id)).toEqual(ids.slice(0, 3));
        for (const q of active) {
            expect(q.rewardMapId).toBeUndefined();
            expect(q.rewardItems.length).toBeGreaterThan(0);
        }
    });

    it('the chain is short, ordered, and pays small items that exist', () => {
        expect(TUTORIAL_QUESTS.length).toBeGreaterThanOrEqual(8);
        expect(TUTORIAL_QUESTS.length).toBeLessThanOrEqual(12);
        TUTORIAL_QUESTS.forEach((t, i) => {
            expect(t.step, t.id).toBe(i);
            for (const r of t.rewardItems) {
                expect(getItem(r.itemId), `${t.id} ${r.itemId}`).toBeTruthy();
                expect(r.quantity, t.id).toBeGreaterThan(0);
                expect(r.quantity, t.id).toBeLessThanOrEqual(10);
            }
            // A step that names a Token names one that exists.
            for (const key of ['typeId', 'fromTypeId']) {
                if (t.match?.[key]) expect(getTokenType(t.match[key]), `${t.id} ${t.match[key]}`).toBeTruthy();
            }
            if (t.match?.itemId) expect(getItem(t.match.itemId), t.id).toBeTruthy();
        });
    });

    it('immediately replenishes an opened slot with the next tutorial quest when claimed, paying items', () => {
        EventBus.publish('hero_recruited', { heroId: 'hero_1' });
        const res = QuestManager.claimQuest('tut_recruit');
        expect(res.success).toBe(true);
        expect(res.rewardItems.map(r => [r.itemId, r.quantity])).toEqual([['item_oak_wood', 10]]);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(GameState.state.board.maps).toBeUndefined();   // no Map box anywhere (9.1)
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)

        const active = QuestManager.getActiveQuests();
        expect(active.map(q => q.id)).toEqual(ids.slice(1, 4));
        expect(GameState.state.quests.tutorialStep).toBe(1);
    });

    it('offers bounties only once every tutorial step is done or offered', () => {
        for (const id of ids) expect(completeAndClaim(id).success, id).toBe(true);
        const active = QuestManager.getActiveQuests();
        expect(active).toHaveLength(MAX_ACTIVE_QUESTS);
        expect(active.every(q => !q.isTutorial)).toBe(true);
        expect(GameState.state.quests.tutorialStep).toBe(ids.length);
    });

    it('a `match` narrows a step to one kind of Token', () => {
        // `tut_log` is third: it counts Oak Tree cycles and nothing else.
        const log = find('tut_log');
        expect(log.match).toEqual({ typeId: 'token_oak_tree' });
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't1', typeId: 'token_copper_ore_vein', heroId: 'h', failed: false, produced: [] });
        expect(log.currentCount).toBe(0);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't2', typeId: 'token_oak_tree', heroId: 'h', failed: true, produced: [] });
        expect(log.currentCount).toBe(0);   // a failed cycle did nothing
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't2', typeId: 'token_oak_tree', heroId: 'h', failed: false, produced: ['item_oak_wood'] });
        expect(log.currentCount).toBe(1);
    });

    // ------------------------------------------------------------------
    // Old saves (DP-10 supports new games only, but a load must not crash).
    // ------------------------------------------------------------------
    it('an old save’s tutorial steps are dropped on load, and the new chain fills the slots', () => {
        const q = GameState.state.quests;
        q.completedTutorials = ['tutorial_1', 'tutorial_2', 'tutorial_3'];
        q.active = [
            { id: 'tutorial_4', isTutorial: true, title: 'Explore one Map', targetType: 'map_burst', requiredCount: 1, currentCount: 0, status: 'active' },
            { id: 'tutorial_12', isTutorial: true, title: 'Token Vault', targetType: 'open_vault', requiredCount: 1, currentCount: 0, rewardMapId: 'map_guild_hall', status: 'active' },
            { id: 'bounty_keep', isTutorial: false, type: 'collection', targetType: 'item_collected', itemId: 'fixture_oak_wood', requiredCount: 5, currentCount: 0, status: 'active' }
        ];

        expect(() => EventBus.publish('game_loaded', { slot: 0 })).not.toThrow();

        const active = QuestManager.getActiveQuests();
        expect(active.map(x => x.id)).toEqual(['bounty_keep', ...ids.slice(0, 2)]);
        // The old ids do not tick off new steps.
        expect(GameState.state.quests.tutorialStep).toBe(0);
        expect(() => QuestManager.claimQuest('tutorial_4')).not.toThrow();
    });

    it('an old save’s copy of a live step is re-read from its template', () => {
        const log = find('tut_log');
        log.targetType = 'token_exhausted';
        log.title = 'stale';
        log.requiredCount = 99;
        delete log.match;
        EventBus.publish('game_loaded', { slot: 0 });
        expect(log.targetType).toBe('cycle_completed');
        expect(log.title).toBe('Log an Oak Tree');
        expect(log.requiredCount).toBe(3);
        expect(log.match).toEqual({ typeId: 'token_oak_tree' });
    });

    it('events nobody publishes any more report nothing and do not throw', () => {
        for (const t of ['map_burst', 'map_opened', 'map_purchased', 'vault_withdrawn', 'vault_deposited', 'loot_token_placed', 'board_recall', 'return_to_tray']) {
            expect(() => EventBus.publish(t, {})).not.toThrow();
        }
        expect(QuestManager.getActiveQuests().every(q => (q.currentCount || 0) === 0)).toBe(true);
    });

    // ------------------------------------------------------------------
    // Bounties
    // ------------------------------------------------------------------
    it('hunt bounties name an enemy Token a new game can buy, and count its kills', () => {
        for (const hunt of RANDOM_HUNTS) expect(getTokenType(hunt.id)?.enemy, hunt.id).toBeTruthy();
        for (const item of RANDOM_ITEMS) expect(getItem(item.id), item.id).toBeTruthy();

        const hunt = { id: 'bounty_hunt', isTutorial: false, type: 'hunt', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 2, currentCount: 0, status: 'active' };
        GameState.state.quests.active.push(hunt);
        EventBus.publish('combat_victory', { enemyId: 'token_goblin_chief' });
        expect(hunt.currentCount).toBe(0);
        EventBus.publish('combat_victory', { enemyId: 'token_goblin' });
        expect(hunt.currentCount).toBe(1);
    });

    it('a random bounty never mentions a Map', () => {
        for (let i = 0; i < 50; i++) {
            const b = QuestManager.createRandomQuest();
            expect(b.title).not.toMatch(/map/i);
            expect(b.requiredCount).toBeGreaterThan(0);
            if (b.type === 'hunt') expect(b.enemyId).toBe('token_goblin');
        }
    });

    it('prevents abandoning tutorial quests but allows abandoning bounties with 5-minute locked cooldown', () => {
        const tutorialRes = QuestManager.abandonQuest('tut_recruit');
        expect(tutorialRes.success).toBe(false);
        expect(tutorialRes.reason).toBe('Tutorial quests cannot be abandoned');

        const bounty = {
            id: 'bounty_abandon_test',
            isTutorial: false,
            type: 'hunt',
            title: 'Defeat 3 Goblins',
            targetType: 'enemy_hunted',
            enemyId: 'token_goblin',
            requiredCount: 3,
            currentCount: 0,
            status: 'active'
        };
        GameState.state.quests.active.push(bounty);

        const abandonRes = QuestManager.abandonQuest('bounty_abandon_test');
        expect(abandonRes.success).toBe(true);

        const abandonedSlot = QuestManager.getActiveQuests().find(q => q.status === 'abandoned');
        expect(abandonedSlot).toBeDefined();
        expect(abandonedSlot.readyAt).toBeGreaterThan(Date.now());

        abandonedSlot.readyAt = Date.now() - 1000;
        QuestManager.tick(100);

        expect(QuestManager.getActiveQuests().some(q => q.id === 'bounty_abandon_test')).toBe(false);
    });

    it('handles collection quests with item deductions on claim', () => {
        const q = GameState.state.quests;
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

        InventoryManager.addItem('fixture_oak_wood', 15);
        QuestManager.tick(100);
        expect(collectionQuest.currentCount).toBe(10);

        const res = QuestManager.claimQuest('test_collection_1');
        expect(res.success).toBe(true);
        expect(InventoryStore.getItems()['fixture_oak_wood'].quantity).toBe(5);
        expect(GameState.state.board.maps).toBeUndefined();
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
    });

    // ------------------------------------------------------------------
    // One player action = one count (CR2-085, CR2-055/CR2-177). Pinned
    // 2026-08-25. These drive the ENGINE rather than publishing by hand,
    // because the bug was a single call raising TWO events QuestManager
    // both listened to. `requiredCount` is raised first: at a target of 1 the
    // `Math.min` cap in `reportProgress` hides a doubling completely.
    // ------------------------------------------------------------------
    const probe = (targetType) => {
        const quest = { id: 'probe', isTutorial: false, targetType, requiredCount: 10, currentCount: 0, status: 'active' };
        GameState.state.quests.active.push(quest);
        return quest;
    };

    it('counts one placed Token exactly once, not twice', () => {
        const quest = probe('token_placed');
        const res = put(10, BoardState.createTokenInstance('token_oak_forest'));
        expect(res.success).toBe(true);
        expect(quest.currentCount).toBe(1);
    });

    it('counts one deployed hero exactly once, not twice', () => {
        put(10, BoardState.createTokenInstance('token_oak_forest'));
        const quest = probe('hero_deployed');
        GameState.state.heroes = [{ id: 'hero_1', name: 'Tester', status: 'idle' }];
        const res = plant('hero_1', 10);
        expect(res.success).toBe(true);
        expect(quest.currentCount).toBe(1);
    });

    it('does not count a Token redraw as a placement', () => {
        // `TILE_CHANGED` fires for clearing, depletion, restocks, grows and
        // turns. None of those is the player placing a Token.
        const quest = probe('token_placed');
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: 'tok_12', typeId: 'token_oak_forest' });
        expect(quest.currentCount).toBe(0);
    });
});
