import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
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
import * as Shop from '../systems/board/Shop.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The cartographer's tutorial, walked through the REAL systems on the shipped content, from the
 * first Hero to the first move. Content the owner has not authored yet (an endgame site, the
 * maps) is a test fixture here.
 */

const SITE = 'fixture_tut_site';
registerTokenTypes({
    [SITE]: {
        id: SITE, name: 'Old Site', landmark: true, tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, size: 1, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 600000, xp: 0, inputs: [], outputs: [] }
    }
});

/** Two first maps, one map they trade up into (not a first map), and a modifier (not one either). */
const MAPS = {
    map_tut_woods: {
        id: 'map_tut_woods', name: 'Woods Map', type: 'map', stackable: true,
        cartography: { biome: 'forest', points: 12, nodes: [{ typeId: 'token_oak_tree', weight: 1 }], camps: [], treasures: [], upcycle: { itemId: 'map_tut_deep_woods', ratio: 3 } }
    },
    map_tut_hills: {
        id: 'map_tut_hills', name: 'Hills Map', type: 'map', stackable: true,
        cartography: { biome: 'mountain', points: 12, nodes: [{ typeId: 'token_copper_ore_vein', weight: 1 }], camps: [], treasures: [] }
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
const withMaps = () => registerItems(MAPS);
const withoutMaps = () => { for (const id of Object.keys(MAPS)) delete getAllItems()[id]; };

/** Spots on the mat, far enough apart that one flag reaches one Token. */
const SPOT = {
    tree: { x: 300, y: 300 },
    build: { x: 1400, y: 300 },
    fight: { x: 1400, y: 900 },
    site: { x: 300, y: 900 }
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

/** What the inspection sheet tells the engine when it opens on a Token on the mat. */
const inspect = (instance) => EventBus.publish(UI_EVENTS.TOKEN_INSPECTED, { instanceId: instance.id, typeId: instance.typeId });

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); withoutMaps(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 220);
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

        // 2. Plant a Flag beside an Oak Tree.
        Placement.placeTokenAt(
            BoardState.createTokenInstance('token_oak_tree', tokenStartingUses('token_oak_tree')), SPOT.tree);
        expect(Flags.plant(heroId, SPOT.tree).success).toBe(true);
        claim('cart_flag');

        // 3. Gather three times.
        expect(runUntil(() => complete('cart_gather'), 5 * 60_000)).toBe(true);
        claim('cart_gather');

        // 4. Collect 10 items by hovering (the hover calls `collectSprite`).
        expect(runUntil(() => {
            collectAll();
            if (!onMat('token_oak_tree').length) {
                Placement.placeTokenAt(BoardState.createTokenInstance('token_oak_tree', 10), SPOT.tree);
            }
            return complete('cart_loot');
        }, 10 * 60_000)).toBe(true);
        claim('cart_loot');
        Flags.furl(heroId);

        // 5. Buy a Wood Foundation; another purchase does not count for it.
        give('item_oak_wood', 15);
        const quarry = Shop.buy('token_quarry');
        expect(quarry.success, quarry.reason).toBe(true);
        Placement.removePlacedToken(quarry.instance.id);
        expect(complete('cart_foundation')).toBe(false);
        give('item_oak_wood', 15);
        const foundation = buyAt('token_wood_foundation', SPOT.build);
        claim('cart_foundation');

        // 6. Build a station on it (a Workbench).
        StationRecipe.setSelectedRecipe(foundation, 'recipe_muily2pb');
        give('item_oak_wood', 5);
        Flags.plant(heroId, SPOT.build);
        expect(runUntil(() => complete('cart_station'), 2 * 60_000)).toBe(true);
        expect(onMat('token_workbench')).toHaveLength(1);
        claim('cart_station');

        // 7. Craft a recipe there. A new Workbench has no recipe, so nothing is crafted until the
        // player picks one (Charcoal).
        give('item_oak_wood', 10);
        const workbench = onMat('token_workbench')[0];
        expect(workbench.selectedRecipeId).toBeUndefined();
        expect(runUntil(() => complete('cart_craft'), 30_000)).toBe(false);
        expect(StationRecipe.setSelectedRecipe(workbench, 'recipe_muily2pf')).toBe(true);
        expect(runUntil(() => complete('cart_craft'), 2 * 60_000)).toBe(true);
        claim('cart_craft');
        Flags.furl(heroId);

        // 8. Win a first fight, against a Cow (it never attacks first).
        // ⚠️ Fixture: a Recruit fights as a level 1 fighter, and a level-1 or level-10 hero is
        // often knocked out by a Cow before the first kill, so the hero is lent a combat skill at
        // level 40.
        GameState.heroes[0].skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 40 };
        Placement.placeTokenAt(BoardState.createTokenInstance('token_cow', tokenStartingUses('token_cow')), SPOT.fight);
        expect(Flags.plant(heroId, SPOT.fight).success).toBe(true);
        expect(runUntil(() => complete('cart_fight'), 5 * 60_000)).toBe(true);
        claim('cart_fight');
        Flags.furl(heroId);

        // 9. Inspect an endgame site. Inspecting anything else does not count.
        inspect(onMat('token_workbench')[0]);
        expect(complete('cart_inspect')).toBe(false);
        inspect(placeSite());
        // The reward is the first maps: one of each Base Map nothing trades up into.
        const paid = claim('cart_inspect').rewardItems.map(r => r.itemId);
        expect(paid).toEqual(expect.arrayContaining(['map_tut_hills', 'map_tut_woods']));
        expect(paid).not.toContain('map_tut_deep_woods');
        expect(paid).not.toContain('mod_tut_thicket');
        collectAll();
        expect(bank('map_tut_woods')).toBe(1);
        expect(bank('map_tut_hills')).toBe(1);

        // 10. Write the first world: settle a Region from a map.
        const settled = Atlas.settle({ ingredients: ['map_tut_woods'], seed: 7 });
        expect(settled.success, settled.reason).toBe(true);
        claim('cart_settle');

        // 11. Move the guild there. The step travels beside the Hall and counts on arrival.
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
        expect(TUTORIAL_QUESTS.find(t => t.id === 'cart_inspect').firstMaps).toBe(true);
        walkTo('cart_inspect');
        const paid = claim('cart_inspect').rewardItems;
        expect(paid.every(r => !String(r.itemId).startsWith('map_'))).toBe(true);
        expect(paid.length).toBeGreaterThan(0);
    });

    it('maps authored after the step was offered are still paid (read at claim, not at spawn)', () => {
        withoutMaps();
        walkTo('cart_inspect');
        withMaps();
        const paid = claim('cart_inspect').rewardItems.map(r => r.itemId);
        expect(paid).toEqual(expect.arrayContaining(['map_tut_woods', 'map_tut_hills']));
    });

    it('one of each Base Map that no map trades up into, in id order', () => {
        withMaps();
        expect(firstMapsReward().map(r => [r.itemId, r.quantity])).toEqual([
            ['map_tut_hills', 1], ['map_tut_woods', 1]
        ]);
    });
});

/** Stand an endgame site on the mat. */
function placeSite() {
    const site = BoardState.createTokenInstance(SITE);
    expect(Placement.placeTokenAt(site, SPOT.site).success).toBe(true);
    return BoardState.getTokenById(site.id);
}

/**
 * Bring the chain to step `id` (the steps before it recorded as claimed; they are walked above),
 * then complete it with its own event.
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
    inspect(placeSite());
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

    it('no step says "log" (the skill is Forestry)', () => {
        for (const t of TUTORIAL_QUESTS) {
            expect(`${t.title} ${t.says} ${t.instruction}`, t.id).not.toMatch(/\blog(s|ging|ged)?\b/i);
        }
    });

    it('the chain is the cartographer\'s, in order, with new ids', () => {
        expect(TUTORIAL_QUESTS.map(t => t.id)).toEqual([
            'cart_recruit', 'cart_flag', 'cart_gather', 'cart_loot', 'cart_foundation', 'cart_station',
            'cart_craft', 'cart_fight', 'cart_inspect', 'cart_settle', 'cart_travel'
        ]);
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

    it('the inspection notice is published by the UI (the tutorial counts it)', () => {
        const inspection = fs.readFileSync(path.join(SRC, 'ui/components/drawer/TokenInspection.jsx'), 'utf8');
        expect(inspection).toMatch(/publish\(\s*UI_EVENTS\.TOKEN_INSPECTED/);
    });
});
