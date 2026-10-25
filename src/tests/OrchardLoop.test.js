import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as Charges from '../systems/board/Charges.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { respawnOf } from '../config/registries/tokenConstants.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { flagStatusLine } from '../ui/components/board/flagText.js';
import { cardLifecycle, liveCardSources } from '../ui/components/board/tokenCard.js';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';
import { problemText } from '../ui/components/board/problemMark.js';
import { getTokenType, tokenName } from '../config/registries/tokenRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Orchards (brief 230 S2b): a fruit tree is picked, not felled. Fruiting → picked empty → Bare
 * (it rests, drawn as its Bare picture) → Fruiting again, all at once. The refill runs only with an
 * Orchard of its fruit in reach (`respawn.needsNearby`): a Bare tree with none stays Bare, its clock
 * standing still, and says what it needs; an Orchard put in reach starts it again from where it
 * stood. The Orchard's Grow Time shortens the rest (floored). The picker waits silently on a Bare
 * tree that is coming back, and idles beside one that is not.
 */

const APPLE = 'item_apple';
const SEED = 'item_apple_seed';
const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const picking = { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
    outputs: [{ itemId: APPLE, chance: 100, minQty: 1, maxQty: 1 }] };
registerTokenTypes({
    or_orchard: plain('or_orchard', 'Test Apple Orchard', {
        tokenType: 'buff',
        statements: [{ id: 'stm_or_orchard', keyword: 'provides', to: { mode: 'id', value: 'or_tree' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 } }]
    }),
    or_tree: plain('or_tree', 'Test Apple Tree', {
        uses: 2, requiresHero: true, staysPut: true, config: picking,
        respawn: { mode: 'refill', afterMs: 20000, restingSprite: 't_tree_bare_apple', needsNearby: ['or_orchard'] }
    }),
    // An Orchard that plants Saplings within its reach for a seed each, and speeds its trees.
    or_planting_orchard: plain('or_planting_orchard', 'Test Planting Orchard', {
        tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'or_sapling', weight: 1 }], allowance: 2, intervalMs: 5000,
            upkeep: [{ itemId: SEED, quantity: 1 }], withinReach: true },
        statements: [{ id: 'stm_or_planting', keyword: 'provides', to: { mode: 'id', value: 'or_planted_tree' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 } }]
    }),
    or_sapling: plain('or_sapling', 'Test Apple Sapling', { artSize: 'small', grows: { into: 'or_planted_tree', afterMs: 6000 } }),
    or_planted_tree: plain('or_planted_tree', 'Test Planted Apple', {
        uses: 2, requiresHero: true, staysPut: true, config: picking,
        respawn: { mode: 'refill', afterMs: 20000, needsNearby: ['or_planting_orchard'] }
    }),
    // Today's shape: a refill with no Orchard named comes back wherever it stands.
    or_free_tree: plain('or_free_tree', 'Test Wild Apple', {
        uses: 2, requiresHero: true, config: picking, respawn: { mode: 'refill', afterMs: 20000 }
    })
});

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, x, y, uses = tokenStartingUses(typeId)) {
    const instance = BoardState.createTokenInstance(typeId, uses);
    const res = Placement.placeTokenAt(instance, { x, y });
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const TREE = { x: 800, y: 500 };

beforeAll(() => { Flags.init(); Growth.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 240);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    GameState.state.heroes = [hero('picker', { farming: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

/** An apple tree (with or without its Orchard in reach), a picker flagged on it, run until it is Bare. */
function pickedBare({ orchard = true, type = 'or_tree' } = {}) {
    if (orchard) put('or_orchard', TREE.x + 150, TREE.y);
    const tree = put(type, TREE.x, TREE.y);
    TileModifiers.rebuildAll();
    Flags.plant('picker', { x: TREE.x, y: TREE.y });
    run(2600);
    expect(BoardState.getTokenById(tree.id)).toBeTruthy();
    expect(Respawn.isResting(tree)).toBe(true);
    return tree;
}

describe('the refill block names what it needs in reach', () => {
    it('reads `needsNearby` on a refill, the same list each time; a regrow and a plain refill need nothing', () => {
        const def = { respawn: { mode: 'refill', afterMs: 5000, needsNearby: [' or_orchard ', 'or_orchard', '', 7] } };
        const first = respawnOf(def);
        expect(first.needsNearby).toEqual(['or_orchard']);
        expect(respawnOf(def).needsNearby).toBe(first.needsNearby);
        expect(respawnOf({ respawn: { mode: 'refill', afterMs: 5000 } }).needsNearby).toEqual([]);
        expect(respawnOf({ respawn: { mode: 'regrow', into: 'x', needsNearby: ['or_orchard'] } }).needsNearby).toEqual([]);
    });
});

describe('⭐ picked, not felled: Fruiting → Bare → Fruiting with its Orchard in reach', () => {
    it('stays where it stands, Bare (its resting picture), and fruits again all at once, sped by the Orchard', () => {
        const tree = pickedBare();
        expect(FixedTokens.isFixed(tree)).toBe(true);
        expect(Respawn.restingSpriteOf(tree)).toBe('t_tree_bare_apple');
        // The Orchard's −50 % Grow Time: a 20 s rest takes 10 s.
        expect(Respawn.nextRespawn(tree)).toMatchObject({ mode: 'refill', totalMs: 10000, paused: false });
        run(10000);
        expect(tree.usesRemaining).toBe(2);
        expect(Respawn.isResting(tree)).toBe(false);
        expect(Respawn.restingSpriteOf(tree)).toBeNull();
        expect(InventoryManager.getItemCount(APPLE) + SpriteLayer.countOnBoard(APPLE)).toBeGreaterThanOrEqual(2);
    });

    it('the picker waits silently on the Bare tree, then picks it again', () => {
        const tree = pickedBare();
        run(200);
        expect(Flags.waitingOf('picker')).toEqual({ instanceId: tree.id, kind: 'node' });
        expect(flagStatusLine('picker')).toBe('Waiting for Test Apple Tree');
        expect(BoardRunner.isHeroIdle('picker')).toBe(false);
        run(10000);
        run(300);
        expect(Flags.statusOf('picker')).toMatchObject({ state: 'working', typeId: 'or_tree' });
    });
});

describe('⭐ a Bare tree with no Orchard in reach stays Bare', () => {
    it('its clock stands still and it says it needs an Orchard nearby; the picker idles beside it', () => {
        const tree = pickedBare({ orchard: false });
        run(60000);
        expect(Respawn.isResting(tree)).toBe(true);
        expect(Number(tree.clocks?.[Respawn.CLOCK]) || 0).toBe(0);
        expect(Respawn.nextRespawn(tree)).toMatchObject({ paused: true, needsNearby: ['or_orchard'], inMs: 20000 });
        expect(Respawn.respawnState(tree)).toMatchObject({ resting: true, paused: true, needsNearby: ['or_orchard'] });
        expect(Growth.growthAlertOf(tree.id)).toEqual({ alert: ALERT.GROW_NEEDS_NEARBY, needs: ['or_orchard'] });
        expect(Flags.waitingOf('picker')).toBeNull();
        expect(BoardRunner.isHeroIdle('picker')).toBe(true);
    });

    it('an Orchard put in reach starts it again (Grow Time from the start), and the alert drops', () => {
        const tree = pickedBare({ orchard: false });
        run(5000);
        put('or_orchard', TREE.x + 150, TREE.y);
        run(100);
        expect(Growth.growthAlertOf(tree.id)).toBeNull();
        expect(Respawn.nextRespawn(tree)).toMatchObject({ paused: false, totalMs: 10000 });
        expect(Flags.waitingOf('picker')).toEqual({ instanceId: tree.id, kind: 'node' });
        run(10000);
        expect(Respawn.isResting(tree)).toBe(false);
        expect(tree.usesRemaining).toBe(2);
    });

    it('given a charge back while it waits (a copy dropped on it), it is no longer Bare and its mark goes', () => {
        const tree = pickedBare({ orchard: false });
        run(200);
        expect(Growth.growthAlertOf(tree.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);
        Charges.applyDelta(tree, 1);
        expect(Respawn.isResting(tree)).toBe(false);
        expect(Growth.growthAlertOf(tree.id)).toBeNull();
    });

    it('an Orchard out of reach does not count', () => {
        put('or_orchard', TREE.x + 400, TREE.y);
        const tree = pickedBare({ orchard: false });
        run(30000);
        expect(Respawn.isResting(tree)).toBe(true);
        expect(Number(tree.clocks?.[Respawn.CLOCK]) || 0).toBe(0);
        expect(Growth.growthAlertOf(tree.id)?.alert).toBe(ALERT.GROW_NEEDS_NEARBY);
    });

    it('its Orchard demolished mid-rest: the clock stands where it was', () => {
        const orchard = put('or_orchard', TREE.x + 150, TREE.y);
        const tree = pickedBare({ orchard: false });
        run(4000);
        const stood = Number(tree.clocks[Respawn.CLOCK]);
        expect(stood).toBeGreaterThan(0);
        BoardState.removeToken(orchard.id);
        TileModifiers.rebuildAll();
        run(30000);
        expect(Number(tree.clocks[Respawn.CLOCK])).toBe(stood);
        expect(Respawn.isResting(tree)).toBe(true);
    });
});

describe('a refill that names no Orchard is unchanged', () => {
    it('refills wherever it stands, the picker waiting on it', () => {
        const tree = pickedBare({ orchard: false, type: 'or_free_tree' });
        expect(Respawn.nextRespawn(tree)).toMatchObject({ paused: false, needsNearby: [] });
        expect(Flags.waitingOf('picker')).toEqual({ instanceId: tree.id, kind: 'node' });
        run(20000);
        expect(Respawn.isResting(tree)).toBe(false);
        expect(Growth.growthAlertOf(tree.id)).toBeNull();
    });
});

describe('an Orchard plants its fruit trees within its reach, as a Forest does (S2a)', () => {
    const ORCHARD = { x: 800, y: 500 };
    const family = () => BoardState.tokens().filter(t => t.typeId === 'or_sapling' || t.typeId === 'or_planted_tree');

    it('plants Saplings within reach up to its allowance, a seed each; they grow into fixed, fruiting trees it speeds', () => {
        InventoryManager.addItem(SEED, 5);
        put('or_planting_orchard', ORCHARD.x, ORCHARD.y);
        run(30000);
        const trees = family();
        expect(trees.map(t => t.typeId)).toEqual(['or_planted_tree', 'or_planted_tree']);
        expect(InventoryManager.getItemCount(SEED)).toBe(3);
        for (const t of trees) {
            expect(Math.hypot(t.x - ORCHARD.x, t.y - ORCHARD.y)).toBeLessThanOrEqual(164);
            expect(FixedTokens.isFixed(t)).toBe(true);
            expect(Respawn.restMsOf(t)).toBe(10000);
        }
    });

    it('a Bare tree still counts toward the allowance: picking does not make room for another', () => {
        InventoryManager.addItem(SEED, 5);
        put('or_planting_orchard', ORCHARD.x, ORCHARD.y);
        run(30000);
        const [tree] = family();
        tree.usesRemaining = 0;
        Respawn.restInstead(tree);
        run(20000);
        expect(family()).toHaveLength(2);
        expect(InventoryManager.getItemCount(SEED)).toBe(3);
    });
});

describe('an Apple Tree from an old save, once the content pack makes it a fruit tree', () => {
    // The shipped Apple Tree as it is today (3 charges, picked by Farming, leaves when used up),
    // given the S8 shape under its own id: so a saved instance (charges left, no clocks) loads as is.
    const shipped = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/tokens.json'), 'utf8'));
    const list = Array.isArray(shipped) ? shipped : Object.values(shipped.tokens || shipped);
    const today = list.find(t => t.id === 'token_apple_tree');

    it('is today a Token that leaves when used up (no respawn yet)', () => {
        expect(today).toBeTruthy();
        expect(today.respawn).toBeUndefined();
    });

    it('a saved one with charges left is picked on, rests Bare, and waits for an Orchard; one put in reach brings it back', () => {
        registerTokenTypes({
            token_apple_tree: { ...today, staysPut: true,
                respawn: { mode: 'refill', afterMs: 20000, restingSprite: 't_tree_bare_apple', needsNearby: ['or_orchard'] } }
        });
        const saved = JSON.parse(JSON.stringify(BoardState.createTokenInstance('token_apple_tree', 1)));
        delete saved.clocks;
        const res = Placement.placeTokenAt(saved, TREE);
        expect(res?.success).not.toBe(false);
        const tree = BoardState.getTokenById(saved.id);
        expect(FixedTokens.isFixed(tree)).toBe(true);
        Flags.plant('picker', TREE);
        run(5000);
        expect(BoardState.getTokenById(saved.id)).toBe(tree);
        expect(Respawn.isResting(tree)).toBe(true);
        expect(Respawn.nextRespawn(tree)).toMatchObject({ paused: true });
        put('or_orchard', TREE.x + 150, TREE.y);
        run(20100);
        expect(tree.usesRemaining).toBe(today.uses);
    });
});

describe('what a Bare tree says', () => {
    const linesOf = (t) => lifecycleLines(t, { typeOf: getTokenType, tokenName, respawn: Respawn.respawnState });
    const cardLine = (t) => cardLifecycle(t, getTokenType(t.typeId), liveCardSources()).find(l => l.icon === 'regrow');

    it('with no Orchard in reach: no time, it waits for one, and its mark says it needs one to refill', () => {
        const tree = pickedBare({ orchard: false });
        expect(cardLine(tree)).toMatchObject({ text: '–', tip: 'Test Apple Tree: resting, refills only with Test Apple Orchard nearby', tone: 'warning' });
        expect(linesOf(tree)).toEqual(expect.arrayContaining([
            { label: 'Resting', value: 'waiting for a Test Apple Orchard nearby', tone: 'warning' },
            { label: 'Needs nearby to refill', value: 'a Test Apple Orchard', tone: 'muted' }
        ]));
        expect(problemText({ kind: ALERT.GROW_NEEDS_NEARBY, needs: ['or_orchard'] }, tree.id)).toBe('Needs a Test Apple Orchard nearby to refill');
    });

    it('with one: its countdown, named, as a resting vein says it', () => {
        const tree = pickedBare();
        expect(cardLine(tree)).toMatchObject({ text: '0:10', tip: 'Test Apple Tree: resting, refills in 0:10' });
        expect(linesOf(tree).find(l => l.label === 'Resting')).toEqual({ label: 'Resting', value: 'Test Apple Tree: resting, refills in 10 s' });
    });
});
