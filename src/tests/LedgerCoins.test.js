import { describe, it, expect } from 'vitest';
import { buildLedger, tokenKey, wedgeKey, starKey, HOW } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { buildPace, roundDown } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE, PROFILES, BEFORE_HALL } from '../../cms/src/engine/ledger/profiles.js';
import { settingsOf, coinMinutesAt, minutesToReach, DEFAULT_LEDGER_SETTINGS } from '../../cms/src/engine/ledger/settings.js';
import { ledgerCoinWorth } from '../../cms/src/engine/ledger/coins.js';
import { proposeBalance, LEVER } from '../../cms/src/engine/ledger/balance.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import { paceContent } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';
import { WORLD_FIXTURE_TABLES, WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';
import { workspaceBalance, balancePack } from '../../cms/src/engine/ledgerBalance.js';

/**
 * ⭐ The ledger prices coins (brief 870 C3): an item's coin worth comes from its value; selling, kill
 * coin drops and Hideout thefts are the guild's coin supply; a Shop price, a Guild Hall rank and a
 * ring's settling that ask coins wait for them on the timeline; a coin cost is proposed as the
 * coins one hero earns in the coin curve's minutes for its stage, times its rank; and a price that
 * asks no coins moves nothing. On the pace world (`fixtures/paceWorld.js`) with values: Copper Ore
 * 2, Oak Wood 1, Beer 5. At Bare its vein makes 360 ore an hour (720 coins), the oak 900 wood (900
 * coins) and the Still 360 Beer from 360 wood (1800 less 360: 1440 coins), the best.
 */

const VALUES = { item_copper_ore: 2, item_oak_wood: 1, item_beer: 5 };

function coinContent({ values = true } = {}) {
    const c = paceContent();
    if (values) for (const [id, v] of Object.entries(VALUES)) c.items[id].value = v;
    return c;
}
const paceOf = (c, settings = null) => buildPace(c, buildLedger(c), settings);

/** A rat nest in the Starter Camp: a rat every 20 s, so 180 kills an hour, each dropping `coinDrop`. */
function withRats(c, { coinDrop = 10, steal = null } = {}) {
    c.tokens.token_rat = {
        id: 'token_rat', name: 'Rat', uses: 1, enemy: { level: 1, style: 'melee', ...(coinDrop ? { coinDrop } : {}) },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
        ...(steal ? { steal } : {})
    };
    c.tokens.token_rat_nest = { id: 'token_rat_nest', name: 'Rat Nest', spawner: { spawns: [{ typeId: 'token_rat', weight: 1 }], allowance: 3, intervalMs: 20000, upkeep: [] } };
    c.starterCamp.tokens.push({ typeId: 'token_rat_nest', x: 5, y: 0 });
    return c;
}

/** A Hideout in the Starter Camp: a theft every 6 s, caught one time in four robbing a camp of its own level. */
function withHideout(c) {
    c.tokens.token_hideout = {
        id: 'token_hideout', name: 'Hideout', uses: null,
        config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [], outputs: [] },
        statements: [{ keyword: 'station', payload: { skill: 'crime', stationKind: 'hideout' } }]
    };
    c.starterCamp.tokens.push({ typeId: 'token_hideout', x: 6, y: 0 });
    return c;
}

/** A Shop stall for 36 Copper Ore (a tenth of an hour of the vein at Bare) and `coins`. */
function withStall(c, coins) {
    c.tokens.token_stall = {
        id: 'token_stall', name: 'Stall', tokenType: 'buff', uses: null, config: null,
        shop: { price: [{ itemId: 'item_copper_ore', quantity: 36 }], ...(coins != null ? { coins } : {}) }
    };
    return c;
}

describe('⭐ an item\'s coin worth comes from its value', () => {
    it('its value in whole coins, a pinned worth kept, nothing without either', () => {
        expect(ledgerCoinWorth({ id: 'a', value: 57 })).toBe(57);
        expect(ledgerCoinWorth({ id: 'a', value: 57, coinWorth: 3 })).toBe(57);
        expect(ledgerCoinWorth({ id: 'a', value: 57, coinWorth: 3, sim: { coinWorthPinned: true } })).toBe(3);
        expect(ledgerCoinWorth({ id: 'a', value: null, coinWorth: 3, sim: { coinWorthPinned: true } })).toBe(3);
        expect(ledgerCoinWorth({ id: 'a', value: null })).toBe(0);
        expect(ledgerCoinWorth({ id: 'a' })).toBe(0);
        expect(ledgerCoinWorth(null)).toBe(0);
    });
});

describe('⭐ the coin supply: what one hero earns by each point of play', () => {
    it('selling: the best work\'s net coins an hour, what it makes at its worth less what it spends', () => {
        const pace = paceOf(coinContent());
        const s = pace.coinSupplyOf(PROFILE.BARE, 0);
        expect(s.perHour).toBeCloseTo(1440);
        expect(s.work.target).toMatchObject({ token: 'token_still', recipe: 'recipe_beer' });
        // With no worth anywhere nothing earns coins.
        expect(paceOf(coinContent({ values: false })).coinSupplyOf(PROFILE.BARE, 0).perHour).toBe(0);
        // A pinned worth counts as Recalculate writes it: Oak Wood at 3 makes the oak 2700 an hour.
        const c = coinContent();
        c.items.item_oak_wood.coinWorth = 3;
        c.items.item_oak_wood.sim = { coinWorthPinned: true };
        expect(paceOf(c).coinSupplyOf(PROFILE.BARE, 0)).toMatchObject({ perHour: expect.closeTo(2700, 6) });
    });

    it('⭐ kills: an enemy\'s Coin drop at every kill (180 kills an hour at 10 coins)', () => {
        const book = buildRateBook(withRats(coinContent()));
        const r = book.rateOf({ token: 'token_rat' }, { family: { spawner: 'token_rat_nest' } });
        expect(r).toMatchObject({ ok: true, cyclesPerHour: expect.closeTo(180, 6), coinsPerCycle: 10, coins: expect.closeTo(1800, 6) });
        const s = paceOf(withRats(coinContent())).coinSupplyOf(PROFILE.BARE, 0);
        expect(s.perHour).toBeCloseTo(1800);
        expect(s.work.target).toEqual({ token: 'token_rat' });
        // No Coin drop: the fight earns no coins and the Still is best again.
        expect(buildRateBook(withRats(coinContent(), { coinDrop: 0 })).rateOf({ token: 'token_rat' }, { family: { spawner: 'token_rat_nest' } }).coins).toBeUndefined();
        expect(paceOf(withRats(coinContent(), { coinDrop: 0 })).coinSupplyOf(PROFILE.BARE, 0).perHour).toBeCloseTo(1440);
    });

    it('Coin Find in reach raises a kill\'s coins, rounded to whole coins as the board drops them', () => {
        const c = withRats(coinContent());
        c.tokens.token_counting_house = {
            id: 'token_counting_house', name: 'Counting House', tokenType: 'buff', uses: null, config: null,
            statements: [{ id: 'stm_ch', keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: 'COIN_FIND', bucket: 'percentage', value: 0.55 } }]
        };
        const r = buildRateBook(c).rateOf({ token: 'token_rat' }, { family: { spawner: 'token_rat_nest' }, supports: ['token_counting_house'] });
        // 10 coins +55 % is 15.5, dropped as 16.
        expect(r.coinsPerCycle).toBe(16);
    });

    it('⭐ thefts: a Hideout robbing a camp whose steal table takes coins, less the thefts caught', () => {
        const c = withHideout(withRats(coinContent(), { coinDrop: 0, steal: { crimeLevel: 1, coins: 6 } }));
        const s = paceOf(c).coinSupplyOf(PROFILE.BARE, 0);
        // 600 thefts an hour, a quarter caught: 450 at 6 coins.
        expect(s.perHour).toBeCloseTo(2700);
        expect(s.work).toBeNull();
        expect(s.theft).toMatchObject({ hideout: 'token_hideout', enemy: 'token_rat', thefts: expect.closeTo(450, 6), coins: 6 });
        // A camp of a higher Crime level catches more thieves: 3 points more a level, 34 % at level 4.
        const wary = withHideout(withRats(coinContent(), { coinDrop: 0, steal: { crimeLevel: 4, coins: 6 } }));
        expect(paceOf(wary).coinSupplyOf(PROFILE.BARE, 0).theft.thefts).toBeCloseTo(600 * 0.66);
        // A table with no coins steals none.
        const none = withHideout(withRats(coinContent(), { coinDrop: 0, steal: { crimeLevel: 1, outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] } }));
        expect(paceOf(none).coinSupplyOf(PROFILE.BARE, 0).theft).toBeNull();
    });

    it('a later stage earns at least as much: the supply only grows with the stage', () => {
        const pace = paceOf(coinContent());
        for (const p of PROFILES) expect(pace.coinSupplyOf(p, 1).perHour).toBeGreaterThanOrEqual(pace.coinSupplyOf(p, 0).perHour);
    });
});

describe('⭐ coin costs on the timeline: a price that asks coins waits for them', () => {
    it('a Shop Token: its items and its coins gathered side by side, the slower sets its own time', () => {
        const free = paceOf(withStall(coinContent(), null)).pathOf(tokenKey('token_stall'), PROFILE.BARE);
        expect(free.own).toBeCloseTo(0.1);
        const pace = paceOf(withStall(coinContent(), 2880));
        const priced = pace.pathOf(tokenKey('token_stall'), PROFILE.BARE);
        // 2880 coins at 1440 an hour: two hours, longer than the ore's six minutes.
        expect(priced.own).toBeCloseTo(2);
        expect(priced.step.gather).toMatchObject({ item: 'coins', coins: 2880 });
        // A few coins wait on the ore, as before.
        expect(paceOf(withStall(coinContent(), 14)).pathOf(tokenKey('token_stall'), PROFILE.BARE).own).toBeCloseTo(0.1);
    });

    it('⭐ asking coins nothing earns by then: never had, and a coin-supply finding names it', () => {
        const pace = paceOf(withStall(coinContent({ values: false }), 100));
        const r = pace.pathOf(tokenKey('token_stall'), PROFILE.TYPICAL);
        expect(r.own).toBe(Infinity);
        expect(r.why).toMatch(/coins/);
        const f = pace.findings().filter(x => x.check === 'coin-supply');
        expect(f.map(x => x.key)).toEqual([tokenKey('token_stall')]);
        expect(f[0].message).toMatch(/asks 100 coins/);
        expect(CHECKS['coin-supply']).toMatchObject({ group: 'D' });
    });

    it('a Foundation that asks coins: bought only once they are earned; each build lists them, its levelling not held back', () => {
        const c = coinContent();
        c.tokens.token_plot.shop.coins = 50;
        const r = buildRateBook(c).rateOf({ token: 'token_plot', recipe: 'recipe_build_hut' });
        expect(r).toMatchObject({ coinsPerCycle: -50, coins: expect.closeTo(-6000, 6) });
        expect(r.unmodelled).toContainEqual(expect.objectContaining({ source: 'token_plot', what: 'coins' }));
        const pace = paceOf(c);
        // 10 Oak Wood (40 s of the oak) and 50 coins (125 s of the Still) at Bare.
        expect(pace.pathOf(tokenKey('token_plot'), PROFILE.BARE).own).toBeCloseTo(50 / 1440);
        // Paying coins, it is never a way to earn them.
        expect(pace.coinSourcesOf(PROFILE.BARE, 0).some(src => src.work?.target.recipe === 'recipe_build_hut')).toBe(false);
    });

    it('⭐ the timeline waits for coins: income at the levels the pace curve has reached; a better way worth waiting for is waited for', () => {
        const c = withStall(coinContent(), 2880);
        // A rich seam at Mining 20, worth 100 an ore: 360 ore an hour at 36,000 coins.
        c.items.item_gold = { id: 'item_gold', name: 'Gold', type: 'material', value: 100, plan: { tier: 0 } };
        c.tokens.token_seam = {
            id: 'token_seam', name: 'Gold Seam', tags: ['Ore'], uses: 5, needsTool: { kind: 'pickaxe', minTier: 1 }, respawn: { mode: 'refill', afterMs: 60000 },
            config: { skill: 'mining', skillRequired: 20, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: 'item_gold', chance: 100, minQty: 1, maxQty: 2 }] }
        };
        c.starterCamp.tokens.push({ typeId: 'token_seam', x: 7, y: 0 });
        const pace = paceOf(c);
        const ready = minutesToReach(settingsOf(null), 20) / 60;
        const seam = pace.coinSourcesOf(PROFILE.BARE, 0).find(src => src.work?.target.token === 'token_seam');
        expect(seam).toMatchObject({ perHour: expect.closeTo(36000, 3), readyHours: expect.closeTo(ready, 9) });
        // At the start only level-1 work earns: the Still's 1440 an hour; any level, the seam.
        expect(pace.coinSupplyOf(PROFILE.BARE, 0, 0).perHour).toBeCloseTo(1440);
        expect(pace.coinSupplyOf(PROFILE.BARE, 0).perHour).toBeCloseTo(36000);
        // 2880 coins: two hours at the Still now, or the seam once Mining 20 is had, whichever is sooner.
        const own = pace.pathOf(tokenKey('token_stall'), PROFILE.BARE).own;
        expect(own).toBeCloseTo(Math.min(2, ready + 2880 / 36000));
    });

    it('⭐ a Guild Hall rank: its coins are part of its price, gathered at Typical before the Hall', () => {
        const base = coinContent();
        base.hallSky = paceHallSky();
        const before = paceOf(base).hallPaybacks().find(r => r.id === 'ph_lore' && r.rank === 1);
        const c = coinContent();
        c.hallSky = paceHallSky();
        c.hallSky.stars.ph_lore.ranks[0].coins = 720;
        const pace = paceOf(c);
        const row = pace.hallPaybacks().find(r => r.id === 'ph_lore' && r.rank === 1);
        const supply = pace.coinSupplyOf(BEFORE_HALL, row.cap).perHour;
        expect(supply).toBeGreaterThan(0);
        expect(row.coins).toBe(720);
        expect(row.priceHours).toBeCloseTo(before.priceHours + 720 / supply);
        expect(row.priceText).toMatch(/720 coins/);
    });

    it('⭐ settling: a ring\'s coins wait on what the guild earns with the rings before; a ring star\'s coins on its stage', () => {
        const ws = worldWorkspace();
        ws.items.item_copper_ore.value = 4;
        const content = (w) => ({ ...contentOf(w), worldTables: WORLD_FIXTURE_TABLES });
        const plain = paceOf(content(ws));
        const tables = structuredClone(WORLD_FIXTURE_TABLES);
        tables.prices[1].coins = 500;
        const c = { ...contentOf(ws), worldTables: tables };
        const ledger = buildLedger(c);
        expect(ledger.world.rules.find(r => r.id === 'settle:ores:1')).toMatchObject({ how: HOW.SETTLE, coins: 500 });
        expect(ledger.world.rules.find(r => r.id === 'settle:ores:2').coins).toBeUndefined();
        const pace = buildPace(c, ledger, null);
        const supply = pace.coinSupplyOf(PROFILE.TYPICAL, 0).perHour;
        expect(supply).toBeGreaterThan(0);
        const at = pace.pathOf(wedgeKey('ores', 1), PROFILE.TYPICAL);
        const was = plain.pathOf(wedgeKey('ores', 1), PROFILE.TYPICAL);
        expect(was.own).toBe(0);
        expect(at.own).toBeCloseTo(500 / supply);
        expect(at.hours).toBeCloseTo(was.start + 500 / supply);
        // A ring star's coins (its first rank's) on its own step.
        ws.hallStars.star_ring_2.ranks[0].coins = 300;
        const starred = buildPace({ ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES }, buildLedger({ ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES }), null);
        const lit = starred.pathOf(starKey('star_ring_2'), PROFILE.TYPICAL);
        const tier = buildLedger({ ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES }).reachOf(starKey('star_ring_2')).tier;
        expect(lit.own).toBeGreaterThanOrEqual(300 / starred.coinSupplyOf(PROFILE.TYPICAL, tier).perHour - 1e-9);
        expect(lit.step.gather.item).toBe('coins');
    });
});

describe('⭐ asking no coins moves nothing', () => {
    it('coins 0 or absent, worth on the items or not: every path, stage and Guild Hall row the same', () => {
        const variants = [
            withStall(coinContent({ values: false }), null),
            withStall(coinContent(), null),
            withStall(coinContent(), 0),
            withRats(withStall(coinContent(), 0), { coinDrop: 0 })
        ];
        const read = (c) => {
            c.hallSky = paceHallSky();
            const pace = paceOf(c);
            const keys = [...buildLedger(c).reach.keys()].filter(k => !k.includes('rat')).sort();
            return {
                paths: keys.map(k => PROFILES.map(p => { const r = pace.pathOf(k, p); return [k, r.hours, r.own, r.start]; })),
                stages: pace.settings.stages.map(s => pace.stageOf(s.tier).hours),
                hall: pace.hallPaybacks().map(r => [r.id, r.rank, r.priceHours, r.payback ?? null, r.proposed?.quantity ?? null])
            };
        };
        const first = read(variants[0]);
        for (const v of variants.slice(1, 3)) expect(read(v)).toEqual(first);
    });
});

describe('⭐ proposed coin costs: the coins one hero earns in the coin curve\'s minutes, rising with rank and distance', () => {
    it('the curve is a Ledger setting by stage, read as the last point at or before it; ten minutes to start', () => {
        expect(DEFAULT_LEDGER_SETTINGS.coinCurve).toEqual([{ tier: 0, minutes: 10 }]);
        const s = settingsOf({ coinCurve: [{ tier: 2, minutes: 40 }, { tier: 0, minutes: 10 }, { tier: 1, minutes: 'x' }] });
        expect(s.coinCurve).toEqual([{ tier: 0, minutes: 10 }, { tier: 2, minutes: 40 }]);
        expect(coinMinutesAt(s, 0)).toBe(10);
        expect(coinMinutesAt(s, 1)).toBe(10);
        expect(coinMinutesAt(s, 3)).toBe(40);
        expect(coinMinutesAt(settingsOf({ coinCurve: [] }), 1)).toBeNull();
    });

    it('a Shop Token at its stage; a Guild Hall rank times its rank; each named with the work that earns them', () => {
        const c = withStall(coinContent(), 0);
        c.hallSky = paceHallSky();
        const pace = paceOf(c);
        const rows = pace.coinPrices();
        const typical = pace.coinSupplyOf(PROFILE.TYPICAL, 0).perHour;
        const stall = rows.find(r => r.kind === 'shop' && r.id === 'token_stall');
        expect(stall).toMatchObject({ tier: 0, coins: 0, minutes: 10, perHour: typical, proposed: roundDown(typical * 10 / 60) });
        expect(stall.source).toBeTruthy();
        const hallIncome = pace.coinSupplyOf(BEFORE_HALL, 0).perHour;
        const lore1 = rows.find(r => r.kind === 'hall' && r.id === 'ph_lore' && r.rank === 1);
        const lore2 = rows.find(r => r.kind === 'hall' && r.id === 'ph_lore' && r.rank === 2);
        expect(lore1.proposed).toBe(roundDown(hallIncome * 10 / 60));
        expect(lore2.proposed).toBe(roundDown(hallIncome * 10 / 60 * 2));
        expect(lore2.proposed).toBeGreaterThan(lore1.proposed);
    });

    it('further out costs more: the curve\'s minutes and the income both rise by stage', () => {
        const c = withStall(coinContent(), 0);
        c.tokens.token_stall.plan = { tier: 1 };
        const near = paceOf(c, { coinCurve: [{ tier: 0, minutes: 10 }, { tier: 1, minutes: 30 }] }).coinPrices().find(r => r.id === 'token_stall');
        expect(near).toMatchObject({ tier: 1, minutes: 30 });
        expect(near.proposed).toBe(roundDown(near.perHour * 30 / 60));
        // A ring: settled with the income of the stage before it, at its own ring's minutes.
        const ws = worldWorkspace();
        ws.items.item_copper_ore.value = 4;
        const world = { ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES };
        const pace = paceOf(world, { coinCurve: [{ tier: 0, minutes: 10 }, { tier: 2, minutes: 20 }] });
        const rings = pace.coinPrices().filter(r => r.kind === 'ring');
        expect(rings.map(r => r.ring)).toEqual([1, 2, 3]);
        const two = rings.find(r => r.ring === 2);
        expect(two).toMatchObject({ tier: 2, cap: 1, minutes: 20 });
        expect(two.proposed).toBe(roundDown(pace.coinSupplyOf(PROFILE.TYPICAL, 1).perHour * 20 / 60));
        expect(rings.find(r => r.ring === 1).minutes).toBe(10);
    });

    it('no curve point, or nothing earning coins: no proposal, and why', () => {
        const row = paceOf(withStall(coinContent(), 0), { coinCurve: [] }).coinPrices().find(r => r.id === 'token_stall');
        expect(row.proposed).toBeNull();
        expect(row.why).toMatch(/curve/);
        const dry = paceOf(withStall(coinContent({ values: false }), 0)).coinPrices().find(r => r.id === 'token_stall');
        expect(dry.proposed).toBeNull();
        expect(dry.why).toMatch(/earns/);
    });
});

describe('⭐ the balance tool sets the coins of a price that asks them', () => {
    it('whether anything asks coins: a Shop Token, a Guild Hall rank or a ring; with none the balance works out no coin income', () => {
        expect(paceOf(withStall(coinContent(), 0)).asksCoins()).toBe(false);
        expect(paceOf(withStall(coinContent(), 5)).asksCoins()).toBe(true);
        const c = coinContent();
        c.hallSky = paceHallSky();
        c.hallSky.stars.ph_lore.ranks[1].coins = 3;
        expect(paceOf(c).asksCoins()).toBe(true);
        const ws = worldWorkspace();
        const tables = structuredClone(WORLD_FIXTURE_TABLES);
        tables.prices[3].coins = 9;
        const world = { ...contentOf(ws), worldTables: tables };
        expect(paceOf(world).asksCoins()).toBe(true);
        expect(proposeBalance(withStall(coinContent(), 0), null, { rounds: 1 }).proposals.filter(p => p.lever === LEVER.COINS)).toEqual([]);
    });

    it('a price asking coins is moved to the curve\'s number; one asking none is left alone', () => {
        const c = withStall(coinContent(), 1);
        c.hallSky = paceHallSky();
        c.hallSky.stars.ph_lore.ranks[1].coins = 5;
        const want = paceOf(structuredClone(c)).coinPrices();
        const result = proposeBalance(c, null, { rounds: 1 });
        const coins = result.proposals.filter(p => p.lever === LEVER.COINS);
        const stall = coins.find(p => p.id === 'token_stall');
        expect(stall).toMatchObject({ kind: 'token', field: 'shop.coins', from: 1, to: want.find(r => r.id === 'token_stall').proposed });
        const lore = coins.find(p => p.id === 'ph_lore');
        expect(lore).toMatchObject({ kind: 'hallStar', field: 'ranks.1.coins', from: 5, to: want.find(r => r.id === 'ph_lore' && r.rank === 2).proposed });
        // The Plot and Lore's first rank ask none: no proposal.
        expect(coins.filter(p => p.id === 'token_plot' || p.field === 'ranks.0.coins')).toEqual([]);
        // The content handed in is never changed.
        expect(c.tokens.token_stall.shop.coins).toBe(1);
    });
});

describe('⭐ a coin proposal as a change pack', () => {
    it('a ring asking coins: the pack carries the workspace own world record with the new coins', () => {
        const ws = worldWorkspace();
        ws.items.item_copper_ore.value = 4;
        ws.world = structuredClone(WORLD_FIXTURE_RAW);
        ws.world.prices[2].coins = 5;
        const result = workspaceBalance(ws);
        const p = result.proposals.find(x => x.lever === LEVER.COINS && x.kind === 'world');
        expect(p).toMatchObject({ id: 'world', field: 'prices.2.coins', from: 5 });
        expect(p.to).toBeGreaterThan(5);
        const pack = balancePack(ws, result, { id: 'coin-test', createdAt: '2026-11-25T00:00:00Z' });
        const entry = pack.entries.find(e => e.kind === 'world');
        expect(entry.value.prices[2].coins).toBe(p.to);
        expect(entry.value.prices[1].coins).toBeUndefined();
        expect(entry.value.lines).toEqual(ws.world.lines);
        expect(ws.world.prices[2].coins).toBe(5);
    });
});
