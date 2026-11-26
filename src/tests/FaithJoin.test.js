import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Summons from '../systems/board/Summons.js';
import * as Laboratories from '../systems/board/Laboratories.js';
import * as Mastery from '../systems/progression/Mastery.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { TRICK } from '../systems/combat/CombatTricks.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { LABORATORY_KIND } from '../config/registries/mastery.js';
import { resetMatTuning } from '../config/matTuning.js';
import { roundByChance } from '../utils/RNG.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
// Wisdom pays a share's fraction through `roundByChance`; nothing else on these mats calls it.
vi.mock('../utils/RNG.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, roundByChance: vi.fn(actual.roundByChance) };
});

/**
 * ⭐ The shrines' later blessings (Valiant, Wisdom) beside the combat tricks and Summoned workers:
 *
 * - **Last Stand, then Valiant**: Unbreakable holds the first defeating blow at 1 health, before any
 *   defeat, so Valiant is not asked then; the next defeating blow reaches the defeat, and a lit
 *   Valiant shrine makes it a flee that loses nothing. The fight's notes (Last Stand spent) go with
 *   the fight, as on a defeat.
 * - **Wisdom and Summoned workers**: a Summoned worker gains no XP, so working in a Wisdom shrine's
 *   reach it gives no share (it earned none) and is given none, and no draw is made for it.
 * - **Fortune and a Laboratory**: a study lands no drops, so Fortune counts nothing at a Laboratory,
 *   even one carrying a rare table, and no sure find is said there.
 */

const SWORD = 'fixture_fj_sword';
const ORE = 'fixture_fj_ore';
const BRUTE = 'fj_brute';
const VEIN = 'fj_vein';
const VALIANT_SHRINE = 'fj_valiant_shrine';
const WISDOM_SHRINE = 'fj_wisdom_shrine';
const CIRCLE = 'fj_circle';
const SUMMONED_MINER = 'fj_summoned_miner';
const GEM = 'fixture_fj_gem';
const LAB = 'fj_lab';
const STUDIED_VEIN = 'fj_studied_vein';
const FORTUNE_SHRINE = 'fj_fortune_shrine';
const MASTERY_FX = 'fj_mastery';

const XP = 4;
const CYCLE_MS = 1000;
// 30 % of 4 XP is 1.2: every share has a fraction, so every share made calls `roundByChance`.
const WISDOM = 30;

const shrine = (id, type, value) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forest',
    requiresHero: true, shrine: { maxLitMs: 6_000_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [
        { id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } },
        { id: `stm_${id}_rule`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
            payload: { type, bucket: 'flat', value } }
    ]
});

function registerFixtures() {
    registerEffects({
        fj_unbreakable: {
            id: 'fj_unbreakable', name: 'Unbreakable',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.LAST_STAND, bucket: 'flat', value: 100, category: 'melee' } }]
        },
        [MASTERY_FX]: {
            id: MASTERY_FX, name: MASTERY_FX,
            statements: [{ id: `stm_${MASTERY_FX}`, keyword: KEYWORD.PROVIDES, to: null, reach: 'self', payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.5 } }]
        }
    });
    registerItems({
        [SWORD]: { id: SWORD, name: 'Join Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 1, effects: [{ effectId: 'fj_unbreakable' }] },
        [ORE]: { id: ORE, name: 'Join Ore', type: 'material', sprite: 'i_wheat', stackable: true },
        [GEM]: { id: GEM, name: 'Join Gem', type: 'material', sprite: 'i_wheat', stackable: true }
    });
    registerTokenTypes({
        // Never falls; every blow it lands would defeat a hero of 10 health.
        [BRUTE]: {
            id: BRUTE, name: 'Join Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1,
            sprite: 'e_goblin', requiresHero: true, enemy: { level: 1, style: 'melee', hp: 1000000, hit: 50, accuracy: 30 },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        },
        [VEIN]: {
            id: VEIN, name: 'Join Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_ore_vein_copper', requiresHero: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: CYCLE_MS, xp: XP, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
        },
        // A Laboratory carrying a rare table, as no shipped one does: what Fortune would promise.
        [LAB]: {
            id: LAB, name: 'Join Laboratory', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
            requiresHero: true, laboratory: { maxLevel: 20 },
            rareTable: { chance: 1, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] },
            config: { skill: 'science', skillRequired: 1, cycleTimeMs: 2000, xp: 3, inputs: [], outputs: [] },
            statements: [{ id: 'stm_fj_lab_works', keyword: KEYWORD.STATION, payload: { skill: 'science', stationKind: LABORATORY_KIND } }]
        },
        [STUDIED_VEIN]: {
            id: STUDIED_VEIN, name: 'Join Studied Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_ore_vein_copper',
            requiresHero: true, uses: 50,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
            mastery: { ranks: [{ points: 100, effectId: MASTERY_FX, scale: 1 }] }
        },
        [FORTUNE_SHRINE]: shrine(FORTUNE_SHRINE, EFFECT_TYPES.FORTUNE, 40),
        [VALIANT_SHRINE]: shrine(VALIANT_SHRINE, EFFECT_TYPES.VALIANT, 100),
        [WISDOM_SHRINE]: shrine(WISDOM_SHRINE, EFFECT_TYPES.WISDOM, WISDOM),
        [CIRCLE]: {
            id: CIRCLE, name: 'Join Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
            summonCircle: { charges: 10, perLevel: 0 },
            config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
            statements: [{ id: 'stm_fj_circle_station', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
        },
        [SUMMONED_MINER]: {
            id: SUMMONED_MINER, name: 'Join Summoned Miner', rarity: 'common', theme: 'fixture', sprite: 's_occult',
            summon: { of: BRUTE, skills: { mining: 30 } }
        }
    });
}

// The shrine in the middle; each spot 160 from it, in its reach (the standard 240), 320 apart.
const CENTRE = { x: 900, y: 500 };
const WEST = { x: 740, y: 500 };
const EAST = { x: 1060, y: 500 };
const CIRCLE_AT = { x: 300, y: 1000 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };

function litShrine(typeId, at = CENTRE) {
    const s = fixtures.placeAt(typeId, at.x, at.y);
    s.shrine = { litMs: 6_000_000 };
    TileModifiers.rebuildAll();
    return s;
}

const heroOf = (heroId) => GameState.state.heroes.find(h => h.id === heroId);

/** Every combat event for one hero, in order. */
function record(heroId) {
    const seen = [];
    const mine = (kind) => (p) => { if (p?.heroId === heroId) seen.push({ kind, ...p }); };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, mine('enemy')),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_TRICK, (p) => { if (p?.heroId === heroId) seen.push({ kind: 'trick', ...p, hpAfter: heroOf(heroId)?.hp?.current }); }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, mine('defeated')),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, mine('resolved'))
    ];
    return { seen, stop: () => offs.forEach(off => off()), of: (kind) => seen.filter(e => e.kind === kind) };
}

/** Heroes at Mining 10, by id. */
function miners(n) {
    const out = fixtures.makeHeroes(n, { mining: 10, melee: 10, faith: 10 });
    for (const h of out) HeroManager.updateHeroFromSkills(h);
    return out.map(h => h.id);
}
const earned = (heroId) => heroOf(heroId).skills.mining.xp - xpForLevel(10);

/** A vein at `at`, worked by `heroId`. */
function work(heroId, at) {
    fixtures.placeAt(VEIN, at.x, at.y);
    TileModifiers.rebuildAll();
    expect(fixtures.orderAt(heroId, at).success).toBe(true);
}

/** Run until each of `want` (hero id to cycles) has finished that many; the cycles each finished. */
function runCycles(want, limitMs = 60_000) {
    const done = new Map(Object.keys(want).map(id => [id, 0]));
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (done.has(p.heroId)) done.set(p.heroId, done.get(p.heroId) + 1); });
    for (let ms = 0; ms < limitMs && Object.entries(want).some(([id, n]) => done.get(id) < n); ms += 100) step(100);
    off();
    return done;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    GameState.state.progress.rosterLimit = 6;
    InventoryManager.init();
    TileModifiers.clearAll();
    vi.mocked(roundByChance).mockClear();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ Last Stand holds the first defeating blow; Valiant turns the next into a flee', () => {
    function fightTheBrute({ valiant }) {
        const [hero] = fixtures.makeHeroes(1, { melee: 10 });
        const heroId = hero.id;
        HeroManager.updateHeroFromSkills(hero);
        InventoryManager.addItem(SWORD, 1);
        const equipped = EquipmentManager.equipItem(heroId, SWORD);
        expect(equipped.success, equipped.error).toBe(true);
        hero.hp = { current: 10, max: 10 };
        const brute = fixtures.placeAt(BRUTE, WEST.x, WEST.y);
        if (valiant) litShrine(VALIANT_SHRINE, CENTRE);
        TileModifiers.rebuildAll();
        expect(fixtures.orderAt(heroId, WEST).success).toBe(true);
        const log = record(heroId);
        let held = null;
        for (let t = 0; t < 300_000 && !log.of('defeated').length; t += 100) {
            step(100);
            if (!held && log.of('trick').some(e => e.trick === TRICK.LAST_STAND)) {
                held = { hp: { ...heroOf(heroId).hp }, defeats: log.of('defeated').length, notes: heroOf(heroId).fightTricks };
            }
        }
        log.stop();
        return { heroId, brute, log, held };
    }

    it('⭐ the first defeating blow leaves the hero at 1 health with no defeat; the second flees, losing nothing, the notes gone', () => {
        const { heroId, brute, log, held } = fightTheBrute({ valiant: true });
        // Last Stand acted on the blow: 1 health, nobody defeated, the trick noted for this fight.
        expect(held).toEqual({ hp: { current: 1, max: 10 }, defeats: 0, notes: { at: brute.id, lastStand: true } });
        const landed = log.of('enemy').filter(e => e.hit);
        expect(landed).toHaveLength(2);
        expect(landed[0]).toMatchObject({ heroHpRemaining: 1, lastStand: true });
        expect(landed[1].lastStand).toBeUndefined();
        expect(log.of('trick').filter(e => e.trick === TRICK.LAST_STAND)).toHaveLength(1);
        // The second reached the defeat, and Valiant made it a flee.
        expect(log.of('defeated')).toHaveLength(1);
        expect(log.of('defeated')[0]).toMatchObject({ fled: true, lost: [] });
        expect(log.of('resolved').map(e => e.outcome)).toEqual(['fled']);
        const hero = heroOf(heroId);
        expect(hero.equipment[0]).toBe(SWORD);
        expect(hero.status).toBe('wounded');
        // The fight's notes went with it: the next fight has Unbreakable again.
        expect(hero.fightTricks).toBeUndefined();
    });

    it('without the shrine the same second blow is a defeat, the notes gone too', () => {
        const { heroId, log, held } = fightTheBrute({ valiant: false });
        expect(held.hp).toEqual({ current: 1, max: 10 });
        expect(held.defeats).toBe(0);
        expect(log.of('defeated')).toHaveLength(1);
        expect(log.of('defeated')[0].fled).toBeFalsy();
        expect(log.of('resolved').map(e => e.outcome)).toEqual(['defeat']);
        expect(heroOf(heroId).fightTricks).toBeUndefined();
    });
});

describe('⭐ Wisdom and Summoned workers: no XP, so no share given or taken', () => {
    /** A Summoned Miner called by a Circle, holding 10 charges. */
    function summonedMiner(callerId) {
        const circle = fixtures.placeAt(CIRCLE, CIRCLE_AT.x, CIRCLE_AT.y);
        const record = Summons.chargeFromCircle(circle, SUMMONED_MINER, callerId);
        expect(record).toBeTruthy();
        record.summon.charges = 10;
        return record;
    }

    it('the control: two heroes in its reach share, each share drawn for its fraction', () => {
        litShrine(WISDOM_SHRINE);
        const [a, b] = miners(2);
        work(a, WEST);
        work(b, EAST);
        const done = runCycles({ [a]: 3, [b]: 3 });
        expect(done.get(a)).toBeGreaterThanOrEqual(3);
        expect(done.get(b)).toBeGreaterThanOrEqual(3);
        // Each has their own XP and at least 1 of each of the other's cycles (30 % of 4 is 1.2).
        expect(earned(a)).toBeGreaterThanOrEqual(done.get(a) * XP + done.get(b));
        expect(earned(b)).toBeGreaterThanOrEqual(done.get(b) * XP + done.get(a));
        expect(vi.mocked(roundByChance)).toHaveBeenCalled();
    });

    it('⭐ a Summoned worker mining in the reach gives the hero there no share, gets none, and no share is drawn', () => {
        litShrine(WISDOM_SHRINE);
        const [a] = miners(1);
        const worker = summonedMiner(a);
        const workerXp = worker.skills.mining.xp;
        work(a, WEST);
        work(worker.id, EAST);
        const done = runCycles({ [a]: 3, [worker.id]: 3 });
        // Both worked, the Summoned worker spending a charge a cycle.
        expect(done.get(a)).toBeGreaterThanOrEqual(3);
        expect(done.get(worker.id)).toBeGreaterThanOrEqual(3);
        expect(worker.summon.charges).toBe(10 - done.get(worker.id));
        // The hero has their own XP alone, the Summoned worker none, and no share was rolled.
        expect(earned(a)).toBe(done.get(a) * XP);
        expect(worker.skills.mining.xp).toBe(workerXp);
        expect(vi.mocked(roundByChance)).not.toHaveBeenCalled();
    });
});

describe('⭐ Fortune and a Laboratory: a study lands no drops, so it counts nothing', () => {
    it('⭐ a Laboratory with a rare table in a Fortune shrine\'s reach studies on, its count never moving, no sure find said', () => {
        Mastery.apply();
        litShrine(FORTUNE_SHRINE);
        const lab = fixtures.placeAt(LAB, WEST.x, WEST.y);
        const vein = fixtures.placeAt(STUDIED_VEIN, WEST.x, WEST.y + 160);
        TileModifiers.rebuildAll();
        expect(Laboratories.setTarget(lab, vein.id)).toBe(true);
        const [scholar] = fixtures.makeHeroes(1, { science: 10 });
        expect(fixtures.orderAt(scholar.id, WEST).success).toBe(true);
        const fired = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { if (p.instanceId === lab.id && p.fortune) fired.push(p); });
        const done = runCycles({ [scholar.id]: 3 });
        off();
        expect(done.get(scholar.id)).toBeGreaterThanOrEqual(3);
        expect(lab.fortune).toBeUndefined();
        expect(fired).toEqual([]);
        expect(InventoryManager.getItemCount(GEM)).toBe(0);
    });
});
