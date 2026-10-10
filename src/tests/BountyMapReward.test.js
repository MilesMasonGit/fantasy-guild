import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import {
    createRandomQuest, drawBountyMap, bountyMapPool, BOUNTY_MAP_REWARD
} from '../systems/quests/questBounties.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { isMapItem } from '../systems/atlas/mapItems.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A bounty may pay a map, drawn when the bounty is **claimed**, never when it appears: the
 * bounty's own roll draws exactly the random numbers it always did, so the bench (where bounties
 * appear and are never claimed) does the same work.
 */

const HALL = { x: 880, y: 560 };
const FIXTURE_MAPS = {
    fixture_bounty_map_a: { id: 'fixture_bounty_map_a', name: 'Bounty Map A', type: 'map', stackable: true, cartography: { biome: 'forest', points: 10, nodes: [] } },
    fixture_bounty_map_b: { id: 'fixture_bounty_map_b', name: 'Bounty Map B', type: 'map', stackable: true, cartography: { biome: 'forest', points: 10, nodes: [], bountyWeight: 3 } },
    fixture_bounty_mod_never: { id: 'fixture_bounty_mod_never', name: 'Never Paid', type: 'modifier', stackable: true, cartography: { effects: [], bountyWeight: 0 } }
};

/** A Math.random stand-in that hands out `values` in turn and counts the calls. */
function scripted(values) {
    let i = 0;
    const fn = () => values[Math.min(i++, values.length - 1)];
    fn.calls = () => i;
    return fn;
}

const doneHunt = (id = 'quest_fixture_hunt') => ({
    id, tutorial: false, title: 'Defeat 1 Goblin', type: 'hunt', targetType: 'enemy_hunted',
    enemyId: 'token_goblin', requiredCount: 1, currentCount: 1,
    rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }], done: true
});

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
    BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), HALL.x, HALL.y);
    QuestManager.init();
    GameState.state.quests.completedTutorials = TUTORIAL_QUESTS.map(t => t.id);
    for (const t of QuestTokens.tutorialTokens()) BoardState.removeToken(t.id);
}

describe('the bounty roll is untouched', () => {
    it('a bounty draws the same random numbers, and comes out the same, whether or not maps exist', () => {
        GameState.initNew();
        InventoryManager.init();
        vi.spyOn(Date, 'now').mockReturnValue(1_000);
        const roll = () => {
            const random = scripted([0.3, 0.7, 0.1, 0.9, 0.5, 0.2]);
            const spy = vi.spyOn(Math, 'random').mockImplementation(random);
            const quests = [createRandomQuest([]), createRandomQuest([{ type: 'hunt' }]), createRandomQuest([{ type: 'collection' }])];
            spy.mockRestore();
            return { quests, draws: random.calls() };
        };
        const before = roll();
        registerItems(structuredClone(FIXTURE_MAPS));
        const after = roll();
        expect(after.draws).toBe(before.draws);
        expect(after.quests).toEqual(before.quests);
        for (const q of after.quests) expect(JSON.stringify(q)).not.toMatch(/fixture_bounty/);
        vi.restoreAllMocks();
    });
});

describe('drawing the map at claim', () => {
    const pool = [{ itemId: 'map_a', weight: 1 }, { itemId: 'map_b', weight: 3 }];

    it('with no map to pay, draws nothing at all', () => {
        const random = scripted([0]);
        expect(drawBountyMap(doneHunt(), random, [])).toBeNull();
        expect(random.calls()).toBe(0);
    });

    it('a tutorial step never pays a map, and draws nothing', () => {
        const random = scripted([0]);
        expect(drawBountyMap({ ...doneHunt(), tutorial: true }, random, pool)).toBeNull();
        expect(random.calls()).toBe(0);
    });

    it('a miss pays no map, for one draw', () => {
        const random = scripted([BOUNTY_MAP_REWARD.chance, 0]);
        expect(drawBountyMap(doneHunt(), random, pool)).toBeNull();
        expect(random.calls()).toBe(1);
    });

    it('a hit pays one map, picked by weight, for two draws', () => {
        const first = scripted([0, 0.2]);    // 0.2 × 4 = 0.8, inside map_a's 1
        expect(drawBountyMap(doneHunt(), first, pool)).toMatchObject({ itemId: 'map_a', quantity: BOUNTY_MAP_REWARD.quantity });
        expect(first.calls()).toBe(2);
        const second = scripted([0, 0.3]);   // 1.2: past map_a, into map_b
        expect(drawBountyMap(doneHunt(), second, pool).itemId).toBe('map_b');
    });

    it('the pool is every map with a bounty weight, in id order', () => {
        registerItems(structuredClone(FIXTURE_MAPS));
        const fixtures = bountyMapPool().filter(e => e.itemId.startsWith('fixture_bounty'));
        expect(fixtures).toEqual([
            { itemId: 'fixture_bounty_map_a', weight: 1 },
            { itemId: 'fixture_bounty_map_b', weight: 3 }
        ]);
        expect(bountyMapPool().every(e => isMapItem(getItem(e.itemId)))).toBe(true);
    });
});

describe('claiming a bounty', () => {
    beforeEach(() => {
        registerItems(structuredClone(FIXTURE_MAPS));
        newGame();
    });
    afterEach(() => QuestManager.cleanup());

    it('can pay a map beside its items, dropped as loot with them', () => {
        const token = QuestTokens.spawnQuest(doneHunt());
        const res = QuestTokens.claimQuest(token.id, scripted([0, 0]));
        expect(res.success).toBe(true);
        const maps = res.rewardItems.filter(r => isMapItem(getItem(r.itemId)));
        expect(maps).toHaveLength(1);
        expect(maps[0].quantity).toBe(BOUNTY_MAP_REWARD.quantity);
        expect(res.rewardItems.find(r => r.itemId === 'item_oak_wood')?.quantity).toBe(10);
        const loot = SpriteLayer.getSprites().filter(s => s.refId === maps[0].itemId);
        expect(loot.reduce((n, s) => n + s.quantity, 0)).toBe(BOUNTY_MAP_REWARD.quantity);
    });

    it('pays no map on a miss, and the quest still pays its items', () => {
        const token = QuestTokens.spawnQuest(doneHunt('quest_fixture_miss'));
        const res = QuestTokens.claimQuest(token.id, scripted([0.99]));
        expect(res.success).toBe(true);
        expect(res.rewardItems).toEqual([{ itemId: 'item_oak_wood', quantity: 10, name: getItem('item_oak_wood').name }]);
    });

    it('a refused claim draws nothing', () => {
        const quest = { ...doneHunt('quest_fixture_open'), currentCount: 0, done: false };
        const token = QuestTokens.spawnQuest(quest);
        const random = scripted([0]);
        expect(QuestTokens.claimQuest(token.id, random).success).toBe(false);
        expect(random.calls()).toBe(0);
    });
});
