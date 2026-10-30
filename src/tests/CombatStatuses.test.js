import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as Flags from '../systems/board/Flags.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { statusBlockOf } from '../systems/effects/effectLibrary.js';
import { getEffect } from '../config/registries/effectRegistry.js';
import { registerStatusFixtures, POISON, BURN } from './fixtures/statusEffects.js';

/**
 * Poison and Burn as Rules-system statuses (brief 220, C4): library effects carrying a `status`
 * block. Poison stacks to 3 and deals 1 a stack a tick until the fight ends; Burn does not stack,
 * deals 1 a tick for 3 ticks, and halves what food heals; a tick is 3 s; every status ends with its
 * fight and lands only on a fighter.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerTokenTypes({
    st_enemy: {
        id: 'st_enemy', name: 'Status Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50,
        sprite: 's_occult',
        enemy: { level: 1, style: 'magic', hp: 500 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const AT = { x: 400, y: 300 };

function reset() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    // Furls a knocked-out hero's flag, as in the game.
    Flags.init();
    registerStatusFixtures();
    LiveEffects.resetClock();
}

function makeHero(id = 'st_hero') {
    const h = generateHero({ name: 'Bram' });
    h.id = id;
    h.status = 'idle';
    h.skills.melee = { level: 99, xp: 0 };
    h.hp = { current: 109, max: 109 };
    GameState.state.heroes.push(h);
    return h;
}

/** A hero planted on a 500 HP dummy, walked there and fighting. */
function startFight() {
    const hero = makeHero();
    const enemy = BoardState.createTokenInstance('st_enemy', tokenStartingUses('st_enemy'));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    for (let t = 0; t < 20000 && !BoardCombat.fightOfHero(hero.id); t += 100) BoardRunner.tick(100);
    expect(BoardCombat.fightOfHero(hero.id), 'the hero reached the enemy').toBeTruthy();
    return { hero, enemy, fight: BoardCombat.fightOfHero(hero.id) };
}

/** One Rules tick, nothing else. */
const tick = () => LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
const land = (heroId, effectId) => LiveEffects.applyToHero(heroId, { effectId });

beforeEach(() => {
    reset();
    // Every swing hits and none crits, so the numbers below are exact.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('a status is a library effect with a status block', () => {
    it('reads the block: stacks 1–5, ticks 0 (the whole fight) or more', () => {
        expect(statusBlockOf(getEffect(POISON))).toEqual({ stacks: 3, ticks: 0 });
        expect(statusBlockOf(getEffect(BURN))).toEqual({ stacks: 1, ticks: 3 });
        expect(statusBlockOf({ status: { stacks: 9, ticks: -2 } })).toEqual({ stacks: 5, ticks: 0 });
        expect(statusBlockOf({ status: {} })).toEqual({ stacks: 1, ticks: 0 });
        expect(statusBlockOf({ name: 'Valor' })).toBeNull();
    });

    it('ticks every 3 seconds, the one Rules tick', () => {
        expect(STATUS_TICK_INTERVAL_MS).toBe(3000);
    });
});

describe('Poison: stacks to 3, 1 a stack a tick, until the fight ends', () => {
    it('each landing adds a stack, never past 3', () => {
        const { hero } = startFight();
        for (let i = 0; i < 5; i++) expect(land(hero.id, POISON)).toBe(true);
        expect(LiveEffects.statusesOf(hero)).toEqual([{ effectId: POISON, stacks: 3, ticksLeft: null }]);
    });

    it('deals 1 per stack per tick, ignoring armour, and nothing between ticks', () => {
        const { hero } = startFight();
        hero.aggregator.addModifier({ type: EFFECT_TYPES.ARMOR, value: 5, bucket: 'flat', source: 'test' });
        land(hero.id, POISON);
        land(hero.id, POISON);
        const before = hero.hp.current;
        LiveEffects.tick(STATUS_TICK_INTERVAL_MS - 1, TriggerSystem.fireLiveStatement);
        expect(hero.hp.current).toBe(before);
        LiveEffects.tick(1, TriggerSystem.fireLiveStatement);
        expect(hero.hp.current).toBe(before - 2);
        land(hero.id, POISON);
        tick();
        expect(hero.hp.current).toBe(before - 2 - 3);
    });

    it('ends with the fight: the hero leaving takes it off, and no tick hurts them after', () => {
        const { hero } = startFight();
        land(hero.id, POISON);
        expect(BoardCombat.endFightOfHero(hero.id)).toBe(true);
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
        const hp = hero.hp.current;
        tick();
        expect(hero.hp.current).toBe(hp);
    });

    it('ends with the fight at the kill too', () => {
        const { hero, fight } = startFight();
        land(hero.id, POISON);
        fight.combat.enemyHp.current = 1;
        for (let t = 0; t < 4000 && LiveEffects.statusesOf(hero).length; t += 100) BoardRunner.tick(100);
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
    });

    it('lands only on a fighter: a hero out of a fight is never poisoned', () => {
        const hero = makeHero('st_idle');
        hero.aggregator = hero.aggregator || null;
        expect(land(hero.id, POISON)).toBe(false);
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
    });

    it('works on the enemy the same way: its own stacks, its own ticks', () => {
        const { fight, enemy } = startFight();
        const bearer = BoardCombat.enemyBearerOfToken(enemy.id);
        for (let i = 0; i < 4; i++) LiveEffects.applyTo(bearer, { effectId: POISON });
        expect(LiveEffects.statusesOf(fight)).toEqual([{ effectId: POISON, stacks: 3, ticksLeft: null }]);
        const hp = fight.combat.enemyHp.current;
        tick();
        expect(fight.combat.enemyHp.current).toBe(hp - 3);
    });
});

describe('Burn: no stacks, 1 a tick for 3 ticks, food heals half', () => {
    it('does not stack; it lasts 3 ticks and landing again renews it', () => {
        const { hero } = startFight();
        land(hero.id, BURN);
        land(hero.id, BURN);
        expect(LiveEffects.statusesOf(hero)).toEqual([{ effectId: BURN, stacks: 1, ticksLeft: 3 }]);
        const hp = hero.hp.current;
        tick();
        expect(hero.hp.current).toBe(hp - 1);
        expect(LiveEffects.statusesOf(hero)[0].ticksLeft).toBe(2);
        land(hero.id, BURN);
        expect(LiveEffects.statusesOf(hero)[0].ticksLeft).toBe(3);
        tick(); tick(); tick();
        expect(hero.hp.current).toBe(hp - 4);
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
        tick();
        expect(hero.hp.current).toBe(hp - 4);
    });

    it('halves what a meal heals in a fight, rounded halves up (Shrimp 5 heals 3)', () => {
        const { hero } = startFight();
        InventoryManager.addItem('item_shrimp', 5);
        expect(EquipmentManager.equipItem(hero.id, 'item_shrimp').success).toBe(true);

        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat(hero.id, { inFight: true })).toEqual([{ itemId: 'item_shrimp', amount: 5 }]);
        expect(hero.hp.current).toBe(15);

        land(hero.id, BURN);
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat(hero.id, { inFight: true })).toEqual([{ itemId: 'item_shrimp', amount: 3 }]);
        expect(hero.hp.current).toBe(13);

        // Once it burns out, food heals whole again.
        tick(); tick(); tick();
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat(hero.id, { inFight: true })).toEqual([{ itemId: 'item_shrimp', amount: 5 }]);
    });
});

describe('what a hero carries moves a status (a Hide Vest, an immunity)', () => {
    it('Status Stack Limit -1 on Poison: it stacks at most 2', () => {
        const { hero } = startFight();
        hero.aggregator.addModifier({ type: EFFECT_TYPES.STATUS_MAX_STACKS, value: -1, bucket: 'flat', source: 'vest', target: { category: POISON } });
        for (let i = 0; i < 4; i++) land(hero.id, POISON);
        expect(LiveEffects.statusesOf(hero)[0].stacks).toBe(2);
    });

    it('a cap moved to 0 keeps it off, said as blocked; so does an immunity', () => {
        const { hero } = startFight();
        const blocked = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.STATUS_BLOCKED, (p) => blocked.push(p.statusId));
        hero.aggregator.addModifier({ type: EFFECT_TYPES.STATUS_MAX_STACKS, value: -1, bucket: 'flat', source: 'vest', target: { category: BURN } });
        hero.aggregator.addModifier({ type: EFFECT_TYPES.STATUS_IMMUNITY, value: 1, bucket: 'flat', source: 'charm', target: { category: POISON } });
        expect(land(hero.id, BURN)).toBe(false);
        expect(land(hero.id, POISON)).toBe(false);
        off();
        expect(blocked).toEqual([BURN, POISON]);
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
    });

    it('never strips stacks already carried when the cap drops mid-fight', () => {
        const { hero } = startFight();
        for (let i = 0; i < 3; i++) land(hero.id, POISON);
        hero.aggregator.addModifier({ type: EFFECT_TYPES.STATUS_MAX_STACKS, value: -2, bucket: 'flat', source: 'vest', target: { category: POISON } });
        land(hero.id, POISON);
        expect(LiveEffects.statusesOf(hero)[0].stacks).toBe(3);
    });
});

describe('a status that finishes a fighter goes through the one way of finishing them', () => {
    it('a tick that knocks the hero out is one defeat: one banner, carried off, the fight over, the statuses gone', () => {
        const { hero, enemy } = startFight();
        const defeats = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeats.push(p.heroId));
        for (let i = 0; i < 3; i++) land(hero.id, POISON);
        hero.hp.current = 2;
        tick();
        // The clock ticking again, and the board running on, roll nothing twice.
        tick();
        for (let t = 0; t < 2000; t += 100) BoardRunner.tick(100);
        off();
        expect(defeats).toEqual([hero.id]);
        expect(hero.status).toBe('wounded');
        expect(hero.hp.current).toBe(0);
        // Their flag comes down with them, and the enemy is free for someone else.
        expect(BoardState.flagOf(hero.id)).toBeNull();
        expect(BoardState.workerOf(enemy.id)).toBeNull();
        expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
        expect(LiveEffects.statusesOf(hero)).toEqual([]);
    });

    it('a tick that finishes the enemy is a kill, before the dead creature swings again', () => {
        const { hero, enemy, fight } = startFight();
        const kills = [];
        const swings = [];
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => kills.push(1)),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => swings.push(1))
        ];
        LiveEffects.applyTo(BoardCombat.enemyBearerOfToken(enemy.id), { effectId: POISON });
        fight.combat.enemyHp.current = 1;
        fight.combat.enemyTickProgress = 2950;   // its swing is due on the next board tick
        tick();
        expect(fight.combat.enemyHp.current).toBe(0);
        BoardRunner.tick(100);
        offs.forEach(off => off());
        expect(kills).toEqual([1]);
        expect(swings).toEqual([]);
        expect(hero.status).not.toBe('wounded');
    });
});

describe('an older save', () => {
    it('drops the old status engine\'s statuses on load (they outlasted their fight)', () => {
        const hero = generateHero({ name: 'Old' });
        hero.statuses = [{ id: 'poison', stacks: 2, remaining: 3 }, { id: 'well_fed', stacks: 1 }];
        rehydrateHero(hero);
        expect(hero.statuses).toEqual([]);
    });
});
