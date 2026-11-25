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
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { migrateEffectIds } from '../systems/effects/effectIdMigration.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { enemyMovesOf, pickMove, moveLastsFor, moveProblems } from '../config/registries/enemyMoves.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import { registerStatusFixtures, VENOM } from './fixtures/statusEffects.js';

/**
 * Enemy moves (brief 280 V3): an enemy may list a few moves, one made each swing, picked at random
 * by weight; each hits in its own type or lands an effect, or both (owner's chicken: Peck, Stab;
 * Scratch, Slash; Flutter, +50 % Slash, Crush and Stab resistance for one attack). An enemy without
 * moves swings a plain Crush hit and draws exactly what it drew before.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const provides = (id, type, value, category, bucket = 'flat') => ({
    ...makeStatement(KEYWORD.PROVIDES), id, to: null,
    payload: { type, bucket, value, ...(category ? { category } : {}) }
});

/** A Type Resistance row on each of Slash, Crush and Stab: a Physical line, split. */
const physicalRows = (id, value) => ['slash', 'crush', 'stab'].map(t => provides(`${id}_${t}`, EFFECT_TYPES.TYPE_RESIST, value, t));

registerEffects({
    em_flutter: { id: 'em_flutter', name: 'Flutter', statements: physicalRows('stm_em_flutter', 50) },
    em_heavy: { id: 'em_heavy', name: 'Heavy Strike', statements: [provides('stm_em_heavy', EFFECT_TYPES.DAMAGE, 1, null, 'percentage')] },
    em_exposed: { id: 'em_exposed', name: 'Exposed', statements: physicalRows('stm_em_exposed', -50) },
    em_nothing: { id: 'em_nothing', name: 'Nothing', statements: [] },
    em_enrage: { id: 'em_enrage', name: 'Enrage', statements: [provides('stm_em_enrage', EFFECT_TYPES.DAMAGE, 1, null, 'percentage')] },
    // A passive rule's holder: an enemy's rules live in an effect named after it.
    em_alpha_moves: { id: 'em_alpha_moves', name: 'Alpha Moves', statements: [
        { ...makeStatement(KEYWORD.APPLIES), id: 'stm_em_alpha_enrage', chargeDelta: 0, when: { scope: 'self', event: 'FIGHT_HP_BELOW', belowPct: 50 },
            target: { role: 'opponent' }, payload: { effectId: 'em_enrage', forFight: true, chance: 100 } }
    ] }
});

const PECK = { name: 'Peck', damageType: 'stab' };
const SCRATCH = { name: 'Scratch', damageType: 'slash' };
const FLUTTER = { name: 'Flutter', hits: false, effectId: 'em_flutter', target: 'self', lasts: 'attack' };

const enemyType = (id, enemy) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult', requiresHero: true,
    enemy: { level: 1, style: 'melee', hp: 2000, hit: 2, ...enemy },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});
registerTokenTypes({
    em_plain: enemyType('em_plain', {}),
    em_one_move: enemyType('em_one_move', { moves: [{ name: 'Swipe' }] }),
    em_two_plain_moves: enemyType('em_two_plain_moves', { moves: [{ name: 'Swipe' }, { name: 'Claw' }] }),
    em_chicken: enemyType('em_chicken', { moves: [PECK, SCRATCH, FLUTTER] }),
    em_flutterer: enemyType('em_flutterer', { speed: 'slow', moves: [FLUTTER] }),
    em_pecker: enemyType('em_pecker', { moves: [PECK] }),
    em_venom_bite: enemyType('em_venom_bite', { moves: [{ name: 'Venom Bite', damageType: 'poison', effectId: VENOM }] }),
    em_smasher: enemyType('em_smasher', { moves: [{ name: 'Smash', damageType: 'crush', effectId: 'em_heavy', target: 'self', lasts: 'swing' }] }),
    em_exposer: enemyType('em_exposer', {
        moves: [{ name: 'Expose', hits: false, effectId: 'em_exposed', target: 'hero', lasts: 'attack' }, { name: 'Swipe', weight: 3 }]
    }),
    em_expose_only: enemyType('em_expose_only', { moves: [{ name: 'Expose', hits: false, effectId: 'em_exposed', target: 'hero', lasts: 'attack' }] }),
    em_glare: enemyType('em_glare', { moves: [{ name: 'Glare', hits: false, effectId: 'em_nothing', target: 'hero' }] }),
    em_pose: enemyType('em_pose', { moves: [{ name: 'Pose', hits: false, effectId: 'em_nothing', target: 'self' }] }),
    em_alpha: { ...enemyType('em_alpha', { hp: 20, moves: [PECK] }), effects: [{ effectId: 'em_alpha_moves' }] }
});

registerItems({
    em_plate: { id: 'em_plate', name: 'Plate', type: 'armor', equipSlot: 'chest', stackable: true, resistances: { slash: 20, crush: 20, stab: 20 } },
    em_slash_guard: { id: 'em_slash_guard', name: 'Slash Guard', type: 'armor', equipSlot: 'hat', stackable: true, resistances: { slash: 50 } },
    em_dagger: { id: 'em_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 3, speed: 'fast' }
});

function addHero(name, skills = { melee: 1 }) {
    const hero = generateHero({ name });
    hero.status = 'idle';
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { level, xp: 0 };
    hero.hp = { current: 5000, max: 5000 };
    GameState.state.heroes.push(hero);
    return hero;
}
const equip = (hero, id) => {
    InventoryManager.addItem(id, 1);
    const res = EquipmentManager.equipItem(hero.id, id);
    expect(res.success, res.error).toBe(true);
};
const AT = { x: 400, y: 300 };
function startFight(typeId, hero) {
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return enemy;
}
/** Run the board and the Rules tick together, as the game loop does, recording both sides' swings. */
function play(ms, { onHeroSwing = null } = {}) {
    const seen = { hero: [], enemy: [], applied: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { seen.hero.push(p); onHeroSwing?.(p); }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.enemy.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => seen.applied.push(`${p.targetType}:${p.statusId}`))
    ];
    for (let t = 0; t < ms; t += 100) {
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
    }
    offs.forEach(off => off());
    return seen;
}
/** `Math.random` returning `value` and counting its draws. */
function countedRandom(value = 0.5) {
    const counter = { draws: 0 };
    vi.spyOn(Math, 'random').mockImplementation(() => { counter.draws += 1; return value; });
    return counter;
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
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});
afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('the shape', () => {
    it('a move hits by default, Crush when it names no type; one that does not hit has no type', () => {
        expect(enemyMovesOf({ moves: [{ name: ' Peck ', damageType: 'stab' }, { name: 'Swipe' }, FLUTTER] })).toEqual([
            { name: 'Peck', hits: true, type: 'stab', effectId: null, target: 'hero', lasts: 'fight', weight: 1 },
            { name: 'Swipe', hits: true, type: 'crush', effectId: null, target: 'hero', lasts: 'fight', weight: 1 },
            { name: 'Flutter', hits: false, type: null, effectId: 'em_flutter', target: 'self', lasts: 'attack', weight: 1 }
        ]);
    });

    it('reads what it cannot use as the default and drops what is not a move', () => {
        const [m] = enemyMovesOf({ moves: [{ name: 'Odd', damageType: 'stob', target: 'tail', lasts: 'ever', weight: -2 }, 'peck', null] });
        expect(m).toEqual({ name: 'Odd', hits: true, type: 'crush', effectId: null, target: 'hero', lasts: 'fight', weight: 1 });
        // A group is no type: a move naming one hits as Crush.
        expect(enemyMovesOf({ moves: [{ name: 'Gust', damageType: 'elemental' }] })[0].type).toBe('crush');
        expect(enemyMovesOf({ moves: ['peck', null] })).toEqual([]);
    });

    it('an enemy with no moves has one shared empty list (built every tick, so no copy)', () => {
        expect(enemyMovesOf({})).toBe(enemyMovesOf({ moves: [] }));
        expect(enemyMovesOf({ moves: 'peck' })).toEqual([]);
    });

    it('the profile carries its moves only when it has some: a plain enemy\'s block is as it was', () => {
        const plain = enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style: 'melee' } });
        expect(plain).not.toHaveProperty('moves');
        const chicken = enemyProfileOf({ id: 'c', name: 'C', enemy: { level: 1, style: 'melee', moves: [PECK, SCRATCH, FLUTTER] } });
        expect(chicken.moves.map(m => m.name)).toEqual(['Peck', 'Scratch', 'Flutter']);
    });

    it('"for the swing" is offered only on itself: on the hero it is over before it can matter', () => {
        expect(moveLastsFor('self')).toEqual(['attack', 'swing', 'fight']);
        expect(moveLastsFor('hero')).toEqual(['attack', 'fight']);
    });
});

describe('the pick', () => {
    const moves = enemyMovesOf({ moves: [{ name: 'A', weight: 1 }, { name: 'B', weight: 3 }] });

    it('no moves and one move draw nothing; a choice draws once', () => {
        const random = vi.fn(() => 0.5);
        expect(pickMove(undefined, random)).toBe(null);
        expect(pickMove([], random)).toBe(null);
        const one = enemyMovesOf({ moves: [PECK] });
        expect(pickMove(one, random)).toBe(one[0]);
        expect(random).not.toHaveBeenCalled();
        pickMove(moves, random);
        expect(random).toHaveBeenCalledTimes(1);
    });

    it('by weight: B is three times as likely as A', () => {
        expect(pickMove(moves, () => 0.0).name).toBe('A');
        expect(pickMove(moves, () => 0.24).name).toBe('A');
        expect(pickMove(moves, () => 0.26).name).toBe('B');
        expect(pickMove(moves, () => 0.999).name).toBe('B');
    });
});

describe('a fight with moves', () => {
    it('the owner\'s chicken: every swing names its move; Peck hits Stab, Scratch Slash, Flutter hits nothing', () => {
        const hero = addHero('Aela');
        startFight('em_chicken', hero);
        const seen = play(120000);
        const byMove = (name) => seen.enemy.filter(p => p.move === name);
        expect(seen.enemy.length).toBeGreaterThan(30);
        expect(seen.enemy.every(p => ['Peck', 'Scratch', 'Flutter'].includes(p.move))).toBe(true);
        for (const name of ['Peck', 'Scratch', 'Flutter']) expect(byMove(name).length).toBeGreaterThan(3);
        expect(byMove('Peck').filter(p => p.hit).every(p => p.types.join() === 'stab')).toBe(true);
        expect(byMove('Scratch').filter(p => p.hit).every(p => p.types.join() === 'slash')).toBe(true);
        expect(byMove('Flutter').every(p => p.effectOnly === true && p.hit === false && p.damage === 0 && !p.types)).toBe(true);
    });

    it('Flutter resists Slash, Crush and Stab 50 % for the hero\'s next swing only, then comes off', () => {
        countedRandom(0.5);    // every swing hits, none crits, a .5 rolls down
        const hero = addHero('Aela', { melee: 99 });
        equip(hero, 'em_dagger');                       // 3 + 4 for the level = 7 Slash, every 2 s
        const enemy = startFight('em_flutterer', hero);
        const carried = [];
        const seen = play(16100, { onHeroSwing: () => carried.push(LiveEffects.carries(BoardCombat.getFight(enemy.id), 'em_flutter')) });
        // Hero swings at 2, 4, 6, 8, 10, 12, 14, 16 s; the slow flutterer at 4, 8, 12, 16 s, after the
        // hero's swing in the same tick. Each Flutter covers the next hero swing (6, 10, 14 s): 7 x 0.5
        // = 3.5, which a .5 draw rolls down to 3.
        expect(seen.hero.map(p => p.damage)).toEqual([7, 7, 3, 7, 3, 7, 3, 7]);
        expect(seen.hero.map(p => p.verdict)).toEqual([null, null, 'resisted', null, 'resisted', null, 'resisted', null]);
        // Read as each swing lands: on for the swing it covers, off by the next.
        expect(carried).toEqual([false, false, true, false, true, false, true, false]);
        expect(seen.enemy.every(p => p.move === 'Flutter' && p.effectOnly)).toBe(true);
    });

    it('a miss spends Flutter as surely as a hit', () => {
        countedRandom(0);    // every swing misses
        const hero = addHero('Aela', { melee: 99 });
        equip(hero, 'em_dagger');
        const enemy = startFight('em_flutterer', hero);
        let sawIt = false;
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => {
            sawIt ||= LiveEffects.carries(BoardCombat.getFight(enemy.id), 'em_flutter');
        });
        const seen = play(6100);
        off();
        expect(sawIt).toBe(true);
        expect(seen.hero.every(p => !p.hit)).toBe(true);
        expect(LiveEffects.carries(BoardCombat.getFight(enemy.id), 'em_flutter')).toBe(false);
    });

    it('the fight panel reads Flutter on the enemy: its Slash 50 while it lasts', () => {
        countedRandom(0.5);
        const hero = addHero('Aela', { melee: 99 });
        equip(hero, 'em_dagger');
        const enemy = startFight('em_flutterer', hero);
        play(4100);    // the flutterer has just fluttered at 4 s
        const fight = BoardCombat.getFight(enemy.id);
        expect(CF.enemyTypeResistance(fight.enemy, 'slash')).toBe(50);
        expect(fight.effects.find(e => e.effectId === 'em_flutter')).toMatchObject({ forAttack: 3, forFight: true });
    });

    it('a hero in Slash, Crush and Stab gear resists Peck and Scratch alike; a Slash guard only Scratch', () => {
        countedRandom(0.5);
        const plated = addHero('Dara');
        equip(plated, 'em_plate');
        startFight('em_pecker', plated);
        const a = play(9100);
        // A 2 Stab hit × 0.8 = 1.6, which rolls 2 at a .5 draw... and the words say Resisted.
        expect(a.enemy.filter(p => p.hit).every(p => p.types.join() === 'stab' && p.verdict === 'resisted')).toBe(true);
        expect(CF.heroTypeResistance(plated, 'stab')).toBe(20);
        expect(CF.heroTypeResistance(plated, 'slash')).toBe(20);

        const guarded = addHero('Eli');
        equip(guarded, 'em_slash_guard');
        expect(CF.heroTypeResistance(guarded, 'slash')).toBe(50);
        expect(CF.heroTypeResistance(guarded, 'stab')).toBe(0);
        const enemy = enemyProfileOf({ id: 'c', name: 'C', enemy: { level: 1, style: 'melee', hit: 2 } });
        expect(CF.enemyBlow(enemy, guarded, { type: 'slash' }).exact).toBe(1);
        expect(CF.enemyBlow(enemy, guarded, { type: 'stab' }).exact).toBe(2);
        expect(CF.enemyBlow(enemy, guarded).parts[0].type).toBe('crush');
    });

    it('a move\'s effect on the hero lands with its hit, never on a miss (a Venom Bite)', () => {
        const hero = addHero('Aela');
        startFight('em_venom_bite', hero);
        countedRandom(0);    // misses only
        const missed = play(9100);
        expect(missed.enemy.length).toBeGreaterThan(0);
        expect(missed.applied).toEqual([]);
        vi.restoreAllMocks();
        countedRandom(0.5);  // hits only
        const hit = play(3100);
        expect(hit.enemy.every(p => p.hit && p.types.join() === 'poison' && p.move === 'Venom Bite')).toBe(true);
        expect(hit.applied).toContain(`hero:${VENOM}`);
    });

    it('a move\'s effect on itself "for the swing" counts on that swing (a Smash with a heavy strike)', () => {
        countedRandom(0.5);
        const hero = addHero('Aela');
        const enemy = startFight('em_smasher', hero);
        const seen = play(9100);
        expect(seen.enemy.map(p => p.damage)).toEqual([4, 4, 4]);
        expect(seen.enemy.every(p => p.types.join() === 'crush')).toBe(true);
        expect(BoardCombat.getFight(enemy.id).effects.filter(e => e.effectId === 'em_heavy')).toEqual([]);
    });

    it('"for one attack" on the hero lasts through the enemy\'s next swing, then comes off (Expose, then Swipe)', () => {
        const hero = addHero('Aela');
        startFight('em_exposer', hero);
        const script = [];
        vi.spyOn(Math, 'random').mockImplementation(() => (script.length ? script.shift() : 0.5));
        const seen = { enemy: [] };
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.enemy.push({ ...p, exposed: LiveEffects.carries(hero, 'em_exposed') }));
        // At 3, 6 and 9 s both swing, the hero first: its miss and crit draws (a fist's 1 is whole, so
        // no fraction), then the enemy's target pick, then its move: 0.1 picks Expose (weight 1 of 4),
        // 0.9 Swipe. Expose's accuracy roll and Swipe's swing draw the 0.5 after: both land.
        for (let t = 0; t < 9100; t += 100) {
            if ((t + 100) % 3000 === 0) script.push(0.5, 0.5, 0.5, (t + 100) === 3000 ? 0.1 : 0.9);
            LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
            BoardRunner.tick(100);
        }
        off();
        expect(seen.enemy.map(p => p.move)).toEqual(['Expose', 'Swipe', 'Swipe']);
        // Exposed (Crush −50 among its lines) lands with Expose, so Expose's own event has it on; the Swipe after
        // it hits 2 × 1.5 = 3 Weak!, and it is gone for the second Swipe.
        expect(seen.enemy.map(p => p.exposed)).toEqual([true, true, false]);
        expect(seen.enemy.slice(1).map(p => [p.damage, p.verdict])).toEqual([[3, 'weak'], [2, null]]);
    });
});

describe('a move that does not hit, aimed at the hero', () => {
    it('lands only if it hits, by the same accuracy as any attack: a miss lands nothing and reads as a miss', () => {
        const hero = addHero('Aela');
        startFight('em_expose_only', hero);
        countedRandom(0);    // every roll misses
        let carried = false;
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => { carried ||= LiveEffects.carries(hero, 'em_exposed'); });
        const missed = play(9100);
        off();
        expect(missed.enemy.length).toBeGreaterThan(0);
        expect(carried).toBe(false);
        expect(missed.enemy.every(p => p.move === 'Expose' && p.hit === false && !p.effectOnly)).toBe(true);

        vi.restoreAllMocks();
        countedRandom(0.5);  // every roll hits
        const landed = play(3100);
        expect(landed.enemy.every(p => p.move === 'Expose' && p.effectOnly === true && p.damage === 0)).toBe(true);
        expect(LiveEffects.carries(hero, 'em_exposed')).toBe(true);
    });

    it('draws one number a swing for its accuracy; a move on itself draws none', () => {
        const draws = (typeId) => {
            GameState.initNew();
            BoardCombat.clearAll();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            const hero = addHero('Aela');
            startFight(typeId, hero);
            const counter = countedRandom(0.5);
            const seen = play(30000);
            vi.restoreAllMocks();
            return { draws: counter.draws, swings: seen.enemy.length };
        };
        const pose = draws('em_pose');
        const glare = draws('em_glare');
        expect(pose.swings).toBeGreaterThan(5);
        expect(glare.swings).toBe(pose.swings);
        expect(glare.draws).toBe(pose.draws + pose.swings);
    });
});

describe('who names what', () => {
    /** Every title said over the enemy Token. */
    function titles(typeId, ms) {
        const hero = addHero('Aela', { melee: 99 });
        equip(hero, 'em_dagger');
        startFight(typeId, hero);
        const said = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { if (p.title) said.push(p.title); });
        countedRandom(0.5);
        const seen = play(ms);
        off();
        return { said, seen };
    }

    it('an enemy\'s passive is named by the effect it lands (Enrage), not by the effect holding it', () => {
        const { said } = titles('em_alpha', 6100);
        expect(said).toContain('Enrage');
        expect(said).not.toContain('Alpha Moves');
    });

    it('a move with an effect is said by its own name with its swing, never by its effect\'s', () => {
        const { said, seen } = titles('em_smasher', 6100);
        expect(seen.enemy.length).toBeGreaterThan(0);
        expect(seen.enemy.every(p => p.move === 'Smash')).toBe(true);
        expect(said).not.toContain('Heavy Strike');
    });
});

describe('the random stream', () => {
    /** A fresh board, as each test starts with. */
    function reset() {
        TriggerSystem.teardown();
        Flags.teardown();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        LootSystem.init();
        BoardCombat.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        TriggerSystem.init();
        Flags.init();
        LiveEffects.resetClock();
        GameState.state.heroes = [];
    }
    /** One 30 s fight against `typeId`, counting every draw once the fight is set up. */
    function run(typeId) {
        reset();
        const hero = addHero('Aela');
        startFight(typeId, hero);
        const counter = countedRandom(0.5);
        const seen = play(30000);
        vi.restoreAllMocks();
        return {
            draws: counter.draws,
            enemy: seen.enemy.map(p => `${p.hit}|${p.damage}|${(p.types || []).join()}|${p.verdict}`),
            hero: seen.hero.map(p => p.damage)
        };
    }

    it('an enemy with no moves, or one move, draws exactly the same numbers and fights the same', () => {
        const plain = run('em_plain');
        const one = run('em_one_move');
        expect(plain.enemy.length).toBeGreaterThan(5);
        expect(one).toEqual(plain);
    });

    it('a choice of moves draws one more number a swing, and nothing else changes', () => {
        const plain = run('em_plain');
        const two = run('em_two_plain_moves');
        expect(two.enemy).toEqual(plain.enemy);
        expect(two.hero).toEqual(plain.hero);
        expect(two.draws).toBe(plain.draws + plain.enemy.length);
    });
});

describe('the audits', () => {
    const tokens = (moves) => ({ e: { id: 'e', name: 'E', enemy: { level: 1, style: 'melee', moves } } });
    const effects = { em_flutter: { id: 'em_flutter', name: 'Flutter' }, [VENOM]: { id: VENOM, name: 'Venom', status: { stacks: 3 } } };
    const messages = (moves) => findUnknownRefs({ tokens: tokens(moves), effects }).filter(f => f.field === 'enemy.moves').map(f => f.message);

    it('name every malformed move, each once', () => {
        const found = messages([
            'peck',
            { damageType: 'stab' },
            { name: 'Stob', damageType: 'stob' },
            { name: 'Idle', hits: false },
            { name: 'Ghost', effectId: 'em_missing' },
            { name: 'Tail', effectId: 'em_flutter', target: 'tail' },
            { name: 'Ever', effectId: 'em_flutter', lasts: 'ever' },
            { name: 'Blink', effectId: 'em_flutter', target: 'hero', lasts: 'swing' },
            { name: 'Heavy', weight: 0 },
            { name: 'Maybe', hits: 'no' }
        ]);
        expect(found).toEqual([
            'its move 1 is not a move — it is never made. Author it again in the CMS.',
            'its move 2 has no name — the fight screen calls it "Strike". Name it in the CMS.',
            'its move "Stob" hits with "stob", which is not a damage type — it hits as Crush. Pick its type again in the CMS.',
            'its move "Idle" neither hits nor lands an effect — the attack does nothing. Tick Hits or pick an effect in the CMS.',
            'its move "Ghost" lands the effect "em_missing", which is not in the effect library — it lands nothing. Pick the effect again in the CMS.',
            'its move "Tail" aims its effect at "tail", which is neither itself nor the hero — it lands on the hero. Pick its target again in the CMS.',
            'its move "Ever" lasts "ever", which is not one attack, this attack or the fight — it lasts the fight. Pick how long again in the CMS.',
            'its move "Blink" puts its effect on the hero for this attack, which is over before it can matter — it does nothing. Make it last one attack or the fight in the CMS.',
            'its move "Heavy" has the weight "0" — a weight is a number above 0, so it counts as 1. Type it again in the CMS.',
            'its move "Maybe" says it hits "no", which is neither yes nor no — it hits. Tick or untick Hits in the CMS.'
        ]);
        expect(messages('peck')).toEqual(['its moves are not a list — it makes a plain Crush Strike. Author its moves again in the CMS.']);
    });

    it('say nothing about good moves; a status on the hero "for the swing" keeps its own lifetime, so it passes', () => {
        expect(messages([PECK, SCRATCH, FLUTTER, { name: 'Bite', damageType: 'poison', effectId: VENOM, target: 'hero', lasts: 'swing' }])).toEqual([]);
        expect(moveProblems(undefined)).toEqual([]);
    });
});

describe('the Venom rename reaches a move', () => {
    it('a move landing effect_poison lands effect_venom; a token without moves is the same object', () => {
        const def = { id: 'e', enemy: { level: 1, moves: [{ name: 'Bite', effectId: 'effect_poison' }, PECK] } };
        const next = migrateEffectIds(def);
        expect(next.enemy.moves[0].effectId).toBe('effect_venom');
        expect(next.enemy.moves[1]).toBe(PECK);
        const plain = { id: 'p', enemy: { level: 1 } };
        expect(migrateEffectIds(plain)).toBe(plain);
        const done = { id: 'd', enemy: { level: 1, moves: [PECK] } };
        expect(migrateEffectIds(done)).toBe(done);
    });
});
