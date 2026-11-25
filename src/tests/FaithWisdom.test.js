import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement, effectParts } from '../systems/effects/statementText.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTag } from '../config/registries/effectWords.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Wisdom, the Shrine of Wisdom's blessing (owner 2026-11-25): heroes working or fighting in a lit
 * shrine's reach share their XP. When one earns XP at a Token the rule reaches, every other hero
 * working or fighting a Token the same rule reaches gets the rule's share of it, in the skill it
 * was earned in. Shares are never shared again; idle heroes get none; two shrines add up.
 */

const ORE = 'fixture_fw_ore';
const LOG = 'fixture_fw_log';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

const VEIN = 'fw_vein';
const TREE = 'fw_tree';
const FOE = 'fw_foe';
const SHRINE = 'fw_shrine';
const QUARTER_SHRINE = 'fw_quarter_shrine';
const MINING_SHRINE = 'fw_mining_shrine';
const THIRTY_SHRINE = 'fw_thirty_shrine';

const XP = 4;
const KILL_XP = 6;
const CYCLE_MS = 1000;

const shrine = (id, value, extra = {}) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forest',
    requiresHero: true, shrine: { maxLitMs: 6_000_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [
        { id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } },
        { id: `stm_${id}_wisdom`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.WISDOM, bucket: 'flat', value, ...extra } }
    ]
});
const node = (id, skill, itemId) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_ore_vein_copper',
    requiresHero: true,
    config: { skill, skillRequired: 1, cycleTimeMs: CYCLE_MS, xp: XP, inputs: [], outputs: [{ itemId, chance: 100, minQty: 1, maxQty: 1 }] }
});

function registerFixtures() {
    registerItems({ [ORE]: item(ORE, 'Wisdom Ore'), [LOG]: item(LOG, 'Wisdom Log') });
    registerTokenTypes({
        [VEIN]: node(VEIN, 'mining', ORE),
        [TREE]: node(TREE, 'forestry', LOG),
        // Weak enough to fall to the first blows, with a set kill award.
        [FOE]: {
            id: FOE, name: 'Wisdom Rat', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1,
            sprite: 'e_goblin', requiresHero: true, enemy: { level: 1, style: 'melee', hp: 1, xp: KILL_XP },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: KILL_XP, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
        },
        [SHRINE]: shrine(SHRINE, 50),
        [QUARTER_SHRINE]: shrine(QUARTER_SHRINE, 25),
        [MINING_SHRINE]: shrine(MINING_SHRINE, 50, { category: 'mining' }),
        [THIRTY_SHRINE]: shrine(THIRTY_SHRINE, 30)
    });
}

// The shrine in the middle; each work spot is 160 from it, in its reach (the standard 240), and 320
// or more from the others.
const CENTRE = { x: 900, y: 500 };
const WEST = { x: 740, y: 500 };
const EAST = { x: 1060, y: 500 };
const NORTH = { x: 900, y: 340 };
const SOUTH = { x: 900, y: 660 };
const FAR = { x: 1800, y: 900 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

function litShrine(typeId = SHRINE, at = CENTRE) {
    const s = fixtures.placeAt(typeId, at.x, at.y);
    s.shrine = { litMs: 6_000_000 };
    TileModifiers.rebuildAll();
    return s;
}

/** Heroes, each with every skill used here at level 10, by name. */
function heroes(n) {
    const out = fixtures.makeHeroes(n, { mining: 10, forestry: 10, melee: 10, faith: 10 });
    for (const h of out) HeroManager.updateHeroFromSkills(h);
    return out.map(h => h.id);
}

/** XP each hero has earned in `skill` since the start (level 10's XP is their start). */
const earned = (heroId, skill) => GameState.state.heroes.find(h => h.id === heroId).skills[skill].xp - xpForLevel(10);

/** Put a Token of `typeId` at `at` and send `heroId` to it. */
function work(heroId, typeId, at) {
    fixtures.placeAt(typeId, at.x, at.y);
    TileModifiers.rebuildAll();
    expect(fixtures.orderAt(heroId, at).success).toBe(true);
}

/** Run `n` of the nodes' cycles. */
const cycles = (n) => step(n * CYCLE_MS + 50);

/** Save and load the game as a player's slot does. */
function reload() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => freshBoard());

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('Wisdom: heroes in a lit shrine\'s reach share the XP they earn', () => {
    it('two miners in its reach each get the rule\'s share of the other\'s XP, in Mining', () => {
        litShrine();
        const [a, b] = heroes(2);
        work(a, VEIN, WEST);
        work(b, VEIN, EAST);
        cycles(2);
        // Each: two cycles of their own (2 x 4), and half of the other's two (2 x 2).
        expect(earned(a, 'mining')).toBe(2 * XP + 2 * XP / 2);
        expect(earned(b, 'mining')).toBe(2 * XP + 2 * XP / 2);
    });

    it('shares are never shared again: three heroes each get a share of each other\'s own XP alone', () => {
        litShrine();
        const [a, b, c] = heroes(3);
        work(a, VEIN, WEST);
        work(b, VEIN, EAST);
        work(c, VEIN, NORTH);
        cycles(1);
        for (const h of [a, b, c]) expect(earned(h, 'mining')).toBe(XP + 2 * (XP / 2));
    });

    it('in the skill it was earned: a forester gets Mining XP from a miner, the miner Forestry from them', () => {
        litShrine();
        const [miner, forester] = heroes(2);
        work(miner, VEIN, WEST);
        work(forester, TREE, EAST);
        cycles(1);
        expect(earned(miner, 'mining')).toBe(XP);
        expect(earned(miner, 'forestry')).toBe(XP / 2);
        expect(earned(forester, 'forestry')).toBe(XP);
        expect(earned(forester, 'mining')).toBe(XP / 2);
    });

    it('idle heroes get none: one standing by the shrine on a spot, one at home', () => {
        litShrine();
        const [miner, idle, home] = heroes(3);
        work(miner, VEIN, WEST);
        expect(fixtures.orderAt(idle, SOUTH).success).toBe(true);
        cycles(2);
        expect(earned(miner, 'mining')).toBe(2 * XP);
        expect(earned(idle, 'mining')).toBe(0);
        expect(earned(home, 'mining')).toBe(0);
    });

    it('a hero working out of its reach neither gives nor gets a share', () => {
        litShrine();
        const [near, far] = heroes(2);
        work(near, VEIN, WEST);
        work(far, VEIN, FAR);
        cycles(2);
        expect(earned(near, 'mining')).toBe(2 * XP);
        expect(earned(far, 'mining')).toBe(2 * XP);
    });

    it('two shrines add up; a hero only one of them reaches gets that one\'s share', () => {
        // The two spots below the centre in reach of both (one shrine at the centre, one south of
        // it, 144 from each); North of the centre's alone (280 from the southern one).
        litShrine(QUARTER_SHRINE, CENTRE);
        litShrine(QUARTER_SHRINE, { x: 900, y: 620 });
        const [a, b, c] = heroes(3);
        work(a, VEIN, { x: 780, y: 540 });
        work(b, VEIN, { x: 1020, y: 540 });
        work(c, VEIN, NORTH);
        cycles(4);
        // a and b: their own 16, half of each other's 16 (two quarters), a quarter of c's 16.
        expect(earned(a, 'mining')).toBe(16 + 8 + 4);
        expect(earned(b, 'mining')).toBe(16 + 8 + 4);
        // c: their own 16 and a quarter of each of a's and b's.
        expect(earned(c, 'mining')).toBe(16 + 4 + 4);
    });

    it('narrowed to a skill, only that work\'s XP is shared', () => {
        litShrine(MINING_SHRINE);
        const [miner, forester] = heroes(2);
        work(miner, VEIN, WEST);
        work(forester, TREE, EAST);
        cycles(1);
        expect(earned(forester, 'mining')).toBe(XP / 2);
        expect(earned(miner, 'forestry')).toBe(0);
    });

    it('a fight in its reach shares the kill\'s XP in its style, and a fighter gets a worker\'s share', () => {
        litShrine();
        const [miner, fighter] = heroes(2);
        work(miner, VEIN, WEST);
        work(fighter, FOE, EAST);
        const kills = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (p) => kills.push(p));
        for (let t = 0; t < 20_000 && !kills.length; t += 100) step(100);
        off();
        expect(kills).toHaveLength(1);
        const kill = earned(fighter, 'melee');
        expect(kill).toBeGreaterThan(0);
        expect(earned(miner, 'melee')).toBe(kill / 2);
        // While the fight lasted, the miner's cycles were shared with the fighter.
        const mined = earned(miner, 'mining');
        expect(mined).toBeGreaterThan(0);
        expect(earned(fighter, 'mining')).toBe(mined / 2);
    });

    it('from a shrine that is out, nothing is shared and nothing more is drawn', () => {
        const drawsWith = (setUp) => {
            freshBoard();
            setUp();
            const [a, b] = heroes(2);
            work(a, VEIN, WEST);
            work(b, VEIN, EAST);
            const draws = vi.spyOn(Math, 'random');
            cycles(2);
            const calls = draws.mock.calls.length;
            draws.mockRestore();
            expect(earned(a, 'mining')).toBe(2 * XP);
            return calls;
        };
        expect(drawsWith(() => fixtures.placeAt(SHRINE, CENTRE.x, CENTRE.y))).toBe(drawsWith(() => {}));
    });

    it('a whole share is paid at once, drawing nothing; a fraction by chance, one draw a share', () => {
        const drawsWith = (setUp) => {
            freshBoard();
            setUp();
            const [a, b] = heroes(2);
            work(a, VEIN, WEST);
            work(b, VEIN, EAST);
            const draws = vi.spyOn(Math, 'random');
            cycles(3);
            const calls = draws.mock.calls.length;
            draws.mockRestore();
            return { calls, a: earned(a, 'mining') };
        };
        const none = drawsWith(() => fixtures.placeAt(QUARTER_SHRINE, CENTRE.x, CENTRE.y));
        // A quarter of 4 is 1 a cycle, whole.
        const whole = drawsWith(() => litShrine(QUARTER_SHRINE));
        expect(whole).toEqual({ calls: none.calls, a: 3 * XP + 3 });
        // At 30 % it is 1.2: one draw for each of the six shares (two heroes, three cycles).
        const fraction = drawsWith(() => litShrine(THIRTY_SHRINE));
        expect(fraction.calls).toBe(none.calls + 6);
        expect(fraction.a).toBeGreaterThanOrEqual(3 * XP + 3);
        expect(fraction.a).toBeLessThanOrEqual(3 * XP + 6);
    });
});

describe('Wisdom through a save and time away', () => {
    it('loaded, the shrine still shares', () => {
        litShrine();
        const [a, b] = heroes(2);
        work(a, VEIN, WEST);
        work(b, VEIN, EAST);
        cycles(1);
        reload();
        step(2 * CYCLE_MS);
        expect(earned(a, 'mining')).toBe(3 * XP + 3 * XP / 2);
    });

    it('time away: the catch-up shares as the plain loop in its 1 s steps does', async () => {
        const AWAY = 30_000;
        const setUp = () => {
            freshBoard();
            litShrine();
            const ids = heroes(3);
            work(ids[0], VEIN, WEST);
            work(ids[1], TREE, EAST);
            work(ids[2], VEIN, NORTH);
            return ids;
        };
        const tally = (ids) => ids.map(h => [earned(h, 'mining'), earned(h, 'forestry')]);
        const liveIds = setUp();
        step(AWAY, 1000);
        const live = tally(liveIds);
        const ids = setUp();
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        expect(tally(ids)).toEqual(live);
        expect(live[1][0]).toBeGreaterThan(0);
    });
});

describe('Wisdom in the CMS', () => {
    it('is offered on a Token as a blessing, narrowed by skill, and reads as what it does', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.WISDOM);
        expect(entry).toMatchObject({ label: 'Wisdom', shape: MODIFIER_SHAPES.PROC, blessing: true, categories: 'skill' });
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).toContain(EFFECT_TYPES.WISDOM);
        const payload = { type: EFFECT_TYPES.WISDOM, bucket: 'flat', value: 20 };
        expect(effectTag(entry, payload).text).toBe('Wisdom 20%');
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, reach: 'nearby', to: { mode: 'all', value: '' }, payload }))
            .toBe('Wisdom 20% on every nearby Token.');
        expect(effectParts({ keyword: KEYWORD.PROVIDES, payload })).toEqual({
            before: 'share', size: '20%', after: 'of the XP earned here with every other hero working or fighting in reach'
        });
    });
});
