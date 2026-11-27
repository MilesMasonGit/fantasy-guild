import { describe, it, expect } from 'vitest';

import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE } from '../../cms/src/engine/ledger/pace.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import { settingsOf, heroesAt, chainHeroesAt } from '../../cms/src/engine/ledger/settings.js';
import { paceContent } from './fixtures/paceWorld.js';

/** These numbers were worked out for a camp of two nodes, the sparse layout; the pace times the dense one by default. */
const SPARSE = { layout: 'sparse' };

/**
 * ⭐ The ledger times the reference guild (BALANCE_RULES section 8): heroes
 * arrive about one a tier and staff a chain of at most one maker and about two gatherers, each doing
 * everything in turn when there are fewer; the guild's time is spent once, so a stage waits for its
 * heroes to do all its work; a camp works the layout's nodes (two sparse, five dense) and its own
 * rules reach them; a site holds eight building places, at most four boosting one kind, and the same
 * building may stand in several.
 */

const paceOf = (content = paceContent(), settings = null) => buildPace(content, buildLedger(content), { ...SPARSE, ...settings });
/** A batch factor every drink meets: Typical drinks what its own weighing takes, as these tests were written for. */
const ANY_BATCH = { batchPayback: 1e-6 };

const provides = (id, type, bucket, value, to, extra = {}) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload: { type, bucket, value, ...extra } });
const building = (id, name, statements) => ({ id, name, tokenType: 'buff', uses: null, requiresHero: false, config: null, statements });
const buildRecipe = (id, tokenId, wood = 5) => ({
    id, name: `Build ${tokenId}`, skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'],
    inputs: [{ itemId: 'item_oak_wood', quantity: wood }], outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }]
});
const VEIN = { token: 'token_vein' };
const HUT = { token: 'token_plot', recipe: 'recipe_build_hut' };

/** The fixture with a Lore Hut (+5 % XP at the vein) and a Rush Hut (5 % off its work time) to build, beside the Mine and the Gold Statue. */
function siteContent() {
    const c = paceContent();
    c.tokens.token_lore = building('token_lore', 'Lore Hut', [provides('lore', 'XP_BONUS', 'percentage', 0.05, { mode: 'id', value: 'token_vein' })]);
    c.tokens.token_rush = building('token_rush', 'Rush Hut', [provides('rush', 'WORK_TIME', 'percentage', -0.05, { mode: 'id', value: 'token_vein' })]);
    c.recipes.push(buildRecipe('recipe_build_lore', 'token_lore'), buildRecipe('recipe_build_rush', 'token_rush'));
    return c;
}

describe('the reference guild\'s settings', () => {
    it('⭐ holds section 8\'s heroes by tier, the two layouts and a site\'s places, and drops the camp copies of before', () => {
        const s = settingsOf(null);
        expect(s.heroesByTier.map(p => [p.tier, p.heroes])).toEqual([[0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 8]]);
        expect(s.layouts).toEqual({ sparse: 2, dense: 5 });
        // The pace times the rule's camp, five nodes (the balancer, 2026-11-26); two are the comparison.
        expect(s.layout).toBe('dense');
        expect(s.sitePlaces).toEqual({ places: 12, buildings: 8, perKind: 4 });
        expect(settingsOf({ campMembers: 3 })).not.toHaveProperty('campMembers');
        expect([0, 1, 2, 6, 7, 9].map(t => heroesAt(s, t))).toEqual([1, 1, 2, 6, 8, 8]);
        // One chain is at most one maker and 2.2 gatherers: the guild's heroes until it has more.
        expect([0, 2, 3].map(t => chainHeroesAt(s, t))).toEqual([1, 2, 3]);
        expect(chainHeroesAt(s, 4)).toBeCloseTo(3.2);
        expect(chainHeroesAt(s, 7)).toBeCloseTo(3.2);
        expect(settingsOf({ layouts: { sparse: 3, dense: 1 }, sitePlaces: { buildings: 6, perKind: 9 }, layout: 'x' })).toMatchObject({
            layouts: { sparse: 3, dense: 3 }, sitePlaces: { buildings: 6, perKind: 6 }, layout: 'dense'
        });
        expect(settingsOf({ heroesByTier: [{ tier: 2, heroes: 3 }, { tier: 0, heroes: 0 }] }).heroesByTier).toEqual([{ tier: 2, heroes: 3 }]);
        expect(CHECKS.layout).toMatchObject({ group: 'D' });
    });
});

describe('heroes staff the chain', () => {
    it('⭐ a maker whose chain needs more heroes than the guild has runs at their share: one hero at copper does everything in turn', () => {
        // The Hut builder needs two foresters: three heroes' work, and the Starter Camp has one.
        const pace = paceOf();
        expect(pace.staffingOf(HUT, PROFILE.BARE)).toMatchObject({ gatherers: 2, brewers: 0, have: 1 });
        expect(pace.staffingOf(HUT, PROFILE.BARE).need).toBeCloseTo(3);
        expect(pace.chainOf(HUT, PROFILE.BARE)).toBeCloseTo(1 / 3);
        const full = paceOf(paceContent(), { heroesByTier: [{ tier: 0, heroes: 8 }] });
        expect(full.chainOf(HUT, PROFILE.BARE)).toBe(1);
        const first = (p) => p.trackOf('construction').levels[0];
        expect(first(full).source.bare.xp).toBeCloseTo(600);
        expect(first(pace).source.bare.xp).toBeCloseTo(200);
        expect(first(pace).hours.bare).toBeCloseTo(first(full).hours.bare * 3);
        // The level's hero-hours are the same either way: the chain's whole work.
        expect(first(pace).work.bare).toBeCloseTo(first(full).work.bare);
        expect(first(full).work.bare).toBeCloseTo(first(full).hours.bare * 3);
    });

    it('⭐ generalises the 2.2 cap: past one maker and its gatherers, the chain\'s heroes share all its work, the maker\'s too', () => {
        // Eight heroes, a chain of one maker and one gatherer: two heroes for three heroes' work.
        const tight = paceOf(paceContent(), { heroesByTier: [{ tier: 0, heroes: 8 }], gatherersPerMaker: 1 });
        expect(tight.staffingOf(HUT, PROFILE.BARE).have).toBe(2);
        expect(tight.chainOf(HUT, PROFILE.BARE)).toBeCloseTo(2 / 3);
        // The count of gatherers stays the full one.
        expect(tight.heroesOf(HUT, PROFILE.BARE)).toBeCloseTo(3);
    });

    it('⭐ counts the brewers of a work\'s drinks among its chain\'s heroes: a boost\'s goods are spent once', () => {
        // Typical drinks Beer at the vein; its brewer at the Still and two fifths of a forester per Still are the chain's.
        const pace = paceOf(paceContent(), { ...ANY_BATCH, heroesByTier: [{ tier: 0, heroes: 8 }] });
        const vein = pace.rateAt(VEIN, PROFILE.TYPICAL);
        expect(vein.chosen.map(c => c.id)).toContain('item_beer');
        const staff = pace.staffingOf(VEIN, PROFILE.TYPICAL);
        const beerPerHour = vein.rate.boostInputs.item_beer * vein.scale;
        expect(staff.brewers).toBeCloseTo((beerPerHour / 360) * 1.4, 6);
        expect(staff.need).toBeCloseTo(1 + staff.brewers, 9);
        expect(pace.heroesOf(VEIN, PROFILE.TYPICAL)).toBe(1);
    });
});

describe('the guild\'s time is spent once', () => {
    /** Stage 1 asks Construction 15 (the Big Hut) and Cooking 12 (a Stew at the Still). */
    function twoSkills() {
        const c = paceContent();
        c.items.item_stew = { id: 'item_stew', name: 'Stew', type: 'food', plan: { tier: 1 } };
        c.recipes.push({ id: 'recipe_stew', name: 'Stew', skill: 'cooking', levelRequirement: 12, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [{ itemId: 'item_stew', chance: 100, minQty: 1, maxQty: 1 }], plan: { tier: 1 } });
        return c;
    }

    it('⭐ a stage waits for its heroes to do all its work, each level and each price once', () => {
        const one = paceOf(twoSkills(), { heroesByTier: [{ tier: 0, heroes: 1 }] });
        const s = one.stageOf(1);
        const work = one.workOfStage(1);
        expect(work.levels).toMatchObject({ construction: 15, cooking: 12 });
        const levels = one.trackOf('construction').levels[13].cumulativeWork.maxed + one.trackOf('cooking').levels[10].cumulativeWork.maxed;
        expect(work.levelHeroHours).toBeCloseTo(levels, 6);
        expect(s.heroHours).toBeCloseTo(work.heroHours, 9);
        expect(s.heroHours).toBeCloseTo(work.levelHeroHours + work.stepHeroHours, 9);
        // One hero all the way: the work takes its hero-hours, more than either skill side by side.
        expect(s.heroes).toBe(1);
        expect(s.workHours).toBeCloseTo(s.heroHours, 9);
        expect(s.byWork).toBe(true);
        expect(s.hours).toBeCloseTo(s.workHours, 9);
        expect(s.hours).toBeGreaterThan(s.pathHours * 1.2);
        // The Plot's price is paid once, though the Hut, the Mine and the Big Hut all stand on one.
        expect(work.steps.filter(k => k === 'token:token_plot')).toHaveLength(1);
    });

    it('⭐ a price is paid first from what the levels on the way made: a forester levelling fells the wood a Woodpile asks', () => {
        // Plane 1 asks Forestry 6 (an Old Oak) and a Woodpile bought for Oak Wood.
        const c = paceContent();
        c.items.item_old_wood = { id: 'item_old_wood', name: 'Old Wood', type: 'material', plan: { tier: 1 } };
        c.tokens.token_old_oak = {
            id: 'token_old_oak', name: 'Old Oak', uses: null, needsTool: { kind: 'woodaxe', minTier: 1 }, plan: { tier: 1 },
            config: { skill: 'forestry', skillRequired: 6, cycleTimeMs: 4000, xp: 1, inputs: [], outputs: [{ itemId: 'item_old_wood', chance: 100, minQty: 1, maxQty: 1 }] }
        };
        c.starterCamp.tokens.push({ typeId: 'token_old_oak', x: 5, y: 0 });
        c.tokens.token_woodpile = { ...building('token_woodpile', 'Woodpile', []), shop: { price: [{ itemId: 'item_oak_wood', quantity: 100 }] }, plan: { tier: 1 } };
        // The Gold Statue's thousand would take the wood first; the other prices on the way ask 50 between them.
        delete c.tokens.token_statue;
        c.recipes = c.recipes.filter(r => r.id !== 'recipe_build_statue');
        const one = { heroesByTier: [{ tier: 0, heroes: 1 }] };
        const small = paceOf(c, one);
        const wood = small.levelMade('forestry', 6, PROFILE.MAXED).item_oak_wood;
        expect(wood).toBeGreaterThan(150);
        // A hundred Oak Wood the forester has felled already: the Woodpile costs the guild nothing more.
        expect(small.workOfStage(1).levels.forestry).toBe(6);
        expect(small.workOfStage(1).costliest.map(s => s.key)).not.toContain('token:token_woodpile');
        // Ten thousand: what the levels made pays part, the rest is gathered.
        c.tokens.token_woodpile.shop.price[0].quantity = 10000;
        const big = paceOf(c, one);
        const pile = big.workOfStage(1).costliest.find(s => s.key === 'token:token_woodpile');
        const hh = big.heroHoursOf('item_oak_wood', PROFILE.MAXED, 1);
        expect(pile.heroHours).toBeGreaterThanOrEqual((10000 - wood) * hh - 1e-9);
        expect(pile.heroHours).toBeLessThanOrEqual((10000 - wood + 50) * hh + 1e-9);
    });

    it('⭐ with heroes to spare, the path sets the stage again', () => {
        const many = paceOf(twoSkills(), { heroesByTier: [{ tier: 0, heroes: 40 }], gatherersPerMaker: 2.2 });
        const s = many.stageOf(1);
        expect(s.byWork).toBe(false);
        expect(s.hours).toBeCloseTo(s.pathHours, 9);
        expect(s.workHours).toBeLessThan(s.pathHours);
    });

    it('⭐ an entry\'s arrival waits for the guild\'s heroes too, never before its path', () => {
        const one = paceOf(twoSkills(), { heroesByTier: [{ tier: 0, heroes: 1 }] });
        const a = one.arrivalOf('token:token_big_hut', PROFILE.MAXED);
        expect(a.pathHours).toBeCloseTo(one.pathOf('token:token_big_hut', PROFILE.MAXED).hours, 9);
        expect(a.hours).toBeGreaterThanOrEqual(a.pathHours);
        expect(a.hours).toBeCloseTo(Math.max(a.pathHours, a.workHours), 9);
    });

    it('heroes arrive as the curve reaches each tier', () => {
        const pace = paceOf();
        const spans = pace.heroSpans();
        expect(spans.map(s => s.heroes)).toEqual([1, 1, 2, 3, 4, 5, 6, 8]);
        expect(spans[0].from).toBe(0);
        expect(spans[1].from).toBeCloseTo(pace.settings.stages[0].budgetMinutes / 60, 9);
    });
});

describe('a camp works the layout\'s nodes', () => {
    it('⭐ the pace times the dense layout: Maxed\'s camp works five veins, Bare one vein and no camp', () => {
        const pace = buildPace(paceContent(), buildLedger(paceContent()), null);
        expect(pace.settings.layout).toBe('dense');
        expect(pace.rateAt(VEIN, PROFILE.MAXED).setup.camp).toEqual({ id: 'token_mining_camp', members: 5 });
        expect(pace.rateAt(VEIN, PROFILE.MAXED).rate.cyclesPerHour).toBeCloseTo(1200);
        expect(pace.rateAt(VEIN, PROFILE.BARE).setup.camp).toBeUndefined();
        expect(pace.rateAt(VEIN, PROFILE.BARE).rate.cyclesPerHour).toBeCloseTo(240);
        // The sparse layout is the comparison beside it.
        expect(pace.layoutSpread()).toMatchObject({ timed: 'dense', other: 'sparse' });
    });

    it('⭐ two veins in the sparse layout, five in the dense, one with no camp', () => {
        const sparse = paceOf();
        const dense = paceOf(paceContent(), { layout: 'dense' });
        // Five charges of 3 s, then a minute's rest: one vein offers 240 cycles an hour.
        expect(sparse.rateAt(VEIN, PROFILE.BARE).rate.cyclesPerHour).toBeCloseTo(240);
        expect(sparse.rateAt(VEIN, PROFILE.MAXED).setup.camp).toEqual({ id: 'token_mining_camp', members: 2 });
        expect(sparse.rateAt(VEIN, PROFILE.MAXED).rate.cyclesPerHour).toBeCloseTo(480);
        expect(dense.rateAt(VEIN, PROFILE.MAXED).rate.cyclesPerHour).toBeCloseTo(1200);
        // The camp copies of before are not read.
        expect(paceOf(paceContent(), { campMembers: 3 }).rateAt(VEIN, PROFILE.MAXED).setup.camp.members).toBe(2);
    });

    it('⭐ warns where the dense layout makes a node past the tolerance more than the sparse one', () => {
        const pace = paceOf();
        const rows = pace.layoutRows();
        expect(rows.map(r => r.work.key)).toEqual(['token_vein||']);
        expect(rows[0].dense / rows[0].sparse).toBeCloseTo(2.5);
        const found = pace.findings().filter(f => f.check === 'layout');
        expect(found.map(f => f.key)).toEqual(['token:token_vein']);
        expect(found[0].message).toMatch(/Copper Vein at Maxed, worked from Mining Camp: 2 in reach make .* an hour and 5 make .* \(\+150 %, over ±25 %\)/);
        expect(found[0].message).toMatch(/a lone hero at one node is busy about a fifth of the time, so a camp keeps one busy on 5/);
        // A vein that rests no longer than it works keeps one hero busy on two: no warning.
        const c = paceContent();
        c.tokens.token_vein.respawn = { mode: 'refill', afterMs: 1000 };
        expect(paceOf(c).layoutRows()).toEqual([]);
    });

    it('⭐ times the other layout beside it and says where a skill\'s days to 99 differ', () => {
        const pace = paceOf();
        expect(pace.otherLayoutPace().settings.layout).toBe('dense');
        expect(pace.otherLayoutPace().book).toBe(pace.book);
        const spread = pace.layoutSpread();
        expect(spread).toMatchObject({ timed: 'sparse', other: 'dense', nodes: { sparse: 2, dense: 5 } });
        const mining = spread.skills.find(s => s.skill === 'mining');
        expect(mining.days.dense.bare).toBeCloseTo(mining.days.sparse.bare, 9);
        expect(mining.days.dense.maxed).toBeLessThan(mining.days.sparse.maxed);
        expect(mining.warn).toBe(true);
    });

    it('⭐ a camp variant\'s own rules reach the nodes it works', () => {
        // A Mine Head halves the vein's rest; worked from it, the vein offers more and its rest is the camp's doing.
        const c = paceContent();
        c.tokens.token_mine_head = { id: 'token_mine_head', name: 'Mine Head', uses: null, config: null, camp: { skill: 'mining', reach: 280 }, statements: [provides('mine_head', 'GROW_TIME', 'percentage', -0.5, { mode: 'all', value: '' }, { category: 'mining' })] };
        c.recipes.push(buildRecipe('recipe_build_mine_head', 'token_mine_head', 20));
        const pace = paceOf(c);
        const vein = pace.rateAt(VEIN, PROFILE.MAXED);
        expect(vein.setup.camp).toEqual({ id: 'token_mine_head', members: 2 });
        expect(vein.rate.lifecycle.restMs).toBeCloseTo(30000);
        expect(vein.rate.factors.find(f => f.id === 'support:token_mine_head').axes).toContain('GROW_TIME');
        // A hero works from one camp: the Mining Camp it replaced stands nowhere in the setup.
        expect(JSON.stringify(vein.setup.supports)).not.toMatch(/token_mining_camp/);
        // The camp takes no building place.
        expect(pace.siteOf(VEIN, PROFILE.MAXED).buildings.map(b => b.id)).not.toContain('token_mine_head');
    });
});

describe('a work site is timed by its building places', () => {
    it('⭐ Maxed stands a building in as many places as lift the work, eight at most and four boosting one kind', () => {
        const pace = paceOf(siteContent());
        const site = pace.siteOf(VEIN, PROFILE.MAXED);
        expect(site.room).toBe(8);
        expect(site.places).toBe(8);
        // Four Mines (each a 25 % double: a sure double at four) fill yield's four; four Lore Huts XP's.
        expect(Object.fromEntries(site.buildings.map(b => [b.id, b.count]))).toEqual({ token_mine: 4, token_lore: 4 });
        expect(site.byKind).toEqual({ yield: 4, xp: 4 });
        const vein = pace.rateAt(VEIN, PROFILE.MAXED);
        expect(vein.setup.supports).toEqual(expect.arrayContaining([{ id: 'token_mine', count: 4 }, { id: 'token_lore', count: 4 }]));
        expect(vein.rate.perCycle.item_copper_ore).toBeCloseTo(pace.rateAt(VEIN, PROFILE.BARE).rate.perCycle.item_copper_ore * 2);
        // With room for twelve, the Rush Hut takes four more; the Gold Statue's yield still has no place.
        const roomy = paceOf(siteContent(), { sitePlaces: { places: 15, buildings: 12, perKind: 4 } }).siteOf(VEIN, PROFILE.MAXED);
        expect(Object.fromEntries(roomy.buildings.map(b => [b.id, b.count]))).toEqual({ token_mine: 4, token_lore: 4, token_rush: 4 });
        // The twelve places hold the site's own Tokens too, its camp and both its veins: nine for buildings, one Rush Hut.
        const round = paceOf(siteContent(), { sitePlaces: { buildings: 12, perKind: 4 } }).siteOf(VEIN, PROFILE.MAXED);
        expect(round).toMatchObject({ room: 9, taken: 3 });
        expect(Object.fromEntries(round.buildings.map(b => [b.id, b.count]))).toEqual({ token_mine: 4, token_lore: 4, token_rush: 1 });
    });

    it('⭐ Maxed fills the places itself when Typical holds none', () => {
        // Nothing pays back within a few seconds: Typical stands no building, and Maxed's copies are its own.
        const pace = paceOf(siteContent(), { paybackHours: 0.0001 });
        expect(pace.siteOf(VEIN, PROFILE.TYPICAL).places).toBe(0);
        const site = pace.siteOf(VEIN, PROFILE.MAXED);
        expect(Object.fromEntries(site.buildings.map(b => [b.id, b.count]))).toEqual({ token_mine: 4, token_lore: 4 });
    });

    it('⭐ Typical stands each copy that pays back, within the same places', () => {
        const pace = paceOf(siteContent());
        const site = pace.siteOf(VEIN, PROFILE.TYPICAL);
        expect(site.places).toBeLessThanOrEqual(8);
        expect(Math.max(...Object.values(site.byKind))).toBeLessThanOrEqual(4);
        expect(site.buildings.find(b => b.id === 'token_mine').count).toBe(4);
        const typical = pace.rateAt(VEIN, PROFILE.TYPICAL);
        const mines = typical.chosen.filter(c => c.id === 'token_mine');
        expect(mines).toHaveLength(4);
        for (const m of mines) expect(m.payback).toBeLessThanOrEqual(pace.settings.paybackHours);
    });

    it('a building that stacks no copies stands once', () => {
        const c = siteContent();
        c.tokens.token_mine.noStackDuplicates = true;
        const site = paceOf(c).siteOf(VEIN, PROFILE.MAXED);
        expect(site.buildings.find(b => b.id === 'token_mine').count).toBe(1);
    });

    it('a building\'s copies are named once in the boost groups, with their count', () => {
        const pace = paceOf(siteContent(), { boostTargets: { support: [{ tier: 0, pct: 1 }] } });
        const group = pace.boostGroups().find(g => g.kind === 'support' && g.works.some(w => w.work.key === 'token_vein||'));
        expect(group.names.join(', ')).toMatch(/Mine ×4/);
    });
});
