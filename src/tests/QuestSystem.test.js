import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager, RANDOM_HUNTS, RANDOM_ITEMS } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { InventoryStore } from '../systems/inventory/InventoryStore.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import './fixtures/fixtureItems.js';

/**
 * The quest machinery QuestManager keeps since B6.1 (TL-18): the event
 * reports, bounty content, rewards and counting one action once — now counted
 * on quest Tokens on the mat. The Tokens' own rules (cap, clock, tutorial
 * chain, bin, saves) are `QuestTokens.test.js`; the tutorial's steps are
 * driven through the real systems in `QuestTutorialChain.test.js`.
 */

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name spots on the mat to place a Token on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
/** Where the Guild Hall stands: clear of every `C(i)` a test uses. */
const HALL = { x: 1500, y: 950 };

/** Put a Token on spot `i`, and plant a hero's flag there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

const ids = TUTORIAL_QUESTS.map(t => t.id);
const find = (id) => QuestManager.getActiveQuests().find(q => q.id === id);
const completeAndClaim = (id) => {
    const q = find(id);
    if (q) {
        q.currentCount = q.requiredCount;
        q.done = true;
    }
    return QuestManager.claimQuest(id);
};

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

    it('starts with the first tutorial quest on the mat, rewarding items', () => {
        const active = QuestManager.getActiveQuests();
        expect(active.map(q => q.id)).toEqual([ids[0]]);
        expect(active[0].tutorial).toBe(true);
        expect(active[0].rewardMapId).toBeUndefined();
        expect(active[0].rewardItems.length).toBeGreaterThan(0);
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

    it('claiming a done tutorial quest drops its reward as loot and brings the next step', () => {
        EventBus.publish('hero_recruited', { heroId: 'hero_1' });
        expect(find('tut_recruit').done).toBe(true);
        const res = QuestManager.claimQuest('tut_recruit');
        expect(res.success).toBe(true);
        expect(res.rewardItems.map(r => [r.itemId, r.quantity])).toEqual([['item_oak_wood', 10]]);
        // FB-53 / B6 rewards: on the floor, not in the Bank, until collected.
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
        const loot = SpriteLayer.getSprites().filter(s => s.refId === 'item_oak_wood');
        expect(loot.reduce((n, s) => n + s.quantity, 0)).toBe(10);
        for (const s of loot) SpriteLayer.collectSprite(s.id);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(GameState.state.board.maps).toBeUndefined();   // no Map box anywhere (9.1)
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)

        expect(QuestManager.getActiveQuests().map(q => q.id)).toEqual([ids[1]]);
        expect(GameState.state.quests.tutorialStep).toBe(1);
    });

    it('after the last tutorial step, no tutorial quest comes back', () => {
        for (const id of ids) expect(completeAndClaim(id).success, id).toBe(true);
        expect(QuestTokens.tutorialTokens()).toHaveLength(0);
        expect(QuestTokens.tutorialChainDone()).toBe(true);
        expect(GameState.state.quests.tutorialStep).toBe(ids.length);
        QuestTokens.ensure();
        expect(QuestTokens.tutorialTokens()).toHaveLength(0);
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

    it('a tutorial quest Token’s saved copy is re-read from its template on load', () => {
        const recruit = find('tut_recruit');
        recruit.targetType = 'token_exhausted';
        recruit.title = 'stale';
        recruit.requiredCount = 99;
        EventBus.publish('game_loaded', { slot: 0 });
        const fresh = find('tut_recruit');
        expect(fresh.targetType).toBe('hero_recruited');
        expect(fresh.title).toBe('Recruit a Hero');
        expect(fresh.requiredCount).toBe(1);
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

    it('abandoning is retired: tutorials refuse as before, bounties point at the bin (B6.1)', () => {
        const tutorialRes = QuestManager.abandonQuest('tut_recruit');
        expect(tutorialRes.success).toBe(false);
        expect(tutorialRes.reason).toBe('Tutorial quests cannot be abandoned');

        const b = bounty({ type: 'hunt', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 3 });
        const res = QuestManager.abandonQuest(b.id);
        expect(res.success).toBe(false);
        expect(res.reason).toMatch(/bin/);
        expect(find(b.id)).toBe(b);   // still on the mat, no cooldown slot
        expect(GameState.state.quests.active).toEqual([]);
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

    // ------------------------------------------------------------------
    // One player action = one count (CR2-085, CR2-055/CR2-177). Pinned
    // 2026-08-25. These drive the ENGINE rather than publishing by hand,
    // because the bug was a single call raising TWO events QuestManager
    // both listened to. `requiredCount` is raised first: at a target of 1 the
    // `Math.min` cap in `reportProgress` hides a doubling completely.
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
