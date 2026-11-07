import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, FACTOR } from '../systems/progression/ledger/rates.js';
import { buildPace, roundDown, roundUp } from '../systems/progression/ledger/pace.js';
import { settingsOf } from '../systems/progression/ledger/settings.js';
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
        // Six 10-minute laps an hour with no lap star (`DropLap.test.js` buys it).
        expect(hall.items.item_copper_ore).toBeCloseTo(20 * 6);
        expect(hall.items.item_water).toBeCloseTo(10 * 6);
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
        for (const c of hall) expect(c.payback).toBeLessThanOrEqual(24);
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

    it('the Hall has its own payback time, a day unless set: the boosts\' two hours never decide a rank', () => {
        expect(settingsOf(null)).toMatchObject({ paybackHours: 2, hallPaybackHours: 24 });
        expect(settingsOf({ hallPaybackHours: 6 }).hallPaybackHours).toBe(6);
        expect(world({ hallPaybackHours: 1e6 }).rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_gold).toBe(1);
        expect(world({ paybackHours: 1e6 }).rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_gold).toBe(0);
    });

    it('a rank that pays back in hours, not minutes, is bought within the Hall\'s day and not within two hours', () => {
        const c = content();
        // Rich Seams (no other star opens through it) at 1,200 Copper Ore: about 50 minutes of gathering for half as much ore again.
        c.hallSky.stars.ph_rich.ranks[0].price = [{ itemId: 'item_copper_ore', quantity: 1200 }];
        const day = buildPace(c, buildLedger(c), null);
        const row = day.hallPaybacks().find(r => r.id === 'ph_rich' && r.rank === 1);
        expect(row.payback).toBeGreaterThan(2);
        expect(row.payback).toBeLessThan(24);
        expect(row.pays).toBe(true);
        expect(day.rateAt(VEIN, PROFILE.TYPICAL, 1).setup.hallRanks.ph_rich).toBe(1);
        const hours = buildPace(c, buildLedger(c), { hallPaybackHours: 2 });
        expect(hours.hallPaybacks().find(r => r.id === 'ph_rich' && r.rank === 1).pays).toBe(false);
        expect(hours.rateAt(VEIN, PROFILE.TYPICAL, 1).setup.hallRanks.ph_rich).toBe(0);
        expect(hours.findings().some(f => f.key === 'hall:ph_rich' && /over the 2 h a Guild Hall rank has to pay for itself/.test(f.message))).toBe(true);
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
        expect(lore.proposed.quantity).toBe(roundDown(24 * lore.gain * 1350));
        expect(lore.proposed).toMatchObject({ pays: true });
        expect(lore.proposed.payback).toBeLessThanOrEqual(24);
        expect(lore.proposed.payback).toBeGreaterThan(20);
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

    it('never proposes a rank cheaper than the one before: raised, marked, and red when it then pays back too slowly', () => {
        const pace = world();
        const one = rowOf(pace, 'ph_lore', 1).proposed;
        const two = rowOf(pace, 'ph_lore', 2);
        // Rank 2 saves less than rank 1 (+50 % on +50 %), so on its own it would cost less.
        expect(roundDown(24 * two.gain * 1350)).toBeLessThan(one.quantity);
        expect(two.proposed).toMatchObject({ itemId: 'item_copper_ore', quantity: one.quantity, raised: true, pays: false });
        expect(two.proposed.payback).toBeCloseTo((one.quantity / 1350) / two.gain);
        expect(two.proposed.payback).toBeGreaterThan(24);
        // Every authored star's proposals, rank by rank, never fall.
        for (const id of ['ph_lore', 'ph_quick', 'ph_deep', 'ph_gold', 'ph_rich', 'ph_spring']) {
            const proposed = pace.hallPaybacks().filter(r => r.id === id && r.proposed?.itemId).map(r => r.proposed);
            for (let i = 1; i < proposed.length; i++) {
                expect(proposed[i].priceHours).toBeGreaterThanOrEqual(proposed[i - 1].priceHours - 1e-9);
                if (proposed[i].itemId === proposed[i - 1].itemId) expect(proposed[i].quantity).toBeGreaterThanOrEqual(proposed[i - 1].quantity);
            }
        }
    });

    it('rounds a proposal down to two figures, and a raised one up', () => {
        expect([roundDown(0.5), roundDown(7.9), roundDown(57.9), roundDown(137), roundDown(1234), roundDown(98765)]).toEqual([0, 7, 57, 130, 1200, 98000]);
        expect([roundUp(0.2), roundUp(7.1), roundUp(57), roundUp(131), roundUp(1201), roundUp(98001), roundUp(1300)]).toEqual([1, 8, 57, 140, 1300, 99000, 1300]);
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

describe('the payback check counts opening a star; a skill that gathers nothing is priced in its main input', () => {
    const rowOf = (pace, id, rank) => pace.hallPaybacks().find(r => r.id === id && r.rank === rank);
    const rule = (id, type, value, category) => ({ id: `stm_ph_${id}`, keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, payload: { type, bucket: 'percentage', value, category } });
    const addStar = (c, id, constellation, links, price, rules) => {
        c.hallSky.stars[id] = { id, constellation, name: id.slice(3), description: '', node: { x: 0.5, y: 0 }, links, ranks: [{ tier: 0, price, rules, lines: [] }] };
    };

    it('a star behind one Typical never lights counts lighting it, so it does not pay back, as Typical does not buy it', () => {
        const c = content();
        // Only through the Gold Leaf (100,000 Oak Wood): cheap itself, dear to open.
        addStar(c, 'ph_beyond', 'ph_mining', ['ph_gold'], [{ itemId: 'item_copper_ore', quantity: 5 }], [rule('beyond', 'YIELD', 0.5, 'mining')]);
        const pace = buildPace(c, buildLedger(c), null);
        const row = rowOf(pace, 'ph_beyond', 1);
        expect(row.opening.path).toEqual(['ph_gold']);
        expect(row.opening.cost).toBeCloseTo(100000 / pace.supplyOf('item_oak_wood', BEFORE_HALL, 0).perHour);
        expect(row.payback).toBeCloseTo((row.priceHours + row.opening.cost) / row.gain);
        expect(row.pays).toBe(false);
        expect(pace.rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_beyond).toBe(0);
        // No price can make it pay: opening it alone takes longer.
        expect(row.proposed.why).toMatch(/Gold Leaf/);
        expect(pace.findings().find(x => x.check === 'hall-payback' && x.key === 'hall:ph_beyond').message).toMatch(/to open it, lighting Gold Leaf/);
    });

    it('a star beside one Typical holds for its own sake opens free; one Typical lit only to open it is counted', () => {
        const pace = world();
        expect(rowOf(pace, 'ph_quick', 1).opening).toEqual({ path: [], cost: 0 });
        expect(rowOf(pace, 'ph_lore', 2).opening).toEqual({ path: [], cost: 0 });
        // Typical opened Deep Veins through Quick Picks, which it holds for nothing else.
        const deep = rowOf(pace, 'ph_deep', 1);
        expect(deep.opening.path).toEqual(['ph_quick']);
        expect(deep.opening.cost).toBeCloseTo(15 / pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour);
    });

    it('a rank whose own price is affordable but whose opening is dear is proposed what is left of the payback time', () => {
        const c = content();
        // Behind Long Rails (5 Copper Ore), which adds no rate, so Typical never lights it for its own sake.
        addStar(c, 'ph_vein_lore', 'ph_mining', ['ph_rails'], [{ itemId: 'item_copper_ore', quantity: 5 }], [rule('vein_lore', 'XP_BONUS', 0.5, 'mining')]);
        c.hallSky.stars.ph_rails.links = ['hall'];
        const pace = buildPace(c, buildLedger(c), null);
        const row = rowOf(pace, 'ph_vein_lore', 1);
        expect(row.opening.path).toEqual(['ph_rails']);
        const perHour = pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour;
        expect(row.opening.cost).toBeCloseTo(5 / perHour);
        expect(row.proposed.quantity).toBe(roundDown((24 * row.gain - row.opening.cost) * perHour));
        expect(row.proposed.payback).toBeCloseTo((row.proposed.priceHours + row.opening.cost) / row.gain);
        expect(row.proposed.payback).toBeLessThanOrEqual(24);
    });

    it('every rank that pays back is one Typical buys on the work it saves most on', () => {
        const pace = world();
        const paying = pace.hallPaybacks().filter(r => !r.builtIn && r.rate && r.pays && r.work);
        expect(paying.length).toBeGreaterThan(2);
        for (const row of paying) {
            const held = pace.rateAt(row.work.target, PROFILE.TYPICAL, row.cap).setup.hallRanks?.[row.id] || 0;
            expect([row.id, row.rank, held >= row.rank]).toEqual([row.id, row.rank, true]);
        }
    });

    it('a star of a skill that gathers nothing is priced in that skill\'s main input, not the fastest gathered item', () => {
        const c = content();
        // Ten XP a brew, so the XP floor stays out of the way.
        c.recipes.find(r => r.id === 'recipe_beer').xp = 10;
        c.hallSky.constellations.ph_cooking = { id: 'ph_cooking', name: 'Cooking', label: { x: 0, y: 0 }, skill: 'cooking' };
        addStar(c, 'ph_brew', 'ph_cooking', ['hall'], [{ itemId: 'item_oak_wood', quantity: 10 }], [rule('brew', 'XP_BONUS', 0.5, 'cooking')]);
        const pace = buildPace(c, buildLedger(c), null);
        // Copper Ore is gathered faster, but Cooking spends Oak Wood (its Beer).
        expect(pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour).toBeGreaterThan(pace.supplyOf('item_oak_wood', BEFORE_HALL, 0).perHour);
        const row = rowOf(pace, 'ph_brew', 1);
        expect(row.rate).toBe(true);
        expect(row.proposed.itemId).toBe('item_oak_wood');
        // A gathering skill is still priced in its own gathered item.
        expect(rowOf(pace, 'ph_lore', 1).proposed.itemId).toBe('item_copper_ore');

        // A chest Cooking opens yields ore, but Cooking is the best source of nothing: still its main input.
        c.tokens.token_pantry = {
            id: 'token_pantry', name: 'Pantry', uses: 1,
            config: { skill: 'cooking', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] }
        };
        c.starterCamp.tokens.push({ typeId: 'token_pantry', x: 5, y: 0 });
        const chests = buildPace(c, buildLedger(c), null);
        expect(chests.workOf({ token: 'token_pantry' })).toBeTruthy();
        expect(rowOf(chests, 'ph_brew', 1).proposed.itemId).toBe('item_oak_wood');
    });
});
