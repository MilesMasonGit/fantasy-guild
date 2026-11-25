import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Summons from '../systems/board/Summons.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Hideouts from '../systems/board/Hideouts.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { HIDEOUT_KIND } from '../config/registries/crime.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { t } from '../i18n/index.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Summoned workers (brief 810 K5) beside Crime (K4), the gathering perks (800 P1, P2) and coins
 * (870 C2): a Summoned worker works only at its own skills and never fights, so one with Crime robs a
 * Hideout (Crime work is no fight) but is refused the guard a catch sets and the camp it robs. Every
 * cycle it finishes spends one charge, whatever the cycle did: a theft, a caught theft, a theft's
 * Echo (none more), a tree whose fall fells its grove, a cycle Can't Run Out keeps the Token's
 * charges for. Its stolen coins land as a hero's do.
 *
 * The content keeps summons to gathering (content_summoning.md, ruling 2; the summon audit names a
 * Crime summon): the Rogue here pins what the engine does if one is ever written.
 */

const LOOT = 'fixture_sj_loot';
registerItems({
    [LOOT]: { id: LOOT, name: 'SJ Loot', type: 'material', stackable: true, sprite: 'i_bones' }
});

const provides = (id, type, value, extra = {}) => ({
    id, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
registerEffects({
    sj_grove_feller: { id: 'sj_grove_feller', name: 'SJ Grove Feller', statements: [provides('stm_sj_gf', EFFECT_TYPES.GROVE_FELLING, 100, { category: 'forestry' })] }
});

const works = (id) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } });
const hideout = (id, curve) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
    requiresHero: true, hideout: curve,
    config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 2000, xp: 3, inputs: [], outputs: [] },
    statements: [works(id)]
});
const resource = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', ...extra });

registerTokenTypes({
    sj_goblin: {
        id: 'sj_goblin', name: 'SJ Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 'e_goblin',
        requiresHero: true, enemy: { level: 5, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [] },
        steal: { coins: 10, outputs: [{ itemId: LOOT, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sj_camp: {
        id: 'sj_camp', name: 'SJ Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
        requiresHero: false, config: null, spawner: { spawns: [{ typeId: 'sj_goblin', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    },
    sj_safe_hideout: hideout('sj_safe_hideout', { evenChance: 0, perLevel: 0, minChance: 0, maxChance: 0 }),
    sj_loud_hideout: hideout('sj_loud_hideout', { evenChance: 100, perLevel: 0, minChance: 100, maxChance: 100 }),
    sj_echo: {
        id: 'sj_echo', name: 'SJ Echo', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        statements: [provides('stm_sj_echo', EFFECT_TYPES.ECHO, 100)]
    },
    sj_unending: {
        id: 'sj_unending', name: 'SJ Unending', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        statements: [provides('stm_sj_unending', EFFECT_TYPES.NEVER_RUNS_OUT, 100)]
    },
    sj_vein: resource('sj_vein', {
        uses: 10, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: LOOT, chance: 100, minQty: 1, maxQty: 1 }] }
    }),
    sj_oak: resource('sj_oak', {
        uses: 5, respawn: { mode: 'regrow', into: 'sj_oak_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 3, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }] }
    }),
    sj_oak_stump: resource('sj_oak_stump', { uses: null, config: null, grows: { into: 'sj_oak', afterMs: 600000 } }),
    sj_circle: {
        id: 'sj_circle', name: 'SJ Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
        summonCircle: { charges: 10, perLevel: 0 },
        config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_sj_circle_station', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
    },
    sj_summoned_rogue: {
        id: 'sj_summoned_rogue', name: 'SJ Summoned Rogue', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'sj_goblin', skills: { crime: 30 } }
    },
    sj_summoned_miner: {
        id: 'sj_summoned_miner', name: 'SJ Summoned Miner', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'sj_goblin', skills: { mining: 30 } }
    },
    sj_summoned_feller: {
        id: 'sj_summoned_feller', name: 'SJ Summoned Feller', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'sj_goblin', skills: { forestry: 99 }, trait: { effectId: 'sj_grove_feller', scale: 1 } }
    }
});

const HIDEOUT_AT = { x: 800, y: 500 };
const CAMP_AT = { x: 960, y: 500 };
const CIRCLE_AT = { x: 300, y: 900 };
const BESIDE_HIDEOUT = { x: 800, y: 660 };
// A standard Token's art radius is 64: two trees touch at 128 apart or less.
const OAK_AT = { x: 800, y: 500 };
const OAK_TOUCHING = { x: 910, y: 500 };

const coinsIn = () => SpriteLayer.countOnBoard(COIN_ITEM_ID) + (Number(GameState.state.progress.coins) || 0);

function summoner() {
    const h = generateHero({ name: 'summoner' });
    h.id = 'summoner';
    h.status = 'idle';
    for (const s of Object.values(h.skills)) { s.level = 10; s.xp = xpForLevel(10); }
    GameState.state.heroes.push(h);
    HeroManager.rehydrateHero(h);
    return h;
}

/** A Summoned worker of `kind`, called by a Circle and holding `charges`. */
function summon(kind, charges = 10) {
    const circle = placeAt('sj_circle', CIRCLE_AT.x, CIRCLE_AT.y);
    const record = Summons.chargeFromCircle(circle, kind, 'summoner');
    expect(record).toBeTruthy();
    record.summon.charges = charges;
    return record;
}

/** A Hideout robbing a filled camp, and a Summoned Rogue on it. */
function robbery(hideoutType = 'sj_safe_hideout', { echo = false } = {}) {
    const hide = placeAt(hideoutType, HIDEOUT_AT.x, HIDEOUT_AT.y);
    const camp = placeAt('sj_camp', CAMP_AT.x, CAMP_AT.y);
    for (let i = 0; i < 3; i++) SpawnerSystem.attemptSpawn(camp, getTokenType('sj_camp'), Math.random);
    if (echo) placeAt('sj_echo', BESIDE_HIDEOUT.x, BESIDE_HIDEOUT.y);
    TileModifiers.rebuildAll();
    expect(Hideouts.setTarget(hide, camp.id)).toBe(true);
    const rogue = summon('sj_summoned_rogue');
    expect(Orders.orderAt(rogue.id, HIDEOUT_AT).success).toBe(true);
    return { hide, camp, rogue };
}

/** Run until `heroId` has finished `n` cycles at `instanceId`; the thefts it said. */
function cyclesOf(heroId, n, limitMs = 20_000) {
    const done = [];
    const thefts = [];
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.heroId === heroId) done.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => thefts.push(p))
    ];
    for (let ms = 0; ms < limitMs && done.length < n; ms += 100) BoardRunner.tick(100);
    offs.forEach(off => off());
    return { done, thefts };
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
    Summons.init();
    TimedChanges.init();
});
afterAll(() => {
    Flags.teardown();
    Summons.teardown();
    resetMatTuning();
});

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 3;
    GameState.state.inventory.maxSlots = 50;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    TileModifiers.clearAll();
    clearMat();
    summoner();
});

afterEach(() => vi.restoreAllMocks());

describe('⭐ a Summoned worker with Crime robs a Hideout: Crime work is no fight', () => {
    it('⭐ each theft spends one charge, teaches it nothing, and lands its goods and coins as a hero\'s', () => {
        const { hide, rogue } = robbery();
        const xp = rogue.skills.crime.xp;
        const { done, thefts } = cyclesOf(rogue.id, 2);
        expect(done.map(d => d.instanceId)).toEqual([hide.id, hide.id]);
        expect(thefts.map(p => p.heroId)).toEqual([rogue.id, rogue.id]);
        expect(rogue.summon.charges).toBe(8);
        expect(rogue.skills.crime.xp).toBe(xp);
        expect(coinsIn()).toBe(20);
        expect(SpriteLayer.countOnBoard(LOOT)).toBe(2);
    });

    it('⭐ a caught theft spends its charge too; the guard and the camp are refused it, since it never fights', () => {
        const { camp, rogue } = robbery('sj_loud_hideout');
        const { thefts } = cyclesOf(rogue.id, 1);
        expect(thefts).toEqual([expect.objectContaining({ heroId: rogue.id, caught: true })]);
        expect(rogue.summon.charges).toBe(9);
        expect(coinsIn()).toBe(0);
        const guard = Hideouts.guardOf(camp);
        expect(guard).toBeTruthy();
        const atGuard = Orders.orderAt(rogue.id, { x: guard.x, y: guard.y });
        expect(atGuard.success).toBe(false);
        expect(atGuard.reason).toBe(t('orders.summonNeverFights'));
        const atCamp = Orders.orderAt(rogue.id, CAMP_AT);
        expect(atCamp.success).toBe(false);
        expect(atCamp.reason).toBe(t('orders.summonNeverFights'));
    });

    it('⭐ an Echo of its theft takes the goods and coins again but spends no second charge', () => {
        const { rogue } = robbery('sj_safe_hideout', { echo: true });
        const { thefts } = cyclesOf(rogue.id, 1);
        expect(thefts).toHaveLength(1);
        expect(SpriteLayer.countOnBoard(LOOT)).toBe(2);
        expect(coinsIn()).toBe(20);
        expect(rogue.summon.charges).toBe(9);
    });
});

describe('⭐ the gathering perks charge a Summoned worker one cycle a cycle', () => {
    it('⭐ Grove Felling as its trait: the cycle whose fall fells the grove spends one charge, however many trees fall', () => {
        const worked = placeAt('sj_oak', OAK_AT.x, OAK_AT.y);
        const kin = placeAt('sj_oak', OAK_TOUCHING.x, OAK_TOUCHING.y);
        TileModifiers.rebuildAll();
        const feller = summon('sj_summoned_feller');
        expect(Orders.orderAt(feller.id, OAK_AT).success).toBe(true);
        // Every end roll misses until it is at work; then the next cycle fells the tree.
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
        for (let ms = 0; ms < 20_000 && !(worked.cycleElapsedMs > 0); ms += 100) BoardRunner.tick(100);
        const before = feller.summon.charges;
        spy.mockReturnValue(0);
        const { done } = cyclesOf(feller.id, 1, 5000);
        expect(done).toHaveLength(1);
        expect(Respawn.isResting(worked)).toBe(true);
        expect(Respawn.isResting(kin)).toBe(true);
        expect(feller.summon.charges).toBe(before - 1);
    });

    it('a cycle Can\'t Run Out keeps the Token\'s charges for still spends the Summoned worker\'s', () => {
        const vein = placeAt('sj_vein', OAK_AT.x, OAK_AT.y);
        placeAt('sj_unending', OAK_AT.x, OAK_AT.y + 160);
        TileModifiers.rebuildAll();
        const miner = summon('sj_summoned_miner');
        expect(Orders.orderAt(miner.id, OAK_AT).success).toBe(true);
        const { done } = cyclesOf(miner.id, 3);
        expect(done).toHaveLength(3);
        expect(vein.usesRemaining).toBe(10);
        expect(miner.summon.charges).toBe(7);
    });
});

describe('coins from kills are never a Summoned worker\'s', () => {
    it('it is refused every enemy, so no kill of its drops coins', () => {
        const goblin = placeAt('sj_goblin', 1300, 800);
        const rogue = summon('sj_summoned_rogue');
        const order = Orders.orderAt(rogue.id, { x: goblin.x, y: goblin.y });
        expect(order.success).toBe(false);
        expect(order.reason).toBe(t('orders.summonNeverFights'));
        expect(Flags.canFight(rogue.id)).toBe(false);
    });
});
