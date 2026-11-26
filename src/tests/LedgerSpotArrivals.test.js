import { describe, it, expect } from 'vitest';

import { buildLedger, tokenKey, itemKey, recipeKey, wedgeKey, HOW, spotPoolKey } from '../systems/progression/ledger/engine.js';
import { buildRateBook, LIFECYCLE, LIMIT } from '../../cms/src/engine/ledger/rates.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE } from '../../cms/src/engine/ledger/profiles.js';
import { worldPlan, originFindings } from '../../cms/src/engine/ledger/world.js';
import { runChecks } from '../../cms/src/engine/ledger/checks.js';
import { poolKeyOf, catchPoolsOf } from '../config/registries/catchPools.js';
import { groundWaterKinds, WATER_KIND } from '../config/registries/fishingSpots.js';
import { WATER_KIND as SHAPE } from '../systems/atlas/WaterShapes.js';
import { NO_MAP_BIOME } from '../systems/board/GroundRules.js';
import { STARTER_CAMP_GROUND } from '../systems/progression/ledger/engine.js';
import { EVENT_WAIT_MIN_MS, EVENT_WAIT_MAX_MS } from '../config/eventTiming.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { buildEncyclopedia } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { paceContent } from './fixtures/paceWorld.js';
import { WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * Fishing spots are Tokens that drift in on water by themselves (`FishingSpots.js`): the ledger
 * reads a spot kind as a wild origin wherever its water and biome stand (the Starter Camp's pond, a
 * wedge's ground by its kits' biomes, a seed's cells by their mats), lands an event's spot kind with
 * its event, fishes at each place the first pool for each tool that holds there, gates each fish
 * by its own level, and rates a spot by how often one arrives and how long it stays.
 */

const fish = (id, name, level, cycleMs, bait) => ({ id, name, type: 'food', fish: { level, cycleMs, bait }, plan: { tier: 0 } });

const SPOT = Object.freeze({
    id: 'token_spot', name: 'Fishing Spot', tokenType: 'resource', uses: null, standsOn: ['water'],
    config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 2, inputs: [], outputs: [] },
    spot: { water: ['sea', 'fresh'], biomes: [], everyMinutes: 6, most: 3, leaveChance: 4, unworkedMinutes: 20 },
    catchPools: [
        { tool: 'fishing_trap', bait: null, biomes: ['meadow'], catches: [{ itemId: 'item_spot_shrimp', weight: 100 }] },
        { tool: 'fishing_rod', bait: 'item_spot_bait', biomes: ['meadow'], catches: [{ itemId: 'item_spot_perch', weight: 60 }, { itemId: 'item_spot_pike', weight: 40 }] },
        { tool: 'fishing_rod', bait: 'item_spot_bait', biomes: ['forest'], catches: [{ itemId: 'item_spot_trout', weight: 1 }] },
        { tool: 'fishing_rod', bait: 'item_spot_bait', water: ['sea'], catches: [{ itemId: 'item_spot_salmon', weight: 1 }] },
        { tool: 'fishing_rod', bait: 'item_spot_bait', catches: [{ itemId: 'item_spot_carp', weight: 1 }] }
    ]
});

/**
 * The pace fixture's camp (its Still cooks) with a spot kind, its fish, a recipe a fish feeds, and
 * Bait cut from the shrimp at the Still, so the rod is fed.
 */
function spotContent({ spot = {} } = {}) {
    const c = addSpot(paceContent(), spot);
    const out = (itemId, n) => [{ itemId, chance: 100, minQty: n, maxQty: n }];
    c.recipes.push(
        { id: 'recipe_grilled_shrimp', name: 'Grilled Shrimp', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 5000, xp: 5, inputs: [{ itemId: 'item_spot_shrimp', quantity: 1 }], outputs: out('item_grilled_shrimp', 1) },
        { id: 'recipe_spot_bait', name: 'Bait', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 2000, xp: 1, inputs: [{ itemId: 'item_spot_shrimp', quantity: 1 }], outputs: out('item_spot_bait', 3) }
    );
    return c;
}

/** A content with the spot kind, its fish, the tools and Bait in the opening Bank. */
function addSpot(c, spot = {}) {
    Object.assign(c.items, {
        item_spot_shrimp: fish('item_spot_shrimp', 'Raw Shrimp', 1, 6000, 0),
        item_spot_perch: fish('item_spot_perch', 'Perch', 1, 8000, 1),
        item_spot_pike: fish('item_spot_pike', 'Pike', 30, 10000, 1),
        item_spot_trout: fish('item_spot_trout', 'Trout', 1, 8000, 1),
        item_spot_salmon: fish('item_spot_salmon', 'Salmon', 1, 8000, 1),
        item_spot_carp: fish('item_spot_carp', 'Carp', 1, 8000, 1),
        item_grilled_shrimp: { id: 'item_grilled_shrimp', name: 'Grilled Shrimp', type: 'food', plan: { tier: 0 } },
        item_spot_bait: { id: 'item_spot_bait', name: 'Bait', type: 'material', plan: { tier: 0 } },
        item_trap: { id: 'item_trap', name: 'Trap', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_trap', tier: 1, starter: true } },
        item_rod: { id: 'item_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_rod', tier: 1, starter: true } }
    });
    c.tokens.token_spot = { ...structuredClone(SPOT), spot: { ...SPOT.spot, ...spot } };
    c.starterCamp.bank = { ...c.starterCamp.bank, item_spot_bait: 50 };
    return c;
}

const pools = () => catchPoolsOf(SPOT);
const poolOf = (i) => poolKeyOf(pools()[i]);

describe('a spot kind that arrives by itself, at the Starter Camp', () => {
    it('drifts in on the camp\'s pond, meadow fresh water, and its catch feeds a Cooking recipe there', () => {
        const l = buildLedger(spotContent());
        expect(l.reachOf(tokenKey('token_spot'))).toMatchObject({ tier: 0, how: HOW.ARRIVE, luckOnly: false });
        expect(l.reachOf(itemKey('item_spot_shrimp'))).toMatchObject({ tier: 0, how: HOW.CATCH, via: tokenKey('token_spot'), luckOnly: false });
        expect(l.reachOf(recipeKey('recipe_grilled_shrimp')).tier).toBe(0);
        expect(l.reachOf(itemKey('item_grilled_shrimp')).tier).toBe(0);
        expect(l.pathOf(itemKey('item_spot_shrimp'))).toBe('Raw Shrimp ← Fishing Spot, meadow (Fishing 1) ← drifts in on the water by itself');
    });

    it('never reaches a fish with no spot arriving: the fault the brief names', () => {
        const l = buildLedger(spotContent({ spot: { everyMinutes: 0 } }));
        expect(l.reachOf(tokenKey('token_spot')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_spot_shrimp')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_grilled_shrimp')).tier).toBeNull();
    });

    it('takes the Starter Camp as the game makes it: meadow, with a fresh-water pond', () => {
        expect(STARTER_CAMP_GROUND).toEqual({ biome: NO_MAP_BIOME, waters: [WATER_KIND.FRESH] });
    });

    it('fishes there only the first pool for each tool that holds there', () => {
        const l = buildLedger(spotContent());
        // The meadow rod pool, not the forest's, the sea's or the one for everywhere after it.
        expect(l.reachOf(spotPoolKey('token_spot', poolOf(1))).tier).toBe(0);
        for (const i of [2, 3, 4]) expect(l.reachOf(spotPoolKey('token_spot', poolOf(i)))?.tier ?? null).toBeNull();
        expect(l.reachOf(itemKey('item_spot_perch')).tier).toBe(0);
        expect(l.reachOf(itemKey('item_spot_trout')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_spot_salmon')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_spot_carp')).tier).toBeNull();
    });

    it('fishes nothing with a tool whose first pool there never bites (a rod with no Bait named)', () => {
        const c = spotContent();
        c.tokens.token_spot.catchPools[1].bait = null;
        const l = buildLedger(c);
        expect(l.reachOf(itemKey('item_spot_perch')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_spot_carp')).tier).toBeNull();
        expect(l.reachOf(itemKey('item_spot_shrimp')).tier).toBe(0);
    });

    it('gates each fish by its own level, as the game does', () => {
        const l = buildLedger(spotContent());
        expect(l.reachOf(itemKey('item_spot_perch')).levels).toEqual({ fishing: 1 });
        expect(l.reachOf(itemKey('item_spot_pike')).levels).toEqual({ fishing: 30 });
    });

    it('lands nowhere its water or biome is not', () => {
        expect(buildLedger(spotContent({ spot: { water: ['sea'] } })).reachOf(tokenKey('token_spot')).tier).toBeNull();
        expect(buildLedger(spotContent({ spot: { biomes: ['coast'] } })).reachOf(tokenKey('token_spot')).tier).toBeNull();
        expect(buildLedger(spotContent({ spot: { biomes: ['meadow'] } })).reachOf(tokenKey('token_spot')).tier).toBe(0);
    });

    it('is no wild origin a wedge must place', () => {
        const found = originFindings(addSpot(contentOf(worldWorkspace())), { baseTables: normaliseWorldTables(WORLD_FIXTURE_RAW) });
        expect(found.some(f => f.key === tokenKey('token_spot'))).toBe(false);
    });
});

describe('its rate: how often a spot arrives and how long it stays', () => {
    it('with room for more than one, a hero fishes every arrival\'s catches: 10 an hour, 25 catches each', () => {
        const r = buildRateBook(spotContent()).rateOf({ token: 'token_spot', pool: poolOf(0) });
        // One spot every 6 minutes on average; 100 / 4 % catches before it moves on; 6 s a shrimp.
        expect(r).toMatchObject({ ok: true, limitedBy: LIMIT.SUPPLY });
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.REFILL, cycles: 25 });
        expect(r.cyclesPerHour).toBeCloseTo(250);
        expect(r.items.item_spot_shrimp).toBeCloseTo(250);
        expect(r.assumptions).toContainEqual(expect.objectContaining({ what: 'arrivals' }));
    });

    it('with room for one, the next comes a whole wait after it leaves', () => {
        const r = buildRateBook(spotContent({ spot: { most: 1, everyMinutes: 45, leaveChance: 8 } })).rateOf({ token: 'token_spot', pool: poolOf(0) });
        const stay = 12.5 * 6000;
        expect(r.cyclesPerHour).toBeCloseTo(3600000 * 12.5 / (stay + 45 * 60000));
    });

    it('a spot-rate raiser among its supports brings them that much more often, its reach taken to cover the water', () => {
        const c = spotContent();
        c.tokens.token_chum = { id: 'token_chum', name: 'Chum Station', tokenType: 'buff', uses: null, config: null, spotRate: { percent: 100 } };
        const b = buildRateBook(c);
        const raised = b.rateOf({ token: 'token_spot', pool: poolOf(0) }, { supports: ['token_chum'] });
        // One every 3 minutes, 25 catches each: 500 an hour, under the hero's 600.
        expect(raised.cyclesPerHour).toBeCloseTo(500);
        expect(raised.factors.find(f => f.id === 'support:token_chum')).toMatchObject({ on: true, axes: ['spotRate'] });
        expect(b.rateOf({ token: 'token_spot', pool: poolOf(0) }, { supports: ['token_chum'], off: ['support:token_chum'] }).cyclesPerHour).toBeCloseTo(250);
        expect(b.rateOf({ token: 'token_spot', pool: poolOf(0) }, { supports: [{ id: 'token_chum', distant: true }] }).cyclesPerHour).toBeCloseTo(250);
        // Standing in the camp, Maxed builds it beside the spots, in as many places as still help: a second brings
        // them every two minutes, past the hero's 600, and a third adds nothing.
        c.starterCamp.tokens.push({ typeId: 'token_chum', x: 9, y: 0 });
        const pace = buildPace(c, buildLedger(c), null);
        const maxed = pace.rateAt({ token: 'token_spot', pool: poolOf(0) }, PROFILE.MAXED);
        expect(maxed.chosen.map(x => x.id)).toContain('token_chum');
        expect(pace.siteOf({ token: 'token_spot', pool: poolOf(0) }, PROFILE.MAXED).buildings).toEqual([{ id: 'token_chum', count: 2, kinds: ['speed'] }]);
        expect(maxed.items.item_spot_shrimp).toBeCloseTo(600);
        const one = buildPace(c, buildLedger(c), { sitePlaces: { buildings: 1, perKind: 1 } }).rateAt({ token: 'token_spot', pool: poolOf(0) }, PROFILE.MAXED);
        expect(one.items.item_spot_shrimp).toBeCloseTo(500);
    });

    it('arriving faster than a hero fishes, the hero is the limit', () => {
        const r = buildRateBook(spotContent({ spot: { everyMinutes: 1 } })).rateOf({ token: 'token_spot', pool: poolOf(0) });
        expect(r).toMatchObject({ limitedBy: LIMIT.HERO });
        expect(r.cyclesPerHour).toBeCloseTo(600);
    });

    it('the pace times its catch and levels Cooking on it at the Starter Camp', () => {
        const content = spotContent();
        const ledger = buildLedger(content);
        const pace = buildPace(content, ledger, null);
        expect(Number.isFinite(pace.pathOf(itemKey('item_spot_shrimp'), PROFILE.TYPICAL).hours)).toBe(true);
        expect(Number.isFinite(pace.pathOf(itemKey('item_grilled_shrimp'), PROFILE.TYPICAL).hours)).toBe(true);
        expect(Number.isFinite(pace.pathOf(itemKey('item_spot_pike'), PROFILE.TYPICAL).hours)).toBe(true);
        expect(pace.pathOf(itemKey('item_spot_pike'), PROFILE.TYPICAL).hours).toBeGreaterThan(pace.pathOf(itemKey('item_spot_perch'), PROFILE.TYPICAL).hours);
    });

    it('times a fish whose level is above its water\'s own: the hero fishes at the fish\'s level', () => {
        const content = spotContent();
        content.items.item_spot_perch.fish.level = 5;
        const path = buildPace(content, buildLedger(content), null).pathOf(itemKey('item_spot_perch'), PROFILE.TYPICAL);
        expect(path.waitsOn).toEqual({ skill: 'fishing', level: 5 });
        expect(Number.isFinite(path.hours)).toBe(true);
        // Asked no level, a hero fishes the pool at the lowest level it lands anything at; asked one under it, none.
        const book = buildRateBook(content);
        expect(book.rateOf({ token: 'token_spot', pool: poolOf(1) })).toMatchObject({ ok: true, gates: { level: 5, needed: 5 } });
        expect(book.rateOf({ token: 'token_spot', pool: poolOf(1) }, { level: 3 })).toMatchObject({ ok: false, reason: 'level' });
    });

    it('supplies a fish above its pool\'s lowest at its own level, so what it feeds is timed', () => {
        const content = spotContent();
        content.items.item_grilled_pike = { id: 'item_grilled_pike', name: 'Grilled Pike', type: 'food', plan: { tier: 0 } };
        content.recipes.push({
            id: 'recipe_grilled_pike', name: 'Grilled Pike', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 5000, xp: 5,
            inputs: [{ itemId: 'item_spot_pike', quantity: 1 }], outputs: [{ itemId: 'item_grilled_pike', chance: 100, minQty: 1, maxQty: 1 }]
        });
        const pace = buildPace(content, buildLedger(content), null);
        // At Fishing 30 the meadow rod lands Pike 40 in 100: 250 catches an hour, 100 Pike.
        expect(pace.supplyOf('item_spot_pike', PROFILE.BARE, 0).perHour).toBeCloseTo(100);
        expect(Number.isFinite(pace.pathOf(itemKey('item_grilled_pike'), PROFILE.TYPICAL).hours)).toBe(true);
    });
});

describe('a spot kind an event lands', () => {
    const withEvent = (events) => ({ ...spotContent({ spot: { everyMinutes: 0 } }), events });
    const EVENTS = {
        event_shoal: { id: 'event_shoal', name: 'Shoal', typeId: 'token_spot', kind: 'node', weight: 10, ground: ['water'], biomes: [] },
        event_comet: { id: 'event_comet', name: 'Comet', typeId: 'token_vein', kind: 'node', weight: 30, ground: [], biomes: [] }
    };

    it('lands with its event wherever its event fits, at its share of the events that fit', () => {
        const l = buildLedger(withEvent(EVENTS));
        expect(l.reachOf(tokenKey('token_spot'))).toMatchObject({ tier: 0, how: HOW.EVENT, chance: 0.25 });
        expect(l.reachOf(itemKey('item_spot_shrimp')).tier).toBe(0);
        // An event landing a Token that is no spot kind is not read here.
        expect(l.world.rules.some(r => r.how === HOW.EVENT && r.gives.some(g => g.key === tokenKey('token_vein')))).toBe(false);
    });

    it('not when its event lands it on dry ground only, or in a biome the place is not', () => {
        expect(buildLedger(withEvent({ e: { ...EVENTS.event_shoal, ground: ['grass'] } })).reachOf(tokenKey('token_spot')).tier).toBeNull();
        expect(buildLedger(withEvent({ e: { ...EVENTS.event_shoal, biomes: ['coast'] } })).reachOf(tokenKey('token_spot')).tier).toBeNull();
    });

    it('gives way, at the same tier, to a kind that drifts in by itself: that is the path', () => {
        const c = withEvent({ e: { ...EVENTS.event_shoal, typeId: 'token_shoal' } });
        const shoal = { ...structuredClone(SPOT), id: 'token_shoal', name: 'Shoal', spot: { ...SPOT.spot, everyMinutes: 0 } };
        c.tokens = { token_shoal: shoal, ...c.tokens, token_spot: { ...c.tokens.token_spot, spot: SPOT.spot } };
        const l = buildLedger(c);
        expect(l.reachOf(spotPoolKey('token_shoal', poolOf(0)))).toMatchObject({ tier: 0, how: HOW.EVENT });
        expect(l.pathOf(itemKey('item_spot_shrimp'))).toBe('Raw Shrimp ← Fishing Spot, meadow (Fishing 1) ← drifts in on the water by itself');
    });

    it('is rated by the event clock: its share of the events, the next a whole wait after it goes', () => {
        const r = buildRateBook(withEvent(EVENTS)).rateOf({ token: 'token_spot', pool: poolOf(0) });
        const wait = (EVENT_WAIT_MIN_MS + EVENT_WAIT_MAX_MS) / 2 / 0.25;
        expect(r.cyclesPerHour).toBeCloseTo(3600000 * 25 / (25 * 6000 + wait));
    });
});

describe('on the world map', () => {
    // Trees lean to the woodland (forest) three to one over the riverside (coast); Waters all riverside.
    const raw = {
        ...WORLD_FIXTURE_RAW,
        kits: [
            ...WORLD_FIXTURE_RAW.kits,
            { id: 'woodland', name: 'Woodland', biome: 'forest', work: { forestry: 1 }, camps: [], bossCamps: [] },
            { id: 'riverside', name: 'Riverside', biome: 'coast', work: { fishing: 1 }, camps: [], bossCamps: [] }
        ],
        lines: WORLD_FIXTURE_RAW.lines.map(line => ({
            ...line,
            kits: line.id === 'trees' ? { woodland: 3, riverside: 1 } : line.id === 'waters' ? { riverside: 1 } : line.kits
        }))
    };
    const tables = normaliseWorldTables(raw);
    const content = () => addSpot(contentOf(worldWorkspace()));

    it('arrives in a wedge on the ground of the kits it leans to: most of it surely, the rest in some worlds', () => {
        const l = buildLedger({ ...content(), worldTables: tables });
        // The forest's rod pool, through the Trees wedge (three in four of its cells are woodland).
        expect(l.reachOf(itemKey('item_spot_trout'))).toMatchObject({ tier: 1, luckOnly: false });
        expect(l.reachOf(spotPoolKey('token_spot', poolOf(2)))).toMatchObject({ tier: 1, via: wedgeKey('trees', 1) });
        expect(l.pathOf(itemKey('item_spot_trout'))).toMatch(/^Trout ← Fishing Spot, forest \(Fishing 1\) ← Trees ring 1 ← settled on the world map/);
        // The sea's rod pool, through the Waters wedge (all riverside), not by luck through Trees.
        expect(l.reachOf(spotPoolKey('token_spot', poolOf(3)))).toMatchObject({ tier: 1, via: wedgeKey('waters', 1), luckOnly: false });
        const viaTrees = l.world.rules.find(r => r.how === HOW.ARRIVE && r.via === wedgeKey('trees', 1) && r.gives.some(g => g.key === spotPoolKey('token_spot', poolOf(3))));
        expect(viaTrees.gives.every(g => g.maybe === true)).toBe(true);
        // A mountain's fresh water holds none of its pools but the one for everywhere.
        expect(l.reachOf(itemKey('item_spot_carp'))).toMatchObject({ tier: 1 });
    });

    it('in a seed\'s world, arrives on each cell by its mat\'s biome and water', () => {
        // Every cell riverside: coast ground, the sea, no forest anywhere.
        const coastal = normaliseWorldTables({ ...raw, lines: raw.lines.map(line => ({ ...line, kits: { riverside: 1 } })) });
        const plan = worldPlan(content(), { seed: 7, baseTables: coastal });
        expect(plan.world.cells.filter(c => c.ring >= 1).every(c => plan.mats.get(c.id)?.biome === 'coast')).toBe(true);
        const salmon = plan.reach.get(itemKey('item_spot_salmon'));
        expect(salmon.tier).toBe(1);
        expect(plan.reach.get(spotPoolKey('token_spot', poolOf(3))).via).toMatch(/^cell:/);
        expect(plan.reach.get(itemKey('item_spot_trout')).tier).toBeNull();
        expect(plan.reach.get(itemKey('item_spot_shrimp')).tier).toBe(0);
        // The seed-free wedges are gone: a seed's own cells place the spots.
        expect([...plan.reach.values()].some(a => a.rule?.how === HOW.ARRIVE && String(a.rule.via).startsWith('wedge:'))).toBe(false);
    });
});

describe('the ground\'s water kinds', () => {
    it('reads the sea\'s share, a sulphur spring and every other inland shape as fresh water', () => {
        expect(groundWaterKinds(0.3, [])).toEqual([WATER_KIND.SEA]);
        expect(groundWaterKinds(0, [SHAPE.LAKE_RIVER, SHAPE.POND])).toEqual([WATER_KIND.FRESH]);
        expect(groundWaterKinds(0, [SHAPE.SULPHUR])).toEqual([WATER_KIND.SULPHUR]);
        expect(groundWaterKinds(0.4, SHAPE.LAKE)).toEqual([WATER_KIND.SEA, WATER_KIND.FRESH]);
        expect(groundWaterKinds(0, [])).toEqual([]);
    });
});

describe('what stays as it was', () => {
    it('a water that is no spot kind is worked where it stands, every pool', () => {
        const l = buildLedger(paceWithPond());
        expect(l.reachOf(itemKey('item_fish'))).toMatchObject({ tier: 0, how: HOW.CATCH });
        expect(l.reachOf(itemKey('item_eel')).tier).toBe(0);
    });

    it('the encyclopedia shows no arrival yet', () => {
        const book = buildEncyclopedia({ ...spotContent(), events: {} });
        expect(book.sourcesOf(tokenKey('token_spot')).some(r => r.how === HOW.ARRIVE || r.how === HOW.EVENT)).toBe(false);
        expect(book.sourcesOf(itemKey('item_spot_shrimp')).map(r => r.how)).toEqual([HOW.CATCH]);
    });

    it('a spot kind\'s findings say nothing makes or places it no more', () => {
        const content = spotContent();
        const found = runChecks(buildLedger(content), content);
        expect(found.filter(f => f.key === tokenKey('token_spot') && /never/i.test(f.message))).toEqual([]);
        expect(found.filter(f => f.key === itemKey('item_spot_shrimp') && /never/i.test(f.message))).toEqual([]);
    });
});

/** The pace fixture with a plain water standing in the camp (two pools, no spot block). */
function paceWithPond() {
    const c = paceContent();
    c.items.item_fish = { id: 'item_fish', name: 'Fish', type: 'food' };
    c.items.item_eel = { id: 'item_eel', name: 'Eel', type: 'food' };
    c.items.item_rod = { id: 'item_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_rod', tier: 1, starter: true } };
    c.tokens.token_pond = {
        id: 'token_pond', name: 'Pond', uses: null, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 1, inputs: [], outputs: [] },
        catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 'item_fish', weight: 3 }, { itemId: 'item_eel', weight: 1 }] }]
    };
    c.starterCamp.tokens.push({ typeId: 'token_pond', x: 5, y: 0 });
    return c;
}
