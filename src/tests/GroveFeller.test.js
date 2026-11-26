import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Orders from '../systems/board/Orders.js';
import * as Flags from '../systems/board/Flags.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Grove Feller (brief 800 P2, Forestry 99): when a tree this hero works falls (turns to its
 * Stump), the trees of the same kind touching it fall too, not the whole reach, each paying one
 * cycle's output and XP. Touching is the drawn bodies meeting (centres no further apart than the two
 * art radii). The felled trees fall as the worked one does: each rests and becomes its Stump on the
 * next tick, a Forest's own trees its own Stumps (860 R2). Only the tree the hero works fells its
 * neighbours: a felled tree fells nothing more. As a chance (Grove Felling), 100 % is the perk.
 */

const NEST = 'fixture_gf_nest';
registerItems({
    [NEST]: {
        id: NEST, name: 'GF Nest', type: 'material', sprite: 'i_wheat', description: '', tags: [],
        stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});

const logging = (xp = 3) => ({
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp,
    inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
});
const resource = (id, extra) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', ...extra
});

registerTokenTypes({
    gf_oak: resource('gf_oak', {
        uses: 5, config: logging(), respawn: { mode: 'regrow', into: 'gf_oak_stump' },
        rareTable: { chance: 100, entries: [{ itemId: NEST, weight: 1 }] }
    }),
    gf_oak_stump: resource('gf_oak_stump', { uses: null, config: null, grows: { into: 'gf_oak', afterMs: 600000 } }),
    gf_birch: resource('gf_birch', { uses: 5, config: logging(), respawn: { mode: 'regrow', into: 'gf_birch_stump' } }),
    gf_birch_stump: resource('gf_birch_stump', { uses: null, config: null, grows: { into: 'gf_birch', afterMs: 600000 } }),
    gf_forest: resource('gf_forest', { tokenType: 'building', uses: null, config: null }),
    // A Faith shrine whose Echo (100) reaches the trees once it is lit.
    gf_echo_shrine: {
        id: 'gf_echo_shrine', name: 'GF Echo Shrine', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_shrine_forest', requiresHero: true, shrine: { maxLitMs: 600_000 },
        config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
        statements: [
            { id: 'stm_gf_echo_works', keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } },
            { id: 'stm_gf_echo', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
                payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 100 } }
        ]
    }
});

const fells = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.GROVE_FELLING, bucket: 'flat', value, category: 'forestry' }
    }]
});
registerEffects({ gf_grove_feller: fells('gf_grove_feller', 100) });

function hero(id, forestry) {
    return { id, name: id, status: 'idle', level: 10, hp: { current: 100, max: 100 }, skills: { forestry: { level: forestry, xp: 0 } } };
}

// A standard Token's art radius is 64: two trees touch at 128 apart or less, and no two Tokens
// may stand closer than that, so the touching trees stand exactly edges touching.
const AT = { x: 800, y: 500 };
const TOUCHING = { x: AT.x + 128, y: AT.y };
const OTHER_SIDE = { x: AT.x - 128, y: AT.y };
const BIRCH = { x: AT.x, y: AT.y + 128 };
const IN_REACH = { x: AT.x, y: AT.y - 200 };
const BEYOND_TOUCHING = { x: TOUCHING.x + 128, y: AT.y };

const typeAt = (point) => BoardState.tokens().find(t => t.x === point.x && t.y === point.y)?.typeId;
const wood = () => InventoryManager.getItemCount('fixture_oak_wood') + SpriteLayer.countOnBoard('fixture_oak_wood');
const nests = () => InventoryManager.getItemCount(NEST) + SpriteLayer.countOnBoard(NEST);
const xpOf = (id) => GameState.state.heroes.find(h => h.id === id).skills.forestry.xp;

/** Work the tree at `AT` with `heroId` until it falls; every end roll under its chance once `fall` is set. */
function workUntilFall(heroId) {
    Orders.orderAt(heroId, AT);
    const worked = BoardState.tokens().find(t => t.x === AT.x && t.y === AT.y);
    // Every end roll misses until the hero is at work, then the next one fells it.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (let t = 0; t < 20_000 && !(worked.cycleElapsedMs > 0); t += 100) BoardRunner.tick(100);
    spy.mockReturnValue(0);
    for (let t = 0; t < 5_000 && !Respawn.isResting(worked); t += 100) BoardRunner.tick(100);
    expect(Respawn.isResting(worked)).toBe(true);
    return { worked, spy };
}

/**
 * The next tick, on the seeded stream again: the resting trees become their Stumps. (A `Math.random`
 * held at one value would hand every new Stump made in one millisecond the same id.)
 */
function becomeStumps() {
    vi.restoreAllMocks();
    BoardRunner.tick(100);
}

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => {
    registerSkillPerks({ forestry: { perks: [] } });
    Flags.teardown();
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
    registerSkillPerks({ forestry: { perks: [{ level: 99, effectId: 'gf_grove_feller' }] } });
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('master', 99), hero('novice', 10)];
    GameState.state.inventory.maxSlots = 50;
});

describe('the effect: Grove Felling, a chance on a skill the CMS offers', () => {
    it('is a chance narrowed to the work\'s skill, and the effect editor lists it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.GROVE_FELLING);
        expect(entry).toMatchObject({ shape: MODIFIER_SHAPES.PROC, categories: 'skill', scales: 'value' });
        expect(entry.explains).toMatch(/touching/i);
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(EFFECT_TYPES.GROVE_FELLING);
    });
});

describe('a falling tree fells the touching trees of its kind', () => {
    function grove() {
        placeAt('gf_oak', AT.x, AT.y);
        placeAt('gf_oak', TOUCHING.x, TOUCHING.y);
        placeAt('gf_oak', OTHER_SIDE.x, OTHER_SIDE.y);
        placeAt('gf_oak', IN_REACH.x, IN_REACH.y);
        placeAt('gf_birch', BIRCH.x, BIRCH.y);
        TileModifiers.rebuildAll();
    }

    it('the touching Oaks fall with it; one in reach but not touching, and a touching Birch, stand', () => {
        grove();
        workUntilFall('master');
        becomeStumps();
        expect(typeAt(AT)).toBe('gf_oak_stump');
        expect(typeAt(TOUCHING)).toBe('gf_oak_stump');
        expect(typeAt(OTHER_SIDE)).toBe('gf_oak_stump');
        expect(typeAt(IN_REACH)).toBe('gf_oak');
        expect(typeAt(BIRCH)).toBe('gf_birch');
    });

    it('each felled tree pays one cycle\'s output and XP: its logs, its rare find, its 3 XP', () => {
        grove();
        const before = { wood: wood(), nests: nests(), xp: xpOf('master') };
        workUntilFall('master');
        // Measured across the one cycle that fells: the worked tree's own cycle, and two felled.
        const cycles = 3;
        expect(wood() - before.wood).toBeGreaterThanOrEqual(2 * cycles);
        expect(nests() - before.nests).toBeGreaterThanOrEqual(cycles);
        expect(xpOf('master') - before.xp).toBeGreaterThanOrEqual(3 * cycles);
    });

    it('the felled trees pay exactly one cycle each, beyond what the worked tree made', () => {
        grove();
        Orders.orderAt('master', AT);
        const worked = BoardState.tokens().find(t => t.x === AT.x && t.y === AT.y);
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        for (let t = 0; t < 20_000 && !(worked.cycleElapsedMs > 0); t += 100) BoardRunner.tick(100);
        // Let the cycle under way finish on a miss, so the next cycle starts from nothing.
        for (let t = 0; t < 3_000 && worked.cycleElapsedMs > 0; t += 100) BoardRunner.tick(100);
        const before = { wood: wood(), nests: nests(), xp: xpOf('master') };
        Math.random.mockReturnValue(0);
        for (let t = 0; t < 5_000 && !Respawn.isResting(worked); t += 100) BoardRunner.tick(100);
        expect(wood() - before.wood).toBe(2 * 3);
        expect(nests() - before.nests).toBe(3);
        expect(xpOf('master') - before.xp).toBe(3 * 3);
    });

    it('an Echo of the felling cycle repeats the worked tree\'s cycle, never the felling', () => {
        grove();
        const shrine = placeAt('gf_echo_shrine', AT.x - 160, AT.y - 160);
        shrine.shrine = { litMs: 600_000 };
        TileModifiers.rebuildAll();
        Orders.orderAt('master', AT);
        const worked = BoardState.tokens().find(t => t.x === AT.x && t.y === AT.y);
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        for (let t = 0; t < 20_000 && !(worked.cycleElapsedMs > 0); t += 100) BoardRunner.tick(100);
        for (let t = 0; t < 3_000 && worked.cycleElapsedMs > 0; t += 100) BoardRunner.tick(100);
        const before = { wood: wood(), nests: nests(), xp: xpOf('master') };
        Math.random.mockReturnValue(0);
        for (let t = 0; t < 5_000 && !Respawn.isResting(worked); t += 100) BoardRunner.tick(100);
        // The worked tree's cycle twice (its own and the Echo), and each of the two felled once.
        expect(wood() - before.wood).toBe(2 * 2 + 2 * 2);
        expect(nests() - before.nests).toBe(2 + 2);
        expect(xpOf('master') - before.xp).toBe(3 * 2 + 3 * 2);
        becomeStumps();
        expect(typeAt(TOUCHING)).toBe('gf_oak_stump');
        expect(typeAt(OTHER_SIDE)).toBe('gf_oak_stump');
        expect(typeAt(IN_REACH)).toBe('gf_oak');
    });

    it('a Forest\'s own trees turn to its own Stumps', () => {
        const forest = placeAt('gf_forest', AT.x, AT.y + 400);
        const worked = placeAt('gf_oak', AT.x, AT.y);
        const neighbour = placeAt('gf_oak', TOUCHING.x, TOUCHING.y);
        BoardState.setTether(worked, forest.id);
        BoardState.setTether(neighbour, forest.id);
        TileModifiers.rebuildAll();
        workUntilFall('master');
        becomeStumps();
        const stumps = BoardState.tokens().filter(t => t.typeId === 'gf_oak_stump');
        expect(stumps).toHaveLength(2);
        for (const stump of stumps) expect(stump.tether).toBe(forest.id);
    });

    it('without it, only the worked tree falls', () => {
        grove();
        workUntilFall('novice');
        becomeStumps();
        expect(typeAt(AT)).toBe('gf_oak_stump');
        expect(typeAt(TOUCHING)).toBe('gf_oak');
        expect(typeAt(OTHER_SIDE)).toBe('gf_oak');
    });

    it('a felled tree fells nothing more: an Oak touching only the felled one stands', () => {
        placeAt('gf_oak', AT.x, AT.y);
        placeAt('gf_oak', TOUCHING.x, TOUCHING.y);
        placeAt('gf_oak', BEYOND_TOUCHING.x, BEYOND_TOUCHING.y);
        TileModifiers.rebuildAll();
        workUntilFall('master');
        becomeStumps();
        expect(typeAt(TOUCHING)).toBe('gf_oak_stump');
        expect(typeAt(BEYOND_TOUCHING)).toBe('gf_oak');
    });

    it('a touching tree already resting is not felled again and pays nothing', () => {
        placeAt('gf_oak', AT.x, AT.y);
        const resting = placeAt(BoardState.createTokenInstance('gf_oak', 0), TOUCHING.x, TOUCHING.y);
        TileModifiers.rebuildAll();
        expect(Respawn.isResting(resting)).toBe(true);
        Orders.orderAt('master', AT);
        const worked = BoardState.tokens().find(t => t.x === AT.x && t.y === AT.y);
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        for (let t = 0; t < 20_000 && !(worked.cycleElapsedMs > 0); t += 100) BoardRunner.tick(100);
        for (let t = 0; t < 3_000 && worked.cycleElapsedMs > 0; t += 100) BoardRunner.tick(100);
        const before = wood();
        Math.random.mockReturnValue(0);
        for (let t = 0; t < 5_000 && !Respawn.isResting(worked); t += 100) BoardRunner.tick(100);
        expect(wood() - before).toBe(2);
    });

    it('while no tree falls, holding it draws nothing more than holding none', () => {
        const draws = (heroId) => {
            clearMat();
            TileModifiers.clearAll();
            SpriteLayer.init();
            InventoryManager.init();
            GameState.state.heroes = [hero('master', 99), hero('novice', 10)];
            placeAt('gf_oak', AT.x, AT.y);
            placeAt('gf_oak', TOUCHING.x, TOUCHING.y);
            TileModifiers.rebuildAll();
            Orders.orderAt(heroId, AT);
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
            for (let t = 0; t < 10_000; t += 100) BoardRunner.tick(100);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return n;
        };
        expect(draws('master')).toBe(draws('novice'));
    });
});
