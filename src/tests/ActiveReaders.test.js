import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as Charges from '../systems/board/Charges.js';
import * as Managers from '../systems/board/Managers.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { tileCentre, idAt, pointAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **The active reach readers measure like the buffs do** (Free Playmat slice 1.3).
 *
 * Slice 1.2 made reach a centre-to-centre distance for buffs. This pins the
 * rest — crafting context, tool wear, Manager reach, neighbour triggers and
 * `Cannot` counts — to the same `nearby()` measurement:
 *
 * * 1×1 Tokens at 272 u: exactly today's 8-tile ring;
 * * 2×2 Tokens (FP-41): the 8 tiles touching their sides, not the 4 touching
 *   only a corner;
 * * a larger Near radius widens every one of them.
 *
 * 6×6 board, row-major. The 2×2 used throughout sits on anchor **7**, covering
 * 7, 8, 13, 14. Its side-touching tiles are 1, 2, 6, 9, 12, 15, 19, 20; its
 * corner-diagonal tiles are 0, 3, 18, 21.
 * ```
 *    0  1  2  3  4  5
 *    6  7  8  9 10 11
 *   12 13 14 15 16 17
 *   18 19 20 21 22 23
 *   24 25 26 27 28 29
 *   30 31 32 33 34 35
 * ```
 */

const BIG = 7;
const SIDE = 20;        // touches the 2×2's side: 253 u from its centre
const CORNER = 21;      // touches only its corner: 339 u — outside Near at 272 u

registerTokenTypes({
    /** The fixture tool, two tiles square. */
    fixture_large_tool: {
        id: 'fixture_large_tool', name: 'Fixture Large Tool', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 80, sprite: 'skill_industry', size: 2,
        isTool: true, requiresHero: false,
        provides: [{ tag: 'ctx_fixture_tool', minTier: 1, chargeCost: 0 }]
    },
    /** The tool-gated resource, two tiles square. */
    fixture_large_gated: {
        id: 'fixture_large_gated', name: 'Fixture Large Gated', tokenType: 'resource',
        rarity: 'uncommon', theme: 'fixture', uses: 2600, sprite: 'skill_nature', size: 2,
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 18000, xp: 12 },
        statements: [
            { id: 'stm_fixture_large_gated', keyword: KEYWORD.STATION, payload: { skill: 'fixture_gated_skill' } }
        ]
    },
    /** A Manager two tiles square, over the 1×1 producer and the 2×2 one. */
    fixture_large_manager: {
        id: 'fixture_large_manager', name: 'Fixture Large Manager', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social', size: 2,
        requiresHero: false,
        manages: ['fixture_producer', 'fixture_large_producer']
    },
    /** A 1×1 Manager over the 2×2 producer. */
    fixture_small_large_manager: {
        id: 'fixture_small_large_manager', name: 'Fixture Small Manager Of Large', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        manages: ['fixture_large_producer']
    },
    fixture_large_producer: {
        id: 'fixture_large_producer', name: 'Fixture Large Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_nature', size: 2,
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
        }
    },
    /** `fixture_trigger_any`, two tiles square. */
    fixture_large_trigger_any: {
        id: 'fixture_large_trigger_any', name: 'Fixture Large Trigger Any', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry', size: 2,
        requiresHero: false,
        statements: [{
            id: 'stm_large_trigger_any', keyword: 'grants',
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 100, quantity: 1 }
        }]
    },
    /** A plain Coast two tiles square — counted, carries no rule. */
    fixture_large_coast: {
        id: 'fixture_large_coast', name: 'Fixture Large Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature', size: 2,
        requiresHero: false, tags: ['Coast']
    },
    /** A +5% YIELD buff that reaches the whole board. */
    fixture_board_buff: {
        id: 'fixture_board_buff', name: 'Fixture Board Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [{
            id: 'stm_board_buff', keyword: 'provides', reach: 'board', to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        }]
    }
});

/** Put a Token straight onto the board — no cascade, no events. */
function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    BoardState.setToken(tile, instance);
    return instance;
}

function clearBoard() {
    for (const [index] of BoardState.occupiedTiles()) BoardState.setToken(index, null);
}

/** Resolve the station's selected recipe and say whether its context is met. */
const statusOf = (tile) => RecipeResolver.resolveRecipe(idAt(tile), BoardState.getToken(tile)).status;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearBoard();
    TileModifiers.clearAll();
    resetMatTuning();
    // ⚠️ These cases are laid out on the 8-tile ring (272 u), not the shipped
    // default: Near has started at 164 u since FP-75, which reaches no diagonal
    // and lets a 2×2 reach nothing. The shipped default is pinned in Nearby.test.js.
    setMatTuning('nearRadius', 272);
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    resetMatTuning();
});

// ---------------------------------------------------------------------------
// RecipeResolver — "a tool beside a station" is "a tool near it"
// ---------------------------------------------------------------------------

describe('RecipeResolver: a tool near a station', () => {
    it('1×1 at 272 u: a diagonal tool serves, one two steps away does not (today\'s ring)', () => {
        put(14, 'fixture_tool_gated');
        put(21, 'fixture_tool');                       // diagonal, 226 u
        expect(statusOf(14)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.contextTiersAround(idAt(14))).toEqual({ ctx_fixture_tool: 1 });

        BoardState.setToken(21, null);
        put(16, 'fixture_tool');                       // 320 u
        expect(statusOf(14)).toBe(RecipeResolver.RECIPE.NONE);
    });

    it('⭐ a 2×2 tool serves a side-touching station but not a corner-diagonal one (FP-41)', () => {
        put(BIG, 'fixture_large_tool');
        put(SIDE, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool_gated');

        expect(statusOf(SIDE)).toBe(RecipeResolver.RECIPE.OK);
        expect(statusOf(CORNER)).toBe(RecipeResolver.RECIPE.NONE);
        expect(RecipeResolver.contextTiersAround(idAt(CORNER))).toEqual({});
        expect(RecipeResolver.getMissingRequirements(idAt(CORNER), BoardState.getToken(CORNER)).type).toBe('tokens');
        expect(RecipeResolver.servesFrom(idAt(BIG))).toEqual([idAt(SIDE)]);
    });

    it('⭐ a 2×2 station is served from its side, not its corner (FP-41)', () => {
        put(BIG, 'fixture_large_gated');
        put(CORNER, 'fixture_tool');
        expect(statusOf(BIG)).toBe(RecipeResolver.RECIPE.NONE);

        BoardState.setToken(CORNER, null);
        put(SIDE, 'fixture_tool');
        expect(statusOf(BIG)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.servesFrom(idAt(SIDE))).toEqual([idAt(BIG)]);
    });

    it('accepted tools (Requires) measure the same way', () => {
        const vein = { acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }] };
        put(14, 'fixture_copper_vein');
        put(16, 'fixture_pickaxe_t1');                  // 320 u
        expect(RecipeResolver.checkAcceptedTokens(idAt(14), vein)).toBe(false);

        put(21, 'fixture_pickaxe_t1');                  // diagonal
        expect(RecipeResolver.checkAcceptedTokens(idAt(14), vein)).toBe(true);
    });

    it('a larger radius widens it: at 400 u a tool two steps away serves', () => {
        put(14, 'fixture_tool_gated');
        put(16, 'fixture_tool');                       // 320 u
        expect(statusOf(14)).toBe(RecipeResolver.RECIPE.NONE);

        setMatTuning('nearRadius', 400);
        expect(statusOf(14)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.servesFrom(idAt(16))).toEqual([idAt(14)]);

        put(BIG, 'fixture_large_tool');
        put(CORNER, 'fixture_tool_gated');              // 339 u from the 2×2 centre
        expect(RecipeResolver.servesFrom(idAt(BIG))).toContain(idAt(CORNER));
    });
});

// ---------------------------------------------------------------------------
// Charges — wear per station served, and who pays a recipe's context cost
// ---------------------------------------------------------------------------

describe('Charges: a tool wears once per station it serves, per cycle (D-113/D-157)', () => {
    it('1×1 at 272 u: −1 per station served; a station out of reach does not wear it', () => {
        const tool = put(14, 'fixture_tool');
        put(13, 'fixture_tool_gated');
        put(15, 'fixture_tool_gated');
        put(16, 'fixture_tool_gated');                  // 320 u from the tool

        RecipeResolver.wearAdjacentSupport(idAt(13));
        RecipeResolver.wearAdjacentSupport(idAt(15));
        expect(tool.usesRemaining).toBe(78);            // two stations served, one cycle each

        RecipeResolver.wearAdjacentSupport(idAt(16));
        expect(tool.usesRemaining).toBe(78);
    });

    it('a null-charge tool never wears', () => {
        const tool = put(14, 'fixture_tool', null);
        put(13, 'fixture_tool_gated');
        RecipeResolver.wearAdjacentSupport(idAt(13));
        expect(tool.usesRemaining).toBeNull();
    });

    it('⭐ a 2×2 tool wears for a side-touching station and not for a corner-diagonal one (FP-41)', () => {
        const tool = put(BIG, 'fixture_large_tool');
        put(SIDE, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool_gated');

        RecipeResolver.wearAdjacentSupport(idAt(SIDE));
        RecipeResolver.wearAdjacentSupport(idAt(CORNER));
        expect(tool.usesRemaining).toBe(79);
    });

    it('⭐ context providers are the Tokens within Near, a 2×2 named once (FP-41)', () => {
        put(BIG, 'fixture_large_tool');
        put(SIDE, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool_gated');

        expect(Charges.contextProvidersAround(idAt(SIDE)).map(p => p.id)).toEqual([idAt(BIG)]);
        expect(Charges.contextProvidersAround(idAt(CORNER))).toEqual([]);
    });

    it('a larger radius widens it: at 400 u the far station wears the tool too', () => {
        const tool = put(14, 'fixture_tool');
        put(16, 'fixture_tool_gated');
        setMatTuning('nearRadius', 400);

        RecipeResolver.wearAdjacentSupport(idAt(16));
        expect(tool.usesRemaining).toBe(79);
        expect(Charges.contextProvidersAround(idAt(16)).map(p => p.id)).toEqual([idAt(14)]);
    });
});

// ---------------------------------------------------------------------------
// Managers — Near reach from the spot; nearest, then the earlier-placed Manager
// ---------------------------------------------------------------------------

describe('Managers: reach is Near, measured from the spot that is owed', () => {
    /** The spot a `typeId` Token anchored at `tile` stood on (test layout). */
    const spot = (tile, typeId = 'fixture_producer') => pointAt(tile, typeId);

    it('1×1 at 272 u: a diagonal Manager covers the vacancy, one two steps away does not', () => {
        put(16, 'fixture_manager');                     // diagonal to 9
        expect(Managers.managerFor(spot(9), 'fixture_producer')).toEqual([idAt(16), 'fixture_manager']);

        BoardState.setToken(16, null);
        put(21, 'fixture_manager');                     // 320 u below 9
        expect(Managers.managerFor(spot(9), 'fixture_producer')).toBeNull();
    });

    it('⭐ tie-break: the nearest Manager first, then the earlier-placed one (slice 1.6b; was the lower anchor)', () => {
        const diagonal = put(8, 'fixture_manager');     // diagonal to 15: 226 u
        const right = put(16, 'fixture_manager');       // beside 15: 160 u, placed first
        const left = put(14, 'fixture_manager');        // beside 15: 160 u, placed second
        expect(Managers.managerFor(spot(15), 'fixture_producer')[0]).toBe(right.id);

        BoardState.removeToken(right.id);
        expect(Managers.managerFor(spot(15), 'fixture_producer')[0]).toBe(left.id);

        BoardState.removeToken(left.id);
        expect(Managers.managerFor(spot(15), 'fixture_producer')[0]).toBe(diagonal.id);   // nearer beats earlier
    });

    it('⭐ a 2×2 Manager covers its side-touching tiles and not its corner-diagonal ones (FP-41)', () => {
        const big = put(BIG, 'fixture_large_manager');
        expect(Managers.managerFor(spot(SIDE), 'fixture_producer')).toEqual([big.id, 'fixture_large_manager']);
        expect(Managers.managerFor(spot(15), 'fixture_producer')?.[0]).toBe(big.id);
        expect(Managers.managerFor(spot(CORNER), 'fixture_producer')).toBeNull();
        expect(Managers.managerFor(spot(0), 'fixture_producer')).toBeNull();   // in the anchor's old ring
    });

    it('⭐ a vacated 2×2 spot is measured from its own centre, not its anchor tile', () => {
        const side = put(SIDE, 'fixture_small_large_manager');   // 253 u from the 2×2 centre
        expect(Managers.managerFor(spot(BIG, 'fixture_large_producer'), 'fixture_large_producer')?.[0]).toBe(side.id);

        BoardState.setToken(SIDE, null);
        put(CORNER, 'fixture_small_large_manager');     // 339 u
        expect(Managers.managerFor(spot(BIG, 'fixture_large_producer'), 'fixture_large_producer')).toBeNull();
    });

    it('restocks in the exact spot the vacancy names (FP-19)', () => {
        put(BIG, 'fixture_large_manager');
        const at = spot(SIDE);
        BoardState.setVacancyAt(at, 'fixture_producer');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));

        expect(Managers.restockSpot(BoardState.spotIdAt(at.x, at.y))).toBe('restocked');
        expect(BoardState.getToken(SIDE)?.typeId).toBe('fixture_producer');
        expect(BoardState.tokensAtPoint(at.x, at.y).map(t => t.typeId)).toEqual(['fixture_producer']);
    });

    it('a larger radius widens it: at 400 u the Manager two steps away covers the vacancy', () => {
        const far = put(21, 'fixture_manager');
        setMatTuning('nearRadius', 400);
        expect(Managers.managerFor(spot(9), 'fixture_producer')?.[0]).toBe(far.id);
    });
});

// ---------------------------------------------------------------------------
// TriggerSystem — the "On Neighbour's …" triggers listen within Near
// ---------------------------------------------------------------------------

describe('TriggerSystem: neighbour triggers listen within Near', () => {
    beforeEach(() => TriggerSystem.init());
    afterEach(() => TriggerSystem.teardown());

    const cycleAt = (tile, typeId) =>
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { tile, typeId, heroId: null, failed: false, produced: [] });
    const bones = () => SpriteLayer.countOnBoard('item_bones');

    it('1×1 at 272 u: a diagonal neighbour hears it, one two steps away does not', () => {
        put(15, 'fixture_producer');
        put(22, 'fixture_trigger_any');                 // diagonal
        cycleAt(15, 'fixture_producer');
        expect(bones()).toBe(1);

        BoardState.setToken(22, null);
        put(17, 'fixture_trigger_any');                 // 320 u
        cycleAt(15, 'fixture_producer');
        expect(bones()).toBe(1);
    });

    it('⭐ a 2×2 source is heard from a side tile outside its anchor\'s old ring (FP-41)', () => {
        put(BIG, 'fixture_large_producer');
        put(SIDE, 'fixture_trigger_any');               // side-touching; not in tile 7's 8-ring
        cycleAt(BIG, 'fixture_large_producer');
        expect(bones()).toBe(1);
    });

    it('⭐ a 2×2 source is NOT heard from its corner diagonals, even one in its anchor\'s old ring (FP-41)', () => {
        put(BIG, 'fixture_large_producer');
        put(0, 'fixture_trigger_any');                  // in tile 7's 8-ring, but a corner diagonal
        put(CORNER, 'fixture_trigger_any');
        cycleAt(BIG, 'fixture_large_producer');
        expect(bones()).toBe(0);
    });

    it('⭐ a 2×2 listener hears a side-touching source', () => {
        put(BIG, 'fixture_large_trigger_any');
        put(SIDE, 'fixture_producer');
        cycleAt(SIDE, 'fixture_producer');
        expect(bones()).toBe(1);

        clearBoard();
        put(BIG, 'fixture_large_trigger_any');
        put(CORNER, 'fixture_producer');
        cycleAt(CORNER, 'fixture_producer');
        expect(bones()).toBe(1);                        // unchanged
    });

    it('⭐ a departed 2×2 is still heard from where it stood (TOKEN_DEPLETED)', () => {
        put(SIDE, 'fixture_trigger_depleted');
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: BIG, typeId: 'fixture_large_producer' });
        expect(bones()).toBe(1);
    });

    it('a larger radius widens it: at 400 u a listener two steps away hears it', () => {
        put(15, 'fixture_producer');
        put(17, 'fixture_trigger_any');
        setMatTuning('nearRadius', 400);
        cycleAt(15, 'fixture_producer');
        expect(bones()).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Restrictions — `Cannot` is a count within Near, on the board as it WOULD be
// ---------------------------------------------------------------------------

describe('Restrictions: "Cannot be adjacent to more than 2 Coast" counts within Near', () => {
    /** The restricted Coast on 21, exactly at its limit: plain Coasts on 20 and 22. */
    const atLimit = () => {
        put(21, 'fixture_coast');
        put(20, 'fixture_plain_coast');
        put(22, 'fixture_plain_coast');
    };

    it('1×1 at 272 u, hypothetical drop: diagonal is refused, two steps away is not — nothing moves', () => {
        atLimit();
        const before = BoardState.occupiedTiles().map(([t]) => t);

        const at = (tile) => pointAt(tile, 'fixture_plain_coast');
        expect(Restrictions.checkPlacement(at(15), 'fixture_plain_coast').ok).toBe(false);   // diagonal
        expect(Restrictions.checkPlacement(at(27), 'fixture_plain_coast').ok).toBe(false);   // below
        expect(Restrictions.checkPlacement(at(17), 'fixture_plain_coast').ok).toBe(true);    // 358 u
        expect(Restrictions.checkPlacement(at(9), 'fixture_plain_coast').ok).toBe(true);     // 320 u

        expect(BoardState.occupiedTiles().map(([t]) => t)).toEqual(before);
    });

    it('a displaced Token does not count (remove)', () => {
        atLimit();
        expect(Restrictions.checkPlacement(pointAt(15, 'fixture_plain_coast'), 'fixture_plain_coast', { remove: [idAt(20)] }).ok).toBe(true);
    });

    it('1×1 at 272 u, a moved Token: a Coast moved into reach is refused; moved short of it is not', () => {
        atLimit();
        const shoved = put(3, 'fixture_plain_coast');   // far from 21
        const drop = pointAt(0, 'fixture_large_tool');

        const into = Restrictions.checkPlacement(drop, 'fixture_large_tool', { move: [{ id: shoved.id, ...tileCentre(15) }] });
        expect(into.ok).toBe(false);
        expect(into.reason).toContain('Fixture Coast');

        expect(Restrictions.checkPlacement(drop, 'fixture_large_tool', { move: [{ id: shoved.id, ...tileCentre(9) }] }).ok).toBe(true);
    });

    it('⭐ a 2×2 Coast counts from its side, not from its corner (FP-41)', () => {
        atLimit();

        // Anchor 7 covers 14, which only touches 21 at a corner: 339 u, not near.
        expect(Restrictions.checkPlacement(pointAt(BIG, 'fixture_large_coast'), 'fixture_large_coast').ok).toBe(true);
        // Anchor 8 covers 15, which touches 21's side: 253 u, near — a third Coast.
        const side = Restrictions.checkPlacement(pointAt(8, 'fixture_large_coast'), 'fixture_large_coast');
        expect(side.ok).toBe(false);
        expect(side.violatingTypeId).toBe('fixture_coast');
    });

    it('⭐ through Placement: the corner 2×2 lands, the side one is refused and moves nothing', () => {
        atLimit();
        const big = BoardState.createTokenInstance('fixture_large_coast', 500);
        expect(Placement.placeToken(8, big).success).toBe(false);
        expect(BoardState.getToken(8)).toBeFalsy();

        expect(Placement.placeToken(BIG, big).success).toBe(true);
        expect(Restrictions.violations()).toEqual([]);
    });

    it('⭐ the restricted Coast as a 2×2 neighbour counts once, by its centre', () => {
        put(21, 'fixture_coast');
        put(BIG, 'fixture_large_coast');                // corner — not counted
        put(22, 'fixture_plain_coast');
        put(27, 'fixture_plain_coast');
        expect(Restrictions.violations()).toEqual([]); // 2 within Near, the 2×2 is not one of them
    });

    it('a larger radius widens it: at 400 u a Coast two steps away counts, on a drop and on a shift', () => {
        atLimit();
        const shoved = put(3, 'fixture_plain_coast');
        setMatTuning('nearRadius', 400);

        expect(Restrictions.checkPlacement(pointAt(17, 'fixture_plain_coast'), 'fixture_plain_coast').ok).toBe(false);   // 358 u
        expect(Restrictions.checkPlacement(pointAt(0, 'fixture_large_tool'), 'fixture_large_tool', { move: [{ id: shoved.id, ...tileCentre(9) }] }).ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Rebuild coverage — one dirty event per placement, and board reach refreshes
// ---------------------------------------------------------------------------

describe('Placement publishes one dirty event per change, covering the Near radius', () => {
    const yieldAt = (tile) => TileModifiers.resolveAxis(idAt(tile), EFFECT_TYPES.YIELD, 100);

    beforeAll(() => {
        // The engine's own listener. Its subscription is not idempotent, so it
        // is added once for this file; the rebuilds it causes are harmless.
        BoardRunner.init();
    });

    it('one ADJACENCY_DIRTY per drop, naming the point it changed', () => {
        const events = [];
        const off = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => events.push(p));
        try {
            Placement.placeToken(14, BoardState.createTokenInstance('fixture_producer', 5000));
        } finally {
            off();
        }
        expect(events).toHaveLength(1);
        expect(events[0].points).toEqual([tileCentre(14)]);
    });

    it('at 400 u a dropped buff reaches a Token two steps away, and lifting it clears it', () => {
        setMatTuning('nearRadius', 400);
        put(12, 'fixture_producer');
        TileModifiers.rebuildAll();

        Placement.placeToken(14, BoardState.createTokenInstance('fixture_buff_yield', 800));
        expect(yieldAt(12)).toBeCloseTo(105);

        Placement.returnTokenToTray(14);
        expect(yieldAt(12)).toBeCloseTo(100);
    });

    it('a 2×2 moved away clears its buff from tiles its new position does not reach', () => {
        registerTokenTypes({
            fixture_large_yield: {
                id: 'fixture_large_yield', name: 'Fixture Large Yield', tokenType: 'buff',
                rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature', size: 2,
                requiresHero: false,
                statements: [{
                    id: 'stm_large_yield', keyword: 'provides', to: { mode: 'all' },
                    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
                }]
            }
        });
        put(1, 'fixture_producer');                     // side-touching the 2×2 on 7
        put(BIG, 'fixture_large_yield');
        TileModifiers.rebuildAll();
        expect(yieldAt(1)).toBeCloseTo(105);

        expect(Placement.moveToken(BIG, 22).success).toBe(true);
        expect(yieldAt(1)).toBeCloseTo(100);
    });
});

describe('⭐ a board-reach rule refreshes distant tiles (pre-existing bug)', () => {
    const yieldAt = (tile) => TileModifiers.resolveAxis(idAt(tile), EFFECT_TYPES.YIELD, 100);

    it('arriving: a Token across the board gains the buff from one local rebuild', () => {
        put(35, 'fixture_producer');
        TileModifiers.rebuildAll();
        expect(yieldAt(35)).toBeCloseTo(100);

        put(0, 'fixture_board_buff');
        TileModifiers.rebuildAround([tileCentre(0)]);                 // 35 is nowhere near 0
        expect(yieldAt(35)).toBeCloseTo(105);
    });

    it('leaving: the distant Token loses it again', () => {
        put(35, 'fixture_producer');
        put(0, 'fixture_board_buff');
        TileModifiers.rebuildAll();
        expect(yieldAt(35)).toBeCloseTo(105);

        BoardState.setToken(0, null);
        TileModifiers.rebuildAround([tileCentre(0)]);
        expect(yieldAt(35)).toBeCloseTo(100);
    });

    it('changing: replaced by a Token with no board rule, the distant buff goes', () => {
        put(35, 'fixture_producer');
        put(0, 'fixture_board_buff');
        TileModifiers.rebuildAll();

        BoardState.setToken(0, null);
        put(0, 'fixture_producer');
        TileModifiers.rebuildAround([tileCentre(0)]);
        expect(yieldAt(35)).toBeCloseTo(100);
    });

    it('through Placement and the engine\'s listener', () => {
        put(35, 'fixture_producer');
        TileModifiers.rebuildAll();

        Placement.placeToken(0, BoardState.createTokenInstance('fixture_board_buff', null));
        expect(yieldAt(35)).toBeCloseTo(105);

        Placement.returnTokenToTray(0);
        expect(yieldAt(35)).toBeCloseTo(100);
    });
});
