import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { TUTORIAL_QUESTS, firstMapsReward } from '../systems/quests/tutorialQuests.js';
import { TUTORIAL_TEXT } from '../systems/quests/tutorialText.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Shop from '../systems/board/Shop.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { isMapItem } from '../systems/atlas/mapItems.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The cartographer's tutorial, walked through the REAL systems on the shipped content, from the
 * first Hero to the first move. Content the owner has not authored yet (the maps) is a test
 * fixture here.
 */

/** The first tool, until the owner's starter tools are content. A woodaxe, for the Oak Tree. */
const AXE = 'fixture_tut_woodaxe';
registerItems({
    [AXE]: { id: AXE, name: 'Fixture Woodaxe', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 } }
});

/**
 * Two maps given by the tutorial, a Base Map nothing trades up into that is not (not a first map
 * once any map is ticked), one map they trade up into, and a modifier.
 */
const MAPS = {
    map_tut_woods: {
        id: 'map_tut_woods', name: 'Woods Map', type: 'map', stackable: true,
        cartography: { biome: 'forest', points: 12, nodes: [{ typeId: 'token_oak_tree', weight: 1 }], camps: [], treasures: [], upcycle: { itemId: 'map_tut_deep_woods', ratio: 3 }, tutorial: true }
    },
    map_tut_hills: {
        id: 'map_tut_hills', name: 'Hills Map', type: 'map', stackable: true,
        cartography: { biome: 'mountain', points: 12, nodes: [{ typeId: 'token_copper_ore_vein', weight: 1 }], camps: [], treasures: [], tutorial: true }
    },
    map_tut_meadow: {
        id: 'map_tut_meadow', name: 'Meadow Map', type: 'map', stackable: true,
        cartography: { biome: 'meadow', points: 12, nodes: [{ typeId: 'token_oak_tree', weight: 1 }], camps: [], treasures: [] }
    },
    map_tut_deep_woods: {
        id: 'map_tut_deep_woods', name: 'Deep Woods Map', type: 'map', stackable: true,
        cartography: { biome: 'forest', points: 24, nodes: [{ typeId: 'token_oak_tree', weight: 1 }], camps: [], treasures: [] }
    },
    mod_tut_thicket: {
        id: 'mod_tut_thicket', name: 'Thicket', type: 'modifier', stackable: true,
        cartography: { effects: [{ kind: 'density', typeId: 'token_oak_tree', points: 4 }] }
    }
};
// ⚠️ The shipped maps are hidden while a case runs, so what a case expects does not move when the owner authors a map.
const SHIPPED_MAPS = Object.fromEntries(Object.entries(getAllItems()).filter(([, def]) => isMapItem(def)));
const withoutMaps = () => {
    const items = getAllItems();
    for (const id of Object.keys(items)) if (isMapItem(items[id])) delete items[id];
};
const withMaps = () => { withoutMaps(); registerItems(MAPS); };
const restoreShippedMaps = () => { withoutMaps(); registerItems(SHIPPED_MAPS); };

/** Spots on the mat, well apart. */
const SPOT = {
    tree: { x: 300, y: 300 },
    build: { x: 1400, y: 300 },
    fight: { x: 1400, y: 900 },
    forge: { x: 880, y: 1000 },
    camp: { x: 400, y: 800 }
};

const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const quest = (id) => QuestManager.getActiveQuests().find(q => q.id === id);
const give = (itemId, n) => InventoryManager.addItem(itemId, n);
const bank = (itemId) => InventoryManager.getItemCount(itemId);
const collectAll = () => {
    for (const s of SpriteLayer.getSprites().filter(s => s.kind === 'item')) SpriteLayer.collectSprite(s.id);
};

/** Run the engine in 100 ms ticks until `done()` or `maxMs` of game time. */
function runUntil(done, maxMs) {
    for (let t = 0; t < maxMs; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
        SpriteLayer.tick(100);
    }
    return done();
}

const complete = (id) => (quest(id)?.currentCount || 0) >= (quest(id)?.requiredCount || Infinity);

/** The step is the only tutorial quest on the mat, is complete, and is claimed. */
function claim(id) {
    expect(quest(id), `${id} is offered`).toBeTruthy();
    expect(QuestManager.getActiveQuests().filter(q => q.tutorial).map(q => q.id)).toEqual([id]);
    expect(complete(id), `${id} is complete`).toBe(true);
    const res = QuestManager.claimQuest(id);
    expect(res.success, id).toBe(true);
    return res;
}

/** Buy at the Shop, then move the new Token to its own spot. */
function buyAt(typeId, point) {
    const res = Shop.buy(typeId);
    expect(res.success, `${typeId}: ${res.reason}`).toBe(true);
    expect(Placement.moveTokenTo(res.instance.id, point)?.success ?? true).toBe(true);
    return BoardState.getTokenById(res.instance.id);
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); restoreShippedMaps(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    // Quest Tokens are spawned by the Guild Hall, so the mat needs one, in the middle, clear of
    // every SPOT's flag. It is the Starter Camp.
    BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 600);
    Atlas.createStarterRegion();
    QuestManager.init();
});

afterEach(() => QuestManager.cleanup());

describe('⭐ the cartographer\'s chain, step by step, through the real systems', () => {
    it('every step completes from the event it listens to, from the first Hero to the first move', () => {
        withMaps();

        // 1. Recruit a Hero: the Guild Hall board's first Bunk Beds rank is free.
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        const heroId = GameState.heroes[0].id;
        claim('cart_recruit');

        // 2. Equip a tool: food does not count, a woodaxe does.
        give('item_steak', 1);
        expect(EquipmentManager.equipItem(heroId, 'item_steak').success).toBe(true);
        expect(complete('cart_tool')).toBe(false);
        give(AXE, 1);
        expect(EquipmentManager.equipItem(heroId, AXE).success).toBe(true);
        claim('cart_tool');

        // 3. Send the hero to a tree: the player's drop onto an Oak Tree. Bare ground does not
        // count.
        expect(Orders.orderAt(heroId, { x: 600, y: 300 })).toMatchObject({ success: true, order: 'spot' });
        expect(complete('cart_flag')).toBe(false);
        Placement.placeTokenAt(
            BoardState.createTokenInstance('token_oak_tree', tokenStartingUses('token_oak_tree')), SPOT.tree);
        expect(Orders.orderAt(heroId, SPOT.tree)).toMatchObject({ success: true, order: 'token' });
        claim('cart_flag');

        // 4. Gather three times.
        expect(runUntil(() => complete('cart_gather'), 5 * 60_000)).toBe(true);
        claim('cart_gather');

        // 5. Collect 10 items by hovering (the hover calls `collectSprite`).
        expect(runUntil(() => {
            collectAll();
            if (!onMat('token_oak_tree').length) {
                // The felled tree's Stump keeps its hero waiting: the player sends them to a new one.
                const tree = BoardState.createTokenInstance('token_oak_tree', 10);
                Placement.placeTokenAt(tree, SPOT.tree);
                if (BoardState.getTokenById(tree.id)) Orders.orderAt(heroId, { x: tree.x, y: tree.y });
            }
            return complete('cart_loot');
        }, 10 * 60_000)).toBe(true);
        claim('cart_loot');
        Flags.furl(heroId);

        // 6. Buy a Wood Foundation; another purchase does not count for it.
        give('item_oak_wood', 15);
        const other = Shop.buy('token_farmland');
        expect(other.success, other.reason).toBe(true);
        Placement.removePlacedToken(other.instance.id);
        expect(complete('cart_foundation')).toBe(false);
        give('item_oak_wood', 15);
        const foundation = buyAt('token_wood_foundation', SPOT.build);
        claim('cart_foundation');

        // 7. Build a station on it (a Workbench).
        StationRecipe.setSelectedRecipe(foundation, 'recipe_muily2pb');
        give('item_oak_wood', 5);
        Orders.orderAt(heroId, SPOT.build);
        expect(runUntil(() => complete('cart_station'), 2 * 60_000)).toBe(true);
        expect(onMat('token_workbench')).toHaveLength(1);
        claim('cart_station');

        // 8. Craft a recipe there. A new Workbench has no recipe, so nothing is crafted until the
        // player picks one (Charcoal).
        give('item_oak_wood', 10);
        const workbench = onMat('token_workbench')[0];
        expect(workbench.selectedRecipeId).toBeUndefined();
        // A finished build ends the builder's order: the player sends them to the new station.
        expect(Orders.orderAt(heroId, { x: workbench.x, y: workbench.y })).toMatchObject({ success: true, order: 'token' });
        expect(runUntil(() => complete('cart_craft'), 30_000)).toBe(false);
        expect(StationRecipe.setSelectedRecipe(workbench, 'recipe_muily2pf')).toBe(true);
        expect(runUntil(() => complete('cart_craft'), 2 * 60_000)).toBe(true);
        claim('cart_craft');
        Flags.furl(heroId);

        // 9. Build a first camp: a Logging Camp on a second Wood Foundation, then the Hero sent to it
        // chops a tree in its reach.
        give('item_oak_wood', 15);
        const second = buyAt('token_wood_foundation', SPOT.camp);
        expect(StationRecipe.setSelectedRecipe(second, 'recipe_build_logging_camp')).toBe(true);
        give('item_oak_wood', 20);
        expect(Orders.orderAt(heroId, SPOT.camp)).toMatchObject({ success: true, order: 'token' });
        expect(runUntil(() => complete('cart_camp'), 3 * 60_000)).toBe(true);
        const camp = onMat('token_logging_camp')[0];
        expect(camp).toBeTruthy();
        // A finished Foundation ends the builder's order.
        BoardRunner.tick(100);
        expect(Flags.pinnedIdOf(heroId)).toBeNull();
        expect(Flags.needsJob(heroId)).toBe(true);
        const grove = BoardState.createTokenInstance('token_oak_tree', 10);
        expect(Placement.placeTokenAt(grove, { x: camp.x + 160, y: camp.y }).success).toBe(true);
        expect(Orders.orderAt(heroId, { x: camp.x, y: camp.y })).toMatchObject({ success: true, order: 'token' });
        expect(runUntil(() => BoardState.workTokenOf(heroId) === grove.id, 30_000)).toBe(true);
        claim('cart_camp');
        Flags.furl(heroId);

        // 10. Make a first copper tool (a Copper Pickaxe at a Copper Smithy). The Charcoal made
        // above did not count: it is not a tool. No maps yet.
        expect(complete('cart_copper_tool')).toBe(false);
        GameState.heroes[0].skills.smithing = { xp: 0, level: 5 };
        const smithy = BoardState.createTokenInstance('token_copper_smithy', tokenStartingUses('token_copper_smithy'));
        expect(Placement.placeTokenAt(smithy, SPOT.forge).success).toBe(true);
        expect(StationRecipe.setSelectedRecipe(BoardState.getTokenById(smithy.id), 'recipe_copper_pickaxe')).toBe(true);
        give('item_copper_ingot', 4);
        expect(Orders.orderAt(heroId, SPOT.forge).success).toBe(true);
        expect(runUntil(() => complete('cart_copper_tool'), 2 * 60_000)).toBe(true);
        expect(claim('cart_copper_tool').rewardItems.some(r => isMapItem(getAllItems()[r.itemId]))).toBe(false);
        Flags.furl(heroId);

        // 11. Beat a goblin. A Cow (it never attacks first) does not count; a Goblin does, and
        // pays the maps given by the tutorial.
        // ⚠️ Fixture: a new hero fights at level 1 and is often knocked out before the
        // first kill, so the hero is lent a combat skill at level 40.
        GameState.heroes[0].skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 40 };
        // And fed, as the step tells the player ("Give a Hero food first"): the Steak equipped in
        // step 2 is eaten from the Bank below a quarter HP and fills the bar, so the Goblin's hits
        // (1, a crit 2) can never down the hero and the win does not depend on the rolls.
        give('item_steak', 10);
        const cow = BoardState.createTokenInstance('token_cow', tokenStartingUses('token_cow'));
        Placement.placeTokenAt(cow, SPOT.fight);
        expect(Orders.orderAt(heroId, SPOT.fight).success).toBe(true);
        const kills = [];
        const off = EventBus.subscribe('combat_victory', (d) => kills.push(d.enemyId));
        expect(runUntil(() => kills.length > 0, 5 * 60_000)).toBe(true);
        expect(complete('cart_goblin')).toBe(false);
        Flags.furl(heroId);
        Placement.removePlacedToken(cow.id);
        Placement.placeTokenAt(BoardState.createTokenInstance('token_goblin', tokenStartingUses('token_goblin')), SPOT.fight);
        expect(Orders.orderAt(heroId, SPOT.fight).success).toBe(true);
        expect(runUntil(() => complete('cart_goblin'), 5 * 60_000)).toBe(true);
        off();
        const paid = claim('cart_goblin').rewardItems.map(r => r.itemId);
        expect(paid.filter(id => isMapItem(getAllItems()[id])).sort()).toEqual(['map_tut_hills', 'map_tut_woods']);
        collectAll();
        expect(bank('map_tut_woods')).toBe(1);
        expect(bank('map_tut_hills')).toBe(1);
        expect(bank('map_tut_meadow')).toBe(0);
        Flags.furl(heroId);

        // 12. Write the first world: settle a Region from a map.
        const settled = Atlas.settle({ ingredients: ['map_tut_woods'], seed: 7 });
        expect(settled.success, settled.reason).toBe(true);
        claim('cart_settle');

        // 13. Move the guild there. The step travels beside the Hall and counts on arrival.
        const moved = Atlas.travel(settled.region.id);
        expect(moved.success, moved.reason).toBe(true);
        expect(Atlas.activeRegionId()).toBe(settled.region.id);
        claim('cart_travel');

        // Every step was walked, in order, and no step is left on the mat.
        expect(GameState.state.quests.completedTutorials).toEqual(TUTORIAL_QUESTS.map(t => t.id));
        expect(QuestManager.getActiveQuests().filter(q => q.tutorial)).toEqual([]);
    }, 180_000);
});

describe('the first maps are read from the registry when the step is claimed', () => {
    afterEach(() => withoutMaps());

    it('with no map items authored, the step pays nothing but its items', () => {
        withoutMaps();
        expect(firstMapsReward()).toEqual([]);
        expect(TUTORIAL_QUESTS.filter(t => t.firstMaps).map(t => t.id)).toEqual(['cart_goblin']);
        walkTo('cart_goblin');
        const paid = claim('cart_goblin').rewardItems;
        expect(paid.every(r => !String(r.itemId).startsWith('map_'))).toBe(true);
        expect(paid.length).toBeGreaterThan(0);
    });

    it('maps authored after the step was offered are still paid (read at claim, not at spawn)', () => {
        withoutMaps();
        walkTo('cart_goblin');
        withMaps();
        const paid = claim('cart_goblin').rewardItems.map(r => r.itemId);
        expect(paid).toEqual(expect.arrayContaining(['map_tut_woods', 'map_tut_hills']));
    });

    it('one of each Base Map given by the tutorial, in id order', () => {
        withMaps();
        expect(firstMapsReward().map(r => [r.itemId, r.quantity])).toEqual([
            ['map_tut_hills', 1], ['map_tut_woods', 1]
        ]);
    });

    it('a ticked Base Map is paid even when an upcycle makes it; a modifier never', () => {
        const items = {
            ...MAPS,
            map_tut_deep_woods: { ...MAPS.map_tut_deep_woods, cartography: { ...MAPS.map_tut_deep_woods.cartography, tutorial: true } },
            mod_tut_thicket: { ...MAPS.mod_tut_thicket, cartography: { ...MAPS.mod_tut_thicket.cartography, tutorial: true } }
        };
        expect(firstMapsReward(items).map(r => r.itemId)).toEqual(['map_tut_deep_woods', 'map_tut_hills', 'map_tut_woods']);
    });

    it('while no map is ticked yet, the old rule: each Base Map that no map trades up into', () => {
        const unticked = Object.fromEntries(Object.entries(MAPS).map(([id, def]) => [id, { ...def, cartography: { ...def.cartography, tutorial: undefined } }]));
        expect(firstMapsReward(unticked).map(r => r.itemId)).toEqual(['map_tut_hills', 'map_tut_meadow', 'map_tut_woods']);
    });
});

/**
 * Bring the chain to step `id` (the steps before it recorded as claimed; they are walked above),
 * then complete it with a goblin's kill (the step that pays the maps).
 */
function walkTo(id) {
    const q = GameState.state.quests;
    for (const t of TUTORIAL_QUESTS) {
        if (t.id === id) break;
        q.completedTutorials.push(t.id);
    }
    for (const t of QuestTokens.tutorialTokens()) BoardState.removeToken(t.id);
    QuestManager.ensureQuests();
    expect(quest(id), id).toBeTruthy();
    QuestManager.reportProgress('enemy_hunted', 1, { enemyId: 'token_goblin' });
}

describe('the chain\'s words come from one text module', () => {
    it('every step has a title, a cartographer\'s line and a plain instruction, all from TUTORIAL_TEXT', () => {
        for (const t of TUTORIAL_QUESTS) {
            const text = TUTORIAL_TEXT.steps[t.id];
            expect(text, t.id).toBeTruthy();
            expect(t.title).toBe(text.title);
            expect(t.says).toBe(text.says);
            expect(t.instruction).toBe(text.instruction);
            for (const line of [text.title, text.says, text.instruction]) expect(line.length, t.id).toBeGreaterThan(0);
        }
        expect(Object.keys(TUTORIAL_TEXT.steps)).toEqual(TUTORIAL_QUESTS.map(t => t.id));
    });

    it('no step says "log" (the skill is Forestry), but for the Logging Camp, a Token\'s own name', () => {
        for (const t of TUTORIAL_QUESTS) {
            const words = `${t.title} ${t.says} ${t.instruction}`.replace(/Logging Camp/g, 'camp');
            expect(words, t.id).not.toMatch(/\blog(s|ging|ged)?\b/i);
        }
    });

    it('no step speaks of planting a flag: heroes are sent, by dragging', () => {
        for (const t of TUTORIAL_QUESTS) {
            expect(`${t.title} ${t.says} ${t.instruction}`, t.id).not.toMatch(/\bflags?\b|\bplant/i);
        }
    });

    it('the chain is the cartographer\'s, in order, with new ids', () => {
        expect(TUTORIAL_QUESTS.map(t => t.id)).toEqual([
            'cart_recruit', 'cart_tool', 'cart_flag', 'cart_gather', 'cart_loot', 'cart_foundation', 'cart_station',
            'cart_craft', 'cart_camp', 'cart_copper_tool', 'cart_goblin', 'cart_settle', 'cart_travel'
        ]);
    });
});

describe('every step can be done on the shipped content', () => {
    it('no step asks for a landmark while no shipped Token is one', () => {
        const shipped = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/tokens.json'), 'utf8'));
        const landmarks = Object.values(shipped).filter(def => def?.landmark);
        for (const t of TUTORIAL_QUESTS) {
            if (t.match?.landmark) expect(landmarks.length, `${t.id} asks for a landmark`).toBeGreaterThan(0);
        }
    });
});

describe('a save from when the chain had the old-site step moves on to the next step (the first camp)', () => {
    const BEFORE = ['cart_recruit', 'cart_tool', 'cart_flag', 'cart_gather', 'cart_loot', 'cart_foundation', 'cart_station', 'cart_craft'];
    const tutorialOnMat = () => QuestManager.getActiveQuests().filter(q => q.tutorial).map(q => q.id);
    const oldInspectQuest = () => ({
        id: 'cart_inspect', tutorial: true, step: 8, title: 'Inspect an Old Site', targetType: 'token_inspected',
        match: { landmark: true }, requiredCount: 1, currentCount: 0, rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }], done: false
    });

    it('the old step standing on the mat is taken off and the next step arrives', () => {
        for (const t of QuestTokens.tutorialTokens()) BoardState.removeToken(t.id);
        GameState.state.quests.completedTutorials.push(...BEFORE);
        expect(QuestTokens.spawnQuest(oldInspectQuest())).toBeTruthy();
        expect(tutorialOnMat()).toEqual(['cart_inspect']);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(tutorialOnMat()).toEqual(['cart_camp']);
        expect(GameState.state.quests.tutorialStep).toBe(BEFORE.length);
    });

    it('the old step recorded as claimed, or waiting in the old sidebar list, counts for nothing', () => {
        for (const t of QuestTokens.tutorialTokens()) BoardState.removeToken(t.id);
        const q = GameState.state.quests;
        q.completedTutorials.push(...BEFORE, 'cart_inspect');
        q.active.push({ ...oldInspectQuest(), isTutorial: true, status: 'active' });
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(tutorialOnMat()).toEqual(['cart_camp']);
        expect(q.active).toEqual([]);
        expect(q.tutorialStep).toBe(BEFORE.length);
        expect(QuestTokens.tutorialChainDone()).toBe(false);
    });
});

describe('no quest listens for an event nobody publishes', () => {
    const SRC = path.resolve(__dirname, '..');
    const questSource = fs.readFileSync(path.join(SRC, 'systems/quests/QuestManager.js'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it('none of the retired events is subscribed to', () => {
        for (const name of [
            'map_burst', 'map_opened', 'map_purchased',
            'vault_withdrawn', 'vault_deposited', 'loot_token_placed',
            'board_recall', 'return_to_tray'
        ]) {
            expect(questSource, name).not.toMatch(new RegExp(`subscribe\\(\\s*['"]${name}['"]`));
        }
        expect(questSource).not.toMatch(/modalId === 'vault'/);
    });

    it('every tutorial target is one QuestManager reports', () => {
        for (const t of TUTORIAL_QUESTS) {
            expect(questSource, t.id).toContain(`reportProgress('${t.targetType}'`);
        }
    });

    it('the inspection notice is published by the UI (QuestManager counts it)', () => {
        const inspection = fs.readFileSync(path.join(SRC, 'ui/components/board/TokenCard.jsx'), 'utf8');
        expect(inspection).toMatch(/publish\(\s*UI_EVENTS\.TOKEN_INSPECTED/);
    });
});
