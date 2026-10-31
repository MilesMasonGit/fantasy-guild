import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, FACTOR } from '../systems/progression/ledger/rates.js';
import { buildPace, roundDown } from '../systems/progression/ledger/pace.js';
import { PROFILE, BEFORE_HALL } from '../systems/progression/ledger/profiles.js';
import { hallGraph, openingPath, hallTracksOf } from '../systems/progression/ledger/hall.js';
import { CHECKS } from '../systems/progression/ledger/checks.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { tierOf } from '../config/hallStars.js';
import { paceContent } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';

/**
 * The ledger knows the Guild Hall (brief 320 H2): the rate calculator reads every star a setup holds
 * as a switchable factor; Bare holds none, Typical buys a rank when it pays back at Typical, Maxed
 * holds them all; every rank's payback and a proposed price; the Hall's share in the per-skill
 * breakdown. On the pace world (`fixtures/paceWorld.js`, its vein at 10 XP a cycle so the XP floor
 * stays out of the way) with a small sky (`fixtures/paceHallSky.js`). The calculator against the
 * board is `LedgerRates.test.js`; against the engine, `npm run bench:calibrate` (the `vein-hall` setup).
 */

const content = () => {
    const c = paceContent();
    c.tokens.token_vein.config.xp = 10;
    c.hallSky = paceHallSky();
    return c;
};
const world = (settings = null) => {
    const c = content();
    return buildPace(c, buildLedger(c), settings);
};
const VEIN = { token: 'token_vein' };

describe('the rate calculator reads a star the setup holds', () => {
    const book = () => buildRateBook(content());

    it('a Mining XP star at its rank, named as a Guild Hall factor and switchable by id or kind', () => {
        const b = book();
        expect(b.rateOf(VEIN).xp.mining).toBeCloseTo(2400);
        const lore = b.rateOf(VEIN, { hallRanks: { ph_lore: 1 } });
        // 240 cycles an hour, 10 XP each +50 %.
        expect(lore.xp.mining).toBeCloseTo(3600);
        expect(lore.factors.find(f => f.id === 'hall:ph_lore')).toMatchObject({ kind: FACTOR.HALL, name: 'Lore rank 1', on: true, axes: [EFFECT_TYPES.XP_BONUS] });
        expect(b.rateOf(VEIN, { hallRanks: { ph_lore: 2 } }).xp.mining).toBeCloseTo(4800);
        // A rank past the star's top is its top.
        expect(b.rateOf(VEIN, { hallRanks: { ph_lore: 9 } }).xp.mining).toBeCloseTo(4800);
        expect(b.rateOf(VEIN, { hallRanks: { ph_lore: 1 }, off: ['hall:ph_lore'] }).xp.mining).toBeCloseTo(2400);
        expect(b.rateOf(VEIN, { hallRanks: { ph_lore: 1 }, off: ['hall'] }).xp.mining).toBeCloseTo(2400);
    });

    it('a work-speed star shortens the cycle; a star aimed at the vein shortens its rest', () => {
        const b = book();
        const quick = b.rateOf(VEIN, { hallRanks: { ph_quick: 1 } });
        expect(quick.cycleMs).toBe(2400);
        // Five cycles of 2.4 s and the minute's rest.
        expect(quick.cyclesPerHour).toBeCloseTo(5 * 3600 / 72);
        const deep = b.rateOf(VEIN, { hallRanks: { ph_deep: 1 } });
        expect(deep.lifecycle.restMs).toBe(30000);
        expect(deep.cyclesPerHour).toBeCloseTo(5 * 3600 / 45);
        expect(deep.factors.find(f => f.id === 'hall:ph_deep').axes).toEqual([EFFECT_TYPES.GROW_TIME]);
        // Aimed at the vein, it reaches nothing else.
        expect(b.rateOf({ token: 'token_oak' }, { hallRanks: { ph_deep: 1 } }).factors.find(f => f.id === 'hall:ph_deep').axes).toEqual([]);
    });

    it('the Well\'s line pays at the Hall each lap, and a wider camp is named as taken, not read', () => {
        const b = book();
        const hall = b.rateOf({ token: 'token_guild_hall' }, { hallRanks: { wishing_well: 1, ph_spring: 2 } });
        expect(hall.items.item_copper_ore).toBeCloseTo(20 * 12);
        expect(hall.items.item_water).toBeCloseTo(10 * 12);
        expect(hall.factors.map(f => f.id)).toEqual(['self:token_guild_hall', 'hall:wishing_well', 'hall:ph_spring']);
        expect(b.rateOf({ token: 'token_guild_hall' }, { hallRanks: { ph_spring: 2 }, off: ['hall:ph_spring'] }).items.item_copper_ore).toBeUndefined();

        const camped = b.rateOf(VEIN, { camp: { id: 'token_mining_camp', members: 3 }, hallRanks: { ph_rails: 1 } });
        expect(camped.cyclesPerHour).toBeCloseTo(720);
        expect(camped.assumptions).toContainEqual(expect.objectContaining({ source: 'hall:ph_rails', what: 'camp reach' }));
    });

    it('content with no sky rates as before, and a tier written as null is not set', () => {
        const c = paceContent();
        expect(buildRateBook(c).hall.stars).toEqual([]);
        expect(tierOf(null)).toBeNull();
        expect(tierOf(0)).toBe(0);
        expect(tierOf('2')).toBe(2);
    });
});

describe('the profiles and the Hall', () => {
    it('Bare holds no star', () => {
        const bare = world().rateAt(VEIN, PROFILE.BARE, 1);
        expect(bare.chosen).toEqual([]);
        expect(Object.values(bare.setup.hallRanks).every(r => r === 0)).toBe(true);
        expect(bare.xp.mining).toBeCloseTo(2400);
    });

    it('Typical buys the ranks that pay back at Typical, opening a star through the cheapest stars before it', () => {
        const pace = world();
        const typical = pace.rateAt(VEIN, PROFILE.TYPICAL, 0);
        const hall = typical.chosen.filter(c => c.kind === 'hall');
        expect(hall.map(c => c.id)).toEqual(['ph_deep:1', 'ph_lore:2']);
        // Deep Veins sits behind Quick Picks, behind Lore: both lit at rank 1 to open it, their price in its own.
        expect(hall[0].path).toEqual(['ph_lore', 'ph_quick']);
        expect(typical.setup.hallRanks).toMatchObject({ ph_lore: 2, ph_quick: 1, ph_deep: 1, ph_gold: 0, ph_rich: 0 });
        for (const c of hall) expect(c.payback).toBeLessThanOrEqual(2);
        // The Gold Leaf's 1 % for 100,000 Oak Wood never pays back; Rich Seams is a plane-1 rank.
        expect(hall.map(c => c.upgrade)).not.toContain('ph_gold');
        expect(hall.map(c => c.upgrade)).not.toContain('ph_rich');
        expect(pace.rateAt(VEIN, PROFILE.TYPICAL, 1).chosen.map(c => c.id)).toContain('ph_rich:1');
        // Ten XP a cycle, +10 % Beer and +100 % Lore; the camp's three veins, each 2.4 s a cycle and a 30 s rest.
        expect(typical.rate.cycleMs).toBe(2400);
        expect(typical.xp.mining).toBeCloseTo(3 * 5 * 3600 / 42 * 21);
    });

    it('Typical-before-the-Hall is Typical with no star: what a Hall price is gathered at', () => {
        const pace = world();
        expect(pace.rateAt(VEIN, BEFORE_HALL, 0).chosen.some(c => c.kind === 'hall')).toBe(false);
        // The camp's three veins, the Mine's quarter more.
        expect(pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour).toBeCloseTo(720 * 1.5 * 1.25);
    });

    it('Maxed holds every rank on offer, the Gold Leaf too, and nothing from a later tier', () => {
        const pace = world();
        const maxed = pace.rateAt(VEIN, PROFILE.MAXED, 0);
        expect(maxed.setup.hallRanks).toMatchObject({ ph_lore: 2, ph_quick: 1, ph_deep: 1, ph_gold: 1, ph_rich: 0 });
        expect(pace.rateAt(VEIN, PROFILE.MAXED, 1).setup.hallRanks.ph_rich).toBe(1);
        expect(maxed.items.item_copper_ore).toBeGreaterThan(pace.rateAt(VEIN, PROFILE.TYPICAL, 0).items.item_copper_ore);
    });

    it('a rank that gives the work nothing is bought on the way to the rank above it, its price added', () => {
        const c = content();
        // Lore's first rank now helps only farming: the vein gains from its second rank alone. Quick Picks
        // opens from the Hall, so no other star's way runs through Lore.
        c.hallSky.stars.ph_lore.ranks[0].rules[0].payload.category = 'farming';
        c.hallSky.stars.ph_quick.links = ['hall'];
        const pace = buildPace(c, buildLedger(c), null);
        const lore = pace.rateAt(VEIN, PROFILE.TYPICAL, 0).chosen.find(x => x.upgrade === 'ph_lore');
        expect(lore.id).toBe('ph_lore:2');
        expect(lore.price).toBeCloseTo((10 + 20) / 1350);
    });

    it('a longer payback time lets Typical buy the Gold Leaf too', () => {
        const pace = world({ paybackHours: 1e6 });
        expect(pace.rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_gold).toBe(1);
    });
});

describe('every rank\'s payback at Typical, and the price the ledger proposes', () => {
    const rowOf = (pace, id, rank) => pace.hallPaybacks().find(r => r.id === id && r.rank === rank);

    it('the hours its price takes to gather at Typical before the Hall, over the hours it saves an hour where it saves most', () => {
        const pace = world();
        const lore = rowOf(pace, 'ph_lore', 1);
        expect(lore).toMatchObject({ rate: true, tier: 0, cap: 0, pays: true, priceText: '10 Copper Ore' });
        expect(lore.priceHours).toBeCloseTo(10 / 1350);
        expect(pace.workName(lore.work)).toBe('Copper Vein');
        const measured = pace.profiles.hallRankOn(VEIN, 0, 'ph_lore', 1);
        expect(lore.gain).toBeCloseTo(measured.saves);
        expect(lore.payback).toBeCloseTo(lore.priceHours / lore.gain);
        expect(rowOf(pace, 'ph_rich', 1).cap).toBe(1);
    });

    it('a rank that does not pay back is a finding; a star that adds no rate is named, not priced', () => {
        const pace = world();
        expect(rowOf(pace, 'ph_gold', 1)).toMatchObject({ rate: true, pays: false });
        const f = pace.findings();
        const gold = f.find(x => x.check === 'hall-payback' && x.key === 'hall:ph_gold');
        expect(gold.message).toMatch(/Gold Leaf rank 1 \(Starter Camp\) costs 100000 Oak Wood \(.* to gather at Typical\) and saves \d+ s an hour on Copper Vein: it pays back in/);
        expect(f.filter(x => x.check === 'hall-payback')).toHaveLength(1);
        expect(rowOf(pace, 'ph_infirmary', 1)).toMatchObject({ rate: false });
        expect(rowOf(pace, 'ph_rails', 1)).toMatchObject({ rate: false });
        expect(f).toContainEqual(expect.objectContaining({ check: 'unmodelled', key: 'hall:ph_infirmary' }));
        for (const x of f) expect(CHECKS[x.check]?.group).toBe('D');
    });

    it('proposes the most of its tier\'s material it can cost and still pay back in time, rounded down', () => {
        const pace = world();
        const lore = rowOf(pace, 'ph_lore', 1);
        // Mining's own material at the Starter Camp, at Typical-before-the-Hall's 1350 an hour.
        expect(lore.proposed.itemId).toBe('item_copper_ore');
        expect(lore.proposed.quantity).toBe(roundDown(2 * lore.gain * 1350));
        expect(lore.proposed.payback).toBeLessThanOrEqual(2);
        expect(lore.proposed.payback).toBeGreaterThan(1.5);
        // The Well's Spring pays Copper Ore, so it is priced in something else; its second rank has no tier.
        expect(rowOf(pace, 'ph_spring', 1).proposed.itemId).toBe('item_oak_wood');
        expect(rowOf(pace, 'ph_spring', 2).proposed).toEqual({ why: 'no tier set' });
        expect(rowOf(pace, 'ph_gold', 1).proposed.quantity).toBeGreaterThanOrEqual(1);
    });

    it('a rank set past the last stage the pace knows is measured at that stage, and says so', () => {
        const c = content();
        c.hallSky.stars.ph_gold.ranks[0].tier = 5;
        const pace = buildPace(c, buildLedger(c), null);
        const gold = rowOf(pace, 'ph_gold', 1);
        expect(gold).toMatchObject({ tier: 5, cap: pace.maxTier });
        expect(pace.maxTier).toBe(2);
        expect(pace.findings().find(x => x.key === 'hall:ph_gold').message).toMatch(/^Gold Leaf rank 1 \(Plane 5, measured at Plane 2, the last stage the pace knows\)/);
        // Never on offer before its own tier.
        expect(pace.rateAt(VEIN, PROFILE.MAXED, 2).setup.hallRanks.ph_gold).toBe(0);
    });

    it('rounds a proposal down to two figures', () => {
        expect([roundDown(0.5), roundDown(7.9), roundDown(57.9), roundDown(137), roundDown(1234), roundDown(98765)]).toEqual([0, 7, 57, 130, 1200, 98000]);
    });
});

describe('the per-skill breakdown shows the Hall\'s share', () => {
    it('at Typical and at Maxed, one name per star at the rank held', () => {
        const mining = world().breakdown().find(r => r.skill === 'mining');
        expect(mining.profiles.typical.kinds.hall.names).toEqual(['Lore 2', 'Quick Picks 1', 'Deep Veins 1']);
        expect(mining.profiles.typical.kinds.hall.gain).toBeGreaterThan(1);
        expect(mining.profiles.maxed.kinds.hall.names).toEqual(['Lore 2', 'Quick Picks 1', 'Deep Veins 1', 'Gold Leaf 1']);
    });
});

describe('the neighbour gate', () => {
    const tracks = hallTracksOf(buildRateBook(content()));
    const graph = hallGraph(tracks);
    const cost = { ph_lore: 1, ph_quick: 2, ph_deep: 4, ph_gold: 8, ph_rich: 1, ph_rails: 1 };
    const light = (id) => cost[id] ?? Infinity;

    it('a star linked to the Hall, or beside a lit one, is open', () => {
        expect(openingPath('ph_lore', graph, () => 0, light)).toEqual({ path: [], cost: 0 });
        expect(openingPath('ph_quick', graph, (id) => (id === 'ph_lore' ? 1 : 0), light)).toEqual({ path: [], cost: 0 });
        // The Well's star opens beside the Wishing Well, whose first rank is free.
        expect(openingPath('ph_spring', graph, (id) => (id === 'wishing_well' ? 1 : 0), light)).toEqual({ path: [], cost: 0 });
    });

    it('a closed star opens through the cheapest stars before it, or not at all', () => {
        expect(openingPath('ph_deep', graph, () => 0, light)).toEqual({ path: ['ph_lore', 'ph_quick'], cost: 3 });
        expect(openingPath('ph_deep', graph, (id) => (id === 'ph_lore' ? 1 : 0), light)).toEqual({ path: ['ph_quick'], cost: 2 });
        expect(openingPath('ph_deep', graph, () => 0, (id) => (id === 'ph_quick' ? Infinity : light(id)))).toBeNull();
    });
});
