import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { blockedLineFor } from '../ui/components/board/heroBubbles.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { DEMOLITION_SKILL_ID, getSkill, SKILL_LAYERS } from '../config/registries/skillRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';
import { pickRecipe } from './fixtures/stations.js';

/**
 * Demolition: the player marks a Token and a hero holding Construction removes it. No refund, no
 * loot, never a depletion. While marked the Token is that work and nothing else, and it stands
 * still; unmarked it is itself again.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const logging = {
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
};

registerTokenTypes({
    demo_landmark: {
        id: 'demo_landmark', name: 'Demo Landmark', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature', landmark: true, config: logging
    },
    demo_tree: {
        id: 'demo_tree', name: 'Demo Tree', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_nature', config: logging
    },
    demo_sapling: {
        id: 'demo_sapling', name: 'Demo Sapling', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'demo_tree', afterMs: 20000 }
    },
    demo_forest: {
        id: 'demo_forest', name: 'Demo Forest', tokenType: 'spawner', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'demo_sapling', weight: 1 }], allowance: 3, intervalMs: 5000, upkeep: [] }
    },
    /** Its upkeep is an item the Bank never holds, so it waits with an alert up. */
    demo_hungry_forest: {
        id: 'demo_hungry_forest', name: 'Demo Hungry Forest', tokenType: 'spawner', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'demo_sapling', weight: 1 }], allowance: 3, intervalMs: 5000, upkeep: [{ itemId: 'fixture_carrot', quantity: 1 }] }
    },
    demo_vein: {
        id: 'demo_vein', name: 'Demo Vein', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry',
        config: { ...logging, skill: 'mining' },
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    demo_foundation: {
        id: 'demo_foundation', name: 'Demo Foundation', tokenType: 'structure', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_industry',
        foundation: { kind: 'demo', skill: 'construction' }
    }
});

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

function runUntil(done, ms = 60000) {
    for (let t = 0; t < ms; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
    }
    return done();
}

const on = (instance) => BoardState.getTokenById(instance.id);
const claimOf = (heroId) => BoardState.claimOfHero(heroId)?.instanceId ?? null;
const hero = (id = 'hero_1') => GameState.state.heroes.find(h => h.id === id);
const bank = () => JSON.stringify(GameState.state.inventory);
const spriteCount = () => (GameState.state.board.sprites || []).length;

let events;
const offs = [];

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    SpawnerSystem.resetAlerts();
    clearMat();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    events = { demolished: [], depleted: [], resting: [], respawned: [], alerts: [], cycles: [], spawnerAlerts: [], promotion: [] };
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, p => events.demolished.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, p => events.depleted.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, p => events.resting.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, p => events.respawned.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, p => events.alerts.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => events.cycles.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, p => events.spawnerAlerts.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, p => events.promotion.push(p)));
});

afterEach(() => {
    while (offs.length) offs.pop()();
});

describe('the demolition job', () => {
    it('is Construction, a Starting skill every hero holds, at a fixed level and time', () => {
        expect(DEMOLITION_SKILL_ID).toBe('construction');
        expect(getSkill(DEMOLITION_SKILL_ID).layer).toBe(SKILL_LAYERS.STARTING);
        expect(Demolition.DEMOLITION_CONFIG).toMatchObject({
            skill: DEMOLITION_SKILL_ID, skillRequired: Demolition.DEMOLISH_LEVEL,
            cycleTimeMs: Demolition.DEMOLISH_MS, xp: 0, inputs: [], outputs: []
        });
        expect(Demolition.DEMOLISH_MS).toBeGreaterThan(0);
        expect(Demolition.DEMOLISH_LEVEL).toBeGreaterThanOrEqual(1);
    });

    it('is what a marked Token works as, whatever it was; the type alone is unchanged', () => {
        for (const typeId of ['demo_tree', 'demo_forest', 'fixture_kitchen', 'fixture_passive', 'demo_foundation', 'fixture_promotion']) {
            const t = placeAt(typeId, 0, 0);
            const def = getTokenType(typeId);
            const own = StationRecipe.workConfigOf(def, t);
            Demolition.mark(t.id);
            expect(StationRecipe.workConfigOf(def, t), typeId).toBe(Demolition.DEMOLITION_CONFIG);
            expect(StationRecipe.workConfigOf(def), typeId).toEqual(StationRecipe.workConfigOf(def, null));
            Demolition.unmark(t.id);
            expect(StationRecipe.workConfigOf(def, t), typeId).toEqual(own);
            BoardState.removeToken(t.id);
        }
    });
});

describe('what can be marked', () => {
    it('anything bought, built, spawned or planted', () => {
        const bought = place(10, 'demo_tree');
        const spawned = place(11, 'demo_sapling');
        spawned.origin = BoardState.ORIGIN.SPAWNED;
        for (const t of [bought, spawned]) {
            expect(Demolition.canMark(t.id)).toMatchObject({ success: true });
            expect(Demolition.mark(t.id)).toEqual({ success: true });
            expect(Demolition.isMarked(t)).toBe(true);
            expect(t.demolish).toBe(true);
        }
        expect(Demolition.mark(bought.id)).toEqual({ success: true, unchanged: true });
        expect(Demolition.markedTokens().map(t => t.id)).toEqual([bought.id, spawned.id]);
    });

    it('never the Guild Hall, a landmark, a map node, a quest or an enemy: each refused with a reason to show', () => {
        const hall = placeAt('token_guild_hall', 880, 560);
        const landmark = placeAt('demo_landmark', 400, 200);
        const node = placeAt('demo_tree', 560, 200);
        node.fixture = true;
        const quest = placeAt(BoardState.createTokenInstance(QUEST_TOKEN_TYPE), 720, 200);
        quest.quest = { id: 'quest_demo' };
        const enemy = placeAt('fixture_enemy', 400, 360);

        const cases = [
            [hall, Demolition.REFUSAL.GUILD_HALL],
            [landmark, Demolition.REFUSAL.LANDMARK],
            [node, Demolition.REFUSAL.MAP_NODE],
            [quest, Demolition.REFUSAL.QUEST],
            [enemy, Demolition.REFUSAL.ENEMY]
        ];
        const changed = [];
        offs.push(EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, p => changed.push(p)));
        for (const [t, code] of cases) {
            const refused = Demolition.mark(t.id);
            expect(refused, code).toEqual({ success: false, code, reason: Demolition.REFUSAL_TEXT[code] });
            expect(refused.reason, code).toMatch(/\w/);
            expect(Demolition.canMark(t), code).toMatchObject({ success: false, code });
            expect(Demolition.isMarked(t), code).toBe(false);
            expect(t.demolish, code).toBeUndefined();
        }
        expect(changed).toEqual([]);
        expect(Demolition.mark('tok_nowhere')).toMatchObject({ success: false, code: Demolition.REFUSAL.NO_TOKEN });
    });

    it('the dev layout tool lets a landmark be taken off, never marked', () => {
        const landmark = placeAt('demo_landmark', 400, 200);
        Landmarks.setLayoutEditing(true);
        try {
            expect(Demolition.canDemolish(landmark)).toBe(true);
            expect(Demolition.mark(landmark.id)).toMatchObject({ success: false, code: Demolition.REFUSAL.LANDMARK });
        } finally {
            Landmarks.setLayoutEditing(false);
        }
        expect(Demolition.canDemolish(landmark)).toBe(false);
    });
});

describe('a marked Token is Construction work', () => {
    it('a hero holding Construction claims it, walks over and removes it: no refund, no loot, no depletion, one demolished event', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);
        const before = { count: MatCap.tokenCount(), bank: bank(), sprites: spriteCount(), xp: hero().skills.construction.xp };
        const spot = { x: tree.x, y: tree.y };

        Placement.plantFlagAt('hero_1', C(10));
        expect(claimOf('hero_1')).toBe(tree.id);
        expect(Flags.workingRuleOf('hero_1')).toBe(DEMOLITION_SKILL_ID);
        expect(Flags.skipsOf(tree.id)).toEqual([]);

        run(Demolition.DEMOLISH_MS - 200);
        expect(on(tree)).toBe(tree);
        expect(tree.cycleElapsedMs).toBeGreaterThan(0);

        run(300);
        expect(on(tree)).toBeNull();
        expect(MatCap.tokenCount()).toBe(before.count - 1);
        expect(bank()).toBe(before.bank);
        expect(spriteCount()).toBe(before.sprites);
        expect(hero().skills.construction.xp).toBe(before.xp);
        expect(events.demolished).toEqual([{ instanceId: tree.id, typeId: 'demo_tree', ...spot, heroId: 'hero_1' }]);
        expect(events.depleted).toEqual([]);
        expect(events.resting).toEqual([]);
        expect(events.cycles.filter(c => c.instanceId === tree.id)).toEqual([]);
        expect(events.alerts.filter(a => a.instanceId === tree.id)).toEqual([]);
    });

    it('its hero lets go when it is gone and works the next thing', () => {
        const tree = place(10, 'demo_tree');
        const other = place(11, 'fixture_producer_alt');
        Demolition.mark(tree.id);
        Placement.plantFlagAt('hero_1', C(10));
        expect(claimOf('hero_1')).toBe(tree.id);
        expect(runUntil(() => !on(tree), Demolition.DEMOLISH_MS + 1000)).toBe(true);
        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBe(other.id);
    });

    it('a hero without Construction skips it as unskilled; one below the level as access', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);

        delete hero().skills.construction;
        Placement.plantFlagAt('hero_1', C(10));
        expect(claimOf('hero_1')).toBeNull();
        expect(Flags.skipsOf(tree.id)).toEqual([{ heroId: 'hero_1', reason: ALERT.UNSKILLED }]);

        hero().skills.construction = { level: Demolition.DEMOLISH_LEVEL - 1, xp: 0 };
        Flags.assignHero('hero_1');
        expect(claimOf('hero_1')).toBeNull();
        expect(Flags.skipsOf(tree.id)).toEqual([{ heroId: 'hero_1', reason: ALERT.ACCESS }]);

        hero().skills.construction = { level: Demolition.DEMOLISH_LEVEL, xp: 0 };
        Flags.assignHero('hero_1');
        expect(claimOf('hero_1')).toBe(tree.id);
    });

    it('a hero who falls below the level mid-demolition stops, says so, and lets go', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);
        Placement.plantFlagAt('hero_1', C(10));
        run(2000);
        const progress = tree.cycleElapsedMs;
        expect(progress).toBeGreaterThan(0);

        hero().skills.construction.level = Demolition.DEMOLISH_LEVEL - 1;
        BoardRunner.tick(100);
        expect(tree.alert).toBe(ALERT.ACCESS);
        expect(tree.cycleElapsedMs).toBe(progress);
        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBeNull();
        run(Demolition.DEMOLISH_MS);
        expect(on(tree)).toBe(tree);
    });

    it('a hero stuck on a station for want of items carries on as its demolisher when it is marked', () => {
        // Enough for one cycle: the hero claims it, works it, then stands there out of items.
        InventoryManager.addItem('fixture_oak_wood', 2);
        const consumer = place(10, 'fixture_consumer', 'hero_1');
        expect(runUntil(() => consumer.alert === ALERT.INPUTS, 30000)).toBe(true);
        expect(claimOf('hero_1')).toBe(consumer.id);

        // Something else to work arrives in reach the moment the station is marked.
        place(11, 'fixture_producer_alt');
        Demolition.mark(consumer.id);
        expect(consumer.alert ?? null).toBeNull();
        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBe(consumer.id);
        expect(runUntil(() => !on(consumer), Demolition.DEMOLISH_MS + 1000)).toBe(true);
    });

    it('a hero whose Construction rule is off skips it, and one already on it lets go', () => {
        const tree = place(10, 'demo_tree', 'hero_1');
        expect(claimOf('hero_1')).toBe(tree.id);
        Flags.setRule('hero_1', DEMOLITION_SKILL_ID, { allowed: false });
        Demolition.mark(tree.id);
        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBeNull();
        expect(Flags.skipsOf(tree.id)).toEqual([{ heroId: 'hero_1', reason: Flags.SKIP.RULE_OFF }]);
        run(Demolition.DEMOLISH_MS * 2);
        expect(on(tree)).toBe(tree);
    });

    it('a hero stuck below the level says so in Construction words', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);
        expect(blockedLineFor(tree.id, ALERT.ACCESS)).toBe('My Construction level is too low to work Demo Tree.');
    });

    it('a spawner, which no hero works, becomes work a flag claims and a pin holds', () => {
        const forest = place(10, 'demo_forest');
        expect(Flags.isHeroWorkable(forest)).toBe(false);
        Demolition.mark(forest.id);
        expect(Flags.isHeroWorkable(forest)).toBe(true);
        expect(Flags.pinRefusal('hero_1', forest)).toBeNull();

        Placement.plantFlagAt('hero_1', C(10), { pin: true });
        expect(BoardState.flagOf('hero_1').pinnedTo).toBe(forest.id);
        expect(claimOf('hero_1')).toBe(forest.id);
        expect(runUntil(() => !on(forest), Demolition.DEMOLISH_MS + 1000)).toBe(true);
        expect(events.demolished.map(d => d.instanceId)).toEqual([forest.id]);
    });

    it('a Promotion Token is demolished, not trained on, by a hero whose flag merely reaches it', () => {
        const yard = place(10, 'fixture_promotion');
        Demolition.mark(yard.id);
        // Beside it, not on it: unmarked, a Promotion Token is worked only from a flag on it.
        Placement.plantFlagAt('hero_1', C(11));
        expect(claimOf('hero_1')).toBe(yard.id);
        expect(runUntil(() => !on(yard), Demolition.DEMOLISH_MS + 1000)).toBe(true);
        expect(events.promotion).toEqual([]);
        expect(events.demolished.map(d => d.instanceId)).toEqual([yard.id]);
    });

    it('a Passive Generator waits for a Construction hero like anything else, producing nothing', () => {
        const passive = place(10, 'fixture_passive');
        Demolition.mark(passive.id);
        run(65000);
        expect(on(passive)).toBe(passive);
        expect(spriteCount()).toBe(0);
        expect(events.cycles).toEqual([]);

        Placement.plantFlagAt('hero_1', C(10));
        expect(claimOf('hero_1')).toBe(passive.id);
        expect(runUntil(() => !on(passive), Demolition.DEMOLISH_MS + 1000)).toBe(true);
    });
});

describe('unmarking', () => {
    it('restores the Token\'s own work', () => {
        const tree = place(10, 'demo_tree', 'hero_1');
        Demolition.mark(tree.id);
        run(2000);
        expect(Demolition.unmark(tree.id)).toEqual({ success: true });
        expect(tree.demolish).toBeUndefined();
        expect(StationRecipe.workConfigOf(getTokenType('demo_tree'), tree)).toBe(getTokenType('demo_tree').config);
        expect(Demolition.unmark(tree.id)).toEqual({ success: true, unchanged: true });

        run(2500);
        expect(Flags.workingRuleOf('hero_1')).toBe('forestry');
        expect(events.cycles.filter(c => c.instanceId === tree.id).length).toBeGreaterThan(0);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBeGreaterThan(0);
        expect(events.demolished).toEqual([]);
    });

    it('loses the half-done demolition: marked again, it takes the full time', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);
        Placement.plantFlagAt('hero_1', C(10));
        run(Demolition.DEMOLISH_MS / 2);
        expect(tree.cycleElapsedMs).toBeGreaterThan(0);

        Demolition.unmark(tree.id);
        expect(tree.cycleElapsedMs).toBe(0);
        Demolition.mark(tree.id);
        run(Demolition.DEMOLISH_MS - 300);
        expect(on(tree)).toBe(tree);
        run(400);
        expect(on(tree)).toBeNull();
    });
});

describe('a marked Token stands still', () => {
    it('a station mid-recipe stops: its progress goes, no cycle completes, nothing is made', () => {
        InventoryManager.addItem('fixture_carrot', 10);
        const kitchen = place(10, 'fixture_kitchen');
        pickRecipe(kitchen, 'pooled_stew');
        place(11, 'fixture_context_a');
        Placement.plantFlagAt('hero_1', C(10));
        expect(runUntil(() => kitchen.cycleElapsedMs > 3000, 10000)).toBe(true);
        Flags.setRule('hero_1', DEMOLITION_SKILL_ID, { allowed: false });

        Demolition.mark(kitchen.id);
        expect(kitchen.cycleElapsedMs).toBe(0);
        run(30000);
        expect(events.cycles.filter(c => c.instanceId === kitchen.id)).toEqual([]);
        expect(SpriteLayer.countOnBoard('fixture_leek_potato_stew')).toBe(0);
        expect(kitchen.selectedRecipeId).toBe('pooled_stew');
        expect(on(kitchen)).toBe(kitchen);
    });

    it('the hero working a station carries on as its demolisher', () => {
        InventoryManager.addItem('fixture_carrot', 10);
        const kitchen = place(10, 'fixture_kitchen');
        pickRecipe(kitchen, 'pooled_stew');
        place(11, 'fixture_context_a');
        Placement.plantFlagAt('hero_1', C(10));
        expect(runUntil(() => kitchen.cycleElapsedMs > 3000, 10000)).toBe(true);

        Demolition.mark(kitchen.id);
        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBe(kitchen.id);
        expect(runUntil(() => !on(kitchen), Demolition.DEMOLISH_MS + 1000)).toBe(true);
        expect(SpriteLayer.countOnBoard('fixture_leek_potato_stew')).toBe(0);
    });

    it('a marked spawner stops spawning, and starts again once unmarked', () => {
        const forest = place(10, 'demo_forest');
        Demolition.mark(forest.id);
        run(30000);
        expect(BoardState.tokens().filter(t => t.typeId === 'demo_sapling')).toEqual([]);

        Demolition.unmark(forest.id);
        run(5100);
        expect(BoardState.tokens().filter(t => t.typeId === 'demo_sapling')).toHaveLength(1);
    });

    it('a marked spawner drops its waiting alert', () => {
        const forest = place(10, 'demo_hungry_forest');
        TimedChanges.tick(100);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toMatchObject({ alert: ALERT.SPAWN_NEEDS_ITEM });
        Demolition.mark(forest.id);
        TimedChanges.tick(100);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
        expect(events.spawnerAlerts.at(-1)).toEqual({ instanceId: forest.id, alert: null, needs: [] });
    });

    it('a marked Sapling does not grow, and grows on from where it was once unmarked', () => {
        const sapling = place(10, 'demo_sapling');
        run(5000);
        Demolition.mark(sapling.id);
        run(40000);
        expect(on(sapling)).toBe(sapling);
        expect(sapling.clocks.growMs).toBe(5000);

        Demolition.unmark(sapling.id);
        run(15100);
        expect(on(sapling)).toBeNull();
        expect(BoardState.tokensAtPoint(C(10).x, C(10).y)[0]?.typeId).toBe('demo_tree');
    });
});

describe('a resting Token', () => {
    it('can still be demolished: no refill, no respawn, no depletion', () => {
        const vein = place(10, 'demo_vein');
        Charges.applyDelta(vein, -3);
        expect(Respawn.isResting(vein)).toBe(true);
        expect(WorkCheck.fixableReason(vein.id, vein).reason).toBe(ALERT.RESTING);

        Demolition.mark(vein.id);
        expect(WorkCheck.fixableReason(vein.id, vein).reason).toBeNull();
        expect(WorkCheck.whyCannotRun(vein.id, vein, 'hero_1', StationRecipe.workConfigOf(getTokenType('demo_vein'), vein))).toBeNull();

        Placement.plantFlagAt('hero_1', C(10));
        expect(claimOf('hero_1')).toBe(vein.id);
        run(Demolition.DEMOLISH_MS / 2);
        expect(claimOf('hero_1')).toBe(vein.id);
        expect(runUntil(() => !on(vein), Demolition.DEMOLISH_MS)).toBe(true);
        expect(events.respawned).toEqual([]);
        expect(events.depleted).toEqual([]);
        expect(events.demolished.map(d => d.instanceId)).toEqual([vein.id]);
    });

    it('unmarked, it rests on and refills', () => {
        const vein = place(10, 'demo_vein');
        Charges.applyDelta(vein, -3);
        Demolition.mark(vein.id);
        run(20000);
        expect(vein.usesRemaining).toBe(0);
        Demolition.unmark(vein.id);
        run(12100);
        expect(vein.usesRemaining).toBe(3);
    });
});

describe('save and load', () => {
    it('a marked Token keeps its mark and its progress, and finishes on time', () => {
        const tree = place(10, 'demo_tree');
        Demolition.mark(tree.id);
        Placement.plantFlagAt('hero_1', C(10));
        run(Demolition.DEMOLISH_MS / 2);
        const progress = tree.cycleElapsedMs;
        expect(progress).toBeGreaterThan(0);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED);
        const loaded = BoardState.getTokenById(tree.id);
        expect(loaded).not.toBe(tree);
        expect(Demolition.isMarked(loaded)).toBe(true);
        expect(loaded.cycleElapsedMs).toBe(progress);

        run(Demolition.DEMOLISH_MS - progress - 300);
        expect(BoardState.getTokenById(tree.id)).toBe(loaded);
        run(400);
        expect(BoardState.getTokenById(tree.id)).toBeNull();
        expect(events.demolished.map(d => d.instanceId)).toEqual([tree.id]);
    });
});

describe('the console', () => {
    it('exposes Demolition on the engine', async () => {
        const { EngineBootstrap } = await import('../systems/core/EngineBootstrap.js');
        expect(EngineBootstrap.getEngine().Demolition).toBe(Demolition);
    });
});

describe('FlagRules still know Construction as a rule every hero holds', () => {
    it('so the rules panel can switch demolition off per hero', () => {
        expect(FlagRules.holdsRule('hero_1', DEMOLITION_SKILL_ID)).toBe(true);
    });
});
