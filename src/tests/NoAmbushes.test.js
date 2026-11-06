import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { MAT_TUNABLES, setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => [])
}));

/**
 * ⭐ **No ambushes: combat is always started by the player.** A camp's enemies never attack the
 * heroes working beside it, whatever an old `enemy.hostile` field in the content says; a hero
 * fights only an enemy they were sent at, and nothing pulls them off their job.
 */

const DAY = 24 * 60 * 60 * 1000;

registerTokenTypes({
    fixture_na_camp: {
        id: 'fixture_na_camp', name: 'Fixture NA Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_na_goblin', weight: 1 }], allowance: 4, intervalMs: DAY, upkeep: [] }
    },
    /** One kill and gone, the Goblin's shape, still carrying the old hostile mark the game ignores. */
    fixture_na_goblin: {
        id: 'fixture_na_goblin', name: 'Fixture NA Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const CAMP = { x: 800, y: 500 };

/** A hero who holds a combat skill (and, at level 50, forestry for the Producer). */
function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** A camp and two goblins it spawned, standing beside it. */
function campWithGoblins() {
    const camp = placeAt('fixture_na_camp', CAMP.x, CAMP.y);
    const goblins = [placeAt('fixture_na_goblin', CAMP.x + 100, CAMP.y), placeAt('fixture_na_goblin', CAMP.x, CAMP.y - 100)];
    for (const g of goblins) g.tether = camp.id;
    return { camp, goblins };
}

/** `heroId` ordered onto a Producer at `point`, working it. */
function working(heroId, point) {
    const producer = placeAt('fixture_producer', point.x, point.y);
    expect(Flags.orderToken(heroId, producer).success).toBe(true);
    expect(BoardState.workTokenOf(heroId)).toBe(producer.id);
    return producer;
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [fighter('h1'), fighter('h2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('⭐ a hero working beside a goblin camp is never attacked', () => {
    it('five minutes of work right beside the camp: no fight, the job kept, the goblins where they stood', () => {
        const { goblins } = campWithGoblins();
        const stood = goblins.map(g => ({ x: g.x, y: g.y }));
        const job = working('h1', { x: CAMP.x, y: CAMP.y + 160 });
        const engaged = [];
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engaged.push(p));
        try {
            run(5 * 60 * 1000);
        } finally {
            off();
        }
        expect(engaged).toHaveLength(0);
        expect(BoardState.workTokenOf('h1')).toBe(job.id);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
        expect(goblins.map(g => ({ x: g.x, y: g.y }))).toEqual(stood);
    });

    it('the same through catch-up steps of a second', () => {
        campWithGoblins();
        const job = working('h1', { x: CAMP.x + 160, y: CAMP.y + 160 });
        let engaged = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, () => engaged++);
        try {
            run(10 * 60 * 1000, 1000);
        } finally {
            off();
        }
        expect(engaged).toBe(0);
        expect(BoardState.workTokenOf('h1')).toBe(job.id);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
    });
});

describe('⭐ a hero fights only the enemy they are sent at', () => {
    it('one hero sent at a goblin fights it; the one working beside the camp is left alone', () => {
        const { goblins } = campWithGoblins();
        const job = working('h2', { x: CAMP.x, y: CAMP.y + 160 });
        Flags.orderToken('h1', goblins[0]);
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(goblins[0].id);
        for (let i = 0; i < 600 && BoardState.getTokenById(goblins[0].id); i++) run(100);
        expect(BoardState.getTokenById(goblins[0].id)).toBeNull();
        expect(BoardState.workTokenOf('h2')).toBe(job.id);
        expect(BoardCombat.fightOfHero('h2')).toBeNull();
    });
});

describe('what went with the ambushes', () => {
    it('no Camp watch on the Mat Tuner, no ambush event, nothing in Flags to start one', () => {
        expect(MAT_TUNABLES.find(t => t.key === 'watchRadius')).toBeUndefined();
        expect(BOARD_EVENTS.AMBUSHED).toBeUndefined();
        expect(Flags.ambush).toBeUndefined();
        expect(Flags.ambusherOf).toBeUndefined();
    });
});
