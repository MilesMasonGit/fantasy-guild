import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as RareTables from '../systems/board/RareTables.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { getPaletteEntry, bucketsFor } from '../config/registries/modifierPalette.js';
import { rareTableOf, rareTableChance, pickRareEntry, rareEntryChances } from '../config/registries/rareTables.js';
import { resetMatTuning } from '../config/matTuning.js';
import { supportTag } from '../ui/components/board/supportTags.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Rare drop tables and Lucky (brief 590 P3). A Token's rare table rolls once a cycle (or a kill),
 * after its own lines, at its chance widened by Lucky; on a hit one entry, picked by weight, lands
 * as any line does: Double Loot doubles it, Double Item works on it, and it is marked for the twinkle. A failed cycle
 * rolls nothing; a Token with no table draws nothing, Lucky or not.
 */

const ORE = 'fixture_rt_ore';
const GEM = 'fixture_rt_gem';
const PEARL = 'fixture_rt_pearl';
const BONE = 'fixture_rt_bone';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [ORE]: item(ORE, 'Test Ore'), [GEM]: item(GEM, 'Test Gem'), [PEARL]: item(PEARL, 'Test Pearl'), [BONE]: item(BONE, 'Test Bone') });

/** Gem 3 to Pearl 1: three in four finds are a Gem. */
const TWO_FINDS = [{ itemId: GEM, weight: 3, minQty: 1, maxQty: 1 }, { itemId: PEARL, weight: 1, minQty: 1, maxQty: 1 }];
const vein = (id, rareTable) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    tags: ['RtOre'], requiresHero: true,
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
    ...(rareTable ? { rareTable } : {})
});
const enemy = (id, rareTable, outputs = [{ itemId: BONE, chance: 100, minQty: 1, maxQty: 1 }]) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 20, sprite: 's_occult',
    enemy: { level: 2, style: 'melee' },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs },
    ...(rareTable ? { rareTable } : {})
});
let stm = 0;
const provides = (to, type, value, extra = {}) => ({
    id: `stm_rt_${++stm}`, keyword: 'provides', to, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
const building = (id, statements) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false, statements
});
const AT = (id) => ({ mode: 'id', value: id });
const lucky = (to, value, bucket = 'percentage') => provides(to, EFFECT_TYPES.LUCKY, value, { bucket });

registerTokenTypes({
    rt_plain: vein('rt_plain'),
    rt_sure: vein('rt_sure', { chance: 100, entries: TWO_FINDS }),
    rt_half: vein('rt_half', { chance: 50, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] }),
    rt_one: vein('rt_one', { chance: 1, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] }),
    rt_faint: vein('rt_faint', { chance: 1e-9, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] }),
    rt_lucky_double: building('rt_lucky_double', [lucky(AT('rt_half'), 1)]),
    rt_lucky_zero: building('rt_lucky_zero', [lucky(AT('rt_half'), 0)]),
    rt_lucky_plain: building('rt_lucky_plain', [lucky(AT('rt_plain'), 1)]),
    rt_lucky_one_pct: building('rt_lucky_one_pct', [lucky(AT('rt_one'), 0.1)]),
    rt_lucky_one_flat: building('rt_lucky_one_flat', [lucky(AT('rt_one'), 1, 'flat')]),
    rt_loot_double: building('rt_loot_double', [provides({ mode: 'all' }, EFFECT_TYPES.LOOT_MULT, 100)]),
    rt_gem_double: building('rt_gem_double', [provides({ mode: 'all' }, EFFECT_TYPES.DOUBLE_DROP, 100, { category: GEM })]),
    rt_jinx: building('rt_jinx', [provides({ mode: 'all' }, EFFECT_TYPES.FAIL_CHANCE, 100)]),
    rt_enemy: enemy('rt_enemy', { chance: 100, entries: TWO_FINDS }),
    rt_enemy_half: enemy('rt_enemy_half', { chance: 50, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] }),
    rt_enemy_bare: enemy('rt_enemy_bare', { chance: 100, entries: [{ itemId: PEARL, weight: 1, minQty: 2, maxQty: 2 }] }, []),
    rt_enemy_plain: enemy('rt_enemy_plain', null),
    rt_lucky_enemy: building('rt_lucky_enemy', [lucky(AT('rt_enemy_half'), 1)])
});

/** A Hall star, rank 1 held, giving Lucky (`value`, `bucket`) aimed by `to`. */
function holdStar(value, { to, bucket = 'percentage' } = {}) {
    registerHallSky({
        constellations: { rt: { id: 'rt', name: 'Rare', label: { x: 1, y: 0 } } },
        stars: {
            rt_star: {
                id: 'rt_star', constellation: 'rt', name: 'Lucky Finds', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [], lines: [], rules: [{
                    id: 'stm_rt_star', keyword: KEYWORD.PROVIDES, chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                    to: to || { mode: 'all', value: '' },
                    payload: { type: EFFECT_TYPES.LUCKY, bucket, value }
                }] }]
            }
        }
    });
    GuildUpgradeManager.getRanks().rt_star = 1;
    GuildUpgradeManager.recompute();
}

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const VEIN = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const BELOW = { x: 800, y: 640 };

/** Counts a Token's cycles and the rare finds marked for the twinkle off it. */
function watch(instanceId) {
    const seen = { cycles: 0, failed: 0, finds: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
            if (e.instanceId !== instanceId) return;
            seen.cycles += 1;
            if (e.failed) seen.failed += 1;
        }),
        EventBus.subscribe(BOARD_EVENTS.RARE_DROP, (e) => {
            if (e.itemId === GEM || e.itemId === PEARL) seen.finds.push(e);
        })
    ];
    seen.off = () => offs.forEach(off => off?.());
    return seen;
}

/** A miner on a vein, with whatever stands beside it. */
function scene(typeId, ...beside) {
    const v = put(typeId, VEIN);
    [BESIDE, BELOW].forEach((at, i) => { if (beside[i]) put(beside[i], at); });
    Orders.orderAt('miner', VEIN);
    return v;
}

/** The loot event of one kill of `enemyInstance`, its drops as its fight carries them. */
function kill(enemyInstance) {
    const seen = [];
    const off = EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, p => seen.push(p));
    const def = getTokenType(enemyInstance.typeId);
    LootSystem.handleCombatVictory({ enemyId: def.id, instanceId: enemyInstance.id, drops: def.config.outputs });
    off();
    return seen[0];
}

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('miner', { mining: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
    vi.restoreAllMocks();
});

describe('a rare table, as authored', () => {
    it('reads its chance and its entries; no chance or no usable entry is no table', () => {
        expect(rareTableOf(getTokenType('rt_sure'))).toMatchObject({ chance: 100, total: 4 });
        expect(rareTableChance(getTokenType('rt_one'))).toBe(1);
        expect(rareTableChance(getTokenType('rt_plain'))).toBeNull();
        expect(rareTableOf({ rareTable: { chance: 0, entries: TWO_FINDS } })).toBeNull();
        expect(rareTableOf({ rareTable: { chance: 0.5, entries: [{ itemId: GEM, weight: 0 }, { itemId: '', weight: 2 }] } })).toBeNull();
        // Decimals allowed; a missing quantity is one.
        expect(rareTableOf({ rareTable: { chance: 0.5, entries: [{ itemId: GEM, weight: 2 }] } }))
            .toMatchObject({ chance: 0.5, entries: [{ itemId: GEM, weight: 2, minQty: 1, maxQty: 1 }] });
    });

    it('each entry\'s own chance is the table\'s times its share', () => {
        const table = rareTableOf({ rareTable: { chance: 2, entries: TWO_FINDS } });
        expect(rareEntryChances(table).map(r => [r.entry.itemId, r.chance])).toEqual([[GEM, 1.5], [PEARL, 0.5]]);
    });

    it('picks by weight with one draw, and draws nothing for a table of one', () => {
        const table = rareTableOf(getTokenType('rt_sure'));
        expect(pickRareEntry(table, () => 0.74).itemId).toBe(GEM);
        expect(pickRareEntry(table, () => 0.76).itemId).toBe(PEARL);
        const random = vi.fn(() => 0.5);
        expect(pickRareEntry(rareTableOf(getTokenType('rt_one')), random).itemId).toBe(GEM);
        expect(random).not.toHaveBeenCalled();
    });
});

describe('a rare table on a gathering Token', () => {
    it('at 100 %, every cycle lands its own line and then one find, marked for the twinkle', () => {
        const v = scene('rt_sure');
        const seen = watch(v.id);
        run(6200);
        seen.off();
        expect(seen.cycles).toBeGreaterThanOrEqual(4);
        expect(seen.finds).toHaveLength(seen.cycles);
        expect(SpriteLayer.countOnBoard(ORE)).toBe(seen.cycles);
        expect(SpriteLayer.countOnBoard(GEM) + SpriteLayer.countOnBoard(PEARL)).toBe(seen.cycles);
    });

    it('picks its finds by weight: about three Gems to a Pearl', () => {
        const v = scene('rt_sure');
        const seen = watch(v.id);
        run(402000);
        seen.off();
        const gems = seen.finds.filter(f => f.itemId === GEM).length;
        expect(seen.finds.length).toBeGreaterThan(300);
        expect(gems / seen.finds.length).toBeGreaterThan(0.65);
        expect(gems / seen.finds.length).toBeLessThan(0.85);
    });

    it('Double Loot doubles a rare drop as it doubles every line', () => {
        const looted = scene('rt_sure', 'rt_loot_double');
        const seen = watch(looted.id);
        run(3200);
        seen.off();
        expect(seen.cycles).toBe(3);
        expect(SpriteLayer.countOnBoard(ORE)).toBe(6);
        expect(SpriteLayer.countOnBoard(GEM) + SpriteLayer.countOnBoard(PEARL)).toBe(6);
    });

    it('Double Item on the rare item doubles that find, and leaves the ore', () => {
        GameState.state.heroes = [hero('miner', { mining: 10 })];
        const v = scene('rt_sure', 'rt_gem_double');
        const seen = watch(v.id);
        run(3200);
        seen.off();
        expect(seen.cycles).toBe(3);
        const gemFinds = seen.finds.filter(f => f.itemId === GEM).length;
        const pearlFinds = seen.finds.length - gemFinds;
        expect(SpriteLayer.countOnBoard(ORE)).toBe(3);
        expect(SpriteLayer.countOnBoard(GEM)).toBe(2 * gemFinds);
        expect(SpriteLayer.countOnBoard(PEARL)).toBe(pearlFinds);
    });

    it('a failed cycle rolls nothing: no find, and not one draw for the table', () => {
        const draws = (typeId) => {
            GameState.initNew();
            TileModifiers.clearAll();
            SpriteLayer.init();
            GameState.state.heroes = [hero('miner', { mining: 10 })];
            const v = scene(typeId, 'rt_jinx');
            const seen = watch(v.id);
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            seen.off();
            expect(seen.failed).toBe(3);
            expect(seen.finds).toHaveLength(0);
            return n;
        };
        expect(draws('rt_sure')).toBe(draws('rt_plain'));
        expect(SpriteLayer.countOnBoard(GEM) + SpriteLayer.countOnBoard(PEARL)).toBe(0);
    });
});

describe('⚠️ no table, no draw', () => {
    /** Math.random draws over three cycles of a fresh vein of `typeId`, with `beside` next to it. */
    function drawsWith(typeId, beside = null) {
        GameState.initNew();
        TileModifiers.clearAll();
        SpriteLayer.init();
        GameState.state.heroes = [hero('miner', { mining: 10 })];
        const v = scene(typeId, beside);
        const seen = watch(v.id);
        const spy = vi.spyOn(Math, 'random');
        run(3200);
        const n = spy.mock.calls.length;
        spy.mockRestore();
        seen.off();
        expect(seen.cycles).toBe(3);
        return n;
    }

    it('a Token with no table draws nothing for it, with Lucky beside it or not', () => {
        const none = drawsWith('rt_plain');
        expect(drawsWith('rt_plain', 'rt_lucky_plain')).toBe(none);
    });

    it('a table of one draws once a cycle for its roll, and nothing more when it misses', () => {
        const none = drawsWith('rt_plain');
        expect(drawsWith('rt_faint')).toBe(none + 3);
    });
});

describe('Lucky', () => {
    it('a percentage raises the table\'s chance in proportion: +10 % turns 1 % into 1.1 %', () => {
        const v = scene('rt_one', 'rt_lucky_one_pct');
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_one'), 'mining')).toBeCloseTo(1.1, 10);
    });

    it('a flat amount adds points: +1 turns 1 % into 2 %', () => {
        const v = scene('rt_one', 'rt_lucky_one_flat');
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_one'), 'mining')).toBeCloseTo(2, 10);
    });

    it('from a building at +100 %, a 50 % table drops on every cycle; at 0 % it stays 50 %', () => {
        const v = scene('rt_half', 'rt_lucky_double');
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_half'), 'mining')).toBe(100);
        const seen = watch(v.id);
        run(6200);
        seen.off();
        expect(seen.cycles).toBeGreaterThanOrEqual(4);
        expect(seen.finds).toHaveLength(seen.cycles);

        const w = put('rt_half', { x: 300, y: 300 });
        put('rt_lucky_zero', { x: 440, y: 300 });
        expect(RareTables.rareChanceAt(w.id, getTokenType('rt_half'), 'mining')).toBe(50);
    });

    it('from a Hall star aimed at the Token: +100 % makes the 50 % table sure; another Token is untouched', () => {
        holdStar(1, { to: AT('rt_half') });
        const v = scene('rt_half');
        const other = put('rt_one', { x: 300, y: 300 });
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_half'), 'mining')).toBe(100);
        expect(RareTables.rareChanceAt(other.id, getTokenType('rt_one'), 'mining')).toBe(1);
        const seen = watch(v.id);
        run(6200);
        seen.off();
        expect(seen.finds).toHaveLength(seen.cycles);
    });

    it('from a Hall star at 0 %, the table keeps its own chance', () => {
        holdStar(0, { to: AT('rt_half') });
        const v = scene('rt_half');
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_half'), 'mining')).toBe(50);
    });

    it('a Token with no table ignores Lucky: nothing to read and nothing rolled', () => {
        const v = scene('rt_plain', 'rt_lucky_plain');
        expect(RareTables.rareChanceAt(v.id, getTokenType('rt_plain'), 'mining')).toBeNull();
        expect(RareTables.rollRareTable(v.id, getTokenType('rt_plain'), 'mining', () => { throw new Error('drew'); })).toBeNull();
    });

    it('is offered in the CMS as Lucky, a percentage first and a flat amount too, with the owner\'s hint', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.LUCKY);
        expect(entry.label).toBe('Lucky');
        expect(bucketsFor(entry)).toEqual(['percentage', 'flat']);
        expect(entry.hint).toMatch(/^A higher chance on the Token's rare drop table/);
        expect(paletteForKeyword(KEYWORD.PROVIDES).some(p => p.type === EFFECT_TYPES.LUCKY)).toBe(true);
    });

    it('reads in plain words: in proportion as a percentage, in points as a flat', () => {
        const rule = (bucket, value) => ({ id: 's', keyword: 'provides', to: { mode: 'tag', value: 'Ore' }, reach: 'nearby', payload: { type: EFFECT_TYPES.LUCKY, bucket, value } });
        expect(renderStatement(rule('percentage', 0.1))).toMatch(/have a 10% higher chance on their rare drop table/);
        expect(renderStatement(rule('flat', 1))).toMatch(/have 1% added to their rare drop table's chance/);
        expect(supportTag({ type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.1 })).toBe('+10 % Lucky');
        expect(supportTag({ type: EFFECT_TYPES.LUCKY, bucket: 'flat', value: 1 })).toBe('+1 point Lucky');
    });
});

describe('a rare table on an enemy', () => {
    it('one roll a kill, beside its loot: one find by weight, marked for the twinkle', () => {
        const e = put('rt_enemy', VEIN);
        const finds = [];
        const off = EventBus.subscribe(BOARD_EVENTS.RARE_DROP, (p) => finds.push(p));
        const loot = kill(e);
        off();
        expect(loot.drops.map(d => d.itemId)[0]).toBe(BONE);
        expect(loot.drops).toHaveLength(2);
        expect(loot.drops[1]).toMatchObject({ rare: true, quantity: 1 });
        expect([GEM, PEARL]).toContain(loot.drops[1].itemId);
        expect(finds.map(f => f.itemId)).toEqual([loot.drops[1].itemId]);
        expect(SpriteLayer.countOnBoard(loot.drops[1].itemId)).toBe(1);
    });

    it('picks its finds by weight over many kills: about three Gems to a Pearl', () => {
        const e = put('rt_enemy', VEIN);
        let gems = 0;
        const N = 800;
        for (let i = 0; i < N; i++) if (kill(e).drops[1].itemId === GEM) gems += 1;
        expect(gems / N).toBeGreaterThan(0.68);
        expect(gems / N).toBeLessThan(0.82);
    });

    it('an enemy with no loot lines still rolls its table', () => {
        const e = put('rt_enemy_bare', VEIN);
        const loot = kill(e);
        expect(loot.drops).toEqual([expect.objectContaining({ itemId: PEARL, quantity: 2, rare: true })]);
    });

    it('Lucky aimed at the enemy raises it: +100 % makes its 50 % table drop on every kill', () => {
        const e = put('rt_enemy_half', VEIN);
        put('rt_lucky_enemy', BESIDE);
        for (let i = 0; i < 20; i++) expect(kill(e).drops.some(d => d.rare)).toBe(true);
    });

    it('Double Loot near the enemy doubles its rare find with its loot', () => {
        const e = put('rt_enemy', VEIN);
        put('rt_loot_double', BESIDE);
        const loot = kill(e);
        expect(loot.drops.map(d => d.quantity)).toEqual([2, 2]);
    });

    it('an enemy with no table draws nothing more than its loot', () => {
        const draws = (typeId) => {
            GameState.initNew();
            TileModifiers.clearAll();
            SpriteLayer.init();
            const e = put(typeId, VEIN);
            const spy = vi.spyOn(Math, 'random');
            kill(e);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return n;
        };
        const plain = draws('rt_enemy_plain');
        // A sure two-entry table: the roll and the pick, then what any line draws as it lands (its
        // quantity, its Yield rounding and its sprite's two).
        expect(draws('rt_enemy')).toBe(plain + 6);
    });

    it('a kill banked off the mat banks its find too', () => {
        LootSystem.handleCombatVictory({ enemyId: 'rt_enemy_bare', instanceId: null, drops: [] });
        expect(InventoryManager.getItemCount(PEARL)).toBe(2);
    });
});
