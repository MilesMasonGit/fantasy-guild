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
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Flags from '../systems/board/Flags.js';
import * as Camps from '../systems/board/Camps.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Hideouts from '../systems/board/Hideouts.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools, recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { STATION_KINDS, stationKindsOfSkill, stationKindLabel } from '../config/registries/tokenConstants.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { HIDEOUT_KIND, CAUGHT_DEFAULTS, caughtCurveOf, caughtChance, stealOf, crimeLevelOf } from '../config/registries/crime.js';
import { setWorldTablesForTests, resetWorldTablesForTests } from '../config/registries/worldTablesRegistry.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Crime (brief 810 K4): a Hideout, Crime's station kind, robs one enemy camp in its reach, the one
 * the player picks on its card. Each cycle its hero rolls the camp's enemy's steal table (beside its
 * fight drops), leaving the enemy where it stands. A thief is caught by the odds of their Crime level
 * against the camp's: a catch takes nothing and puts a guard on the camp, past its cap, who stays
 * until beaten, and while it stands nobody robs that camp. Bosses are never robbed. Quiet lowers the
 * odds.
 */

const INGOT = 'fixture_ch_ingot';
const NAILS = 'fixture_ch_nails';
const COIN_PURSE = 'fixture_ch_purse';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

const HIDEOUT = 'fixture_ch_hideout';
const QUIET_HIDEOUT = 'fixture_ch_quiet_hideout';
const ALWAYS_CAUGHT = 'fixture_ch_loud_hideout';
const NEVER_CAUGHT = 'fixture_ch_safe_hideout';
const GOBLIN = 'fixture_ch_goblin';
const CAMP = 'fixture_ch_camp';
const WOLF = 'fixture_ch_wolf';
const BARE_CAMP = 'fixture_ch_bare_camp';
const BOSS = 'fixture_ch_boss';
const BOSS_CAMP = 'fixture_ch_boss_camp';
const FOREST = 'fixture_ch_forest';
const TREE = 'fixture_ch_tree';

const THEFT_MS = 2000;
const QUIET_POINTS = 20;

const works = (id) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } });
const quietRule = (id) => ({
    id: `stm_${id}_quiet`, keyword: KEYWORD.PROVIDES, to: null, reach: 'self',
    payload: { type: EFFECT_TYPES.QUIET, bucket: 'flat', value: QUIET_POINTS }
});
const hideout = (id, name, extra = {}, statements = [works(id)]) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
    requiresHero: true,
    config: { skill: 'crime', skillRequired: 1, cycleTimeMs: THEFT_MS, xp: 3, inputs: [], outputs: [] },
    statements, ...extra
});
const enemy = (id, name, level, extra = {}) => ({
    id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 'e_goblin', requiresHero: true,
    enemy: { level, style: 'melee' },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [{ itemId: INGOT, chance: 100, minQty: 1, maxQty: 1 }] },
    ...extra
});
const camp = (id, name, enemyId, allowance = 2) => ({
    id, name, tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire', requiresHero: false,
    config: null, spawner: { spawns: [{ typeId: enemyId, weight: 1 }], allowance, intervalMs: 1000, upkeep: [] }
});

function registerFixtures() {
    registerItems({
        [INGOT]: item(INGOT, 'Fixture Ingot'),
        [NAILS]: item(NAILS, 'Fixture Nails'),
        [COIN_PURSE]: item(COIN_PURSE, 'Fixture Purse')
    });
    // A Crime recipe someone authored by mistake: a Hideout robs camps and runs no recipe.
    registerRecipePools({
        crime: [{ id: 'ch_stray_recipe', name: 'Stray', skill: 'crime', levelRequirement: 1, durationMs: 1000, xp: 1, inputs: [], outputs: [] }]
    });
    registerTokenTypes({
        [HIDEOUT]: hideout(HIDEOUT, 'Fixture Hideout'),
        [QUIET_HIDEOUT]: hideout(QUIET_HIDEOUT, 'Fixture Quiet Hideout', {}, [works(QUIET_HIDEOUT), quietRule(QUIET_HIDEOUT)]),
        [ALWAYS_CAUGHT]: hideout(ALWAYS_CAUGHT, 'Fixture Loud Hideout', { hideout: { evenChance: 100, perLevel: 0, minChance: 100, maxChance: 100 } }),
        [NEVER_CAUGHT]: hideout(NEVER_CAUGHT, 'Fixture Safe Hideout', { hideout: { evenChance: 0, perLevel: 0, minChance: 0, maxChance: 0 } }),
        [GOBLIN]: enemy(GOBLIN, 'Fixture Goblin', 5, {
            steal: {
                xp: 7,
                outputs: [
                    { itemId: INGOT, chance: 100, minQty: 2, maxQty: 2 },
                    { itemId: NAILS, chance: 100, minQty: 1, maxQty: 1 },
                    { tokenId: TREE, chance: 100, minQty: 1, maxQty: 1 }
                ],
                rareTable: { chance: 100, entries: [{ itemId: COIN_PURSE, weight: 1, minQty: 1, maxQty: 1 }] }
            }
        }),
        [CAMP]: camp(CAMP, 'Fixture Goblin Camp', GOBLIN),
        [WOLF]: enemy(WOLF, 'Fixture Wolf', 4),
        [BARE_CAMP]: camp(BARE_CAMP, 'Fixture Wolf Den', WOLF),
        [BOSS]: enemy(BOSS, 'Fixture Boss', 12, { steal: { outputs: [{ itemId: INGOT, chance: 100, minQty: 1, maxQty: 1 }] } }),
        [BOSS_CAMP]: camp(BOSS_CAMP, 'Fixture Boss Tent', BOSS, 1),
        [TREE]: {
            id: TREE, name: 'Fixture Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_tree_oak', requiresHero: true,
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [], outputs: [] }
        },
        [FOREST]: camp(FOREST, 'Fixture Forest', TREE)
    });
}

const HIDEOUT_AT = { x: 800, y: 500 };
const CAMP_AT = { x: 960, y: 500 };
const NEAR_AT = { x: 800, y: 660 };
const FAR_AT = { x: 1700, y: 500 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };
/** What has come in of an item, on the mat or already in the Bank (each case starts with neither). */
const lootOf = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);
/** Whether every sprite of an item on the mat flew out of `from` (a sprite keeps where it came from). */
const allFrom = (itemId, from) => SpriteLayer.getSprites()
    .filter(sp => sp.refId === itemId)
    .every(sp => sp.fromX === from.x && sp.fromY === from.y);
const guardsOf = (c) => BoardState.tokens().filter(t => t.guardOf === c.id);
const tethered = (c) => BoardState.tokens().filter(t => t.tether === c.id);

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

/** Spawn a camp's enemies up to its cap, as its clock would. */
function fillCamp(c) {
    for (let i = 0; i < 5; i++) SpawnerSystem.attemptSpawn(c, getTokenType(c.typeId), Math.random);
}

/**
 * A Hideout with a Goblin Camp in its reach, the camp filled, and optionally a thief (Crime
 * `crime`) ordered onto the Hideout with the camp chosen.
 */
function build({ typeId = HIDEOUT, crime = 30, chosen = true, thief = true } = {}) {
    freshBoard();
    const hide = fixtures.placeAt(typeId, HIDEOUT_AT.x, HIDEOUT_AT.y);
    const goblins = fixtures.placeAt(CAMP, CAMP_AT.x, CAMP_AT.y);
    fillCamp(goblins);
    TileModifiers.rebuildAll();
    if (chosen) expect(Hideouts.setTarget(hide, goblins.id)).toBe(true);
    let heroId = null;
    if (thief) {
        const [hero] = fixtures.makeHeroes(1, { crime, melee: 50 });
        heroId = hero.id;
        expect(fixtures.orderAt(heroId, HIDEOUT_AT).success).toBe(true);
    }
    return { hide, goblins, heroId };
}

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
    resetWorldTablesForTests();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the Hideout is Crime\'s station kind, and runs no recipe', () => {
    it('the Hideout is a station kind of Crime, with its name', () => {
        expect(STATION_KINDS).toContain(HIDEOUT_KIND);
        expect(stationKindsOfSkill('crime')).toEqual([HIDEOUT_KIND]);
        expect(stationKindLabel(HIDEOUT_KIND)).toBe('Hideout');
    });

    it('a Hideout offers no recipe, even one of its skill: stealing is all Crime does', () => {
        expect(recipesForToken(getTokenType(HIDEOUT))).toEqual([]);
        expect(Hideouts.isHideout(getTokenType(HIDEOUT))).toBe(true);
        expect(Hideouts.isHideout(getTokenType(CAMP))).toBe(false);
    });
});

describe('a steal table, a camp\'s Crime level and the caught curve', () => {
    it('a steal table keeps its item lines and rare table; a Token line is no line', () => {
        const steal = stealOf(getTokenType(GOBLIN));
        expect(steal.outputs.map(o => o.itemId)).toEqual([INGOT, NAILS]);
        expect(steal.rareTable.chance).toBe(100);
        expect(steal.xp).toBe(7);
        expect(stealOf(getTokenType(WOLF))).toBeNull();
        expect(stealOf({ steal: { outputs: [{ tokenId: TREE }] } })).toBeNull();
        expect(stealOf({ steal: { outputs: [{ itemId: INGOT, chance: 0 }] } })).toBeNull();
    });

    it('a camp\'s Crime level is its enemy\'s level unless the steal table writes one', () => {
        expect(crimeLevelOf(getTokenType(GOBLIN))).toBe(5);
        expect(crimeLevelOf({ enemy: { level: 5 }, steal: { crimeLevel: 9, outputs: [{ itemId: INGOT }] } })).toBe(9);
    });

    it('caught often below the camp\'s level, rarely above it, within the curve\'s floor and ceiling', () => {
        const curve = CAUGHT_DEFAULTS;
        const even = caughtChance(5, 5, curve);
        expect(even).toBe(curve.evenChance);
        expect(caughtChance(1, 5, curve)).toBeGreaterThan(even);
        expect(caughtChance(9, 5, curve)).toBeLessThan(even);
        expect(caughtChance(1, 99, curve)).toBe(curve.maxChance);
        expect(caughtChance(99, 1, curve)).toBe(curve.minChance);
        // Quiet takes points off, the floor still holding.
        expect(caughtChance(5, 5, curve, 10)).toBe(even - 10);
        expect(caughtChance(99, 1, curve, 10)).toBe(curve.minChance);
    });

    it('a Hideout\'s curve is its own where it writes one, the default elsewhere', () => {
        expect(caughtCurveOf(getTokenType(HIDEOUT))).toEqual(CAUGHT_DEFAULTS);
        expect(caughtCurveOf(getTokenType(ALWAYS_CAUGHT))).toEqual({ evenChance: 100, perLevel: 0, minChance: 100, maxChance: 100 });
        expect(caughtCurveOf({ hideout: { evenChance: 40, minChance: 90, maxChance: 50 } }))
            .toEqual({ evenChance: 40, perLevel: CAUGHT_DEFAULTS.perLevel, minChance: 50, maxChance: 50 });
    });

    it('Quiet is an effect the CMS offers, narrowed to Crime work', () => {
        const row = getPaletteEntry(EFFECT_TYPES.QUIET);
        expect(row?.label).toBe('Quiet');
        expect(row.skillsOnly).toEqual(['crime']);
    });
});

describe('a Hideout picks one camp in its reach', () => {
    it('it offers the enemy camps in its reach that have a steal table, never one out of reach, a bare one or a boss\'s', () => {
        setWorldTablesForTests({
            ...PLACEHOLDER_WORLD_TABLES,
            kits: PLACEHOLDER_WORLD_TABLES.kits.map((k, i) => (i === 0 ? { ...k, bossCamps: [...(k.bossCamps || []), BOSS_CAMP] } : k))
        });
        const hide = fixtures.placeAt(HIDEOUT, HIDEOUT_AT.x, HIDEOUT_AT.y);
        const goblins = fixtures.placeAt(CAMP, CAMP_AT.x, CAMP_AT.y);
        const wolves = fixtures.placeAt(BARE_CAMP, NEAR_AT.x, NEAR_AT.y);
        const boss = fixtures.placeAt(BOSS_CAMP, HIDEOUT_AT.x - 160, HIDEOUT_AT.y);
        const forest = fixtures.placeAt(FOREST, HIDEOUT_AT.x, HIDEOUT_AT.y - 160);
        const far = fixtures.placeAt(CAMP, FAR_AT.x, FAR_AT.y);
        expect(Hideouts.campsInReach(hide).map(c => c.id)).toEqual([goblins.id]);
        for (const refused of [wolves, boss, forest, far]) expect(Hideouts.setTarget(hide, refused.id)).toBe(false);
        expect(Hideouts.targetOf(hide)).toBeNull();
        expect(Hideouts.setTarget(hide, goblins.id)).toBe(true);
        expect(Hideouts.targetOf(hide)?.id).toBe(goblins.id);
    });

    it('choosing a camp is said on the Token, and starts its cycle again', () => {
        const { hide, goblins } = build({ chosen: false, thief: false });
        const other = fixtures.placeAt(CAMP, NEAR_AT.x, NEAR_AT.y);
        expect(Hideouts.setTarget(hide, goblins.id)).toBe(true);
        hide.cycleElapsedMs = 900;
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => heard.push(p));
        expect(Hideouts.setTarget(hide, other.id)).toBe(true);
        off();
        expect(hide.cycleElapsedMs).toBe(0);
        expect(heard).toContainEqual({ instanceId: hide.id, typeId: HIDEOUT });
    });

    it('with no camp chosen it waits for the player, and no thief takes it', () => {
        const { hide, heroId } = build({ chosen: false });
        step(THEFT_MS * 2);
        expect(WorkCheck.fixableReason(hide.id, hide, heroId).reason).toBe(ALERT.CHOOSE_CAMP);
        expect(BoardState.heroOfInstance(hide.id)).toBeFalsy();
        expect(Flags.hasFixableSkip(hide)).toBe(true);
        expect(lootOf(INGOT)).toBe(0);
    });

    it('a chosen camp that has left its reach reads as none, and is kept for when it is back', () => {
        const { hide, goblins, heroId } = build({ thief: false });
        BoardState.setTokenPoint(goblins.id, FAR_AT.x, FAR_AT.y);
        expect(Hideouts.targetOf(hide)).toBeNull();
        expect(WorkCheck.fixableReason(hide.id, hide, heroId).reason).toBe(ALERT.CHOOSE_CAMP);
        BoardState.setTokenPoint(goblins.id, CAMP_AT.x, CAMP_AT.y);
        expect(Hideouts.targetOf(hide)?.id).toBe(goblins.id);
    });
});

describe('each cycle its hero steals, and the enemy stays', () => {
    it('a theft lands the steal table\'s lines and its rare find at the Hideout, and teaches the table\'s Crime XP', () => {
        const { hide, goblins } = build({ typeId: NEVER_CAUGHT });
        const before = tethered(goblins).map(t => t.id).sort();
        const xp0 = GameState.state.heroes[0].skills.crime.xp;
        step(THEFT_MS + 100);
        expect(lootOf(INGOT)).toBe(2);
        expect(lootOf(NAILS)).toBe(1);
        expect(lootOf(COIN_PURSE)).toBe(1);
        for (const id of [INGOT, NAILS, COIN_PURSE]) expect(allFrom(id, hide)).toBe(true);
        // A Token line is no line: nothing grew beside the Hideout.
        expect(BoardState.tokens().some(t => t.typeId === TREE)).toBe(false);
        // The enemies stand where they stood, none beaten, none added.
        expect(tethered(goblins).map(t => t.id).sort()).toEqual(before);
        expect(GameState.state.heroes[0].skills.crime.xp - xp0).toBe(7);
    });

    it('says each theft: the camp, the thief and what was taken', () => {
        const { hide, goblins, heroId } = build({ typeId: NEVER_CAUGHT });
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
        step(THEFT_MS + 100);
        off();
        expect(heard).toHaveLength(1);
        expect(heard[0]).toMatchObject({ instanceId: hide.id, campId: goblins.id, heroId, caught: false, guardId: null });
        expect(heard[0].items).toEqual(expect.arrayContaining([{ itemId: INGOT, quantity: 2 }, { itemId: NAILS, quantity: 1 }, { itemId: COIN_PURSE, quantity: 1 }]));
    });

    it('thieves and fighters share a camp: a theft takes nothing from the camp\'s count', () => {
        const { goblins } = build({ typeId: NEVER_CAUGHT });
        const counts = SpawnerSystem.spawnerCounts(goblins.id);
        step(THEFT_MS * 3 + 100);
        expect(SpawnerSystem.spawnerCounts(goblins.id)).toEqual(counts);
    });
});

describe('a thief caught: a guard on the camp until beaten', () => {
    it('a catch takes nothing, teaches nothing, and puts a guard of the camp\'s enemy on it, past its cap and outside the Token cap', () => {
        const { hide, goblins, heroId } = build({ typeId: ALWAYS_CAUGHT });
        const counts = SpawnerSystem.spawnerCounts(goblins.id);
        expect(counts.count).toBe(counts.cap);
        const onCap = MatCap.tokenCount();
        const xp0 = GameState.state.heroes[0].skills.crime.xp;
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
        step(THEFT_MS + 100);
        off();
        expect(lootOf(INGOT)).toBe(0);
        expect(GameState.state.heroes[0].skills.crime.xp).toBe(xp0);
        const guards = guardsOf(goblins);
        expect(guards).toHaveLength(1);
        const [guard] = guards;
        expect(guard.typeId).toBe(GOBLIN);
        expect(guard.tether).toBeNull();
        expect(Hideouts.guardOf(goblins)?.id).toBe(guard.id);
        // Past the camp's cap: its own count is unchanged, and the guard came anyway.
        expect(SpawnerSystem.spawnerCounts(goblins.id)).toEqual(counts);
        expect(MatCap.tokenCount()).toBe(onCap);
        expect(heard).toEqual([expect.objectContaining({ instanceId: hide.id, campId: goblins.id, heroId, caught: true, guardId: guard.id, items: [] })]);
    });

    it('while the guard stands nobody robs the camp: the Hideout waits, its thief beside it', () => {
        const { hide, goblins, heroId } = build({ typeId: ALWAYS_CAUGHT });
        step(THEFT_MS + 100);
        expect(guardsOf(goblins)).toHaveLength(1);
        step(THEFT_MS * 3);
        expect(guardsOf(goblins)).toHaveLength(1);
        expect(WorkCheck.fixableReason(hide.id, hide, heroId).reason).toBe(ALERT.GUARDED);
        expect(hide.alert).toBe(ALERT.GUARDED);
        expect(BoardState.flagOf(heroId)?.pinnedTo).toBe(hide.id);
    });

    it('the guard is the camp\'s to fight: a hero sent to the camp hunts it too', () => {
        const { goblins } = build({ typeId: ALWAYS_CAUGHT });
        step(THEFT_MS + 100);
        const [guard] = guardsOf(goblins);
        expect(Camps.isCampWork(goblins, guard)).toBe(true);
    });

    it('once the guard is beaten the camp can be robbed again', () => {
        const { hide, goblins, heroId } = build({ typeId: ALWAYS_CAUGHT });
        step(THEFT_MS + 100);
        const [guard] = guardsOf(goblins);
        const [fighter] = fixtures.makeHeroes(2, { melee: 99 }).slice(1);
        expect(fixtures.orderAt(fighter.id, { x: guard.x, y: guard.y }).success).toBe(true);
        for (let t = 0; t < 120_000 && BoardState.getTokenById(guard.id); t += 100) step(100);
        expect(BoardState.getTokenById(guard.id)).toBeNull();
        expect(Hideouts.guardOf(goblins)).toBeNull();
        expect(WorkCheck.fixableReason(hide.id, hide, heroId).reason).toBeNull();
        // The thief robs it again at once (and, at these odds, is caught again: a new guard).
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
        step(THEFT_MS + 100);
        off();
        expect(heard).toHaveLength(1);
        expect(heard[0].guardId).not.toBe(guard.id);
    });

    it('the Token cap never holds a guard back', () => {
        const { goblins } = build({ typeId: ALWAYS_CAUGHT });
        setMatTuning('tokenCap', 1);
        expect(MatCap.canPlaceMore(1)).toBe(false);
        step(THEFT_MS + 100);
        expect(guardsOf(goblins)).toHaveLength(1);
    });
});

describe('Quiet: a lower chance of being caught', () => {
    it('a Quiet rule on the Hideout takes its points off the thief\'s odds', () => {
        const plain = build({ crime: 5 });
        const base = Hideouts.caughtChanceAt(plain.hide.id, plain.heroId, plain.goblins);
        expect(base).toBe(caughtChance(5, 5, CAUGHT_DEFAULTS));
        const quiet = build({ typeId: QUIET_HIDEOUT, crime: 5 });
        expect(Hideouts.caughtChanceAt(quiet.hide.id, quiet.heroId, quiet.goblins)).toBe(base - QUIET_POINTS);
    });

    it('a thief well above the camp is rarely caught, one far below often', () => {
        const low = build({ crime: 1 });
        const lowOdds = Hideouts.caughtChanceAt(low.hide.id, low.heroId, low.goblins);
        const high = build({ crime: 40 });
        const highOdds = Hideouts.caughtChanceAt(high.hide.id, high.heroId, high.goblins);
        expect(lowOdds).toBeGreaterThan(CAUGHT_DEFAULTS.evenChance);
        expect(highOdds).toBe(CAUGHT_DEFAULTS.minChance);
    });
});

describe('a Hideout through a save and time away', () => {
    it('a save keeps the chosen camp, and the Hideout goes on stealing after the load', () => {
        const { hide, goblins } = build({ typeId: NEVER_CAUGHT });
        reload();
        const loaded = BoardState.getTokenById(hide.id);
        expect(loaded).not.toBe(hide);
        expect(Hideouts.targetOf(loaded)?.id).toBe(goblins.id);
        step(THEFT_MS + 100);
        expect(lootOf(INGOT)).toBe(2);
    });

    it('a save keeps the guard: loaded, the camp is still guarded until it is beaten', () => {
        const { hide, goblins, heroId } = build({ typeId: ALWAYS_CAUGHT });
        step(THEFT_MS + 100);
        const [guard] = guardsOf(goblins);
        reload();
        const loadedCamp = BoardState.getTokenById(goblins.id);
        expect(Hideouts.guardOf(loadedCamp)?.id).toBe(guard.id);
        step(THEFT_MS * 2);
        const loaded = BoardState.getTokenById(hide.id);
        expect(WorkCheck.fixableReason(loaded.id, loaded, heroId).reason).toBe(ALERT.GUARDED);
        expect(guardsOf(loadedCamp)).toHaveLength(1);
        BoardState.removeToken(guard.id);
        expect(Hideouts.guardOf(loadedCamp)).toBeNull();
    });

    it('time away: the catch-up steals as the plain loop in its 1 s steps does', async () => {
        const AWAY = 60_000;
        build({ typeId: NEVER_CAUGHT });
        step(AWAY, 1000);
        const live = { ingots: lootOf(INGOT), nails: lootOf(NAILS), xp: GameState.state.heroes[0].skills.crime.xp };
        build({ typeId: NEVER_CAUGHT });
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        const caught = { ingots: lootOf(INGOT), nails: lootOf(NAILS), xp: GameState.state.heroes[0].skills.crime.xp };
        expect(caught).toEqual(live);
        expect(caught.ingots).toBeGreaterThanOrEqual(2 * 25);
    });

    it('time away: a catch sets its guard, and the rest of the time nobody robs the guarded camp', async () => {
        const { hide, goblins } = build({ typeId: ALWAYS_CAUGHT });
        const NOW = 1_800_000_000_000;
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - 5 * 60_000, now: NOW });
        off();
        expect(heard).toHaveLength(1);
        expect(guardsOf(goblins)).toHaveLength(1);
        expect(hide.alert).toBe(ALERT.GUARDED);
    });
});
