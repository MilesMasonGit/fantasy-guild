import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import * as LimesLessons from '../systems/quests/LimesLessons.js';
import * as LimesGuide from '../systems/quests/LimesGuide.js';
import { LESSON_STEPS, LESSON_TARGETS, GOAL_STEP, LIMES_MOMENTS, lessonSteps, allSteps } from '../systems/quests/lessonPlan.js';
import { LIMES_TEXT } from '../systems/quests/limesText.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
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
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getGrid } from '../config/registries/equipmentConstants.js';
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
 * ⭐ Limes's lessons: the concept's eight, in order, then the goal (settle a place), each counted
 * from the engine's own events through `QuestManager`, a step done early simply done, nothing
 * paid, the progress kept by a save, a catch-up and a travel. Walked here through the REAL systems
 * on the shipped content.
 */

/** Spots on the mat, well apart and clear of the Hall. */
const SPOT = {
    bush: { x: 300, y: 250 },
    tree: { x: 300, y: 600 },
    build: { x: 1400, y: 300 },
    fight: { x: 1400, y: 900 }
};

const give = (itemId, n) => InventoryManager.addItem(itemId, n);
const step = () => LimesLessons.currentStep()?.id ?? null;
const collectAll = () => {
    for (const s of SpriteLayer.getSprites().filter(s => s.kind === 'item')) SpriteLayer.collectSprite(s.id);
};
const place = (typeId, point, uses = tokenStartingUses(typeId)) => {
    const token = BoardState.createTokenInstance(typeId, uses);
    expect(Placement.placeTokenAt(token, point).success, typeId).toBe(true);
    return BoardState.getTokenById(token.id);
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

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 600);
    Atlas.createStarterRegion();
    QuestManager.init();
});

afterEach(() => QuestManager.cleanup());

describe('the lessons, as the concept lists them', () => {
    it('eight lessons in order, then the goal; every step has its words, the first on the mat', () => {
        const numbers = LESSON_STEPS.map(s => s.lesson);
        expect([...new Set(numbers)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(allSteps().at(-1)).toBe(GOAL_STEP);
        expect(GOAL_STEP.targetType).toBe('place_settled');
        for (const s of [...LESSON_STEPS, GOAL_STEP]) {
            const words = LIMES_TEXT.lessons[s.id];
            expect(words?.mat?.length, s.id).toBeGreaterThan(0);
            for (const lines of Object.values(words)) for (const line of lines) expect(line.trim().length, s.id).toBeGreaterThan(0);
        }
        expect(Object.keys(LIMES_TEXT.lessons).sort()).toEqual([...LESSON_STEPS, GOAL_STEP].map(s => s.id).sort());
        for (const id of Object.keys(LIMES_MOMENTS)) expect(LIMES_TEXT.moments[id]?.length, id).toBeGreaterThan(0);
    });

    it('the steps waiting for the opening\'s content (the scrap heap, a first sword) are left out until their id is set', () => {
        expect(LESSON_TARGETS.scrapHeap).toBeNull();
        expect(LESSON_TARGETS.weapon).toBeNull();
        expect(lessonSteps().map(s => s.id)).toEqual([
            'bush', 'collect', 'axe', 'chop', 'bunk_beds', 'foundation', 'build', 'craft', 'food', 'fight'
        ]);
        expect(LESSON_STEPS.filter(s => s.needs).map(s => [s.id, s.needs])).toEqual([['heap', 'scrapHeap'], ['weapon', 'weapon']]);
    });

    it('every id the lessons name is in today\'s content', () => {
        for (const key of ['berryBush', 'tree', 'foundation', 'craftBuilding', 'foe']) {
            expect(getTokenType(LESSON_TARGETS[key]), key).toBeTruthy();
        }
        for (const key of ['woodaxe', 'food']) expect(getItem(LESSON_TARGETS[key]), key).toBeTruthy();
        expect(GuildUpgradeManager.getNextCost(LESSON_TARGETS.bunkBeds)).toBeTruthy();
    });

    it('a game with no lessons (made before them, or with no new game behind it) counts nothing and says nothing', () => {
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.LIMES_LESSON, (d) => heard.push(d));
        QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
        off();
        expect(LimesLessons.hasLessons()).toBe(false);
        expect(step()).toBeNull();
        expect(heard).toEqual([]);
        expect(GameState.state.guide.progress).toBeNull();
    });
});

describe('⭐ the lessons, step by step, through the real systems', () => {
    it('every step is done by the event it listens to, from the first bush to the first place settled; nothing is paid', () => {
        LimesLessons.startLessons();
        expect(EngineBootstrap.createFirstHero()).toBeTruthy();
        const heroId = GameState.heroes[0].id;
        const arrivals = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.LIMES_LESSON, (d) => { if (d.arrived) arrivals.push(d.stepId); });

        // 1. Drag the hero to a Redberry Bush: bare ground does not count, the bush does.
        expect(step()).toBe('bush');
        const bush = place('token_redberry_bush', SPOT.bush);
        expect(Orders.orderAt(heroId, { x: 900, y: 1000 })).toMatchObject({ success: true, order: 'spot' });
        expect(step()).toBe('bush');
        expect(Orders.orderAt(heroId, { x: bush.x, y: bush.y })).toMatchObject({ success: true, order: 'token' });
        expect(step()).toBe('collect');

        // 2. Collect: the berries the bush drops, hovered (the hover calls `collectSprite`).
        expect(runUntil(() => SpriteLayer.getSprites().some(s => s.kind === 'item'), 60_000)).toBe(true);
        expect(step()).toBe('collect');
        collectAll();
        expect(step()).toBe('axe');
        expect(InventoryManager.getItemCount('item_redberry')).toBeGreaterThan(0);

        // 3. Equip the woodaxe (no scrap heap yet): food does not count, a pickaxe does not, a woodaxe does.
        // The berries equipped here do lesson 8's food step early.
        Flags.furl(heroId);
        expect(EquipmentManager.equipItem(heroId, 'item_redberry').success).toBe(true);
        expect(LimesLessons.isStepDone('food')).toBe(true);
        give('item_copper_pickaxe', 1);
        expect(EquipmentManager.equipItem(heroId, 'item_copper_pickaxe').success).toBe(true);
        expect(step()).toBe('axe');
        expect(EquipmentManager.unequipItem(heroId, getGrid(GameState.heroes[0]).indexOf('item_copper_pickaxe')).success).toBe(true);
        give(LESSON_TARGETS.woodaxe, 1);
        expect(EquipmentManager.equipItem(heroId, LESSON_TARGETS.woodaxe).success).toBe(true);
        expect(step()).toBe('chop');

        // 4. Chop wood.
        const tree = place('token_oak_tree', SPOT.tree);
        expect(Orders.orderAt(heroId, { x: tree.x, y: tree.y })).toMatchObject({ success: true, order: 'token' });
        expect(runUntil(() => step() !== 'chop', 2 * 60_000)).toBe(true);
        expect(step()).toBe('bunk_beds');
        Flags.furl(heroId);

        // 5. Buy Bunk Beds: another star does not count; Bunk Beds' next rank does, and brings a second hero.
        const bunkPrice = GuildUpgradeManager.getNextCost(LESSON_TARGETS.bunkBeds);
        for (const { itemId, quantity } of bunkPrice) give(itemId, quantity);
        expect(GuildUpgradeManager.purchase(LESSON_TARGETS.bunkBeds)).toMatchObject({ success: true });
        expect(GameState.heroes).toHaveLength(2);
        expect(step()).toBe('foundation');

        // 6. Buy a Wood Foundation (another purchase does not count), then build the Workbench on it.
        give('item_oak_wood', 40);
        const other = Shop.buy('token_farmland');
        expect(other.success, other.reason).toBe(true);
        Placement.removePlacedToken(other.instance.id);
        expect(step()).toBe('foundation');
        const bought = Shop.buy(LESSON_TARGETS.foundation);
        expect(bought.success, bought.reason).toBe(true);
        expect(step()).toBe('build');
        expect(Placement.moveTokenTo(bought.instance.id, SPOT.build)?.success ?? true).toBe(true);
        const foundation = BoardState.getTokenById(bought.instance.id);
        expect(StationRecipe.setSelectedRecipe(foundation, 'recipe_muily2pb')).toBe(true);
        expect(Orders.orderAt(heroId, SPOT.build).success).toBe(true);
        expect(runUntil(() => step() !== 'build', 3 * 60_000)).toBe(true);
        const workbench = BoardState.tokens().find(t => t.typeId === LESSON_TARGETS.craftBuilding);
        expect(workbench).toBeTruthy();
        expect(step()).toBe('craft');

        // 7. Craft Charcoal at it.
        give('item_oak_wood', 10);
        expect(StationRecipe.setSelectedRecipe(workbench, 'recipe_muily2pf')).toBe(true);
        expect(Orders.orderAt(heroId, { x: workbench.x, y: workbench.y }).success).toBe(true);
        expect(runUntil(() => step() !== 'craft', 2 * 60_000)).toBe(true);
        Flags.furl(heroId);

        // 8. Food was done early (step 3): straight on to the fight.
        // ⚠️ Fixture: a new hero at combat level 1 is often knocked out by a Goblin; lent level 40.
        expect(step()).toBe('fight');
        GameState.heroes[0].skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 40 };
        give('item_redberry', 20);
        place(LESSON_TARGETS.foe, SPOT.fight);
        expect(Orders.orderAt(heroId, SPOT.fight).success).toBe(true);
        expect(runUntil(() => step() !== 'fight', 5 * 60_000)).toBe(true);
        expect(step()).toBe(GOAL_STEP.id);

        // The goal: settle a place on the world map. A Region written off the map does not count.
        const meadow = { id: 'fixture_lesson_place', kind: 'base', biome: 'meadow', points: 4, nodes: [{ typeId: 'token_oak_tree', weight: 1 }] };
        expect(Atlas.settle({ ingredients: [meadow], seed: 7 }).success).toBe(true);
        expect(step()).toBe(GOAL_STEP.id);
        expect(LimesLessons.dueMoment()).toBeNull();
        expect(Atlas.settle({ ingredients: [meadow], seed: 8, cellId: '1,0' }).success).toBe(true);
        expect(step()).toBeNull();

        // Limes's first big moment, said once.
        expect(LimesLessons.dueMoment()).toBe('first_settle');
        LimesLessons.hearMoment('first_settle');
        expect(LimesLessons.dueMoment()).toBeNull();
        off();

        expect(arrivals).toEqual([...lessonSteps().slice(1).map(s => s.id).filter(id => id !== 'food'), GOAL_STEP.id]);
        expect([...GameState.state.guide.progress.done].sort()).toEqual(allSteps().map(s => s.id).sort());
    }, 180_000);

    it('a step done pays nothing: the Bank, the loot and the mat are as they were', () => {
        LimesLessons.startLessons();
        const bankBefore = JSON.stringify(GameState.state.inventory.items);
        const tokensBefore = BoardState.tokens().length;
        for (const s of lessonSteps()) QuestManager.reportProgress(s.targetType, 1, { ...(s.match || {}) });
        expect(step()).toBe(GOAL_STEP.id);
        expect(JSON.stringify(GameState.state.inventory.items)).toBe(bankBefore);
        expect(SpriteLayer.getSprites()).toEqual([]);
        expect(BoardState.tokens().length).toBe(tokensBefore);
    });
});

describe('guides, never locks: a step done early counts and moves on', () => {
    beforeEach(() => LimesLessons.startLessons());

    it('a fight won first is done when its turn comes; the steps before it still wait', () => {
        EventBus.publish(ENGINE_EVENTS.COMBAT_VICTORY, { enemyId: 'token_goblin' });
        expect(LimesLessons.isStepDone('fight')).toBe(true);
        expect(step()).toBe('bush');
        for (const s of lessonSteps().filter(s => s.id !== 'fight' && s.id !== 'food')) {
            QuestManager.reportProgress(s.targetType, 1, { ...(s.match || {}) });
        }
        expect(step()).toBe('food');
        EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: 'h', slot: 0, itemId: 'item_redberry', action: 'equip' });
        // The fight was already won: straight on to the goal.
        expect(step()).toBe(GOAL_STEP.id);
    });

    it('several steps done out of order are all kept, and the lessons go to the first one left', () => {
        const report = (id) => {
            const s = lessonSteps().find(x => x.id === id);
            QuestManager.reportProgress(s.targetType, 1, { ...(s.match || {}) });
        };
        report('craft');
        report('bunk_beds');
        report('collect');
        expect(step()).toBe('bush');
        report('bush');
        expect(step()).toBe('axe');
        report('axe');
        report('chop');
        expect(step()).toBe('foundation');
    });

    it('the engine\'s own events count, each by what it carries', () => {
        // A woodaxe equipped is the axe step; a pickaxe or a plain item is not.
        EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: 'h', slot: 0, itemId: 'item_copper_pickaxe', action: 'equip' });
        expect(LimesLessons.isStepDone('axe')).toBe(false);
        EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: 'h', slot: 0, itemId: 'item_copper_woodaxe', action: 'unequip' });
        expect(LimesLessons.isStepDone('axe')).toBe(false);
        EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: 'h', slot: 0, itemId: 'item_copper_woodaxe', action: 'equip' });
        expect(LimesLessons.isStepDone('axe')).toBe(true);
        // Another Guild Hall star is not Bunk Beds.
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'bank_tabs', rank: 1, count: 1 });
        expect(LimesLessons.isStepDone('bunk_beds')).toBe(false);
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'roster_size', rank: 2, count: 1 });
        expect(LimesLessons.isStepDone('bunk_beds')).toBe(true);
        // A Field built from Farmland is not the Workbench.
        EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, { typeId: 'token_wheat_field', fromTypeId: 'token_farmland' });
        expect(LimesLessons.isStepDone('build')).toBe(false);
        EventBus.publish(BOARD_EVENTS.TOKEN_BUILT, { typeId: LESSON_TARGETS.craftBuilding, fromTypeId: LESSON_TARGETS.foundation });
        expect(LimesLessons.isStepDone('build')).toBe(true);
        // A failed cycle counts for nothing; a Forestry gather is the chop.
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { typeId: 'token_oak_tree', failed: true });
        expect(LimesLessons.isStepDone('chop')).toBe(false);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { typeId: 'token_oak_tree', produced: ['item_oak_wood'] });
        expect(LimesLessons.isStepDone('chop')).toBe(true);
        expect(LimesLessons.isStepDone('craft')).toBe(false);
    });

    it('says when the step changes, and which step has just arrived', () => {
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.LIMES_LESSON, (d) => heard.push(d));
        QuestManager.reportProgress('combat_victory');
        QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
        QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
        off();
        expect(heard).toEqual([
            { stepId: 'bush', arrived: false, moment: null },
            { stepId: 'collect', arrived: true, moment: null }
        ]);
    });
});

describe('⭐ the lessons survive a save, a catch-up, a reload and travel', () => {
    beforeEach(() => LimesLessons.startLessons());

    it('a save and load keeps the steps done and the step Limes is on', () => {
        QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
        QuestManager.reportProgress('combat_victory');
        LimesGuide.setLessons(false);
        const saved = JSON.parse(JSON.stringify(GameState.serialize().state));
        expect(saved.guide.progress).toEqual({ done: ['bush', 'fight'], counts: {}, moments: {} });
        GameState.initNew();
        expect(step()).toBeNull();
        GameState.initFromSave(migrateState(saved, GAME_VERSION));
        expect(step()).toBe('collect');
        expect(LimesLessons.isStepDone('fight')).toBe(true);
        expect(LimesGuide.lessonsOn()).toBe(false);
    });

    it('a catch-up counts: its quiet bus skips only the screen\'s listeners', () => {
        EventBus.setQuiet(true);
        try {
            QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, { kind: 'item', refId: 'item_redberry', quantity: 2 });
        } finally {
            EventBus.setQuiet(false);
        }
        expect(step()).toBe('axe');
    });

    it('travel keeps the lessons: they are the guild\'s, not a mat\'s', () => {
        QuestManager.reportProgress('hero_deployed', 1, { typeId: LESSON_TARGETS.berryBush });
        const meadow = { id: 'fixture_lesson_trip', kind: 'base', biome: 'meadow', points: 4, nodes: [{ typeId: 'token_oak_tree', weight: 1 }] };
        const settled = Atlas.settle({ ingredients: [meadow], seed: 3 });
        expect(settled.success).toBe(true);
        expect(Atlas.travel(settled.region.id).success).toBe(true);
        expect(step()).toBe('collect');
        // Work in the other place counts too.
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, { kind: 'item', refId: 'item_oak_wood', quantity: 1 });
        expect(step()).toBe('axe');
    });

    it('a big moment waits until it is heard, through a save', () => {
        QuestManager.reportProgress('place_settled', 1, { cellId: '1,0' });
        expect(LimesLessons.dueMoment()).toBe('first_settle');
        const saved = JSON.parse(JSON.stringify(GameState.serialize().state));
        GameState.initFromSave(migrateState(saved, GAME_VERSION));
        expect(LimesLessons.dueMoment()).toBe('first_settle');
        LimesLessons.hearMoment('first_settle');
        QuestManager.reportProgress('place_settled', 1, { cellId: '0,1' });
        expect(LimesLessons.dueMoment()).toBeNull();
    });
});

describe('the cartographer\'s quest steps are gone', () => {
    it('a new game puts no quest on the mat, and its first tick brings none', () => {
        LimesLessons.startLessons();
        QuestTokens.requestCheck();
        QuestTokens.tick(100);
        expect(BoardState.tokens().filter(t => t.typeId === QUEST_TOKEN_TYPE)).toEqual([]);
    });

    it('an older save loads with no lessons to give, and its tutorial step Token is taken off the mat', () => {
        const old = structuredClone(INITIAL_STATE);
        delete old.guide;
        old.quests = { completedTutorials: ['cart_tool', 'cart_flag'], tutorialStep: 2, clockMs: 500 };
        const migrated = migrateState(old, GAME_VERSION);
        expect(migrated.quests).toEqual({ clockMs: 500 });
        expect(migrated.guide.progress).toBeNull();

        const stale = BoardState.createTokenInstance(QUEST_TOKEN_TYPE);
        BoardState.addToken(stale, 1100, 600);
        stale.quest = { id: 'cart_gather', tutorial: true, title: 'Gather', targetType: 'cycle_completed', requiredCount: 3, currentCount: 0, rewardItems: [], done: false };
        expect(QuestTokens.questTokens()).toHaveLength(1);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        QuestTokens.tick(0);
        expect(QuestTokens.questTokens()).toEqual([]);
    });
});

describe('the reports the goal counts', () => {
    it('settling a place reports region_settled and place_settled, and arriving there region_travelled', () => {
        const reported = [];
        const spy = vi.spyOn(QuestManager, 'reportProgress').mockImplementation((type) => { reported.push(type); });
        try {
            const settled = Atlas.settle({ ingredients: [{ id: 'fixture_lesson_cell', kind: 'base', biome: 'meadow', points: 4, nodes: [{ typeId: 'token_oak_tree', weight: 1 }] }], seed: 7, cellId: '1,0' });
            expect(settled.success).toBe(true);
            expect(Atlas.travel(settled.region.id).success).toBe(true);
        } finally {
            spy.mockRestore();
        }
        expect(reported).toEqual(expect.arrayContaining(['region_settled', 'place_settled', 'region_travelled']));
    });
});

describe('no quest or lesson listens for an event nobody publishes', () => {
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

    it('every lesson step and moment counts a report QuestManager makes', () => {
        for (const s of [...LESSON_STEPS, GOAL_STEP, ...Object.values(LIMES_MOMENTS)]) {
            expect(questSource, s.id || s.targetType).toContain(`reportProgress('${s.targetType}'`);
        }
    });

    it('every value a step matches on is one its report carries', () => {
        const carried = {
            hero_deployed: ['typeId', 'skill'],
            cycle_completed: ['typeId', 'skill', 'gathered', 'crafted'],
            hero_equipped: ['itemId', 'tool', 'toolKind', 'category', 'weapon'],
            guild_upgrade_purchased: ['upgradeId'],
            token_purchased: ['typeId'],
            token_built: ['typeId', 'fromTypeId', 'camp']
        };
        for (const s of LESSON_STEPS) {
            for (const key of Object.keys(s.match || {})) expect(carried[s.targetType], `${s.id}.${key}`).toContain(key);
        }
    });
});

describe('Limes\'s lesson words', () => {
    const lessonWords = () => Object.values(LIMES_TEXT.lessons).flatMap(w => Object.values(w).flat());

    it('no line says "log" (the skill is Forestry)', () => {
        for (const line of lessonWords()) expect(line).not.toMatch(/\blog(s|ging|ged)?\b/i);
    });

    it('no line speaks of planting a flag: heroes are sent, by dragging', () => {
        for (const line of lessonWords()) expect(line).not.toMatch(/\bflags?\b|\bplant/i);
    });
});
