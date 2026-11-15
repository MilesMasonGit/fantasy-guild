import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager, RANDOM_HUNTS, RANDOM_ITEMS } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryStore } from '../systems/inventory/InventoryStore.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import './fixtures/fixtureItems.js';

/**
 * The quest machinery QuestManager keeps since B6.1: the event reports,
 * bounty content, rewards and counting one action once — now counted on quest
 * Tokens on the mat. The Tokens' own rules (cap, clock, dismiss, saves) are
 * `QuestTokens.test.js`; Limes's lessons, which count the same reports, are
 * driven through the real systems in `LimesLessons.test.js`.
 */

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name spots on the mat to place a Token on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
/** Where the Guild Hall stands: clear of every `C(i)` a test uses. */
const HALL = { x: 1500, y: 950 };

/** Put a Token on spot `i`, and send a hero there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const sendTo = (heroId, i) => Orders.orderAt(heroId, C(i));

/** A bounty quest Token carrying `fields` (a hand-made quest, landed by the Hall). */
const bounty = (fields) => QuestTokens.spawnQuest({
    id: `b_${Math.random().toString(36).slice(2, 7)}`, tutorial: false, title: 'Probe',
    requiredCount: 10, currentCount: 0, rewardItems: [], done: false, ...fields
}).quest;

describe('Quest System (quest Tokens since B6.1)', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.inventory.maxSlots = 50;
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), HALL.x, HALL.y);
        QuestManager.init();
    });

    afterEach(() => {
        QuestManager.cleanup();
    });

    it('starts with no quest on the mat: the bounty clock brings the first', () => {
        expect(QuestManager.getActiveQuests()).toEqual([]);
    });

    it('claiming a done bounty drops its reward as loot', () => {
        const hunt = bounty({ type: 'hunt', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 1, rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }] });
        EventBus.publish('combat_victory', { enemyId: 'token_goblin' });
        expect(hunt.done).toBe(true);
        const res = QuestManager.claimQuest(hunt.id);
        expect(res.success).toBe(true);
        expect(res.rewardItems.map(r => [r.itemId, r.quantity])).toEqual([['item_oak_wood', 10]]);
        // B6 rewards: on the floor, not in the Bank, until collected.
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
        const loot = SpriteLayer.getSprites().filter(s => s.refId === 'item_oak_wood');
        expect(loot.reduce((n, s) => n + s.quantity, 0)).toBe(10);
        for (const s of loot) SpriteLayer.collectSprite(s.id);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(GameState.state.board.maps).toBeUndefined();   // no Map box anywhere (9.1)
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
        expect(QuestManager.getActiveQuests()).toEqual([]);
    });

    it('a `match` narrows a step to one kind of Token', () => {
        const log = bounty({ targetType: 'cycle_completed', match: { typeId: 'token_oak_tree' } });
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't1', typeId: 'token_copper_ore_vein', heroId: 'h', failed: false, produced: [] });
        expect(log.currentCount).toBe(0);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't2', typeId: 'token_oak_tree', heroId: 'h', failed: true, produced: [] });
        expect(log.currentCount).toBe(0);   // a failed cycle did nothing
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 't2', typeId: 'token_oak_tree', heroId: 'h', failed: false, produced: ['item_oak_wood'] });
        expect(log.currentCount).toBe(1);
    });

    it('events nobody publishes any more report nothing and do not throw', () => {
        const quest = bounty({ targetType: 'token_placed' });
        for (const t of ['map_burst', 'map_opened', 'map_purchased', 'vault_withdrawn', 'vault_deposited', 'loot_token_placed', 'board_recall', 'return_to_tray']) {
            expect(() => EventBus.publish(t, {})).not.toThrow();
        }
        expect(quest.currentCount).toBe(0);
    });

    // ------------------------------------------------------------------
    // Bounties
    // ------------------------------------------------------------------
    it('hunt bounties name an enemy Token a new game can buy, and count its kills', () => {
        for (const hunt of RANDOM_HUNTS) expect(getTokenType(hunt.id)?.enemy, hunt.id).toBeTruthy();
        for (const item of RANDOM_ITEMS) expect(getItem(item.id), item.id).toBeTruthy();

        const hunt = bounty({ type: 'hunt', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 2 });
        EventBus.publish('combat_victory', { enemyId: 'token_goblin_chief' });
        expect(hunt.currentCount).toBe(0);
        EventBus.publish('combat_victory', { enemyId: 'token_goblin' });
        expect(hunt.currentCount).toBe(1);
        expect(hunt.done).toBe(false);
        EventBus.publish('combat_victory', { enemyId: 'token_goblin' });
        expect(hunt.done).toBe(true);
    });

    it('a random bounty never mentions a Map', () => {
        for (let i = 0; i < 50; i++) {
            const b = QuestManager.createRandomQuest();
            expect(b.title).not.toMatch(/map/i);
            expect(b.requiredCount).toBeGreaterThan(0);
            if (b.type === 'hunt') expect(b.enemyId).toBe('token_goblin');
        }
    });

    it('handles collection quests with item deductions on claim', () => {
        const collection = bounty({
            type: 'collection', title: 'Collect 10 Oak Wood', targetType: 'item_collected',
            itemId: 'fixture_oak_wood', requiredCount: 10, rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }]
        });
        expect(QuestManager.claimQuest(collection.id).success).toBe(false);

        InventoryManager.addItem('fixture_oak_wood', 15);
        expect(collection.currentCount).toBe(10);
        expect(collection.done).toBe(true);

        const res = QuestManager.claimQuest(collection.id);
        expect(res.success).toBe(true);
        expect(InventoryStore.getItems()['fixture_oak_wood'].quantity).toBe(5);
        expect(GameState.state.board.maps).toBeUndefined();
        expect(SpriteLayer.getSprites().some(s => s.refId === 'item_oak_wood')).toBe(true);
    });

    // ------------------------------------------------------------------ One
    // player action = one count. These drive the ENGINE rather than
    // publishing by hand, because the bug was a single call raising TWO
    // events QuestManager both listened to. `requiredCount` is raised first:
    // at a target of 1 the `Math.min` cap in `reportProgress` hides a
    // doubling completely.
    // ------------------------------------------------------------------
    const probe = (targetType) => bounty({ id: 'probe', targetType, requiredCount: 10 });

    it('counts one placed Token exactly once, not twice', () => {
        const quest = probe('token_placed');
        const res = put(10, BoardState.createTokenInstance('token_oak_forest'));
        expect(res.success).toBe(true);
        expect(quest.currentCount).toBe(1);
    });

    it('a quest Token arriving is not a placed Token', () => {
        const quest = probe('token_placed');
        bounty({ targetType: 'enemy_hunted' });
        expect(quest.currentCount).toBe(0);
    });

    it('counts one deployed hero exactly once, not twice', () => {
        put(10, BoardState.createTokenInstance('token_oak_forest'));
        const quest = probe('hero_deployed');
        GameState.state.heroes = [{ id: 'hero_1', name: 'Tester', status: 'idle' }];
        // Sent to bare ground beside the Forest (a Forest itself is nobody's work).
        const res = sendTo('hero_1', 11);
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
