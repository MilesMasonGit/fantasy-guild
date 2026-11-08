import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { slotsOf, costSlots, SLOT_KIND } from '../../cms/src/engine/ledger/statementSlots.js';
import { renderStatement, renderSegments } from '../systems/effects/statementText.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
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
 * A Token's `Spawns` rule with a chance. The roll comes before the rule fires, so a miss is no
 * firing at all; a rule-fired spawn waits while the mat is at its Token cap. A rule never spawns an
 * enemy: no Token ambushes the hero working it, and nothing pulls a hero off their job.
 */

registerTokenTypes({
    /** One kill and gone: the Goblin's shape. */
    fixture_ambusher: {
        id: 'fixture_ambusher', name: 'Fixture Ambusher', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** Not an enemy: what the rules here spawn. */
    fixture_pebble: {
        id: 'fixture_pebble', name: 'Fixture Pebble', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
    }
});

let nodeCount = 0;

/**
 * A node a hero gathers from (1 s cycles), carrying one `Spawns` rule on its own cycle.
 *
 * @returns {{ typeId: string, statementId: string }}
 */
function spawnNode(payload, { cooldownMs = 0, uses = 50, chargeDelta } = {}) {
    nodeCount += 1;
    const typeId = `fixture_spawn_node_${nodeCount}`;
    const statementId = `stm_spawn_${nodeCount}`;
    const statement = {
        ...makeStatement(KEYWORD.SPAWNS),
        id: statementId,
        payload: { typeId: 'fixture_pebble', placement: PLACEMENT.NEAREST_FREE, ...payload },
        when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs }
    };
    if (chargeDelta !== undefined) statement.chargeDelta = chargeDelta;
    registerTokenTypes({
        [typeId]: {
            id: typeId, name: 'Fixture Spawn Node', tokenType: 'resource', rarity: 'common',
            theme: 'fixture', uses, sprite: 's_nature',
            config: {
                skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            statements: [statement]
        }
    });
    return { typeId, statementId };
}

const NODE = { x: 800, y: 500 };

/** A hero who holds a combat skill (and forestry, for the node). */
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

/** The node finishing one cycle, as `BoardRunner` announces it. */
function cycle(node, heroId = null) {
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        instanceId: node.id, typeId: node.typeId, heroId, failed: false, produced: []
    });
}

const spawnedOn = (typeId = 'fixture_pebble') => BoardState.tokens().filter(t => t.typeId === typeId);

/** A seeded generator (mulberry32), the bench's own. */
function seeded(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
    TriggerSystem.init();
    GameState.state.heroes = [fighter('h1'), fighter('h2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    vi.restoreAllMocks();
    TriggerSystem.teardown();
});

// ---------------------------------------------------------------------------

describe('the chance is authored on the Spawns rule', () => {
    it('a new Spawns rule is born always firing, written out as 100', () => {
        expect(makeStatement(KEYWORD.SPAWNS).payload).toEqual({ typeId: '', placement: 'here', chance: 100 });
    });

    it('the editor has a chance slot, 1 to 100, optional', () => {
        const st = { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'fixture_ambusher', placement: 'nearest_free', chance: 5 } };
        const slot = slotsOf(st).find(s => s.id === 'chance');
        expect(slot).toMatchObject({ kind: SLOT_KIND.NUMBER, value: 5, min: 1, max: 100, optional: true });
        expect(slot.patch('12').payload).toEqual({ typeId: 'fixture_ambusher', placement: 'nearest_free', chance: 12 });
        expect(slot.patch('0').payload.chance).toBe(1);
        expect(slot.patch('250').payload.chance).toBe(100);
        expect(slot.patch('soon').payload.chance).toBe(100);
        // An unauthored chance reads as always.
        expect(slotsOf({ ...st, payload: { typeId: 'x' } }).find(s => s.id === 'chance').value).toBe(100);
    });

    it('reads "a 5% chance to spawn …", with the number and the verb clickable', () => {
        const names = { token: () => 'Goblin' };
        const st = { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'g', placement: 'nearest_free', chance: 5 } };
        expect(renderStatement(st, names)).toBe('On Cycle: a 5% chance to spawn Goblin on the nearest free spot.');
        const segs = renderSegments(st, names);
        expect(segs.find(s => s.slot === 'chance')?.text).toBe('5%');
        expect(segs.find(s => s.slot === 'keyword')?.text).toBe('spawn');
        // Without a moment the sentence starts with the capital.
        expect(renderStatement({ ...st, when: null }, names)).toBe('A 5% chance to spawn Goblin on the nearest free spot.');
    });

    it('says nothing about chance when it always fires', () => {
        const names = { token: () => 'Goblin' };
        for (const chance of [100, undefined]) {
            const st = { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'g', placement: 'nearest_free', chance } };
            expect(renderStatement(st, names)).toBe('On Cycle: spawns Goblin on the nearest free spot.');
        }
    });

    it('the cost strip says a missed roll spends nothing', () => {
        const st = { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'g', placement: 'nearest_free', chance: 5 } };
        expect(costSlots(st).find(s => s.id === 'charge').hint).toContain('A missed roll is not a firing');
        const always = { ...makeStatement(KEYWORD.SPAWNS), payload: { typeId: 'g', placement: 'nearest_free' } };
        expect(costSlots(always).find(s => s.id === 'charge').hint).not.toContain('missed roll');
    });
});

describe('⭐ the roll comes before the rule fires', () => {
    it('a miss neither spawns, costs a charge, nor starts the cooldown', () => {
        const { typeId, statementId } = spawnNode({ chance: 50 }, { cooldownMs: 60000 });
        const node = placeAt(typeId, NODE.x, NODE.y);
        const before = node.usesRemaining;

        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        cycle(node);

        expect(spawnedOn()).toHaveLength(0);
        expect(node.usesRemaining).toBe(before);
        expect(node.blockCooldowns?.[statementId] ?? 0).toBe(0);

        // The very next cycle may fire: nothing put it on cooldown.
        Math.random.mockReturnValue(0);
        cycle(node);
        expect(spawnedOn()).toHaveLength(1);
        expect(node.usesRemaining).toBe(before - 1);
        expect(node.blockCooldowns[statementId]).toBe(60000);
    });

    it('a hit fires as any rule does: one charge by default, and the cooldown starts', () => {
        const { typeId, statementId } = spawnNode({ chance: 50 }, { cooldownMs: 5000 });
        const node = placeAt(typeId, NODE.x, NODE.y);
        vi.spyOn(Math, 'random').mockReturnValue(0.2);
        cycle(node);
        expect(spawnedOn()).toHaveLength(1);
        expect(node.usesRemaining).toBe(49);
        expect(node.blockCooldowns[statementId]).toBe(5000);
        // On cooldown: no roll, no firing.
        Math.random.mockClear();
        cycle(node);
        expect(Math.random).not.toHaveBeenCalled();
        expect(spawnedOn()).toHaveLength(1);
    });

    it('an authored free rule stays free on a hit', () => {
        const { typeId } = spawnNode({ chance: 50 }, { chargeDelta: 0 });
        const node = placeAt(typeId, NODE.x, NODE.y);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        cycle(node);
        expect(spawnedOn()).toHaveLength(1);
        expect(node.usesRemaining).toBe(50);
    });

    it('a node that cannot pay the rule does not roll', () => {
        const { typeId } = spawnNode({ chance: 50 }, { uses: 1, chargeDelta: -2 });
        const node = placeAt(typeId, NODE.x, NODE.y);
        const random = vi.spyOn(Math, 'random');
        cycle(node);
        expect(random).not.toHaveBeenCalled();
        expect(spawnedOn()).toHaveLength(0);
    });
});

describe('⭐ a Spawns rule with no chance draws no random number', () => {
    /** Draws made by one firing of a fresh node's rule. */
    function drawsFor(payload, roll = 0) {
        clearMat();
        const { typeId } = spawnNode(payload);
        const node = placeAt(typeId, NODE.x, NODE.y);
        const random = vi.spyOn(Math, 'random').mockReturnValue(roll);
        cycle(node);
        const draws = random.mock.calls.length;
        random.mockRestore();
        return { draws, spawned: spawnedOn().length };
    }

    /** Draws the spawn itself makes, with no rule around it (a new Token's id). */
    function spawnOnlyDraws() {
        clearMat();
        const { typeId } = spawnNode({});
        const node = placeAt(typeId, NODE.x, NODE.y);
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        EffectActions.spawn({ payload: { typeId: 'fixture_pebble', placement: PLACEMENT.NEAREST_FREE } }, { self: node.id });
        const draws = random.mock.calls.length;
        random.mockRestore();
        return draws;
    }

    it('fires exactly as before: the spawn\'s own draws and nothing else', () => {
        const base = spawnOnlyDraws();
        expect(drawsFor({ chance: undefined })).toEqual({ draws: base, spawned: 1 });
        expect(drawsFor({ chance: 100 })).toEqual({ draws: base, spawned: 1 });
    });

    it('a chance below 100 draws exactly one number, once', () => {
        const base = spawnOnlyDraws();
        expect(drawsFor({ chance: 50 }, 0)).toEqual({ draws: base + 1, spawned: 1 });
        expect(drawsFor({ chance: 50 }, 0.99)).toEqual({ draws: 1, spawned: 0 });
    });
});

describe('⭐ a rule-fired spawn waits while the mat is at its Token cap', () => {
    it('at the cap: no roll, no spawn, no charge, no cooldown; under it again: fires', () => {
        const { typeId, statementId } = spawnNode({ chance: 50 }, { cooldownMs: 5000 });
        const node = placeAt(typeId, NODE.x, NODE.y);
        placeAt('fixture_producer', 200, 200);
        setMatTuning('tokenCap', MatCap.tokenCount());
        expect(MatCap.canPlaceMore(1)).toBe(false);

        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        cycle(node);
        expect(random).not.toHaveBeenCalled();
        expect(spawnedOn()).toHaveLength(0);
        expect(node.usesRemaining).toBe(50);
        expect(node.blockCooldowns?.[statementId] ?? 0).toBe(0);

        setMatTuning('tokenCap', MatCap.tokenCount() + 1);
        cycle(node);
        expect(spawnedOn()).toHaveLength(1);
    });

    it('holds a rule with no chance too', () => {
        const { typeId } = spawnNode({});
        const node = placeAt(typeId, NODE.x, NODE.y);
        setMatTuning('tokenCap', MatCap.tokenCount());
        cycle(node);
        expect(spawnedOn()).toHaveLength(0);
        expect(node.usesRemaining).toBe(50);
    });

    it('a spawn that takes its bearer\'s place adds nothing, so it is not held', () => {
        const { typeId } = spawnNode({ typeId: 'fixture_pebble', placement: PLACEMENT.HERE });
        const node = placeAt(typeId, NODE.x, NODE.y);
        setMatTuning('tokenCap', MatCap.tokenCount());
        cycle(node);
        expect(BoardState.getTokenById(node.id)).toBeNull();
        expect(spawnedOn('fixture_pebble')).toHaveLength(1);
        expect(MatCap.tokenCount()).toBe(1);
    });

    it('⚠️ EffectActions.spawn itself never asks the cap (the bench\'s push storm relies on it)', () => {
        const node = placeAt('fixture_pebble', NODE.x, NODE.y);
        setMatTuning('tokenCap', MatCap.tokenCount());
        const landed = EffectActions.spawn(
            { payload: { typeId: 'fixture_pebble', placement: PLACEMENT.NEAREST_FREE } }, { self: node.id }
        );
        expect(landed).not.toBeNull();
        expect(MatCap.tokenCount()).toBe(2);
    });
});

describe('⭐ no rule spawns an enemy: no Token ambushes the hero working it', () => {
    it('a rule naming an enemy never fires: no roll, no spawn, no charge, no cooldown', () => {
        for (const chance of [undefined, 100, 50]) {
            clearMat();
            const { typeId, statementId } = spawnNode({ typeId: 'fixture_ambusher', chance }, { cooldownMs: 5000 });
            const node = placeAt(typeId, NODE.x, NODE.y);
            const random = vi.spyOn(Math, 'random').mockReturnValue(0);
            cycle(node, 'h1');
            expect(random).not.toHaveBeenCalled();
            random.mockRestore();
            expect(spawnedOn('fixture_ambusher')).toHaveLength(0);
            expect(node.usesRemaining).toBe(50);
            expect(node.blockCooldowns?.[statementId] ?? 0).toBe(0);
        }
    });

    it('a boss is refused the same way', () => {
        registerTokenTypes({
            fixture_rule_boss: {
                id: 'fixture_rule_boss', name: 'Fixture Rule Boss', tokenType: 'enemy', rarity: 'rare', theme: 'fixture',
                uses: 1, sprite: 's_occult', enemy: { level: 1, style: 'melee', boss: true },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const { typeId } = spawnNode({ typeId: 'fixture_rule_boss' });
        cycle(placeAt(typeId, NODE.x, NODE.y), 'h1');
        expect(spawnedOn('fixture_rule_boss')).toHaveLength(0);
    });

    it('the hero working such a node works on, live and through catch-up steps, and never fights', () => {
        const { typeId } = spawnNode({ typeId: 'fixture_ambusher', chance: 50 }, { uses: null });
        const node = placeAt(typeId, NODE.x, NODE.y);
        Orders.orderAt('h1', NODE);
        const engaged = [];
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engaged.push(p));
        vi.spyOn(Math, 'random').mockImplementation(seeded(7));
        try {
            run(30000);             // live, 100 ms a tick
            run(60000, 1000);       // one second a step, as the catch-up plays time away
        } finally {
            off();
        }
        expect(engaged).toHaveLength(0);
        expect(spawnedOn('fixture_ambusher')).toHaveLength(0);
        expect(BoardState.workTokenOf('h1')).toBe(node.id);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
    });

    it('a spawned Token that is not an enemy gets no tether', () => {
        const { typeId } = spawnNode({});
        cycle(placeAt(typeId, NODE.x, NODE.y), 'h1');
        expect('tether' in spawnedOn()[0]).toBe(false);
    });

    it('the editor offers no enemy to a Spawns rule', () => {
        const tokens = {
            imp: { id: 'imp', name: 'Imp', enemy: { level: 1 } },
            boss: { id: 'boss', name: 'Boss', enemy: { level: 1, boss: true } },
            rock: { id: 'rock', name: 'Rock' }
        };
        const slot = slotsOf(makeStatement(KEYWORD.SPAWNS), { tokens }).find((s) => s.id === 'typeId');
        expect(slot.options.map((o) => o.id)).toEqual(['rock']);
    });
});

describe('⭐ with a seeded roll, a 5% rule fires about 5% of cycles', () => {
    it('worked for 2000 one-second cycles at the catch-up step', () => {
        const { typeId } = spawnNode({ typeId: 'fixture_pebble', chance: 5 }, { uses: null });
        const node = placeAt(typeId, NODE.x, NODE.y);
        Orders.orderAt('h1', NODE);
        let cycles = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === node.id) cycles++; });
        let spawned = 0;
        vi.spyOn(Math, 'random').mockImplementation(seeded(70));
        try {
            while (cycles < 2000) {
                BoardRunner.tick(1000);
                for (const pebble of spawnedOn('fixture_pebble')) {
                    spawned++;
                    BoardState.removeToken(pebble.id);
                }
            }
        } finally {
            off();
        }
        // 2000 × 5% = 100; the seed is fixed, the band is ±3 standard deviations.
        expect(spawned).toBeGreaterThanOrEqual(70);
        expect(spawned).toBeLessThanOrEqual(130);
    });
});
