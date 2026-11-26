import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Flags from '../systems/board/Flags.js';
import * as Fields from '../systems/board/Fields.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Laboratories from '../systems/board/Laboratories.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Mastery from '../systems/progression/Mastery.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools, recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { STATION_KINDS, stationKindsOfSkill, stationKindLabel } from '../config/registries/tokenConstants.js';
import {
    LABORATORY_KIND, laboratoryOf, masteryTrackOf, rankAt, nextRankOf, isMasteredAt, kindOfType, kindOfToken
} from '../config/registries/mastery.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Science (brief 810 K6): a Laboratory, Science's station kind, studies one node in its reach, the
 * one the player picks on its card. Each cycle its hero wears the node as gathering does (its chance
 * to end, a Field's harvest, a spot's chance to move on) and gives no goods, only a mastery point to
 * the node's kind, guild-wide and saved. Each kind's track gives a rank at each threshold, and each
 * rank's effect is on every Token of the kind. Science level decides which kinds a hero studies; a
 * Laboratory's level reaches only so high.
 */

const ORE = 'fixture_sc_ore';
const WOOD = 'fixture_sc_wood';
const SEED = 'fixture_sc_seed';
const GRAIN = 'fixture_sc_grain';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

const YIELD_FX = 'fixture_sc_yield';
const SPEED_FX = 'fixture_sc_speed';
const GROWTH_FX = 'fixture_sc_growth';
const provides = (id, type, value, bucket = 'percentage') => ({
    id, name: id, statements: [{ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: null, reach: 'self', payload: { type, bucket, value } }]
});

const LAB = 'fixture_sc_lab';
const HIGH_LAB = 'fixture_sc_high_lab';
const UNIVERSITY = 'fixture_sc_university';
const CURSE = 'fixture_sc_curse';
const VEIN = 'fixture_sc_vein';
const LASTING_VEIN = 'fixture_sc_lasting_vein';
const DEEP_VEIN = 'fixture_sc_deep_vein';
const PLAIN_VEIN = 'fixture_sc_plain_vein';
const TREE = 'fixture_sc_tree';
const STUMP = 'fixture_sc_stump';
const FIELD = 'fixture_sc_field';
const CROP = 'fixture_sc_crop';
const OTHER_CROP = 'fixture_sc_other_crop';
const SPOT = 'fixture_sc_spot';
const DRIFTING_SPOT = 'fixture_sc_drifting_spot';

const STUDY_MS = 2000;
const REST_MS = 30_000;
const REGROW_MS = 20_000;
const GROW_MS = 60_000;

const works = (id) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'science', stationKind: LABORATORY_KIND } });
const lab = (id, name, extra = {}, statements = [works(id)]) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire', requiresHero: true,
    config: { skill: 'science', skillRequired: 1, cycleTimeMs: STUDY_MS, xp: 3, inputs: [], outputs: [] },
    statements, ...extra
});
const track = (...ranks) => ({ ranks: ranks.map(([points, effectId, scale = 1]) => ({ points, effectId, scale })) });
const node = (id, name, skill, level, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_ore_vein_copper', requiresHero: true,
    config: { skill, skillRequired: level, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
    ...extra
});

function registerFixtures() {
    registerItems({ [ORE]: item(ORE, 'Fixture Ore'), [WOOD]: item(WOOD, 'Fixture Wood'), [SEED]: item(SEED, 'Fixture Seed'), [GRAIN]: item(GRAIN, 'Fixture Grain') });
    registerEffects({
        [YIELD_FX]: provides(YIELD_FX, EFFECT_TYPES.YIELD, 0.5),
        [SPEED_FX]: provides(SPEED_FX, EFFECT_TYPES.WORK_TIME, -0.2),
        [GROWTH_FX]: provides(GROWTH_FX, EFFECT_TYPES.GROW_TIME, -0.5)
    });
    const crop = (id, name, extra = {}) => ({
        id, name, skill: 'farming', levelRequirement: 3, durationMs: 1000, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }], outputs: [{ itemId: GRAIN, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: GROW_MS, endChance: 100 }, ...extra
    });
    registerRecipePools({
        // A Science recipe someone authored by mistake: a Laboratory studies nodes and runs no recipe.
        science: [{ id: 'sc_stray_recipe', name: 'Stray', skill: 'science', levelRequirement: 1, durationMs: 1000, xp: 1, inputs: [], outputs: [] }],
        farming: [crop(CROP, 'Fixture Crop', { mastery: track([1, GROWTH_FX], [3, YIELD_FX]) }), crop(OTHER_CROP, 'Fixture Other Crop')]
    });
    registerTokenTypes({
        [LAB]: lab(LAB, 'Fixture Laboratory', { laboratory: { maxLevel: 20 } }),
        [HIGH_LAB]: lab(HIGH_LAB, 'Fixture Grand Laboratory', { laboratory: { maxLevel: 40 } }),
        [UNIVERSITY]: {
            id: UNIVERSITY, name: 'Fixture University', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_campfire', requiresHero: false, config: null,
            statements: [{ id: 'stm_sc_university', keyword: KEYWORD.PROVIDES, to: null, reach: 'nearby', payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.5, category: 'science' } }]
        },
        [CURSE]: {
            id: CURSE, name: 'Fixture Curse', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_campfire', requiresHero: false, config: null,
            statements: [{ id: 'stm_sc_curse', keyword: KEYWORD.PROVIDES, to: null, reach: 'nearby', payload: { type: EFFECT_TYPES.FAIL_CHANCE, bucket: 'flat', value: 100, category: 'science' } }]
        },
        [VEIN]: node(VEIN, 'Fixture Vein', 'mining', 5, {
            uses: 5, endChance: 100, respawn: { mode: 'refill', afterMs: REST_MS },
            mastery: track([4, SPEED_FX], [2, YIELD_FX])
        }),
        [LASTING_VEIN]: node(LASTING_VEIN, 'Fixture Lasting Vein', 'mining', 5, {
            uses: 5, endChance: 0.000001, respawn: { mode: 'refill', afterMs: REST_MS },
            mastery: track([2, YIELD_FX], [4, SPEED_FX], [100, YIELD_FX])
        }),
        [DEEP_VEIN]: node(DEEP_VEIN, 'Fixture Deep Vein', 'mining', 30, {
            uses: 5, endChance: 0.000001, respawn: { mode: 'refill', afterMs: REST_MS }, mastery: track([2, YIELD_FX])
        }),
        [PLAIN_VEIN]: node(PLAIN_VEIN, 'Fixture Plain Vein', 'mining', 1, { uses: 5, endChance: 50, respawn: { mode: 'refill', afterMs: REST_MS } }),
        [TREE]: node(TREE, 'Fixture Tree', 'forestry', 1, {
            uses: 5, endChance: 100, respawn: { mode: 'regrow', into: STUMP }, mastery: track([1, GROWTH_FX], [5, YIELD_FX])
        }),
        [STUMP]: {
            id: STUMP, name: 'Fixture Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_stump_oak', requiresHero: false, config: null, grows: { into: TREE, afterMs: REGROW_MS }
        },
        [FIELD]: {
            id: FIELD, name: 'Fixture Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_farmland', requiresHero: true,
            config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
            field: { emptySprite: 't_farmland', startsWith: CROP },
            statements: [{ id: 'stm_sc_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
        },
        [SPOT]: node(SPOT, 'Fixture Spot', 'fishing', 1, {
            uses: null, spot: { water: [], everyMinutes: 0, most: 1, leaveChance: 100, unworkedMinutes: 0 },
            mastery: track([1, YIELD_FX], [2, SPEED_FX])
        }),
        [DRIFTING_SPOT]: node(DRIFTING_SPOT, 'Fixture Drifting Spot', 'fishing', 1, {
            uses: null, spot: { water: [], everyMinutes: 0, most: 1, leaveChance: 0, unworkedMinutes: 1 },
            mastery: track([100, YIELD_FX])
        })
    });
}

const LAB_AT = { x: 800, y: 500 };
const NODE_AT = { x: 960, y: 500 };
const NEAR_AT = { x: 800, y: 660 };
const FAR_AT = { x: 1700, y: 500 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };
const lootOf = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);
const science = () => GameState.state.heroes[0].skills.science.xp;

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
    Mastery.apply();
}

/**
 * A Laboratory with a node of `nodeType` in its reach, chosen, and optionally a Science hero
 * (Science `level`) ordered onto the Laboratory.
 */
function build({ labType = LAB, nodeType = LASTING_VEIN, level = 30, chosen = true, hero = true } = {}) {
    freshBoard();
    const theLab = fixtures.placeAt(labType, LAB_AT.x, LAB_AT.y);
    const theNode = fixtures.placeAt(nodeType, NODE_AT.x, NODE_AT.y);
    TileModifiers.rebuildAll();
    if (chosen) expect(Laboratories.setTarget(theLab, theNode.id)).toBe(true);
    let heroId = null;
    if (hero) {
        const [h] = fixtures.makeHeroes(1, { science: level, mining: 50 });
        heroId = h.id;
        expect(fixtures.orderAt(heroId, LAB_AT).success).toBe(true);
    }
    return { lab: theLab, node: theNode, heroId };
}

/**
 * Save and load the game as a player's slot does; `fresh`: the game is let go first (a new game in
 * between), so nothing the save made is still in memory, as on opening the game again.
 */
function reload({ fresh = false } = {}) {
    const data = JSON.parse(GameState.serializeJson());
    if (fresh) {
        GameState.initNew();
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, {});
    }
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}

const yieldAt = (instanceId) => TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.YIELD, 1, 'mining');

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => freshBoard());

describe('the Laboratory is Science\'s station kind, and runs no recipe', () => {
    it('the Laboratory is a station kind of Science, with its name', () => {
        expect(STATION_KINDS).toContain(LABORATORY_KIND);
        expect(stationKindsOfSkill('science')).toEqual([LABORATORY_KIND]);
        expect(stationKindLabel(LABORATORY_KIND)).toBe('Laboratory');
    });

    it('a Laboratory offers no recipe, even one of its skill: studying is all it does', () => {
        expect(recipesForToken(getTokenType(LAB))).toEqual([]);
        expect(Laboratories.isLaboratory(getTokenType(LAB))).toBe(true);
        expect(Laboratories.isLaboratory(getTokenType(VEIN))).toBe(false);
    });

    it('a Laboratory\'s level reaches its block\'s, any level without one', () => {
        expect(laboratoryOf(getTokenType(LAB))).toEqual({ maxLevel: 20 });
        expect(laboratoryOf({ laboratory: { maxLevel: 'x' } })).toEqual({ maxLevel: null });
        expect(laboratoryOf({})).toEqual({ maxLevel: null });
    });
});

describe('a mastery track and a node\'s kind', () => {
    it('a track reads its ranks in points order, numbered from 1, a blank row dropped and a scale held to 1-5', () => {
        const t = masteryTrackOf({ mastery: { ranks: [
            { points: 10, effectId: 'b', scale: 9 }, { points: 3, effectId: 'a' }, { points: 5, effectId: '' }, { points: 0, effectId: 'c' }
        ] } });
        expect(t.ranks).toEqual([
            { rank: 1, points: 3, effectId: 'a', scale: 1 },
            { rank: 2, points: 10, effectId: 'b', scale: 5 }
        ]);
        expect(masteryTrackOf({ mastery: { ranks: [{ points: 0, effectId: 'a' }] } })).toBeNull();
        expect(masteryTrackOf({})).toBeNull();
    });

    it('a rank is reached at its points, and the next is the first above', () => {
        const t = masteryTrackOf(getTokenType(VEIN));
        expect(t.ranks.map(r => r.effectId)).toEqual([YIELD_FX, SPEED_FX]);
        expect([0, 1, 2, 3, 4, 9].map(p => rankAt(t, p))).toEqual([0, 0, 1, 1, 2, 2]);
        expect(nextRankOf(t, 2).points).toBe(4);
        expect(nextRankOf(t, 4)).toBeNull();
        expect(isMasteredAt(t, 3)).toBe(false);
        expect(isMasteredAt(t, 4)).toBe(true);
    });

    it('a Stump is its tree\'s kind; a Field\'s kind is the crop in its ground, a wild one\'s its starting crop', () => {
        expect(kindOfType(STUMP, getTokenType)).toBe(TREE);
        expect(kindOfType(TREE, getTokenType)).toBe(TREE);
        const fieldDef = getTokenType(FIELD);
        expect(kindOfToken({ typeId: FIELD }, fieldDef, getTokenType)).toBe(CROP);
        expect(kindOfToken({ typeId: FIELD, field: { cropId: OTHER_CROP } }, fieldDef, getTokenType)).toBe(OTHER_CROP);
        expect(kindOfToken({ typeId: FIELD, field: {} }, fieldDef, getTokenType)).toBeNull();
    });
});

describe('a Laboratory picks one node in its reach', () => {
    it('it offers the nodes in its reach whose kind has a track, never one out of reach or with no track; one above its level is shown, not offered', () => {
        const theLab = fixtures.placeAt(LAB, LAB_AT.x, LAB_AT.y);
        const near = fixtures.placeAt(VEIN, NODE_AT.x, NODE_AT.y);
        const tree = fixtures.placeAt(TREE, NEAR_AT.x, NEAR_AT.y);
        fixtures.placeAt(PLAIN_VEIN, LAB_AT.x - 160, LAB_AT.y);
        const deep = fixtures.placeAt(DEEP_VEIN, LAB_AT.x, LAB_AT.y - 160);
        const far = fixtures.placeAt(VEIN, FAR_AT.x, FAR_AT.y);
        expect(Laboratories.nodesInReach(theLab).map(n => n.id).sort()).toEqual([near.id, tree.id].sort());
        expect(Laboratories.candidatesOf(theLab).find(c => c.node.id === deep.id)).toMatchObject({ refusal: 'level', level: 30, kind: DEEP_VEIN });
        expect(Laboratories.setTarget(theLab, deep.id)).toBe(false);
        expect(Laboratories.setTarget(theLab, far.id)).toBe(false);
        // A variant reaching higher studies it.
        const grand = fixtures.placeAt(HIGH_LAB, LAB_AT.x + 40, LAB_AT.y - 200);
        expect(Laboratories.nodesInReach(grand).map(n => n.id)).toContain(deep.id);
    });

    it('choosing a node is said on the Token, and starts its cycle again', () => {
        const { lab: theLab } = build({ hero: false, chosen: false });
        const other = fixtures.placeAt(VEIN, NEAR_AT.x, NEAR_AT.y);
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => heard.push(p.instanceId));
        theLab.cycleElapsedMs = 500;
        expect(Laboratories.setTarget(theLab, other.id)).toBe(true);
        off();
        expect(theLab.studies).toBe(other.id);
        expect(theLab.cycleElapsedMs).toBe(0);
        expect(heard).toContain(theLab.id);
    });

    it('with no node chosen it waits for the player with a red mark, and no hero takes it', () => {
        const { lab: theLab, heroId } = build({ chosen: false });
        step(1000);
        expect(WorkCheck.fixableReason(theLab.id, theLab, heroId).reason).toBe(ALERT.CHOOSE_NODE);
        expect(BoardState.workerOf(theLab.id)).toBeNull();
        expect(Flags.hasFixableSkip(theLab)).toBe(true);
    });

    it('a chosen node that has left its reach reads as none, and is kept for when it is back', () => {
        const { lab: theLab, node: vein } = build({ hero: false });
        BoardState.setTokenPoint(vein.id, FAR_AT.x, FAR_AT.y);
        expect(Laboratories.targetOf(theLab)).toBeNull();
        expect(theLab.studies).toBe(vein.id);
        BoardState.setTokenPoint(vein.id, NODE_AT.x, NODE_AT.y);
        expect(Laboratories.targetOf(theLab)?.id).toBe(vein.id);
    });
});

describe('each cycle its hero studies, for mastery and no goods', () => {
    it('a study gives the node\'s kind a point, guild-wide and saved, teaches Science, and makes nothing', () => {
        const { lab: theLab, node: vein, heroId } = build();
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.STUDIED, (p) => heard.push(p));
        const xp = science();
        step(STUDY_MS + 200);
        off();
        expect(BoardState.workerOf(theLab.id)).toBe(heroId);
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(1);
        expect(GameState.state.progress.mastery).toEqual({ [LASTING_VEIN]: 1 });
        expect(science()).toBe(xp + 3);
        expect(lootOf(ORE)).toBe(0);
        expect(heard).toEqual([expect.objectContaining({ instanceId: theLab.id, nodeId: vein.id, kind: LASTING_VEIN, points: 1, rank: 0, heroId })]);
    });

    it('a rank reached puts its effect on every Token of the kind, out of the Laboratory\'s reach and placed later too, and on no other kind', () => {
        const { node: vein } = build();
        const far = fixtures.placeAt(LASTING_VEIN, FAR_AT.x, FAR_AT.y);
        const other = fixtures.placeAt(VEIN, NEAR_AT.x, NEAR_AT.y);
        TileModifiers.rebuildAll();
        const ranks = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.MASTERY_RANK_UP, (p) => ranks.push(p));
        step(STUDY_MS + 200);
        expect(yieldAt(vein.id)).toBe(1);
        step(STUDY_MS);
        off();
        expect(Mastery.rankOf(LASTING_VEIN)).toBe(1);
        expect(ranks).toEqual([expect.objectContaining({ kind: LASTING_VEIN, rank: 1, ranks: 3, effectId: YIELD_FX })]);
        expect(yieldAt(vein.id)).toBe(1.5);
        expect(yieldAt(far.id)).toBe(1.5);
        expect(yieldAt(other.id)).toBe(1);
        const later = fixtures.placeAt(LASTING_VEIN, FAR_AT.x, FAR_AT.y + 200);
        TileModifiers.rebuildAround([{ x: later.x, y: later.y }]);
        expect(yieldAt(later.id)).toBe(1.5);
    });

    it('a rank\'s effect speeds its gathering: a gatherer on a mastered node works faster', () => {
        const { node: vein } = build();
        step(STUDY_MS * 4 + 200);
        expect(Mastery.rankOf(LASTING_VEIN)).toBe(2);
        expect(TileModifiers.workTimeOf(vein.id, 3000, 'mining')).toBe(2400);
    });

    it('a hero below the node\'s level in Science cannot study it: the level is the node\'s gathering level', () => {
        const { lab: theLab } = build({ hero: false });
        expect(StationRecipe.workConfigOf(getTokenType(LAB), theLab).skillRequired).toBe(5);
        const [h] = fixtures.makeHeroes(1, { science: 3 });
        expect(WorkCheck.heroReason(h.id, StationRecipe.workConfigOf(getTokenType(LAB), theLab), theLab)).toBe(ALERT.ACCESS);
        // The order is refused for the level, as onto a station whose recipe is above the hero.
        expect(fixtures.orderAt(h.id, LAB_AT)).toMatchObject({ success: false });
        step(STUDY_MS + 200);
        expect(BoardState.workerOf(theLab.id)).toBeNull();
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(0);
    });

    it('a failed study learns nothing but still wears its node', () => {
        const { node: vein } = build({ nodeType: VEIN });
        // A curse beside the Laboratory: every Science cycle there fails.
        fixtures.placeAt(CURSE, LAB_AT.x - 100, LAB_AT.y);
        TileModifiers.rebuildAll();
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(VEIN)).toBe(0);
        expect(Respawn.isResting(vein, getTokenType(VEIN))).toBe(true);
    });

    it('a University speeds Science in its reach, as any support does', () => {
        const { lab: theLab } = build();
        expect(TileModifiers.workTimeOf(theLab.id, STUDY_MS, 'science')).toBe(STUDY_MS);
        fixtures.placeAt(UNIVERSITY, LAB_AT.x - 100, LAB_AT.y);
        TileModifiers.rebuildAll();
        expect(TileModifiers.workTimeOf(theLab.id, STUDY_MS, 'science')).toBe(STUDY_MS / 2);
        step(STUDY_MS * 2 + 200);
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(4);
    });
});

describe('a study wears its node as gathering does', () => {
    it('a node that ends by chance ends: the vein rests, the Laboratory waits with no mark and studies again once it refills', () => {
        const { lab: theLab, node: vein, heroId } = build({ nodeType: VEIN });
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(VEIN)).toBe(1);
        expect(Respawn.isResting(vein, getTokenType(VEIN))).toBe(true);
        step(1000);
        expect(WorkCheck.fixableReason(theLab.id, theLab, heroId).reason).toBe(ALERT.NODE_AWAY);
        expect(theLab.alert ?? null).toBeNull();
        expect(BoardState.workerOf(theLab.id)).toBeNull();
        expect(BoardState.flagOf(heroId)?.pinnedTo).toBe(theLab.id);
        step(REST_MS + STUDY_MS + 2000);
        expect(Mastery.pointsOf(VEIN)).toBe(2);
    });

    it('a node that lasts keeps lasting, study after study', () => {
        const { node: vein } = build();
        step(STUDY_MS * 5 + 200);
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(5);
        expect(vein.usesRemaining).toBeGreaterThan(0);
    });

    it('a tree that ends becomes its Stump; the Laboratory follows it, waits, and studies the tree it grows back into', () => {
        const { lab: theLab, node: tree } = build({ nodeType: TREE });
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(TREE)).toBe(1);
        step(200);
        expect(BoardState.getTokenById(tree.id)).toBeNull();
        const stump = Laboratories.targetOf(theLab);
        expect(stump?.typeId).toBe(STUMP);
        expect(theLab.studies).toBe(stump.id);
        // The tree's rank 1 is Growth: it reaches the tree's own Stump too, as Oak mastery reaches an Oak Stump.
        expect(TileModifiers.growTimeOf(stump, REGROW_MS)).toBe(REGROW_MS / 2);
        step(REGROW_MS / 2 + 300);
        expect(Laboratories.targetOf(theLab)?.typeId).toBe(TREE);
        expect(Mastery.pointsOf(TREE)).toBe(1);
        step(STUDY_MS + 2000);
        expect(Mastery.pointsOf(TREE)).toBe(2);
    });

    it('a ripe Field: a study pays its seed and spends a harvest; the last sows again; its crop\'s Growth shortens the next growth', () => {
        freshBoard();
        InventoryManager.addItem(SEED, 3);
        const theLab = fixtures.placeAt(LAB, LAB_AT.x, LAB_AT.y);
        const field = fixtures.placeAt(FIELD, NODE_AT.x, NODE_AT.y);
        const plain = fixtures.placeAt(FIELD, FAR_AT.x, FAR_AT.y);
        TileModifiers.rebuildAll();
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        expect(Laboratories.setTarget(theLab, field.id)).toBe(true);
        // The other Field grows another crop: the study's crop mastery never reaches it.
        plain.field = { cropId: OTHER_CROP };
        const [h] = fixtures.makeHeroes(1, { science: 30 });
        expect(fixtures.orderAt(h.id, LAB_AT).success).toBe(true);
        step(STUDY_MS + 200);
        expect(Mastery.rankOf(CROP)).toBe(1);
        expect(lootOf(GRAIN)).toBe(0);
        // Its one harvest was its last (a wild patch owes no seed): it sowed again, the seed owed to
        // its first harvest, and grows at half its time.
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
        expect(InventoryManager.getItemCount(SEED)).toBe(3);
        expect(Fields.growMsOf(field)).toBe(GROW_MS / 2);
        expect(TileModifiers.growTimeOf(plain, GROW_MS)).toBe(GROW_MS);
        step(2000);
        expect(WorkCheck.fixableReason(theLab.id, theLab, h.id).reason).toBe(ALERT.NODE_AWAY);
        // Ripe again, the first study pays the seed it was sown with, as its first harvest would.
        step(GROW_MS / 2 + STUDY_MS + 1000);
        expect(Mastery.pointsOf(CROP)).toBe(2);
        expect(InventoryManager.getItemCount(SEED)).toBe(2);
    });

    it('a Field sowing another crop takes that crop\'s mastery from the sowing on', () => {
        freshBoard();
        InventoryManager.addItem(SEED, 2);
        GameState.state.progress.mastery[CROP] = 1;
        Mastery.apply();
        const field = fixtures.placeAt(FIELD, NODE_AT.x, NODE_AT.y);
        field.field = { cropId: OTHER_CROP, ripe: true, full: 1 };
        TileModifiers.rebuildAll();
        expect(StationRecipe.setSelectedRecipe(field, CROP)).toBe(true);
        expect(TileModifiers.growTimeOf(field, GROW_MS)).toBe(GROW_MS);
        // Its last harvest of the other crop sows the picked one, which Growth reaches at once.
        Fields.harvested(field, getTokenType(FIELD));
        expect(Fields.plantedCrop(field)?.id).toBe(CROP);
        expect(Fields.growMsOf(field)).toBe(GROW_MS / 2);
    });

    it('a Fishing Spot: a study counts as a catch for its chance to move on, and the Laboratory then asks for another node', () => {
        const { lab: theLab, node: spot, heroId } = build({ nodeType: SPOT });
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(SPOT)).toBe(1);
        expect(BoardState.getTokenById(spot.id)).toBeNull();
        step(500);
        expect(WorkCheck.fixableReason(theLab.id, theLab, heroId).reason).toBe(ALERT.CHOOSE_NODE);
    });

    it('a studied spot is worked: it does not drift off unworked while its Laboratory studies it', () => {
        const { node: spot } = build({ nodeType: DRIFTING_SPOT });
        step(90_000, 1000);
        expect(BoardState.getTokenById(spot.id)).not.toBeNull();
        expect(Mastery.pointsOf(DRIFTING_SPOT)).toBeGreaterThan(30);
        // With nobody studying it, it drifts off after its minute.
        const { node: alone } = build({ nodeType: DRIFTING_SPOT, hero: false });
        step(61_000, 1000);
        expect(BoardState.getTokenById(alone.id)).toBeNull();
    });

    it('a kind fully mastered is studied no more: the Laboratory stops with a mark and the kind is not offered', () => {
        const { lab: theLab, heroId } = build({ nodeType: VEIN });
        GameState.state.progress.mastery[VEIN] = 4;
        Mastery.apply();
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(VEIN)).toBe(4);
        expect(WorkCheck.fixableReason(theLab.id, theLab, heroId).reason).toBe(ALERT.NODE_MASTERED);
        expect(Laboratories.nodesInReach(theLab)).toEqual([]);
        expect(Laboratories.candidatesOf(theLab)[0].refusal).toBe('mastered');
    });
});

describe('mastery through a save and time away', () => {
    it('a save keeps the guild\'s points and the chosen node; loaded, every Token of the kind holds its rank and the study goes on', () => {
        const { lab: theLab, node: vein } = build();
        step(STUDY_MS * 2 + 200);
        expect(Mastery.rankOf(LASTING_VEIN)).toBe(1);
        const data = reload({ fresh: true });
        expect(data.state.progress.mastery).toEqual({ [LASTING_VEIN]: 2 });
        const loaded = BoardState.getTokenById(theLab.id);
        expect(loaded).not.toBe(theLab);
        expect(Laboratories.targetOf(loaded)?.id).toBe(vein.id);
        expect(yieldAt(vein.id)).toBe(1.5);
        step(STUDY_MS + 200);
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(3);
    });

    it('a new game holds no mastery: the rules go when the points do', () => {
        const { node: vein } = build();
        step(STUDY_MS * 2 + 200);
        expect(yieldAt(vein.id)).toBe(1.5);
        GameState.initNew();
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, {});
        const again = fixtures.placeAt(LASTING_VEIN, NODE_AT.x, NODE_AT.y);
        TileModifiers.rebuildAll();
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(0);
        expect(yieldAt(again.id)).toBe(1);
    });

    it('an older save with no mastery record loads with none', () => {
        build();
        const data = JSON.parse(GameState.serializeJson());
        delete data.state.progress.mastery;
        loadSavedState(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        expect(GameState.state.progress.mastery).toEqual({});
        expect(Mastery.pointsOf(LASTING_VEIN)).toBe(0);
    });

    it('time away: the catch-up studies as the plain loop in its 1 s steps does', async () => {
        const AWAY = 60_000;
        build();
        step(AWAY, 1000);
        const live = { points: Mastery.pointsOf(LASTING_VEIN), xp: science() };
        build();
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        const caught = { points: Mastery.pointsOf(LASTING_VEIN), xp: science() };
        expect(caught).toEqual(live);
        expect(caught.points).toBeGreaterThanOrEqual(25);
    });

    it('time away: a studied node that ends by chance rests, and the study waits for its refill', async () => {
        const { node: vein } = build({ nodeType: VEIN });
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - (REST_MS + STUDY_MS * 3), now: NOW });
        // One study, a rest of 30 s, then studies again: two or three, never one a cycle.
        const points = Mastery.pointsOf(VEIN);
        expect(points).toBeGreaterThanOrEqual(2);
        expect(points).toBeLessThanOrEqual(3);
        expect(BoardState.getTokenById(vein.id)).not.toBeNull();
    });
});
