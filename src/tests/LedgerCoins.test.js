import { describe, it, expect } from 'vitest';
import { buildLedger, tokenKey, wedgeKey, starKey, HOW } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { buildPace, roundDown } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE, PROFILES, BEFORE_HALL } from '../../cms/src/engine/ledger/profiles.js';
import { settingsOf, coinMinutesAt, minutesToReach, minutesPerLevelAt, COIN_CURVE, DEFAULT_LEDGER_SETTINGS } from '../../cms/src/engine/ledger/settings.js';
import { ledgerCoinWorth, coinsInPlay } from '../../cms/src/engine/ledger/coins.js';
import { proposeBalance, LEVER } from '../../cms/src/engine/ledger/balance.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import { paceContent } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';
import { WORLD_FIXTURE_TABLES, WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';
import { workspaceBalance, balancePack } from '../../cms/src/engine/ledgerBalance.js';
import { coinsText } from '../../cms/src/engine/ledgerCoins.js';

/**
 * ⭐ The ledger prices coins (brief 870 C3): an item's coin worth comes from its value; selling, kill
 * coin drops and Hideout thefts are the guild's coin supply; a Shop price, a Guild Hall rank and a
 * ring's settling that ask coins wait for them on the timeline; a coin cost is proposed as the
 * coins one hero earns in its curve's minutes for its stage (everyday or big, never times its rank); and a price that
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

describe('⭐ coins in play: what turns Recalculate\'s coin worths on', () => {
    it('a Shop price, a Coin drop, steal coins, a Hall rank or a ring that asks coins; nothing else', () => {
        expect(coinsInPlay({})).toBe(false);
        expect(coinsInPlay({ tokens: paceContent().tokens, hallStars: paceHallSky().stars, world: WORLD_FIXTURE_RAW })).toBe(false);
        expect(coinsInPlay({ tokens: { a: { shop: { price: [], coins: 2 } } } })).toBe(true);
        expect(coinsInPlay({ tokens: { a: { enemy: { level: 1, coinDrop: 1 } } } })).toBe(true);
        expect(coinsInPlay({ tokens: { a: { enemy: { level: 1 }, steal: { coins: 4 } } } })).toBe(true);
        expect(coinsInPlay({ tokens: { a: { shop: { price: [], coins: 0 } }, b: { enemy: { coinDrop: 2.5 } } } })).toBe(false);
        expect(coinsInPlay({ hallStars: { s: { ranks: [{ price: [] }, { price: [], coins: 9 }] } } })).toBe(true);
        expect(coinsInPlay({ world: { prices: { 1: { items: [] }, 2: { items: [], coins: 30 } } } })).toBe(true);
    });
});

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
        expect(r.assumptions).toContainEqual(expect.objectContaining({ source: 'token_plot', what: 'coins' }));
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

describe('⭐ proposed coin costs: two curves by kind of purchase (BALANCE_RULES section 7), rising with distance, never with rank', () => {
    it("the everyday curve by default: one level's time at each tier's opening level on the pace rule, copper at level 10's", () => {
        expect(DEFAULT_LEDGER_SETTINGS.coinCurve).toEqual([
            { tier: 0, minutes: 5 }, { tier: 2, minutes: 9 }, { tier: 3, minutes: 17 }, { tier: 4, minutes: 32 },
            { tier: 5, minutes: 59 }, { tier: 6, minutes: 107 }, { tier: 7, minutes: 361 }
        ]);
        // ⚠️ The points follow the pace step: a moved pace rule fails here until the points are moved with it.
        const s = settingsOf(null);
        for (const { tier, level } of s.tierLevels) {
            expect(coinMinutesAt(s, tier), `tier ${tier}`).toBe(Math.round(minutesPerLevelAt(s, Math.max(10, level))));
        }
    });

    it('the big curve by default: half the payback curve, 1 hour x 24^(L/80) at each tier opening level, copper at its start', () => {
        expect(DEFAULT_LEDGER_SETTINGS.bigCoinCurve).toEqual([
            { tier: 0, minutes: 30 }, { tier: 1, minutes: 45 }, { tier: 2, minutes: 66 }, { tier: 3, minutes: 99 }, { tier: 4, minutes: 147 },
            { tier: 5, minutes: 219 }, { tier: 6, minutes: 325 }, { tier: 7, minutes: 720 }
        ]);
        // ⚠️ Every tier its own point, Plane 1 at level 10's 45 min, not copper's 30: a tier left out would take the one before.
        const s = settingsOf(null);
        expect(s.bigCoinCurve.map(p => p.tier)).toEqual(s.tierLevels.map(t => t.tier));
        for (const { tier, level } of s.tierLevels) {
            const L = tier === 0 ? 0 : level;
            expect(coinMinutesAt(s, tier, COIN_CURVE.BIG), `tier ${tier}`).toBe(Math.round(30 * 24 ** (L / 80)));
        }
    });

    it('each curve is a Ledger setting by stage, read as the last point at or before it', () => {
        const s = settingsOf({ coinCurve: [{ tier: 2, minutes: 40 }, { tier: 0, minutes: 10 }, { tier: 1, minutes: 'x' }], bigCoinCurve: [{ tier: 1, minutes: 90 }] });
        expect(s.coinCurve).toEqual([{ tier: 0, minutes: 10 }, { tier: 2, minutes: 40 }]);
        expect(coinMinutesAt(s, 0)).toBe(10);
        expect(coinMinutesAt(s, 1)).toBe(10);
        expect(coinMinutesAt(s, 3)).toBe(40);
        expect(coinMinutesAt(s, 3, COIN_CURVE.EVERYDAY)).toBe(40);
        expect(coinMinutesAt(s, 0, COIN_CURVE.BIG)).toBeNull();
        expect(coinMinutesAt(s, 4, COIN_CURVE.BIG)).toBe(90);
        expect(coinMinutesAt(settingsOf({ coinCurve: [] }), 1)).toBeNull();
        expect(coinMinutesAt(settingsOf({ bigCoinCurve: [] }), 1, COIN_CURVE.BIG)).toBeNull();
    });

    it('a Shop Token on the everyday curve; a Guild Hall rank on the big one, with no multiplier for its rank', () => {
        const c = withStall(coinContent(), 0);
        c.hallSky = paceHallSky();
        const pace = paceOf(c);
        const rows = pace.coinPrices();
        const typical = pace.coinSupplyOf(PROFILE.TYPICAL, 0).perHour;
        const stall = rows.find(r => r.kind === 'shop' && r.id === 'token_stall');
        expect(stall).toMatchObject({ tier: 0, coins: 0, curve: COIN_CURVE.EVERYDAY, minutes: 5, perHour: typical, proposed: roundDown(typical * 5 / 60) });
        expect(stall.source).toBeTruthy();
        const hallIncome = pace.coinSupplyOf(BEFORE_HALL, 0).perHour;
        const lore1 = rows.find(r => r.kind === 'hall' && r.id === 'ph_lore' && r.rank === 1);
        const lore2 = rows.find(r => r.kind === 'hall' && r.id === 'ph_lore' && r.rank === 2);
        expect(lore1).toMatchObject({ curve: COIN_CURVE.BIG, minutes: 30, proposed: roundDown(hallIncome * 30 / 60) });
        // Both ranks are of the Starter Camp: the same coins, the rank adds nothing.
        expect(lore2).toMatchObject({ curve: COIN_CURVE.BIG, minutes: 30, proposed: lore1.proposed });
    });

    it("further out costs more: the curve's minutes and the income both rise by stage; a ring on the big curve", () => {
        const c = withStall(coinContent(), 0);
        c.tokens.token_stall.plan = { tier: 1 };
        const near = paceOf(c, { coinCurve: [{ tier: 0, minutes: 10 }, { tier: 1, minutes: 30 }] }).coinPrices().find(r => r.id === 'token_stall');
        expect(near).toMatchObject({ tier: 1, minutes: 30 });
        expect(near.proposed).toBe(roundDown(near.perHour * 30 / 60));
        // A ring: settled with the income of the stage before it, at its own ring's minutes on the big curve.
        const ws = worldWorkspace();
        ws.items.item_copper_ore.value = 4;
        const world = { ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES };
        const pace = paceOf(world, { coinCurve: [{ tier: 0, minutes: 1 }], bigCoinCurve: [{ tier: 0, minutes: 10 }, { tier: 2, minutes: 20 }] });
        const rings = pace.coinPrices().filter(r => r.kind === 'ring');
        expect(rings.map(r => r.ring)).toEqual([1, 2, 3]);
        const two = rings.find(r => r.ring === 2);
        expect(two).toMatchObject({ tier: 2, cap: 1, curve: COIN_CURVE.BIG, minutes: 20 });
        expect(two.proposed).toBe(roundDown(pace.coinSupplyOf(PROFILE.TYPICAL, 1).perHour * 20 / 60));
        expect(rings.find(r => r.ring === 1).minutes).toBe(10);
    });

    it('no curve point, or nothing earning coins: no proposal, and why', () => {
        const row = paceOf(withStall(coinContent(), 0), { coinCurve: [] }).coinPrices().find(r => r.id === 'token_stall');
        expect(row.proposed).toBeNull();
        expect(row.why).toMatch(/everyday coin curve/);
        const c = withStall(coinContent(), 0);
        c.hallSky = paceHallSky();
        const hall = paceOf(c, { bigCoinCurve: [] }).coinPrices().find(r => r.kind === 'hall');
        expect(hall.proposed).toBeNull();
        expect(hall.why).toMatch(/big coin curve/);
        const dry = paceOf(withStall(coinContent({ values: false }), 0)).coinPrices().find(r => r.id === 'token_stall');
        expect(dry.proposed).toBeNull();
        expect(dry.why).toMatch(/earns/);
    });
});

describe("⭐ a coin price is set by a worker's selling only: kills and thefts time a way out, never a price", () => {
    /** The Starter Camp with the stall, the Hall, a rat nest dropping 50 coins a kill (9000 an hour) and a Hideout stealing 20 a theft (9000), both past any selling. */
    const rich = (c = withStall(coinContent(), 0)) => {
        c.hallSky = paceHallSky();
        return withHideout(withRats(c, { coinDrop: 50, steal: { crimeLevel: 1, coins: 20 } }));
    };
    const plain = () => {
        const c = withStall(coinContent(), 0);
        c.hallSky = paceHallSky();
        return c;
    };

    it('the selling supply: the best sold work at the moment, never a fight or a theft', () => {
        const pace = paceOf(rich());
        const all = pace.coinSupplyOf(PROFILE.TYPICAL, 0);
        const sell = pace.sellingSupplyOf(PROFILE.TYPICAL, 0);
        const base = paceOf(plain()).coinSupplyOf(PROFILE.TYPICAL, 0);
        expect(all.perHour).toBeGreaterThan(sell.perHour);
        expect(sell).toMatchObject({ perHour: expect.closeTo(base.perHour, 6), theft: null });
        expect(sell.work.target).toEqual(base.work.target);
        expect(pace.coinSourcesOf(PROFILE.TYPICAL, 0).some(src => src.theft)).toBe(true);
        expect(pace.coinSourcesOf(PROFILE.TYPICAL, 0).some(src => src.work?.target.token === 'token_rat')).toBe(true);
        // At the moment of purchase: at the start only level-1 work is sold.
        expect(pace.sellingSupplyOf(PROFILE.TYPICAL, 0, 0).perHour).toBeCloseTo(paceOf(plain()).coinSupplyOf(PROFILE.TYPICAL, 0, 0).perHour, 6);
    });

    it('every proposal is the selling income: a Shop Token, a Guild Hall rank, as if no enemy dropped coins and no Hideout stole', () => {
        const rows = paceOf(rich()).coinPrices();
        const was = paceOf(plain()).coinPrices();
        expect(rows.length).toBe(was.length);
        for (const r of rows) {
            const w = was.find(x => x.kind === r.kind && x.id === r.id && x.rank === r.rank);
            expect(r, `${r.kind} ${r.id} ${r.rank ?? ''}`).toMatchObject({ perHour: expect.closeTo(w.perHour, 6), proposed: w.proposed, source: w.source });
        }
        expect(rows.every(r => !/thefts|Rat/.test(r.source || ''))).toBe(true);
    });

    it('nothing sold earns: no proposal, though kills pay', () => {
        const c = withRats(withStall(coinContent({ values: false }), 0), { coinDrop: 10 });
        const pace = paceOf(c);
        expect(pace.coinSupplyOf(PROFILE.TYPICAL, 0).perHour).toBeGreaterThan(0);
        const row = pace.coinPrices().find(r => r.id === 'token_stall');
        expect(row.proposed).toBeNull();
        expect(row.why).toMatch(/sell/);
    });

    it('kills still pay a price on the timeline: a stall asking 2880 is had sooner with a rat dropping coins', () => {
        const sold = paceOf(withStall(coinContent(), 2880)).pathOf(tokenKey('token_stall'), PROFILE.BARE).own;
        const killed = paceOf(withRats(withStall(coinContent(), 2880), { coinDrop: 10 })).pathOf(tokenKey('token_stall'), PROFILE.BARE).own;
        expect(sold).toBeCloseTo(2880 / 1440);
        expect(killed).toBeCloseTo(2880 / 1800);
    });
});

describe("⭐ the coins tool: kills and thefts an hour per enemy and hoarding camp, beside a worker's selling", () => {
    const rich = () => withHideout(withRats(withStall(coinContent(), 0), { coinDrop: 10, steal: { crimeLevel: 1, coins: 6 } }));

    it("an enemy: the kills an hour it assumes, the coins they make, and half a worker's selling a kill", () => {
        const pace = paceOf(rich());
        const rat = pace.coinDrops().find(d => d.id === 'token_rat');
        const sell = pace.sellingSupplyOf(PROFILE.TYPICAL, 0, 0).perHour;
        expect(rat).toMatchObject({ killsPerHour: expect.closeTo(180, 6), coinsPerHour: expect.closeTo(1800, 6), sellingPerHour: expect.closeTo(sell, 6) });
        expect(rat.halfSellingPerKill).toBe(Math.round(sell / 2 / 180));
    });

    it("a hoarding camp: each Hideout's thefts an hour from it, less those caught, the coins they make, and half a worker's selling a theft", () => {
        const pace = paceOf(rich());
        const rows = pace.coinThefts();
        expect(rows).toHaveLength(1);
        const sell = pace.sellingSupplyOf(PROFILE.TYPICAL, 0, 0).perHour;
        expect(rows[0]).toMatchObject({ camp: 'token_rat_nest', enemy: 'token_rat', hideout: 'token_hideout', tier: 0, thefts: expect.closeTo(450, 6), coins: 6, perHour: expect.closeTo(2700, 6), sellingPerHour: expect.closeTo(sell, 6) });
        expect(rows[0].halfSellingPerTheft).toBe(Math.round(sell / 2 / 450));
        expect(rows[0].campName).toBe('Rat Nest');
        expect(paceOf(withStall(coinContent(), 0)).coinThefts()).toEqual([]);
    });

    it('the tool prints both, and its result carries them', () => {
        const c = rich();
        const pace = paceOf(c);
        const text = coinsText({ supply: [], prices: [], drops: pace.coinDrops(), thefts: pace.coinThefts(), worth: { priced: 0, pinned: 0, inPlay: true }, ms: 0 });
        expect(text).toMatch(/Rat \(level 1\): 10 now.*180 kills an hour.*1800 coins an hour/);
        expect(text).toMatch(/Rat Nest.*Hideout.*450 thefts an hour.*6 coins.*2700 coins an hour/);
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
