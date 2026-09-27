import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as Charges from '../systems/board/Charges.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

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
 * rest — crafting context, tool wear, neighbour triggers and
 * `Cannot` counts — to the same `nearby()` measurement:
 *
 * * 1×1 Tokens at 272 u: exactly the old 8-tile ring;
 * * 2×2 Tokens (FP-41): the neighbours touching their sides, not those touching
 *   only a corner;
 * * a larger Near radius widens every one of them.
 *
 * ## ⭐ The scene is a lattice of points, not a grid (Free Playmat slice 1.6d-2)
 * There are no tiles left to lay this out on, so the spots below are explicit
 * mat points 160 u apart — the step the old board had. **Every distance these
 * tests turn on is unchanged**, which is the whole reason for keeping the
 * spacing: a side neighbour is 160 u, a diagonal 226 u, two steps 320 u. A 2×2
 * Token's centre sits half a step (80 u) down and right of the 1×1 spot it used
 * to be anchored on, which is what puts it 253 u from a side-touching spot and
 * 339 u from a corner-diagonal one.
 *
 * ```
 *   (0,0) (0,1) (0,2) (0,3) …      P(row, col) = 400 + col·160, 300 + row·160
 *   (1,0) (1,1) (1,2) (1,3) …      BIG is the 2×2 centred between the four
 *   (2,0) (2,1) (2,2) (2,3) …      spots around (1,1) — 640, 540.
 * ```
 */

/** A spot on the 160 u lattice — the step the old board used. */
const P = (row, col) => ({ x: 400 + col * 160, y: 300 + row * 160 });

/** The centre of a 2×2 Token sitting over the four spots around `(row, col)`. */
const big = (row, col) => ({ x: P(row, col).x + 80, y: P(row, col).y + 80 });

const BIG = big(1, 1);          // the 2×2 used throughout: centre (640, 540)
const SIDE = P(3, 2);           // touches the 2×2's side: 253 u from its centre
const CORNER = P(3, 3);         // touches only its corner: 339 u — outside Near at 272 u

// The rest of the scene, by the spot each case needs.
const S0 = P(0, 0);
const S1 = P(0, 1);
const S3 = P(0, 3);
const S9 = P(1, 3);
const S12 = P(2, 0);
const S13 = P(2, 1);
const S14 = P(2, 2);
const S15 = P(2, 3);
const S16 = P(2, 4);
const S17 = P(2, 5);
const S22 = P(3, 4);
const S27 = P(4, 3);
const S35 = P(4, 5);            // the far corner; row 5 would fall off the mat

registerTokenTypes({
    /** The fixture tool, two spots square. */
    fixture_large_tool: {
        id: 'fixture_large_tool', name: 'Fixture Large Tool', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 80, sprite: 'skill_industry', size: 2,
        isTool: true, requiresHero: false,
        provides: [{ tag: 'ctx_fixture_tool', minTier: 1, chargeCost: 0 }]
    },
    /** The tool-gated resource, two spots square. */
    fixture_large_gated: {
        id: 'fixture_large_gated', name: 'Fixture Large Gated', tokenType: 'resource',
        rarity: 'uncommon', theme: 'fixture', uses: 2600, sprite: 'skill_nature', size: 2,
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 18000, xp: 12 },
        statements: [
            { id: 'stm_fixture_large_gated', keyword: KEYWORD.STATION, payload: { skill: 'fixture_gated_skill' } }
        ]
    },
    fixture_large_producer: {
        id: 'fixture_large_producer', name: 'Fixture Large Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_nature', size: 2,
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
        }
    },
    /** `fixture_trigger_any`, two spots square. */
    fixture_large_trigger_any: {
        id: 'fixture_large_trigger_any', name: 'Fixture Large Trigger Any', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry', size: 2,
        requiresHero: false,
        statements: [{
            id: 'stm_large_trigger_any', keyword: 'grants',
            when: { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 },
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 100, quantity: 1 }
        }]
    },
    /** A plain Coast two spots square — counted, carries no rule. */
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

/** Put a Token straight on the mat at a point — no rules, no events. */
function put(point, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    BoardState.addToken(instance, point.x, point.y);
    return instance;
}

function clearBoard() {
    for (const token of BoardState.tokens()) BoardState.removeToken(token.id);
}

/** The Token standing exactly at a point, and its instance id. */
const tokenAt = (point) => BoardState.tokensAtPoint(point.x, point.y)[0] ?? null;
const idAt = (point) => tokenAt(point)?.id ?? null;

/** Take the Token standing at a point off the mat. */
function lift(point) {
    const id = idAt(point);
    if (id) BoardState.removeToken(id);
}

/** Resolve the station's selected recipe and say whether its context is met. */
const statusOf = (point) => RecipeResolver.resolveRecipe(idAt(point), tokenAt(point)).status;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearBoard();
    TileModifiers.clearAll();
    resetMatTuning();
    // ⚠️ These cases are laid out on the old 8-neighbour ring (272 u), not the
    // shipped default: Near has started at 164 u since FP-75, which reaches no
    // diagonal and lets a 2×2 reach nothing. The shipped default is pinned in
    // Nearby.test.js.
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
    it('1×1 at 272 u: a diagonal tool serves, one two steps away does not (the old ring)', () => {
        put(S14, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool');                   // diagonal, 226 u
        expect(statusOf(S14)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.contextTiersAround(idAt(S14))).toEqual({ ctx_fixture_tool: 1 });

        lift(CORNER);
        put(S16, 'fixture_tool');                      // 320 u
        expect(statusOf(S14)).toBe(RecipeResolver.RECIPE.NONE);
    });

    it('⭐ a 2×2 tool serves a side-touching station but not a corner-diagonal one (FP-41)', () => {
        put(BIG, 'fixture_large_tool');
        put(SIDE, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool_gated');

        expect(statusOf(SIDE)).toBe(RecipeResolver.RECIPE.OK);
        expect(statusOf(CORNER)).toBe(RecipeResolver.RECIPE.NONE);
        expect(RecipeResolver.contextTiersAround(idAt(CORNER))).toEqual({});
        expect(RecipeResolver.getMissingRequirements(idAt(CORNER), tokenAt(CORNER)).type).toBe('tokens');
        expect(RecipeResolver.servesFrom(idAt(BIG))).toEqual([idAt(SIDE)]);
    });

    it('⭐ a 2×2 station is served from its side, not its corner (FP-41)', () => {
        put(BIG, 'fixture_large_gated');
        put(CORNER, 'fixture_tool');
        expect(statusOf(BIG)).toBe(RecipeResolver.RECIPE.NONE);

        lift(CORNER);
        put(SIDE, 'fixture_tool');
        expect(statusOf(BIG)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.servesFrom(idAt(SIDE))).toEqual([idAt(BIG)]);
    });

    it('accepted tools (Requires) measure the same way', () => {
        const vein = { acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }] };
        put(S14, 'fixture_copper_vein');
        put(S16, 'fixture_pickaxe_t1');                 // 320 u
        expect(RecipeResolver.checkAcceptedTokens(idAt(S14), vein)).toBe(false);

        put(CORNER, 'fixture_pickaxe_t1');              // diagonal
        expect(RecipeResolver.checkAcceptedTokens(idAt(S14), vein)).toBe(true);
    });

    it('a larger radius widens it: at 400 u a tool two steps away serves', () => {
        put(S14, 'fixture_tool_gated');
        put(S16, 'fixture_tool');                      // 320 u
        expect(statusOf(S14)).toBe(RecipeResolver.RECIPE.NONE);

        setMatTuning('nearRadius', 400);
        expect(statusOf(S14)).toBe(RecipeResolver.RECIPE.OK);
        expect(RecipeResolver.servesFrom(idAt(S16))).toEqual([idAt(S14)]);

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
        const tool = put(S14, 'fixture_tool');
        put(S13, 'fixture_tool_gated');
        put(S15, 'fixture_tool_gated');
        put(S16, 'fixture_tool_gated');                 // 320 u from the tool

        RecipeResolver.wearNearbySupport(idAt(S13));
        RecipeResolver.wearNearbySupport(idAt(S15));
        expect(tool.usesRemaining).toBe(78);            // two stations served, one cycle each

        RecipeResolver.wearNearbySupport(idAt(S16));
        expect(tool.usesRemaining).toBe(78);
    });

    it('a null-charge tool never wears', () => {
        const tool = put(S14, 'fixture_tool', null);
        put(S13, 'fixture_tool_gated');
        RecipeResolver.wearNearbySupport(idAt(S13));
        expect(tool.usesRemaining).toBeNull();
    });

    it('⭐ a 2×2 tool wears for a side-touching station and not for a corner-diagonal one (FP-41)', () => {
        const tool = put(BIG, 'fixture_large_tool');
        put(SIDE, 'fixture_tool_gated');
        put(CORNER, 'fixture_tool_gated');

        RecipeResolver.wearNearbySupport(idAt(SIDE));
        RecipeResolver.wearNearbySupport(idAt(CORNER));
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
        const tool = put(S14, 'fixture_tool');
        put(S16, 'fixture_tool_gated');
        setMatTuning('nearRadius', 400);

        RecipeResolver.wearNearbySupport(idAt(S16));
        expect(tool.usesRemaining).toBe(79);
        expect(Charges.contextProvidersAround(idAt(S16)).map(p => p.id)).toEqual([idAt(S14)]);
    });
});

// ---------------------------------------------------------------------------
// TriggerSystem — the "On Neighbour's …" triggers listen within Near
// ---------------------------------------------------------------------------

describe('TriggerSystem: neighbour triggers listen within Near', () => {
    beforeEach(() => TriggerSystem.init());
    afterEach(() => TriggerSystem.teardown());

    const cycleAt = (point, typeId) =>
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: idAt(point), typeId, heroId: null, failed: false, produced: [] });
    const bones = () => SpriteLayer.countOnBoard('item_bones');

    it('1×1 at 272 u: a diagonal neighbour hears it, one two steps away does not', () => {
        put(S15, 'fixture_producer');
        put(S22, 'fixture_trigger_any');                // diagonal
        cycleAt(S15, 'fixture_producer');
        expect(bones()).toBe(1);

        lift(S22);
        put(S17, 'fixture_trigger_any');                // 320 u
        cycleAt(S15, 'fixture_producer');
        expect(bones()).toBe(1);
    });

    it('⭐ a 2×2 source is heard from a side spot outside its old anchor ring (FP-41)', () => {
        put(BIG, 'fixture_large_producer');
        put(SIDE, 'fixture_trigger_any');               // side-touching
        cycleAt(BIG, 'fixture_large_producer');
        expect(bones()).toBe(1);
    });

    it('⭐ a 2×2 source is NOT heard from its corner diagonals, even one in its old anchor ring (FP-41)', () => {
        put(BIG, 'fixture_large_producer');
        put(S0, 'fixture_trigger_any');                 // in the old 8-ring, but a corner diagonal
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
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { ...BIG, typeId: 'fixture_large_producer' });
        expect(bones()).toBe(1);
    });

    it('a larger radius widens it: at 400 u a listener two steps away hears it', () => {
        put(S15, 'fixture_producer');
        put(S17, 'fixture_trigger_any');
        setMatTuning('nearRadius', 400);
        cycleAt(S15, 'fixture_producer');
        expect(bones()).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Restrictions — `Cannot` is a count within Near, on the board as it WOULD be
// ---------------------------------------------------------------------------

describe('Restrictions: "Cannot be nearby to more than 2 Coast" counts within Near', () => {
    /** The restricted Coast at CORNER, exactly at its limit: plain Coasts either side. */
    const atLimit = () => {
        put(CORNER, 'fixture_coast');
        put(SIDE, 'fixture_plain_coast');
        put(S22, 'fixture_plain_coast');
    };

    it('1×1 at 272 u, hypothetical drop: near is refused, two steps away is not — nothing moves', () => {
        atLimit();
        const before = BoardState.tokens().map(t => t.id);

        expect(Restrictions.checkPlacement(S15, 'fixture_plain_coast').ok).toBe(false);   // 160 u above
        expect(Restrictions.checkPlacement(S27, 'fixture_plain_coast').ok).toBe(false);   // 160 u below
        expect(Restrictions.checkPlacement(S17, 'fixture_plain_coast').ok).toBe(true);    // 358 u
        expect(Restrictions.checkPlacement(S9, 'fixture_plain_coast').ok).toBe(true);     // 320 u

        expect(BoardState.tokens().map(t => t.id)).toEqual(before);
    });

    it('a removed Token does not count (remove)', () => {
        atLimit();
        expect(Restrictions.checkPlacement(S15, 'fixture_plain_coast', { remove: [idAt(SIDE)] }).ok).toBe(true);
    });

    it('1×1 at 272 u, a moved Token: a Coast moved into reach is refused; moved short of it is not', () => {
        atLimit();
        const shoved = put(S3, 'fixture_plain_coast');   // far from CORNER
        const drop = big(0, 0);

        const into = Restrictions.checkPlacement(drop, 'fixture_large_tool', { move: [{ id: shoved.id, ...S15 }] });
        expect(into.ok).toBe(false);
        expect(into.reason).toContain('Fixture Coast');

        expect(Restrictions.checkPlacement(drop, 'fixture_large_tool', { move: [{ id: shoved.id, ...S9 }] }).ok).toBe(true);
    });

    it('⭐ a 2×2 Coast counts from its side, not from its corner (FP-41)', () => {
        atLimit();

        // BIG's centre is 339 u from CORNER — a corner diagonal, not near.
        expect(Restrictions.checkPlacement(BIG, 'fixture_large_coast').ok).toBe(true);
        // Half a step to the right is 253 u from CORNER — near, so a third Coast.
        const side = Restrictions.checkPlacement(big(1, 2), 'fixture_large_coast');
        expect(side.ok).toBe(false);
        expect(side.violatingTypeId).toBe('fixture_coast');
    });

    it('⭐ through Placement: the corner 2×2 lands, and the side one is nudged clear (FP-88)', () => {
        atLimit();

        // The side spot would break the rule, so since FP-88 the drop is moved
        // to the nearest spot that obeys it rather than being refused.
        const side = BoardState.createTokenInstance('fixture_large_coast', 500);
        const sideRes = Placement.placeTokenAt(side, big(1, 2));
        expect(sideRes.success).toBe(true);
        expect(sideRes.nudged).toBe(true);
        expect(Restrictions.violations()).toEqual([]);
        BoardState.removeToken(side.id);

        // The corner spot breaks nothing, so it lands exactly where it was put.
        const corner = BoardState.createTokenInstance('fixture_large_coast', 500);
        const cornerRes = Placement.placeTokenAt(corner, BIG);
        expect(cornerRes.success).toBe(true);
        expect(cornerRes.nudged).toBe(false);
        expect(Restrictions.violations()).toEqual([]);
    });

    it('⭐ the restricted Coast as a 2×2 neighbour counts once, by its centre', () => {
        put(CORNER, 'fixture_coast');
        put(BIG, 'fixture_large_coast');                // corner — not counted
        put(S22, 'fixture_plain_coast');
        put(S27, 'fixture_plain_coast');
        expect(Restrictions.violations()).toEqual([]); // 2 within Near, the 2×2 is not one of them
    });

    it('a larger radius widens it: at 400 u a Coast two steps away counts, on a drop and on a shift', () => {
        atLimit();
        const shoved = put(S3, 'fixture_plain_coast');
        setMatTuning('nearRadius', 400);

        expect(Restrictions.checkPlacement(S17, 'fixture_plain_coast').ok).toBe(false);   // 358 u
        expect(Restrictions.checkPlacement(big(0, 0), 'fixture_large_tool', { move: [{ id: shoved.id, ...S9 }] }).ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Rebuild coverage — one dirty event per placement, and board reach refreshes
// ---------------------------------------------------------------------------

describe('Placement publishes one dirty event per change, covering the Near radius', () => {
    const yieldAt = (point) => TileModifiers.resolveAxis(idAt(point), EFFECT_TYPES.YIELD, 100);

    beforeAll(() => {
        // The engine's own listener. Its subscription is not idempotent, so it
        // is added once for this file; the rebuilds it causes are harmless.
        BoardRunner.init();
    });

    it('one ADJACENCY_DIRTY per drop, naming the point it changed', () => {
        const events = [];
        const off = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => events.push(p));
        try {
            Placement.placeTokenAt(BoardState.createTokenInstance('fixture_producer', 5000), S14);
        } finally {
            off();
        }
        expect(events).toHaveLength(1);
        expect(events[0].points).toEqual([S14]);
    });

    it('at 400 u a dropped buff reaches a Token two steps away, and lifting it clears it', () => {
        setMatTuning('nearRadius', 400);
        put(S12, 'fixture_producer');
        TileModifiers.rebuildAll();

        Placement.placeTokenAt(BoardState.createTokenInstance('fixture_buff_yield', 800), S14);
        expect(yieldAt(S12)).toBeCloseTo(105);

        Placement.removePlacedToken(idAt(S14));
        expect(yieldAt(S12)).toBeCloseTo(100);
    });

    it('a 2×2 moved away clears its buff from spots its new position does not reach', () => {
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
        put(S1, 'fixture_producer');                    // side-touching the 2×2 at BIG
        const buff = put(BIG, 'fixture_large_yield');
        TileModifiers.rebuildAll();
        expect(yieldAt(S1)).toBeCloseTo(105);

        expect(Placement.moveTokenTo(buff.id, big(3, 4)).success).toBe(true);
        expect(yieldAt(S1)).toBeCloseTo(100);
    });
});

describe('⭐ a board-reach rule refreshes distant Tokens (pre-existing bug)', () => {
    const yieldAt = (point) => TileModifiers.resolveAxis(idAt(point), EFFECT_TYPES.YIELD, 100);

    it('arriving: a Token across the mat gains the buff from one local rebuild', () => {
        put(S35, 'fixture_producer');
        TileModifiers.rebuildAll();
        expect(yieldAt(S35)).toBeCloseTo(100);

        put(S0, 'fixture_board_buff');
        TileModifiers.rebuildAround([S0]);              // S35 is nowhere near S0
        expect(yieldAt(S35)).toBeCloseTo(105);
    });

    it('leaving: the distant Token loses it again', () => {
        put(S35, 'fixture_producer');
        put(S0, 'fixture_board_buff');
        TileModifiers.rebuildAll();
        expect(yieldAt(S35)).toBeCloseTo(105);

        lift(S0);
        TileModifiers.rebuildAround([S0]);
        expect(yieldAt(S35)).toBeCloseTo(100);
    });

    it('changing: replaced by a Token with no board rule, the distant buff goes', () => {
        put(S35, 'fixture_producer');
        put(S0, 'fixture_board_buff');
        TileModifiers.rebuildAll();

        lift(S0);
        put(S0, 'fixture_producer');
        TileModifiers.rebuildAround([S0]);
        expect(yieldAt(S35)).toBeCloseTo(100);
    });

    it('through Placement and the engine\'s listener', () => {
        put(S35, 'fixture_producer');
        TileModifiers.rebuildAll();

        Placement.placeTokenAt(BoardState.createTokenInstance('fixture_board_buff', null), S0);
        expect(yieldAt(S35)).toBeCloseTo(105);

        Placement.removePlacedToken(idAt(S0));
        expect(yieldAt(S35)).toBeCloseTo(100);
    });
});
