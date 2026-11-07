// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { breakChanceOf, canBreak, breakChanceProblem } from '../config/registries/itemBreak.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import { rosterAlertOf, rosterBubbleLine, ROSTER_ALERT } from '../ui/components/board/flagText.js';
import { summaryView } from '../ui/components/hud/catchUpSummary.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// A perk's own roll (double wood, say) would land on another number once a break draw is added.
withoutShippedPerks();

/**
 * Brief 480 L1, tools that break. A tool or weapon with a `breakChance` is rolled for once, as a
 * cycle it was used for completes (a tool at a work cycle's end, a weapon at a kill), never part-way;
 * a broken one leaves the hero's hands and they stop with the yellow alert. The roll is one draw
 * from `Math.random`, after everything else the cycle drew, so live play and a catch-up break the
 * same item on the same cycle; an item with no chance draws nothing, so today's content (none has
 * one) plays exactly as before.
 *
 * Two seeded streams, as the bench's prelude seeds `Math.random`: the engine's (counted) and the
 * heroes' pottering (`HeroMotion`), apart so a stroll never moves the engine's count.
 */

const NOW = 1_800_000_000_000;
const WOOD = 'item_oak_wood';
const AXE = 'tb_axe';
const AXE_B = 'tb_axe_b';
const SWORD = 'tb_sword';
const OAK = 'tb_oak';
const OAK_B = 'tb_oak_b';
const ENEMY = 'tb_enemy';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** The three test items, with the chances given (absent: no field at all). */
function setChances({ axe = null, axeB = null, sword = null } = {}) {
    const chance = (n) => (n == null ? {} : { breakChance: n });
    registerItems({
        [AXE]: { id: AXE, name: 'Test Brittle Axe', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 }, ...chance(axe) },
        [AXE_B]: { id: AXE_B, name: 'Test Brittle Axe B', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 }, ...chance(axeB) },
        [SWORD]: { id: SWORD, name: 'Test Brittle Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_longsword_copper', styles: ['melee'], damage: 2, ...chance(sword) }
    });
}
setChances();

const oak = (id, cycleTimeMs) => ({
    id, name: id === OAK ? 'Test Oak' : 'Test Oak B', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
    sprite: 't_tree_oak', requiresHero: true, needsTool: { kind: 'woodaxe', minTier: 1 },
    config: { skill: 'forestry', skillRequired: 1, cycleTimeMs, xp: 1, inputs: [], outputs: [{ itemId: WOOD, chance: 100, minQty: 1, maxQty: 1 }] }
});
registerTokenTypes({
    [OAK]: oak(OAK, 3000),
    [OAK_B]: oak(OAK_B, 2500),
    [ENEMY]: {
        id: ENEMY, name: 'Test Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        requiresHero: true, enemy: { level: 1, style: 'melee', hp: 6, hit: 1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

/** mulberry32, counting its draws, as the bench's prelude does. */
function stream(seed) {
    const s = { state: seed, draws: 0, seed };
    s.next = () => {
        s.draws++;
        s.state = (s.state + 0x6D2B79F5) | 0;
        let t = s.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    s.reset = (to = s.seed) => { s.state = to; s.draws = 0; };
    return s;
}
const engine = stream(11);
const motion = stream(5);
const realRandom = Math.random;

const heroRec = (id) => GameState.state.heroes.find(h => h.id === id);

/** Hold `itemIds` in the first slots, each the hero's own copy. */
function hold(hero, itemIds) {
    itemIds.forEach((itemId, slot) => {
        hero.equipment[slot] = itemId;
        markHeld(hero, slot, true);
    });
}

/** Everything the run heard: cycles per Token, kills, swings and each break (with the draw count at it). */
function listen(ids) {
    const seen = { cycles: {}, kills: 0, swingsBeforeKill: 0, breaks: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { seen.cycles[p.instanceId] = (seen.cycles[p.instanceId] || 0) + 1; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => { if (!seen.kills) seen.swingsBeforeKill++; }),
        EventBus.subscribe(BOARD_EVENTS.GEAR_BROKE, (p) => {
            seen.breaks.push({ heroId: p.heroId, itemId: p.itemId, use: p.use, on: ids.names[p.instanceId] ?? p.instanceId, at: seen.cycles[p.instanceId] ?? 0, draws: engine.draws });
        })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

/** One forester (Forestry 10) holding `items`, ordered onto a Test Oak; a spare axe in the Bank. */
function buildWork({ items = [AXE], second = false, seed = 11 } = {}) {
    engine.reset(seed);
    motion.reset();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const heroes = fixtures.makeHeroes(second ? 2 : 1, { forestry: 10 });
    hold(heroes[0], items);
    const a = fixtures.placeAt(OAK, 500, 500);
    const names = { [a.id]: 'oak' };
    fixtures.orderAt(heroes[0].id, { x: a.x, y: a.y });
    if (second) {
        hold(heroes[1], [AXE_B]);
        const b = fixtures.placeAt(OAK_B, 1300, 500);
        names[b.id] = 'oakB';
        fixtures.orderAt(heroes[1].id, { x: b.x, y: b.y });
    }
    InventoryManager.addItem(AXE, 1);
    TileModifiers.rebuildAll();
    return { heroId: heroes[0].id, heroIds: heroes.map(h => h.id), oakId: a.id, names };
}

/** One fighter (Melee 20) holding `items`, ordered onto a Test Dummy (6 HP) that stands up after every kill. */
function buildFight({ items = [SWORD], seed = 11 } = {}) {
    engine.reset(seed);
    motion.reset();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [fighter] = fixtures.makeHeroes(1, { melee: 20 });
    hold(fighter, items);
    HeroManager.updateHeroFromSkills(fighter);
    fighter.hp.current = fighter.hp.max;
    const e = fixtures.placeAt(ENEMY, 600, 500);
    fixtures.orderAt(fighter.id, { x: e.x, y: e.y });
    TileModifiers.rebuildAll();
    return { heroId: fighter.id, heroIds: [fighter.id], enemyId: e.id, names: { [e.id]: 'dummy' } };
}

const play = (ms, step) => { for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step); };
const catchUp = (ms) => CatchUp.run({ savedAt: NOW - ms, now: NOW, save: false, yieldFn: () => Promise.resolve() });

/** What a run ended as: per hero their hands, order and claim; the wood made; the spare axes. */
function end(ids, seen) {
    const heroes = Object.fromEntries(ids.heroIds.map(id => {
        const h = heroRec(id);
        const flag = BoardState.flagOf(id);
        return [id, {
            hands: h.equipment.slice(0, 2), held: (h.heldCopies || []).slice(0, 2),
            flag: flag ? { pinned: ids.names[flag.pinnedTo] ?? flag.pinnedTo ?? null, spot: flag.spot === true, needsJob: flag.needsJob === true } : null,
            claim: !!BoardState.claimOfHero(id), xp: { forestry: h.skills.forestry?.xp, melee: h.skills.melee?.xp }
        }];
    }));
    return {
        heroes, cycles: Object.fromEntries(Object.entries(seen.cycles).map(([id, n]) => [ids.names[id] ?? id, n])),
        kills: seen.kills, breaks: seen.breaks,
        wood: InventoryManager.getItemCount(WOOD) + SpriteLayer.countOnBoard(WOOD),
        spareAxes: InventoryManager.getItemCount(AXE),
        draws: engine.draws
    };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = engine.next;
    HeroMotion.setRandomForTests(motion.next);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    setChances();
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the chance on an item', () => {
    it('is a percent above 0 and up to 100, on a tool or a weapon only', () => {
        const tool = { equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 } };
        const sword = { equipSlot: 'hand', styles: ['melee'] };
        expect(breakChanceOf({ ...tool, breakChance: 1 })).toBe(1);
        expect(breakChanceOf({ ...sword, breakChance: 0.5 })).toBe(0.5);
        expect(breakChanceOf({ ...tool, breakChance: 100 })).toBe(100);
        for (const bad of [0, -3, 101, 'often', null]) expect(breakChanceOf({ ...tool, breakChance: bad })).toBe(0);
        expect(breakChanceOf(tool)).toBe(0);
        // An off-hand item, armour and a material are never used up by a cycle: they never break.
        expect(canBreak({ equipSlot: 'hand', offHand: true })).toBe(false);
        expect(breakChanceOf({ equipSlot: 'hand', offHand: true, breakChance: 5 })).toBe(0);
        expect(breakChanceOf({ equipSlot: 'chest', breakChance: 5 })).toBe(0);
        expect(breakChanceOf({ equipSlot: '', breakChance: 5 })).toBe(0);
        expect(breakChanceProblem({ ...tool, breakChance: 101 })).toMatch(/not a percent/);
        expect(breakChanceProblem({ equipSlot: 'chest', breakChance: 5 })).toMatch(/only a tool or a weapon/);
        expect(breakChanceProblem({ ...tool, breakChance: 2 })).toBeNull();
        expect(breakChanceProblem(tool)).toBeNull();
    });
});

describe('⭐ a tool breaks only as a work cycle completes', () => {
    it('a 100 % axe lasts the whole first cycle, its wood lands, then it is gone for good', () => {
        setChances({ axe: 100 });
        const ids = buildWork();
        const run = listen(ids);
        const oakToken = () => BoardState.getTokenById(ids.oakId);
        let ticks = 0;
        // Tick by tick through the first cycle: never broken part-way.
        while (!run.seen.cycles[ids.oakId] && ticks++ < 400) {
            GameLoop.runHandlers(100);
            if (!run.seen.cycles[ids.oakId]) expect(heroRec(ids.heroId).equipment[0]).toBe(AXE);
        }
        expect(oakToken().cycleElapsedMs).toBe(0);
        const seen = run.stop();
        expect(seen.cycles[ids.oakId]).toBe(1);
        expect(seen.breaks).toEqual([{ heroId: ids.heroId, itemId: AXE, use: 'work', on: 'oak', at: 1, draws: expect.any(Number) }]);
        const hero = heroRec(ids.heroId);
        expect(hero.equipment[0]).toBeNull();
        expect(hero.heldCopies?.[0] ?? false).toBe(false);
        // The cycle's wood landed, and the XP came in, before it broke.
        expect(InventoryManager.getItemCount(WOOD) + SpriteLayer.countOnBoard(WOOD)).toBe(1);
        expect(hero.skills.forestry.xp).toBe(xpForLevel(10) + 1);
        // Not put back in the Bank: the one spare there is untouched.
        expect(InventoryManager.getItemCount(AXE)).toBe(1);
    });

    it('the hero stops by the Oak with the yellow alert, the order kept, and the Bank\'s spare stays in the Bank', () => {
        setChances({ axe: 100 });
        const ids = buildWork();
        const run = listen(ids);
        play(30_000, 100);
        const seen = run.stop();
        expect(seen.cycles[ids.oakId]).toBe(1);
        expect(Flags.statusOf(ids.heroId)).toMatchObject({ state: 'idle', order: 'token', needsJob: false });
        expect(BoardState.flagOf(ids.heroId).pinnedTo).toBe(ids.oakId);
        expect(BoardState.claimOfHero(ids.heroId)).toBeNull();
        expect(rosterAlertOf(ids.heroId)).toBe(ROSTER_ALERT.ACT);
        expect(BoardRunner.isHeroIdle(ids.heroId)).toBe(true);
        expect(rosterBubbleLine(ids.heroId)).toMatch(/^Test Oak: Needs .*axe/i);
        // Nothing equips the spare: orders never equip anything.
        expect(heroRec(ids.heroId).equipment.includes(AXE)).toBe(false);
        expect(InventoryManager.getItemCount(AXE)).toBe(1);
    });

    it('a second fitting tool in the other hand keeps the hero working', () => {
        setChances({ axe: 100 });
        const ids = buildWork({ items: [AXE, AXE_B] });
        const run = listen(ids);
        play(30_000, 100);
        const seen = run.stop();
        expect(seen.breaks.map(b => b.itemId)).toEqual([AXE]);
        expect(seen.cycles[ids.oakId]).toBeGreaterThan(5);
        expect(heroRec(ids.heroId).equipment.slice(0, 2)).toEqual([null, AXE_B]);
        expect(Flags.statusOf(ids.heroId).state).toBe('working');
    });
});

describe('⭐ the random stream: no chance, no draw', () => {
    it('no chance anywhere draws nothing more; a chance on an item the cycle does not use draws nothing; one on the axe, one draw a cycle', () => {
        setChances();
        let ids = buildWork({ items: [AXE, SWORD] });
        let run = listen(ids);
        play(60_000, 100);
        const plain = end(ids, run.stop());
        expect(plain.cycles.oak).toBeGreaterThanOrEqual(15);

        // A 100 % sword in the other hand: chopping never uses it, so nothing is drawn for it.
        setChances({ sword: 100 });
        ids = buildWork({ items: [AXE, SWORD] });
        run = listen(ids);
        play(60_000, 100);
        expect(end(ids, run.stop())).toEqual(plain);

        // A chance on the axe that never comes up: everything the same, one more draw a cycle.
        setChances({ axe: 1e-9 });
        ids = buildWork({ items: [AXE, SWORD] });
        run = listen(ids);
        play(60_000, 100);
        const drawn = end(ids, run.stop());
        expect(drawn).toEqual({ ...plain, draws: plain.draws + plain.cycles.oak });
    });

    it('a fight: no chance on the sword draws nothing at the kill; a chance draws one there', () => {
        // Played to the end of the tick of the first kill: up to there the two streams are alike.
        const toFirstKill = (chances, items) => {
            setChances(chances);
            const ids = buildFight({ items });
            const run = listen(ids);
            let n = 0;
            while (!run.seen.kills && n++ < 2000) GameLoop.runHandlers(100);
            const seen = run.stop();
            return { kills: seen.kills, swings: seen.swingsBeforeKill, draws: engine.draws };
        };
        const plain = toFirstKill({}, [SWORD, AXE]);
        expect(plain.kills).toBe(1);
        // A 100 % axe in the other hand: a fight never uses it.
        expect(toFirstKill({ axe: 100 }, [SWORD, AXE])).toEqual(plain);
        expect(toFirstKill({ sword: 1e-9 }, [SWORD, AXE])).toEqual({ ...plain, draws: plain.draws + 1 });
    });
});

describe('⭐ a break plays the same live and in a catch-up', () => {
    const AWAY = 3 * 60_000;

    it('one forester: 100 ms ticks, 1000 ms steps and the catch-up break the axe on the same cycle and end alike', async () => {
        setChances({ axe: 12 });
        const live = (step) => {
            const ids = buildWork({ seed: 21 });
            const run = listen(ids);
            play(AWAY, step);
            return end(ids, run.stop());
        };
        const ticks = live(100);
        const steps = live(1000);
        const ids = buildWork({ seed: 21 });
        const run = listen(ids);
        await catchUp(AWAY);
        const caughtUp = end(ids, run.stop());

        expect(steps).toEqual(ticks);
        expect(caughtUp).toEqual(ticks);
        // And it really broke part-way, then nothing more was cut.
        expect(ticks.breaks).toHaveLength(1);
        expect(ticks.breaks[0].at).toBeGreaterThan(1);
        expect(ticks.cycles.oak).toBe(ticks.breaks[0].at);
        expect(ticks.wood).toBe(ticks.cycles.oak);
        expect(ticks.heroes[ids.heroId]).toMatchObject({ hands: [null, null], flag: { pinned: 'oak', spot: false, needsJob: false }, claim: false });
    }, 60_000);

    it('two foresters on two Oaks: the catch-up ends exactly as the same 1000 ms steps do, every draw included', async () => {
        setChances({ axe: 6, axeB: 9 });
        let ids = buildWork({ second: true, seed: 33 });
        let run = listen(ids);
        play(AWAY, 1000);
        const steps = end(ids, run.stop());

        ids = buildWork({ second: true, seed: 33 });
        run = listen(ids);
        await catchUp(AWAY);
        expect(end(ids, run.stop())).toEqual(steps);
        expect(steps.breaks.map(b => b.itemId).sort()).toEqual([AXE, AXE_B]);
    }, 60_000);

    it('a fighter: the catch-up breaks the sword at the same kill as the same 1000 ms steps', async () => {
        setChances({ sword: 20 });
        let ids = buildFight({ seed: 44 });
        let run = listen(ids);
        play(AWAY, 1000);
        const steps = end(ids, run.stop());

        ids = buildFight({ seed: 44 });
        run = listen(ids);
        await catchUp(AWAY);
        expect(end(ids, run.stop())).toEqual(steps);
        expect(steps.breaks).toHaveLength(1);
        expect(steps.breaks[0]).toMatchObject({ itemId: SWORD, use: 'fight' });
        expect(steps.kills).toBe(steps.breaks[0].at);
        expect(steps.heroes[ids.heroId]).toMatchObject({ hands: [null, null], flag: { pinned: null, spot: true, needsJob: true }, claim: false });
    }, 60_000);
});

describe('⭐ a weapon breaks at a kill, never mid-fight, and the hero stops there', () => {
    it('a 100 % sword lasts through every swing of the first fight, breaks at the kill, and the hero fights no more', () => {
        setChances({ sword: 100 });
        const ids = buildFight();
        const run = listen(ids);
        let n = 0;
        while (!run.seen.kills && n++ < 2000) {
            GameLoop.runHandlers(100);
            if (!run.seen.kills) expect(heroRec(ids.heroId).equipment[0]).toBe(SWORD);
        }
        // Several swings landed or missed with the sword in hand before the kill.
        expect(run.seen.swingsBeforeKill).toBeGreaterThanOrEqual(2);
        expect(run.seen.breaks).toEqual([{ heroId: ids.heroId, itemId: SWORD, use: 'fight', on: 'dummy', at: 1, draws: expect.any(Number) }]);
        // The kill trained the sword's style.
        expect(heroRec(ids.heroId).skills.melee.xp).toBeGreaterThan(xpForLevel(20));

        // The order lapsed where they stand: a job wanted, the yellow alert, no fight.
        const flag = BoardState.flagOf(ids.heroId);
        expect(flag).toMatchObject({ spot: true, needsJob: true });
        expect(flag.pinnedTo).toBeUndefined();
        expect(BoardCombat.fightOfHero(ids.heroId)).toBeNull();

        play(30_000, 100);
        const seen = run.stop();
        expect(seen.kills).toBe(1);
        expect(heroRec(ids.heroId).equipment[0]).toBeNull();
        expect(heroRec(ids.heroId).status).not.toBe('combat');
        expect(BoardCombat.fightOfHero(ids.heroId)).toBeNull();
        expect(rosterAlertOf(ids.heroId)).toBe(ROSTER_ALERT.ACT);
        expect(BoardRunner.isHeroIdle(ids.heroId)).toBe(true);
        expect(rosterBubbleLine(ids.heroId)).toBe('Needs a job');
        // The dummy stood up again and nobody fights it.
        expect(BoardState.getTokenById(ids.enemyId)).toBeTruthy();
        expect(BoardState.workerOf(ids.enemyId) ?? null).toBeNull();
    });

    it('barehanded, nothing is drawn and nothing breaks: the hero fights on', () => {
        setChances({ sword: 100 });
        const ids = buildFight({ items: [] });
        const run = listen(ids);
        play(60_000, 100);
        const seen = run.stop();
        expect(seen.kills).toBeGreaterThanOrEqual(2);
        expect(seen.breaks).toEqual([]);
        expect(BoardState.flagOf(ids.heroId).pinnedTo).toBe(ids.enemyId);
    });
});

describe('⭐ time away: a hero whose tool breaks just stops, and the summary says so', () => {
    it('the summary lists the broken axe and its hero, and the hero stood idle by the Oak after', async () => {
        setChances({ axe: 100 });
        const ids = buildWork();
        const result = await catchUp(3 * 60_000);
        expect(result.summary.broken).toEqual([{ heroId: ids.heroId, heroName: heroRec(ids.heroId).name, itemId: AXE, times: 1 }]);
        const view = summaryView({ ...result, show: true });
        expect(view.broken).toEqual([{
            key: `${ids.heroId}|${AXE}`, heroId: ids.heroId, heroName: heroRec(ids.heroId).name, itemId: AXE, name: 'Test Brittle Axe', times: 1
        }]);
        expect(view.hasNews).toBe(true);
        expect(InventoryManager.getItemCount(WOOD) + SpriteLayer.countOnBoard(WOOD)).toBe(1);
        expect(rosterAlertOf(ids.heroId)).toBe(ROSTER_ALERT.ACT);
    });

    it('nothing broke: no line', async () => {
        setChances();
        buildWork();
        const result = await catchUp(60_000);
        expect(result.summary.broken).toEqual([]);
        expect(summaryView({ ...result, show: true }).broken).toEqual([]);
        expect(getItem(AXE).breakChance).toBeUndefined();
    });
});
