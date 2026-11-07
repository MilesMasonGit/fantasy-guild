import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { computeUpkeepSummary } from '../systems/board/UpkeepSummary.js';
import { passiveLapMs } from '../systems/board/workTime.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { describeStarRank, starSentence, starAmount, hallRuleSentence } from '../systems/progression/hallStarText.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { paletteForKeyword, KEYWORD } from '../systems/effects/statements.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import { PASSIVE_LAP_BASE_MS } from '../config/registries/tokenConstants.js';
import { getUpgradeDef, HALL_NODE } from '../config/guildUpgrades.js';
import { resetMatTuning } from '../config/matTuning.js';
import { hallEffectsNow } from '../ui/components/board/GuildHallEffectsPopover.jsx';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';
import { outlineSpriteName } from '../ui/components/board/hallStarOutline.js';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook, FACTOR } from '../systems/progression/ledger/rates.js';
import { buildPace } from '../systems/progression/ledger/pace.js';
import { PROFILE } from '../systems/progression/ledger/profiles.js';
import { starAddsRate } from '../systems/progression/ledger/hall.js';
import { normaliseStar } from '../config/hallStars.js';
import { paceContent } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Brief 390 G5, the drop lap: Passive Production runs on one lap, 10 minutes by default, shortened
 * by a Guild Hall star (Lap Time) to 8, 6 and 5. Every reader of the old fixed 5 minutes follows the
 * live lap; the ledger rates the Hall at the lap its setup holds. The catch-up against live play is
 * `DropLapCatchUp.test.js`.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const MIN = 60_000;

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_lap_seed: item('fixture_lap_seed', 'Fixture Lap Seed'),
    item_water: item('item_water', 'Water')
});
registerTokenTypes({
    /** A Hall stand-in paying one seed a lap. */
    fixture_lap_hall: {
        id: 'fixture_lap_hall', name: 'Fixture Lap Hall', tokenType: 'resource', isGuildHall: true,
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        trickle: [{ itemId: 'fixture_lap_seed', quantity: 1 }]
    },
    /** Not a Hall, with a line of its own: the same one lap. */
    fixture_lap_shrine: {
        id: 'fixture_lap_shrine', name: 'Fixture Lap Shrine', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        trickle: [{ itemId: 'fixture_lap_seed', quantity: 1 }]
    },
    /** A spawner eating 3 seeds a minute, so the Upkeep Summary has a row to net income against. */
    fixture_lap_forest: {
        id: 'fixture_lap_forest', name: 'Fixture Lap Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_lap_shrine', weight: 1 }], allowance: 5, intervalMs: 20000, upkeep: [{ itemId: 'fixture_lap_seed', quantity: 1 }] }
    }
});

const LAP_STAR_ID = 'star_well_lap';

/** The synced lap star, without its id (a fresh copy each call, so a test may edit it). */
const lapStar = () => {
    const { id, ...star } = structuredClone(authoredHallSky().stars[LAP_STAR_ID]);
    return star;
};

/** The lap star, in a sky of its own (beside a Well line star, for the ledger's words). */
function lapSky(star = lapStar()) {
    return { constellations: {}, stars: { [LAP_STAR_ID]: { id: LAP_STAR_ID, ...star } } };
}

const seeds = () => SpriteLayer.countOnBoard('fixture_lap_seed');
const run = (ms, step = 1000) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
/** Hold the lap star at a rank, as a purchase does (`GuildUpgradeManager.recompute` puts its rules in force). */
function holdLap(rank) {
    GameState.state.progress.guildUpgrades[LAP_STAR_ID] = rank;
    GuildUpgradeManager.recompute();
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
    registerHallSky(lapSky());
    GuildUpgradeManager.recompute();
});

afterEach(() => {
    TileModifiers.teardown();
    registerHallSky(null);
    HallRules.apply({});
    resetMatTuning();
});

describe('⭐ the lap: 10 minutes, shortened by the lap star to 8, 6 and 5', () => {
    it('is 10 minutes with no star, and each rank\'s lap with one', () => {
        expect(PASSIVE_LAP_BASE_MS).toBe(10 * MIN);
        expect(PassiveProduction.lapMs()).toBe(10 * MIN);
        const laps = [1, 2, 3].map(rank => { holdLap(rank); return PassiveProduction.lapMs(); });
        expect(laps).toEqual([8 * MIN, 6 * MIN, 5 * MIN]);
        holdLap(0);
        expect(PassiveProduction.lapMs()).toBe(10 * MIN);
    });

    it('the Hall pays once a lap, at 10 minutes and then at 5 with the star', () => {
        placeAt('fixture_lap_hall', 800, 500);
        run(10 * MIN - 1000);
        expect(seeds()).toBe(0);                 // no payout at the old 5 minutes, nor just before 10
        run(1000);
        expect(seeds()).toBe(1);

        holdLap(3);
        run(5 * MIN - 1000);
        expect(seeds()).toBe(1);
        run(1000);
        expect(seeds()).toBe(2);
        run(60 * MIN);
        expect(seeds()).toBe(14);                // twelve laps an hour
    });

    it('one lap for every Token that pays, the Hall or not', () => {
        holdLap(2);
        const hall = placeAt('fixture_lap_hall', 800, 500);
        const shrine = placeAt('fixture_lap_shrine', 400, 500);
        run(6 * MIN);
        expect(seeds()).toBe(2);
        expect(hall.clocks.passiveMs).toBe(0);
        expect(shrine.clocks.passiveMs).toBe(0);
    });

    it('a star bought mid-lap keeps the time already run; a lap already past the new length pays at once', () => {
        const hall = placeAt('fixture_lap_hall', 800, 500);
        run(3 * MIN);
        holdLap(1);                               // 8 minutes: 3 run, 5 to go
        expect(hall.clocks.passiveMs).toBe(3 * MIN);
        expect(PassiveProduction.nextInMs(hall)).toBe(5 * MIN);
        run(4 * MIN);                             // 7 minutes into an 8-minute lap
        holdLap(3);                               // 5 minutes: already past
        expect(PassiveProduction.nextInMs(hall)).toBe(0);
        run(1000);
        expect(seeds()).toBe(1);
        expect(hall.clocks.passiveMs).toBe(2 * MIN + 1000);
    });

    it('one big tick pays what small ones do, at the shortened lap too', () => {
        holdLap(2);
        placeAt('fixture_lap_hall', 800, 500);
        run(2 * 60 * MIN, 100);
        const small = seeds();
        expect(small).toBe(20);                   // 6-minute laps for two hours

        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.inventory.maxSlots = 50;
        clearMat();
        holdLap(2);
        const hall = placeAt('fixture_lap_hall', 800, 500);
        TimedChanges.tick(2 * 60 * MIN);
        expect(seeds()).toBe(small);
        expect(hall.clocks.passiveMs).toBe(0);
    });

    it('an old save\'s per-line clocks wrap to the lap now', () => {
        const hall = placeAt('fixture_lap_hall', 800, 500);
        hall.clocks = { trickle: [420000, 30000] };   // 7 minutes into an old line
        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        InventoryManager.init();
        const loaded = BoardState.getTokenById(hall.id);
        expect(PassiveProduction.elapsedOf(loaded)).toBe(420000);
        holdLap(3);
        expect(PassiveProduction.elapsedOf(loaded)).toBe(120000);
    });
});

describe('⭐ the floor: a lap is floored like any speed-up and held to the whole second', () => {
    it('never under a fifth of 10 minutes, and whole seconds', () => {
        expect(passiveLapMs(0)).toBe(2 * MIN);
        expect(passiveLapMs(10 * MIN * (1 - 0.3333))).toBe(400000);
        expect(passiveLapMs(NaN)).toBe(10 * MIN);
        expect(passiveLapMs(12 * MIN)).toBe(12 * MIN);   // a slow-down passes
    });

    it('a stack past the floor stops at 2 minutes in the game too', () => {
        const star = lapStar();
        star.ranks[0].rules[0].payload.value = -0.95;
        registerHallSky(lapSky(star));
        holdLap(1);
        expect(PassiveProduction.lapMs()).toBe(2 * MIN);
    });
});

describe('⭐ every reader of the lap follows it', () => {
    it('the Hall effects say the lap now, as their first boost, and do not say the star twice', () => {
        expect(hallEffectsNow(GameState.state).lapMs).toBe(10 * MIN);
        holdLap(1);
        const now = hallEffectsNow(GameState.state);
        expect(now.lapMs).toBe(8 * MIN);
        expect(now.boosts).toEqual([]);
    });

    it('the Token card says every 10 min, then every 5 min', () => {
        const hall = placeAt('fixture_lap_hall', 800, 500);
        const rowFor = () => lifecycleLines(hall, {
            typeOf: () => ({ id: 'fixture_lap_hall', name: 'Hall' }), originOf: () => '',
            spawnerStatus: () => null, selectedRecipe: () => null, itemName: (id) => id, tokenName: (id) => id,
            passive: (inst) => ({ lines: PassiveProduction.linesOf(inst), nextInMs: PassiveProduction.nextInMs(inst), lapMs: PassiveProduction.lapMs() })
        }).find(r => r.label === 'Passive Production')?.value;
        expect(rowFor()).toMatch(/every 10 min \(next in 10 min\)/);
        holdLap(3);
        expect(rowFor()).toMatch(/every 5 min \(next in 5 min\)/);
    });

    it('the Upkeep Summary nets income at the lap now', () => {
        placeAt('fixture_lap_hall', 300, 300);
        InventoryManager.addItem('fixture_lap_seed', 10);
        placeAt('fixture_lap_forest', 900, 500);
        const row = () => computeUpkeepSummary().items.find(r => r.itemId === 'fixture_lap_seed');
        expect(row().incomePerMinute).toBeCloseTo(1 / 10);
        holdLap(3);
        expect(row().incomePerMinute).toBeCloseTo(1 / 5);
    });

    it('the Wishing Well says its Water a lap, with no minutes in it', () => {
        const well = getUpgradeDef('wishing_well');
        expect(well.statLabel(2)).toBe('20 Water a lap');
        expect(well.nextStatLabel(2)).toBe('30 Water a lap');
        expect(well.description).not.toMatch(/minute/);
    });
});

describe('⭐ the lap star in words, in the sky and in the rules', () => {
    it('a sentence with no number, and each rank as its lap', () => {
        const def = getUpgradeDef(LAP_STAR_ID);
        expect(starSentence(def)).toBe('The Guild Hall\'s outputs arrive more often: its lap is shorter.');
        expect([1, 2, 3].map(r => starAmount(def, r))).toEqual(['outputs every 8:00', 'outputs every 6:00', 'outputs every 5:00']);
        expect(describeStarRank(normaliseStar({ id: LAP_STAR_ID, ...lapStar() }), 1)).toBe('Makes the Guild Hall\'s lap 20% shorter.');
        expect(hallRuleSentence(lapStar().ranks[2].rules[0])).toBe('Makes the Guild Hall\'s lap 50% shorter.');
    });

    it('wears a candle in the sky', () => {
        expect(outlineSpriteName(getUpgradeDef(LAP_STAR_ID))).toBe('i_candle_white');
    });

    it('Lap Time is a Guild Hall star\'s axis only, and the boot audit finds nothing wrong with the star', () => {
        expect(getPaletteEntry(EFFECT_TYPES.PASSIVE_LAP)).toMatchObject({ guildOnly: true, label: 'Lap Time', buckets: ['percentage'] });
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).not.toContain(EFFECT_TYPES.PASSIVE_LAP);
        const sky = lapSky();
        sky.stars[LAP_STAR_ID].ranks.forEach(r => { r.price = [{ itemId: 'item_water', quantity: 1 }]; });
        expect(hallStarFindings({ sky, items: { item_water: {} }, tokens: {} })).toEqual([]);
    });

    it('a Region\'s Lap Time rule moves the one lap too (the guild-wide aggregator)', () => {
        const agg = getGlobalAggregator();
        agg.addModifier({ type: EFFECT_TYPES.PASSIVE_LAP, bucket: 'percentage', value: -0.1, source: 'test:region' });
        try {
            expect(PassiveProduction.lapMs()).toBe(9 * MIN);
        } finally {
            agg.removeModifiersBySource('test:region');
        }
    });
});

describe('⭐ the ledger rates the Hall at the lap its setup holds', () => {
    const content = () => {
        const c = paceContent();
        const sky = paceHallSky();
        sky.stars[LAP_STAR_ID] = { id: LAP_STAR_ID, ...lapStar(), links: [HALL_NODE] };
        sky.stars[LAP_STAR_ID].ranks.forEach(r => { r.price = [{ itemId: 'item_oak_wood', quantity: 10 }]; r.tier = 0; });
        c.hallSky = sky;
        return c;
    };
    const HALL = { token: 'token_guild_hall' };

    it('six laps an hour with no star, twelve at its top rank; the star named as the lap\'s factor', () => {
        const book = buildRateBook(content());
        const bare = book.rateOf(HALL, { hallRanks: { wishing_well: 1, ph_spring: 2 } });
        expect(bare.cycleMs).toBe(10 * MIN);
        expect(bare.cyclesPerHour).toBeCloseTo(6);
        expect(bare.items.item_water).toBeCloseTo(10 * 6);
        expect(bare.items.item_copper_ore).toBeCloseTo(20 * 6);

        const fast = book.rateOf(HALL, { hallRanks: { wishing_well: 1, ph_spring: 2, [LAP_STAR_ID]: 3 } });
        expect(fast.cycleMs).toBe(5 * MIN);
        expect(fast.items.item_water).toBeCloseTo(10 * 12);
        expect(fast.factors.find(f => f.id === `hall:${LAP_STAR_ID}`)).toMatchObject({ kind: FACTOR.HALL, on: true, axes: ['lap'] });
        expect(book.rateOf(HALL, { hallRanks: { wishing_well: 1, [LAP_STAR_ID]: 3 }, off: [`hall:${LAP_STAR_ID}`] }).cycleMs).toBe(10 * MIN);
        expect(book.rateOf(HALL, { hallRanks: { wishing_well: 1, [LAP_STAR_ID]: 1 } }).cycleMs).toBe(8 * MIN);
    });

    it('adds a rate at the Hall only: offered to the Hall\'s work, never to a hero\'s', () => {
        const c = content();
        expect(starAddsRate(normaliseStar(c.hallSky.stars[LAP_STAR_ID]))).toBe(true);
        const pace = buildPace(c, buildLedger(c));
        const maxedHall = pace.rateAt(HALL, PROFILE.MAXED, 0);
        expect(maxedHall.setup.hallRanks[LAP_STAR_ID]).toBe(3);
        expect(maxedHall.rate.cycleMs).toBe(5 * MIN);
        expect(pace.rateAt({ token: 'token_vein' }, PROFILE.MAXED, 0).setup.hallRanks?.[LAP_STAR_ID]).toBeUndefined();
        const row = pace.hallPaybacks().find(r => r.id === LAP_STAR_ID && r.rank === 1);
        expect(row.rate).toBe(true);
        expect(row.gain).toBeGreaterThan(0);
    });
});
