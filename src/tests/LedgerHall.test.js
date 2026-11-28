import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, FACTOR } from '../../cms/src/engine/ledger/rates.js';
import { buildPace, roundDown, roundUp } from '../../cms/src/engine/ledger/pace.js';
import { settingsOf, paybackHoursAt } from '../../cms/src/engine/ledger/settings.js';
import { PROFILE, BEFORE_HALL } from '../../cms/src/engine/ledger/profiles.js';
import { hallGraph, openingPath, hallTracksOf } from '../../cms/src/engine/ledger/hall.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { tierOf } from '../config/hallStars.js';
import { paceContent } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';
import { withRequiredThree } from './fixtures/hallSky.js';

/** These numbers were worked out for a camp of two nodes, the sparse layout; the pace times the dense one by default. */
const SPARSE = { layout: 'sparse' };

/**
 * The ledger knows the Guild Hall (brief 320 H2): the rate calculator reads every star a setup holds
 * as a switchable factor; Bare holds none, Typical buys a rank when it pays back at Typical, Maxed
 * holds them all; every rank's payback and a proposed price; the Hall's share in the per-skill
 * breakdown. On the pace world (`fixtures/paceWorld.js`, its vein at 10 XP a cycle so its XP
 * bonuses read as whole numbers) with a small sky (`fixtures/paceHallSky.js`). The calculator against the
 * board is `LedgerRates.test.js`; against the engine, `npm run bench:calibrate` (the `vein-hall` setup).
 */

const content = () => {
    const c = paceContent();
    c.tokens.token_vein.config.xp = 10;
    c.hallSky = withRequiredThree(paceHallSky());
    return c;
};
const world = (settings = null) => {
    const c = content();
    return buildPace(c, buildLedger(c), { ...SPARSE, ...settings });
};
const VEIN = { token: 'token_vein' };
/** A batch factor every drink meets: Typical drinks what its own weighing takes, as these tests were written for. */
const ANY_BATCH = { batchPayback: 1e-6 };

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

    it('the Well\'s line pays at the Hall each lap, and a held Camp Reach star (retired) is neither read nor named', () => {
        const b = book();
        const hall = b.rateOf({ token: 'token_guild_hall' }, { hallRanks: { wishing_well: 1, ph_spring: 2 } });
        // Six 10-minute laps an hour with no lap star (`DropLap.test.js` buys it).
        expect(hall.items.item_copper_ore).toBeCloseTo(20 * 6);
        expect(hall.items.item_water).toBeCloseTo(10 * 6);
        expect(hall.factors.map(f => f.id)).toEqual(['self:token_guild_hall', 'hall:wishing_well', 'hall:ph_spring']);
        expect(b.rateOf({ token: 'token_guild_hall' }, { hallRanks: { ph_spring: 2 }, off: ['hall:ph_spring'] }).items.item_copper_ore).toBeUndefined();

        const camped = b.rateOf(VEIN, { camp: { id: 'token_mining_camp', members: 3 }, hallRanks: { ph_rails: 1 } });
        expect(camped.cyclesPerHour).toBeCloseTo(720);
        expect(camped.assumptions.some(a => a.source === 'hall:ph_rails')).toBe(false);
        expect(camped.factors.find(f => f.id === 'hall:ph_rails')?.axes ?? []).toEqual([]);
    });

    it('content with no sky rates no star, standing in for none, and a tier written as null is not set', () => {
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
        const pace = world(ANY_BATCH);
        const typical = pace.rateAt(VEIN, PROFILE.TYPICAL, 0);
        const hall = typical.chosen.filter(c => c.kind === 'hall');
        expect(hall.map(c => c.id)).toEqual(['ph_deep:1', 'ph_lore:2']);
        // Deep Veins sits behind Quick Picks, behind Lore: both lit at rank 1 to open it, their price in its own.
        expect(hall[0].path).toEqual(['ph_lore', 'ph_quick']);
        expect(typical.setup.hallRanks).toMatchObject({ ph_lore: 2, ph_quick: 1, ph_deep: 1, ph_gold: 0, ph_rich: 0 });
        for (const c of hall) expect(c.payback).toBeLessThanOrEqual(paybackHoursAt(1));
        // The Gold Leaf's 1 % for 100,000 Oak Wood never pays back; Rich Seams is a plane-1 rank.
        expect(hall.map(c => c.upgrade)).not.toContain('ph_gold');
        expect(hall.map(c => c.upgrade)).not.toContain('ph_rich');
        expect(pace.rateAt(VEIN, PROFILE.TYPICAL, 1).chosen.map(c => c.id)).toContain('ph_rich:1');
        // Ten XP a cycle, +10 % Beer and +100 % Lore; the camp's two veins (the sparse layout), each 2.4 s a cycle and a 30 s rest.
        expect(typical.rate.cycleMs).toBe(2400);
        expect(typical.xp.mining).toBeCloseTo(2 * 5 * 3600 / 42 * 21);
    });

    it('Typical-before-the-Hall is Typical with no star: what a Hall price is gathered at', () => {
        const pace = world();
        expect(pace.rateAt(VEIN, BEFORE_HALL, 0).chosen.some(c => c.kind === 'hall')).toBe(false);
        // The camp's two veins, and four Mines (each a 25 % double): a sure double.
        expect(pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour).toBeCloseTo(480 * 1.5 * 2);
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
        const pace = buildPace(c, buildLedger(c), SPARSE);
        const lore = pace.rateAt(VEIN, PROFILE.TYPICAL, 0).chosen.find(x => x.upgrade === 'ph_lore');
        expect(lore.id).toBe('ph_lore:2');
        expect(lore.price).toBeCloseTo((10 + 20) / 1440);
    });

    it('no Guild Hall payback setting: the boosts\' two hours never decide a rank, nor a stored day', () => {
        expect(settingsOf(null)).toMatchObject({ paybackHours: 2 });
        expect(settingsOf(null)).not.toHaveProperty('hallPaybackHours');
        expect(settingsOf({ hallPaybackHours: 6 })).not.toHaveProperty('hallPaybackHours');
        expect(world({ hallPaybackHours: 1e6 }).rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_gold).toBe(0);
        expect(world({ paybackHours: 1e6 }).rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_gold).toBe(0);
    });

    it('Typical buys a rank that pays back on its work within the payback curve at its tier\'s opening level, not within a day', () => {
        const c = content();
        // Rich Seams, a Plane 1 rank (the ladder opens Plane 1 at level 10); no other star opens through it.
        const curve = paybackHoursAt(10);
        const priced = (quantity) => {
            c.hallSky.stars.ph_rich.ranks[0].price = [{ itemId: 'item_copper_ore', quantity }];
            const pace = buildPace(c, buildLedger(c), SPARSE);
            return { pace, row: pace.hallPaybacks().find(r => r.id === 'ph_rich' && r.rank === 1) };
        };
        const { row } = priced(1200);
        // Its payback is its price over what it saves: price it to half the curve, then to three times it (still within the old day).
        const perHour = 1200 / row.priceHours;
        const cheap = priced(Math.floor(0.5 * curve * row.gain * perHour));
        expect(cheap.row.payback).toBeLessThan(curve);
        expect(cheap.pace.rateAt(VEIN, PROFILE.TYPICAL, 1).setup.hallRanks.ph_rich).toBe(1);
        const dear = priced(Math.ceil(3 * curve * row.gain * perHour));
        expect(dear.row.payback).toBeGreaterThan(curve);
        expect(dear.row.payback).toBeLessThan(24);
        expect(dear.pace.rateAt(VEIN, PROFILE.TYPICAL, 1).setup.hallRanks.ph_rich).toBe(0);
        // It boosts the vein alone, so over all its work it is as slow: red on the pages, as Typical leaves it.
        expect(cheap.row.pays).toBe(true);
        expect(dear.row.pays).toBe(false);
    });
});

describe('every rank\'s payback at Typical, and the price the ledger proposes', () => {
    const rowOf = (pace, id, rank) => pace.hallPaybacks().find(r => r.id === id && r.rank === rank);

    it('the hours its price takes to gather at Typical before the Hall, over the hours it saves an hour where it saves most', () => {
        const pace = world();
        const lore = rowOf(pace, 'ph_lore', 1);
        expect(lore).toMatchObject({ rate: true, tier: 0, cap: 0, pays: true, priceText: '10 Copper Ore' });
        expect(lore.priceHours).toBeCloseTo(10 / 1440);
        expect(pace.workName(lore.work)).toBe('Copper Vein');
        const measured = pace.profiles.hallRankOn(VEIN, 0, 'ph_lore', 1);
        expect(lore.gain).toBeCloseTo(measured.saves);
        expect(lore.payback).toBeCloseTo(lore.priceHours / lore.gain);
        expect(rowOf(pace, 'ph_rich', 1).cap).toBe(1);
    });

    it('beside it, its payback over all the work it boosts on the payback curve, the payback check\'s own numbers, and pays by them', () => {
        const pace = world();
        const tol = pace.settings.tolerancePct / 100;
        const guild = pace.hallGuildPaybacks();
        expect(guild.length).toBeGreaterThan(3);
        for (const g of guild) {
            const row = rowOf(pace, g.id, g.rank);
            expect(row).toMatchObject({ guildGain: g.gain, guildPayback: g.payback, curve: g.curve });
            expect(g.oneWork).toBe(row.gain);
            expect([g.id, g.rank, row.pays]).toEqual([g.id, g.rank, g.cost === 0 || g.off <= tol + 1e-9]);
        }
        // The Gold Leaf boosts more than one piece of Mining work: its saving over the guild's two heroes is at least the vein's alone.
        const gold = rowOf(pace, 'ph_gold', 1);
        expect(gold.guildGain).toBeGreaterThanOrEqual(gold.gain);
        const slow = new Set(pace.findings().filter(x => x.check === 'hall-guild-payback' && x.severity === 'warn').map(x => x.key));
        for (const row of pace.hallPaybacks().filter(r => r.rate && !r.enabler && Number.isFinite(r.priceHours) && r.priceHours > 0)) {
            expect([row.id, row.rank, slow.has(`hall:${row.id}`) || row.pays]).toEqual([row.id, row.rank, true]);
        }
    });

    it('a rank that does not pay back on the curve is found over all its work; a star that adds no rate is named, not priced', () => {
        const pace = world();
        expect(rowOf(pace, 'ph_gold', 1)).toMatchObject({ rate: true, pays: false });
        const f = pace.findings();
        expect(f.some(x => x.check === 'hall-guild-payback' && x.key === 'hall:ph_gold')).toBe(true);
        expect(f.some(x => x.check === 'hall-payback')).toBe(false);
        expect(rowOf(pace, 'ph_infirmary', 1)).toMatchObject({ rate: false });
        expect(rowOf(pace, 'ph_rails', 1)).toMatchObject({ rate: false });
        expect(f).toContainEqual(expect.objectContaining({ check: 'unmodelled', key: 'hall:ph_infirmary' }));
        for (const x of f) expect(CHECKS[x.check]?.group).toBe('D');
    });

    it('proposes the most of its tier\'s material it can cost and still pay back on the curve over all its work, rounded down', () => {
        const pace = world();
        const lore = rowOf(pace, 'ph_lore', 1);
        const curve = paybackHoursAt(1);
        expect(lore.curve).toBeCloseTo(curve);
        // Mining's own material at the Starter Camp, at Typical-before-the-Hall's 1440 an hour.
        expect(lore.proposed.itemId).toBe('item_copper_ore');
        expect(lore.proposed.quantity).toBe(roundDown(curve * lore.guildGain * 1440));
        expect(lore.proposed).toMatchObject({ pays: true });
        expect(lore.proposed.payback).toBeCloseTo(lore.proposed.priceHours / lore.guildGain);
        expect(lore.proposed.payback).toBeLessThanOrEqual(curve);
        expect(lore.proposed.payback).toBeGreaterThan(0.8 * curve);
        // The Well's Spring pays Copper Ore, so it is priced in something else; its second rank has no tier.
        expect(rowOf(pace, 'ph_spring', 1).proposed.itemId).toBe('item_oak_wood');
        expect(rowOf(pace, 'ph_spring', 2).proposed).toEqual({ why: 'no tier set' });
        expect(rowOf(pace, 'ph_gold', 1).proposed.quantity).toBeGreaterThanOrEqual(1);
    });

    it('a rank set past the last stage the pace knows is measured at that stage, and says so', () => {
        const c = content();
        // The stages run to Plane 7 on the ladder: a rank set past it is measured there.
        c.hallSky.stars.ph_gold.ranks[0].tier = 9;
        const pace = buildPace(c, buildLedger(c), SPARSE);
        const gold = rowOf(pace, 'ph_gold', 1);
        expect(gold).toMatchObject({ tier: 9, cap: pace.maxTier });
        expect(pace.maxTier).toBe(7);
        expect(pace.findings().find(x => x.key === 'hall:ph_gold').message).toMatch(/^Gold Leaf rank 1 \(Plane 9, measured at Plane 7, the last stage the pace knows\)/);
        // Never on offer before its own tier.
        expect(pace.rateAt(VEIN, PROFILE.MAXED, 2).setup.hallRanks.ph_gold).toBe(0);
    });

    it('never proposes a rank cheaper than the one before: raised, marked, and red when it then pays back too slowly', () => {
        // No tolerance, so the raise that takes rank 2 past the curve shows.
        const pace = world({ tolerancePct: 0 });
        const one = rowOf(pace, 'ph_lore', 1).proposed;
        const two = rowOf(pace, 'ph_lore', 2);
        // Rank 2 saves less than rank 1 (+50 % on +50 %), so on its own it would cost less.
        expect(roundDown(two.curve * two.guildGain * 1440)).toBeLessThan(one.quantity);
        expect(two.proposed).toMatchObject({ itemId: 'item_copper_ore', quantity: one.quantity, raised: true, pays: false });
        expect(two.proposed.payback).toBeCloseTo((one.quantity / 1440) / two.guildGain);
        expect(two.proposed.payback).toBeGreaterThan(two.curve);
        // Within the tolerance (25 %), the same raise pays, as the payback check would not warn of it.
        const tolerant = rowOf(world(), 'ph_lore', 2).proposed;
        expect(tolerant).toMatchObject({ quantity: one.quantity, raised: true });
        expect(tolerant.pays).toBe(tolerant.payback <= two.curve * 1.25);
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
        const mining = world(ANY_BATCH).breakdown().find(r => r.skill === 'mining');
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
        const pace = buildPace(c, buildLedger(c), SPARSE);
        const row = rowOf(pace, 'ph_beyond', 1);
        expect(row.opening.path).toEqual(['ph_gold']);
        expect(row.opening.cost).toBeCloseTo(100000 / pace.supplyOf('item_oak_wood', BEFORE_HALL, 0).perHour);
        expect(row.payback).toBeCloseTo((row.priceHours + row.opening.cost) / row.gain);
        expect(row.pays).toBe(false);
        expect(pace.rateAt(VEIN, PROFILE.TYPICAL, 0).setup.hallRanks.ph_beyond).toBe(0);
        // No price can make it pay: opening it alone takes longer.
        expect(row.proposed.why).toMatch(/Gold Leaf/);
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
        const pace = buildPace(c, buildLedger(c), SPARSE);
        const row = rowOf(pace, 'ph_vein_lore', 1);
        expect(row.opening.path).toEqual(['ph_rails']);
        const perHour = pace.supplyOf('item_copper_ore', BEFORE_HALL, 0).perHour;
        expect(row.opening.cost).toBeCloseTo(5 / perHour);
        expect(row.proposed.quantity).toBe(roundDown((row.curve * row.guildGain - row.opening.cost) * perHour));
        expect(row.proposed.payback).toBeCloseTo((row.proposed.priceHours + row.opening.cost) / row.guildGain);
        expect(row.proposed.payback).toBeLessThanOrEqual(row.curve);
    });

    it('every rank one work alone pays back on the curve is one Typical buys on that work', () => {
        const pace = world();
        const paying = pace.hallPaybacks().filter(r => r.rate && !r.enabler && r.work && r.payback <= r.curve);
        expect(paying.length).toBeGreaterThan(2);
        for (const row of paying) {
            const held = pace.rateAt(row.work.target, PROFILE.TYPICAL, row.cap).setup.hallRanks?.[row.id] || 0;
            expect([row.id, row.rank, held >= row.rank]).toEqual([row.id, row.rank, true]);
        }
    });

    it('a star of a skill that gathers nothing is priced in that skill\'s main input, not the fastest gathered item', () => {
        const c = content();
        // Ten XP a brew, so its XP bonus reads as a whole number.
        c.recipes.find(r => r.id === 'recipe_beer').xp = 10;
        c.hallSky.constellations.ph_cooking = { id: 'ph_cooking', name: 'Cooking', label: { x: 0, y: 0 }, skill: 'cooking' };
        addStar(c, 'ph_brew', 'ph_cooking', ['hall'], [{ itemId: 'item_oak_wood', quantity: 10 }], [rule('brew', 'XP_BONUS', 0.5, 'cooking')]);
        const pace = buildPace(c, buildLedger(c), SPARSE);
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
        const chests = buildPace(c, buildLedger(c), SPARSE);
        expect(chests.workOf({ token: 'token_pantry' })).toBeTruthy();
        expect(rowOf(chests, 'ph_brew', 1).proposed.itemId).toBe('item_oak_wood');
    });
});
