import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { createRandomQuest } from '../systems/quests/questBounties.js';
import * as QuestBounties from '../systems/quests/questBounties.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { registerItems, getItem, isRetiredItem } from '../config/registries/itemRegistry.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Map items are retired (the world map settles places): a bounty pays only its items, no drop line
 * naming a map or a modifier is rolled, and none lands on the mat whoever drops it. The bounty's own
 * roll draws exactly the random numbers it always did, whether or not maps exist.
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

describe('nothing pays a map any more', () => {
    it('the bounty map pool and its draw are gone', () => {
        expect(QuestBounties.drawBountyMap).toBeUndefined();
        expect(QuestBounties.bountyMapPool).toBeUndefined();
        expect(QuestBounties.BOUNTY_MAP_REWARD).toBeUndefined();
    });

    it('maps and modifiers are retired kinds; other items are not', () => {
        registerItems(structuredClone(FIXTURE_MAPS));
        expect(isRetiredItem('fixture_bounty_map_a')).toBe(true);
        expect(isRetiredItem(getItem('fixture_bounty_mod_never'))).toBe(true);
        expect(isRetiredItem('item_oak_wood')).toBe(false);
        expect(isRetiredItem('no_such_item')).toBe(false);
    });

    it('a kill never rolls a map line, first kill or not, and the other lines roll as ever', () => {
        registerItems(structuredClone(FIXTURE_MAPS));
        const lines = [
            { itemId: 'fixture_bounty_map_a', chance: 50, minQty: 1, maxQty: 1, firstKill: true },
            { itemId: 'item_oak_wood', chance: 100, minQty: 2, maxQty: 2 },
            { itemId: 'fixture_bounty_mod_never', chance: 100, minQty: 1, maxQty: 1 }
        ];
        const random = scripted([0]);
        const spy = vi.spyOn(Math, 'random').mockImplementation(random);
        const drops = LootSystem.rollEachLine(lines, null, null, true);
        spy.mockRestore();
        expect(drops.map(d => [d.itemId, d.quantity])).toEqual([['item_oak_wood', 2]]);
        expect(random.calls()).toBe(1);
    });
});

describe('a worked Token', () => {
    registerTokenTypes({
        fixture_map_bush: {
            id: 'fixture_map_bush', name: 'Fixture Map Bush', tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: 500, sprite: 's_nature',
            config: {
                skill: 'farming', skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [],
                outputs: [
                    { itemId: 'fixture_bounty_map_a', chance: 100, minQty: 1, maxQty: 1 },
                    { itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }
                ]
            }
        }
    });

    it('never rolls its map line: the cycle drops its other outputs and hands no map to the mat', () => {
        registerItems(structuredClone(FIXTURE_MAPS));
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
        const skills = Object.fromEntries(getAllSkillIds().map(s => [s, { level: 50, xp: 0 }]));
        GameState.state.heroes = [{ id: 'hero_1', name: 'hero_1', status: 'idle', level: 50, skills, hp: { current: 100, max: 100 }, statuses: [], effects: [] }];
        const bush = BoardState.createTokenInstance('fixture_map_bush', tokenStartingUses('fixture_map_bush'));
        Placement.placeTokenAt(bush, { x: 600, y: 400 });
        Orders.orderAt('hero_1', { x: 600, y: 400 });
        const handed = vi.spyOn(SpriteLayer, 'addSprite');
        for (let t = 0; t < 20000; t += 100) BoardRunner.tick(100);
        const ids = handed.mock.calls.map(c => c[1]);
        handed.mockRestore();
        expect(ids).toContain('item_oak_wood');
        expect(ids).not.toContain('fixture_bounty_map_a');
    });
});

describe('claiming a bounty', () => {
    beforeEach(() => {
        registerItems(structuredClone(FIXTURE_MAPS));
        newGame();
    });
    afterEach(() => QuestManager.cleanup());

    it('pays only its items, dropped as loot, whatever maps carry a bounty weight', () => {
        const token = QuestTokens.spawnQuest(doneHunt());
        const res = QuestTokens.claimQuest(token.id);
        expect(res.success).toBe(true);
        expect(res.rewardItems).toEqual([{ itemId: 'item_oak_wood', quantity: 10, name: getItem('item_oak_wood').name }]);
        expect(SpriteLayer.getSprites().map(s => s.refId)).toEqual(['item_oak_wood']);
    });

    it('a map handed to the mat as loot never lands', () => {
        expect(SpriteLayer.addSprite('item', 'fixture_bounty_map_b', 1, null)).toBeNull();
        expect(SpriteLayer.getSprites().some(s => s.refId === 'fixture_bounty_map_b')).toBe(false);
        expect(SpriteLayer.addSprite('item', 'item_oak_wood', 1, null)).toBeTruthy();
    });

    it('a refused claim pays nothing', () => {
        const quest = { ...doneHunt('quest_fixture_open'), currentCount: 0, done: false };
        const token = QuestTokens.spawnQuest(quest);
        expect(QuestTokens.claimQuest(token.id).success).toBe(false);
        expect(SpriteLayer.getSprites()).toEqual([]);
    });
});
