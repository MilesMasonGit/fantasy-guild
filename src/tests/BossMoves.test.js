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
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { renderStatement, rulesLinesOf } from '../systems/effects/statementText.js';
import { slotsOf, costSlots } from '../systems/effects/statementSlots.js';
import { registerStatusFixtures, providesPct, providesFlat, BURN, POISON } from './fixtures/statusEffects.js';

/**
 * Boss moves as Rules effects (brief 220, C4): two new moments a fighter's own rules wait on, "On
 * Every Nth Swing" (and its sibling "On Hit") and "On Health Below X%" (once a fight), and the
 * first moves built from ordinary verbs: a heavy strike, a status attack, a heal or +2 armour, an
 * enrage. Any enemy can carry them; a hero's items can too.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerEffects({
    bm_heavy: { id: 'bm_heavy', name: 'Heavy Strike', statements: [providesPct('stm_bm_heavy', EFFECT_TYPES.DAMAGE, 1)] },
    bm_stone_skin: { id: 'bm_stone_skin', name: 'Stone Skin', statements: [providesFlat('stm_bm_skin', EFFECT_TYPES.ARMOR, 2)] },
    bm_enrage: { id: 'bm_enrage', name: 'Enrage', statements: [providesPct('stm_bm_enrage', EFFECT_TYPES.SWING_TIME, -0.5)] }
});

/** A rule on a fight moment, as the CMS writes one. */
const rule = (id, keyword, when, target, payload) => ({
    ...makeStatement(keyword), id, when: { scope: 'self', ...when }, target, payload
});

const HEAVY = rule('stm_heavy', KEYWORD.APPLIES, { event: 'FIGHT_SWING', every: 4 }, { role: ROLE.OPPONENT },
    { effectId: 'bm_heavy', scale: 1, forSwing: true, chance: 100 });
const BURN_ATTACK = rule('stm_burn_attack', KEYWORD.APPLIES, { event: 'FIGHT_HIT', every: 3 }, { role: ROLE.ACTOR },
    { effectId: BURN, scale: 1, chance: 100 });
const HEAL = rule('stm_heal', KEYWORD.HEALS, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, { role: ROLE.SELF }, { amount: 10 });
const SKIN = rule('stm_skin', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 50 }, { role: ROLE.OPPONENT },
    { effectId: 'bm_stone_skin', scale: 1, forFight: true, chance: 100 });
const ENRAGE = rule('stm_enrage', KEYWORD.APPLIES, { event: 'FIGHT_HP_BELOW', belowPct: 30 }, { role: ROLE.OPPONENT },
    { effectId: 'bm_enrage', scale: 1, forFight: true, chance: 100 });
const CRUSH = rule('stm_crush', KEYWORD.DEALS, { event: 'FIGHT_SWING', every: 2 }, { role: ROLE.ACTOR }, { amount: 500, ignoresArmor: true });

const enemyType = (id, statements, enemy = {}) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
    enemy: { level: 1, style: 'magic', hp: 500, hit: 2, ...enemy },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
    statements
});

registerTokenTypes({
    bm_heavy_boss: enemyType('bm_heavy_boss', [HEAVY]),
    bm_burner: enemyType('bm_burner', [BURN_ATTACK]),
    bm_healer: enemyType('bm_healer', [HEAL, SKIN, ENRAGE], { hp: 40 }),
    bm_crusher: enemyType('bm_crusher', [CRUSH]),
    bm_dummy: enemyType('bm_dummy', [])
});

registerEffects({
    bm_fire_edge: {
        id: 'bm_fire_edge', name: 'Fire Edge',
        statements: [rule('stm_fire_edge', KEYWORD.APPLIES, { event: 'FIGHT_HIT' }, { role: ROLE.OPPONENT }, { effectId: BURN, chance: 100 })]
    }
});
registerItems({
    bm_fire_sword: {
        id: 'bm_fire_sword', name: 'Fire Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2,
        effects: [{ effectId: 'bm_fire_edge', scale: 1 }]
    }
});

const AT = { x: 400, y: 300 };

function startFight(typeId) {
    const hero = generateHero({ name: 'Bram' });
    hero.id = 'bm_hero';
    hero.status = 'idle';
    hero.skills.melee = { level: 99, xp: 0 };
    hero.hp = { current: 109, max: 109 };
    GameState.state.heroes.push(hero);
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return { hero, enemy };
}

/** Run the board and the Rules tick together, as the game loop does, recording the fight. */
function play(ms, seen = { enemyHits: [], enemySwingAt: [], heroHits: [], applied: [], enemyHp: [] }) {
    let t = 0;
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => { seen.enemySwingAt.push(t); if (p.hit) seen.enemyHits.push(p.damage); }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { if (p.hit) { seen.heroHits.push(p.damage); seen.enemyHp.push(p.enemyHpRemaining); } }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => seen.applied.push(`${p.targetType}:${p.statusId}`))
    ];
    for (; t < ms; t += 100) {
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
    }
    offs.forEach(off => off());
    return seen;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    Flags.init();
    registerStatusFixtures();
    LiveEffects.resetClock();
    // Every swing hits and none crits, so the numbers below are exact.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('On Every Nth Swing: a heavy strike', () => {
    it('every 4th swing hits double, and only that swing', () => {
        startFight('bm_heavy_boss');
        const seen = play(40000);
        expect(seen.enemyHits.slice(0, 9)).toEqual([2, 2, 2, 4, 2, 2, 2, 4, 2]);
    });

    it('"for the swing" comes off as the swing ends', () => {
        const { enemy } = startFight('bm_heavy_boss');
        play(14000);
        expect((BoardCombat.getFight(enemy.id)?.effects || []).filter(e => e.forSwing)).toEqual([]);
    });
});

describe('On Hit: a status attack', () => {
    it('every 3rd landed hit burns the hero', () => {
        startFight('bm_burner');
        const seen = play(10500);
        // Hits land at 3, 6 and 9 s of the fight: the third one burns.
        expect(seen.enemyHits.length).toBe(3);
        expect(seen.applied).toEqual([`hero:${BURN}`]);
    });

    it('a hero\'s weapon can do the same to the enemy (a weapon\'s on-hit status)', () => {
        const { hero, enemy } = startFight('bm_dummy');
        InventoryManager.addItem('bm_fire_sword', 1);
        expect(EquipmentManager.equipItem(hero.id, 'bm_fire_sword').success).toBe(true);
        const seen = play(8000);
        expect(seen.applied).toContain(`enemy:${BURN}`);
        expect(LiveEffects.statusesOf(BoardCombat.getFight(enemy.id))).toEqual([{ effectId: BURN, stacks: 1, ticksLeft: expect.any(Number) }]);
    });
});

describe('On Health Below X%: a heal, +2 armour and an enrage, once a fight', () => {
    it('below half it heals itself 10 and gains 2 armour, once; below 30% it enrages, once', () => {
        startFight('bm_healer');
        const seen = play(60000);
        // The hero hits for 5 (1 + 4 for level 99). 40 → 15 crosses half: heal to 25, armour 2.
        expect(seen.enemyHp.slice(0, 5)).toEqual([35, 30, 25, 20, 15]);
        expect(seen.heroHits.slice(5, 7)).toEqual([3, 3]);
        expect(seen.enemyHp.slice(5, 7)).toEqual([22, 19]);
        // Half again (below 20) and no second heal: 25 → 22 → 19 → 16 → 13 → 10 → 7 → 4 → 1 → 0.
        expect(seen.enemyHp.slice(5, 14)).toEqual([22, 19, 16, 13, 10, 7, 4, 1, 0]);
    });

    it('enraged, it swings twice as often', () => {
        startFight('bm_healer');
        const seen = play(60000);
        const gaps = seen.enemySwingAt.slice(1).map((v, i) => v - seen.enemySwingAt[i]);
        expect(gaps).toContain(3000);
        expect(gaps).toContain(1500);
    });

    it('a fresh enemy is a fresh fight: the next one heals again', () => {
        startFight('bm_healer');
        const heals = [];
        const seen = play(120000);
        // Each enemy's HP after the hit that crosses half: 15, then the heal shows as a jump up.
        for (let i = 1; i < seen.enemyHp.length; i++) {
            if (seen.enemyHp[i] > seen.enemyHp[i - 1] && seen.enemyHp[i - 1] !== 0) heals.push(i);
        }
        const kills = seen.enemyHp.filter(hp => hp === 0).length;
        expect(kills).toBeGreaterThanOrEqual(2);
        expect(heals.length).toBeGreaterThanOrEqual(2);
    });
});

describe('a boss move that knocks the hero out', () => {
    it('is one defeat: one banner, one gear roll', () => {
        const { hero } = startFight('bm_crusher');
        const defeats = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeats.push(p.heroId));
        play(12000);
        off();
        expect(defeats).toEqual([hero.id]);
        expect(hero.status).toBe('wounded');
    });

    it('never comes from a boss a status already finished: the kill comes before its next swing', () => {
        const { hero, enemy } = startFight('bm_crusher');
        // Up to its first swing (the crush waits for the second).
        let fight = null;
        for (let t = 0; t < 20000 && !(fight?.combat?.moments?.swings?.enemy >= 1); t += 100) {
            BoardRunner.tick(100);
            fight = BoardCombat.getFight(enemy.id);
        }
        LiveEffects.applyTo(BoardCombat.enemyBearerOfToken(enemy.id), { effectId: POISON });
        fight.combat.enemyHp.current = 1;
        fight.combat.enemyTickProgress = 2950;          // its second swing is due on the next board tick
        fight.combat.heroTickProcesses[hero.id] = 0;    // and the hero's is not
        LiveEffects.tick(3000, TriggerSystem.fireLiveStatement);
        const kills = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => kills.push(1));
        BoardRunner.tick(100);
        off();
        expect(kills).toEqual([1]);
        expect(hero.status).not.toBe('wounded');
        expect(hero.hp.current).toBeGreaterThan(0);
    });
});

describe('the moves read as sentences, and edit as slots', () => {
    const names = { effect: (id) => ({ bm_heavy: 'Heavy Strike', bm_stone_skin: 'Stone Skin', bm_enrage: 'Enrage', [BURN]: 'Burn', [POISON]: 'Poison' })[id] || id };

    it('says each move plainly', () => {
        expect(renderStatement(HEAVY, names)).toBe('On Every 4th Swing: applies Heavy Strike to the enemy for the swing.');
        expect(renderStatement(BURN_ATTACK, names)).toBe('On Every 3rd Hit: applies Burn to the hero.');
        expect(renderStatement(HEAL, names)).toBe('On Health Below 50%: heals 10 health on itself.');
        expect(renderStatement(SKIN, names)).toBe('On Health Below 50%: applies Stone Skin to the enemy for the fight.');
        expect(renderStatement(ENRAGE, names)).toBe('On Health Below 30%: applies Enrage to the enemy for the fight.');
        expect(renderStatement({ ...BURN_ATTACK, when: { event: 'FIGHT_HIT', scope: 'self' } }, names)).toBe('On Hit: applies Burn to the hero.');
    });

    it('a status effect says how it stacks and lasts', () => {
        expect(rulesLinesOf({ status: { stacks: 3, ticks: 0 }, statements: [] })).toEqual(['A status: stacks up to 3, its rules once per stack; lasts until the fight ends.']);
        expect(rulesLinesOf({ status: { stacks: 1, ticks: 3 }, statements: [] })).toEqual(['A status: does not stack (landing again renews it); lasts 3 ticks, never past the fight.']);
    });

    it('a counted moment has its count, a health moment its share; neither a cooldown nor a charge cost', () => {
        const ids = (st) => slotsOf(st, { effects: {} }).map(s => s.id);
        expect(ids(HEAVY)).toContain('every');
        expect(ids(HEAVY)).toContain('forSwing');
        expect(ids(HEAVY)).not.toContain('cooldown');
        expect(ids(HEAL)).toContain('belowPct');
        expect(costSlots(HEAL)).toEqual([]);
        const every = slotsOf(HEAVY, { effects: {} }).find(s => s.id === 'every');
        expect(every.patch(6).when.every).toBe(6);
        const below = slotsOf(HEAL, { effects: {} }).find(s => s.id === 'belowPct');
        expect(below.patch(130).when.belowPct).toBe(99);
    });

    it('"for the swing" is offered only on a fight moment; a status offers no lifetime at all', () => {
        const onCycle = { ...HEAVY, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self' }, payload: { effectId: 'bm_heavy' } };
        expect(slotsOf(onCycle, { effects: {} }).map(s => s.id)).not.toContain('forSwing');
        const effects = { [BURN]: { id: BURN, name: 'Burn', status: { stacks: 1, ticks: 3 } } };
        const ids = slotsOf(BURN_ATTACK, { effects }).map(s => s.id);
        expect(ids).not.toContain('forFight');
        expect(ids).not.toContain('forSwing');
        expect(ids).not.toContain('durationMs');
        // Picking a status clears any lifetime a rule had.
        const pick = slotsOf(HEAVY, { effects }).find(s => s.id === 'effectId').patch(BURN);
        expect(pick.payload).toEqual({ effectId: BURN, scale: 1, chance: 100 });
    });
});
