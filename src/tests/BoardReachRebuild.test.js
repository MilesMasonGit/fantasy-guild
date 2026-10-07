import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { isStatementPaid } from '../systems/board/BlockUpkeep.js';
import { centreOf, tokensAround } from '../systems/board/nearby.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { placeAt, clearMat, SPACING } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Wave 3b — with a board-reach rule on the mat, the whole mat is rebuilt
 * only when the board-reach rules change** (round 3 review R3 §3.2, "the
 * optional second step"; `TileModifiers.rebuildTokens`).
 */

const RR_BOARD = 'fixture_rr_board';
const RR_BOARD_2 = 'fixture_rr_board_2';
const RR_UPKEEP_BOARD = 'fixture_rr_upkeep_board';
const RR_NEAR = 'fixture_rr_near';
const RR_NEAR_NODUP = 'fixture_rr_near_nodup';
const RR_SELF = 'fixture_rr_self';
const RR_SELF_NEAR = 'fixture_rr_self_near';
const RR_CHARGES = 'fixture_rr_charges_filter';
const PRODUCER = 'fixture_producer';

const buff = (id, value, extra = {}, payloadType = EFFECT_TYPES.YIELD) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'all' },
    payload: { type: payloadType, bucket: 'percentage', value }, ...extra
});
const type = (id, statements, extra = {}) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture',
    uses: null, sprite: 'skill_occult', statements, ...extra
});

registerTokenTypes({
    [RR_BOARD]: type(RR_BOARD, [buff(RR_BOARD, 0.05, { reach: 'board' })]),
    [RR_BOARD_2]: type(RR_BOARD_2, [buff(RR_BOARD_2, 0.10, { reach: 'board' })]),
    [RR_UPKEEP_BOARD]: type(RR_UPKEEP_BOARD, [buff(RR_UPKEEP_BOARD, 0.20, {
        reach: 'board', upkeep: { items: [{ itemId: 'fixture_oak_wood', quantity: 1 }], cadenceMs: 1000 }
    })]),
    [RR_NEAR]: type(RR_NEAR, [buff(RR_NEAR, 0.01)]),
    [RR_NEAR_NODUP]: type(RR_NEAR_NODUP, [buff(RR_NEAR_NODUP, 0.02)], { noStackDuplicates: true }),
    [RR_SELF]: type(RR_SELF, [buff(RR_SELF, 0.03, { reach: 'self' })]),
    [RR_SELF_NEAR]: type(RR_SELF_NEAR, [
        buff(RR_SELF_NEAR, 0.04, { reach: 'self_and_nearby' }),
        buff(`${RR_SELF_NEAR}_speed`, -0.05, { reach: 'board' }, EFFECT_TYPES.WORK_TIME)
    ]),
    // A Near rule whose filter reads the target's live charges.
    [RR_CHARGES]: type(RR_CHARGES, [{
        id: 'stm_rr_charges', keyword: 'provides',
        to: { mode: 'all', filters: [{ kind: 'charges_below', value: 4000 }] },
        payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.5 }
    }])
});

const ORIGIN = { x: 480, y: 163 };
const P = (col, row) => ({ x: ORIGIN.x + col * SPACING, y: ORIGIN.y + row * SPACING });
const at = (typeId, point) => placeAt(typeId, point.x, point.y);
const yieldOf = (instance) => TileModifiers.resolveAxis(instance.id, EFFECT_TYPES.YIELD, 100);

/** Every Token's aggregator, as text, in arrival order. */
function aggregatorsNow() {
    return BoardState.tokens().map(t =>
        `${t.id} ${JSON.stringify([...TileModifiers.getTokenAggregator(t.id).modifiers])}`);
}

/** Every Token's buffs are exactly what a whole-mat rebuild gives it. */
function expectSameAsWholeRebuild(label) {
    const got = aggregatorsNow();
    for (const t of BoardState.tokens()) TileModifiers.rebuildToken(t.id);
    expect(got, label).toEqual(aggregatorsNow());
}

let rebuilds;
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    clearMat();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
    rebuilds = vi.spyOn(ModifierAggregator.prototype, 'clearAll');
});

afterEach(() => {
    rebuilds.mockRestore();
    resetMatTuning();
});

/** Rebuilds counted from here on. */
function countFromHere() {
    rebuilds.mockClear();
    return () => rebuilds.mock.calls.length;
}

/**
 * An 8×8 block of producers with a board-reach aura in one corner and a Near
 * buff in the middle. `far` is nowhere near either.
 */
function board() {
    const producers = new Map();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((c === 0 && r === 0) || (c === 4 && r === 4)) continue;
            producers.set(`${c},${r}`, at(PRODUCER, P(c, r)));
        }
    }
    const aura = at(RR_BOARD, P(0, 0));
    const near = at(RR_NEAR, P(4, 4));
    TileModifiers.rebuildAll();
    const far = producers.get('7,0');
    expect(yieldOf(far)).toBeCloseTo(105);
    expect(yieldOf(producers.get('4,3'))).toBeCloseTo(106);
    return { producers, aura, near, far, total: BoardState.tokens().length };
}

// ---------------------------------------------------------------------------
// (a) Nothing about the board-reach rules changed: the neighbourhood only
// ---------------------------------------------------------------------------

describe('⭐ a board-reach aura on the mat: an unrelated change rebuilds only its neighbourhood (Wave 3b)', () => {
    it('a producer moving rebuilds Near of where it left and where it landed — not the whole mat', () => {
        const { producers, far, total } = board();
        const mover = producers.get('7,7');
        const from = centreOf(mover);
        const to = P(9, 9);
        BoardState.setTokenPoint(mover.id, to.x, to.y);
        const expected = tokensAround([from, to]);
        expect(expected.length).toBeLessThan(total);

        const count = countFromHere();
        TileModifiers.rebuildAround([from, to]);
        expect(count(), 'the whole mat was rebuilt for a change the aura cannot see').toBe(expected.length);

        expect(yieldOf(far)).toBeCloseTo(105);
        expect(yieldOf(mover)).toBeCloseTo(105);
        expectSameAsWholeRebuild('a producer moved');
    });

    it('a Near buff moving: its old neighbours lose it, its new ones gain it, a far Token keeps the aura', () => {
        const { producers, near, far, total } = board();
        const from = centreOf(near);
        const to = P(6.5, 1);
        BoardState.setTokenPoint(near.id, to.x, to.y);
        const expected = tokensAround([from, to]);

        const count = countFromHere();
        TileModifiers.rebuildAround([from, to]);
        expect(count()).toBe(expected.length);
        expect(count()).toBeLessThan(total);

        expect(yieldOf(producers.get('4,3')), 'old neighbour keeps a stale buff').toBeCloseTo(105);
        expect(yieldOf(producers.get('6,1')), 'new neighbour misses the buff').toBeCloseTo(106);
        expect(yieldOf(far)).toBeCloseTo(105);
        expectSameAsWholeRebuild('a Near buff moved');
    });

    it('the aura itself moving changes nobody\'s buffs, and does not rebuild the whole mat', () => {
        const { aura, far, total } = board();
        const from = centreOf(aura);
        const to = P(-3, 0);
        BoardState.setTokenPoint(aura.id, to.x, to.y);

        const count = countFromHere();
        TileModifiers.rebuildAround([from, to]);
        expect(count()).toBe(tokensAround([from, to]).length);
        expect(count()).toBeLessThan(total);
        expect(yieldOf(far)).toBeCloseTo(105);
        expectSameAsWholeRebuild('the aura moved');
    });

    it('a Near buff that moved WITHOUT a rebuild (a walking enemy, mid-walk) is caught up by the next one anywhere', () => {
        const { producers, near, total } = board();
        const from = centreOf(near);
        const to = P(1, 6);
        BoardState.setTokenPoint(near.id, to.x, to.y);   // nobody names this move

        // Something unrelated happens on the far side of the mat.
        const elsewhere = P(7, 0);
        const expected = new Set([...tokensAround([elsewhere]), ...tokensAround([from, to])]);
        const count = countFromHere();
        TileModifiers.rebuildAround([elsewhere]);
        expect(count()).toBe(expected.size);
        expect(count()).toBeLessThan(total);

        expect(yieldOf(producers.get('4,3'))).toBeCloseTo(105);
        expect(yieldOf(producers.get('1,5'))).toBeCloseTo(106);
        expectSameAsWholeRebuild('an unnamed move');
    });

    it('a producer arriving or leaving rebuilds only around it', () => {
        const { far, total } = board();
        const spot = P(9, 4);
        const newcomer = at(PRODUCER, spot);
        let count = countFromHere();
        TileModifiers.rebuildAround([spot]);
        expect(count()).toBe(tokensAround([spot]).length);
        expect(count()).toBeLessThan(total);
        expect(yieldOf(newcomer)).toBeCloseTo(105);
        expectSameAsWholeRebuild('a producer arrived');

        BoardState.removeToken(newcomer.id);
        count = countFromHere();
        TileModifiers.rebuildAround([spot]);
        expect(count()).toBeLessThan(total);
        expect(yieldOf(far)).toBeCloseTo(105);
        expectSameAsWholeRebuild('a producer left');
    });
});

// ---------------------------------------------------------------------------
// (b) The board-reach rules changed: the whole mat, in the same call
// ---------------------------------------------------------------------------

describe('⭐ the board-reach rules changing still rebuilds the whole mat, the same call (Wave 3b)', () => {
    it('the aura leaving: every Token, and the far one loses it at once', () => {
        const { aura, far } = board();
        const where = centreOf(aura);
        BoardState.removeToken(aura.id);
        expect(tokensAround([where])).not.toContain(far.id);

        const count = countFromHere();
        TileModifiers.rebuildAround([where]);
        expect(count()).toBe(BoardState.tokens().length);
        expect(yieldOf(far)).toBeCloseTo(100);
        expectSameAsWholeRebuild('the aura left');
    });

    it('the aura arriving: every Token, and the far one gains it at once', () => {
        const { aura, far } = board();
        const where = centreOf(aura);
        BoardState.removeToken(aura.id);
        TileModifiers.rebuildAround([where]);

        const back = at(RR_BOARD, P(0, -3));
        const count = countFromHere();
        TileModifiers.rebuildAround([centreOf(back)]);
        expect(count()).toBe(BoardState.tokens().length);
        expect(yieldOf(far)).toBeCloseTo(105);
        expectSameAsWholeRebuild('the aura arrived');
    });

    it('a second board-reach source appearing beside the first: every Token', () => {
        const { far } = board();
        const second = at(RR_BOARD_2, P(-2, -2));
        const count = countFromHere();
        TileModifiers.rebuildAround([centreOf(second)]);
        expect(count()).toBe(BoardState.tokens().length);
        expect(yieldOf(far)).toBeCloseTo(115);
        expectSameAsWholeRebuild('a second aura arrived');
    });

    it('an aura replaced by another object under the same id: every Token', () => {
        const { aura, far } = board();
        const where = centreOf(aura);
        const replacement = BoardState.createTokenInstance(RR_BOARD_2, null);
        replacement.id = aura.id;
        BoardState.addToken(replacement, where.x, where.y);

        const count = countFromHere();
        TileModifiers.rebuildAround([where]);
        expect(count()).toBe(BoardState.tokens().length);
        expect(yieldOf(far)).toBeCloseTo(110);
        expectSameAsWholeRebuild('the aura was replaced');
    });

    it('an aura going unpaid and paid again: the far Token follows on the very tick it flips', () => {
        const { producers, far } = board();
        const upkeep = at(RR_UPKEEP_BOARD, P(-2, 0));
        TileModifiers.rebuildAll();
        expect(yieldOf(far)).toBeCloseTo(125);

        let flips = 0;
        let paidBefore = true;
        const step = () => {
            const count = countFromHere();
            BoardRunner.tick(100);
            const paid = isStatementPaid(upkeep, `stm_${RR_UPKEEP_BOARD}`);
            expect(yieldOf(far), `tick after paid=${paid}`).toBeCloseTo(paid ? 125 : 105);
            if (paid !== paidBefore) {
                flips++;
                expect(count(), 'a flip must rebuild every Token').toBeGreaterThanOrEqual(BoardState.tokens().length);
            }
            paidBefore = paid;
        };

        // The Bank is empty: the aura lapses at its first cadence.
        for (let t = 0; t < 1000; t += 100) step();
        expect(paidBefore).toBe(false);
        // A far Token away from everything moving meanwhile is still exact.
        const mover = producers.get('7,7');
        const from = centreOf(mover);
        BoardState.setTokenPoint(mover.id, P(9, 7).x, P(9, 7).y);
        TileModifiers.rebuildAround([from, P(9, 7)]);
        expectSameAsWholeRebuild('a move while unpaid');

        InventoryManager.addItem('fixture_oak_wood', 5);
        for (let t = 0; t < 1000; t += 100) step();
        expect(paidBefore).toBe(true);
        expect(flips).toBe(2);
        expectSameAsWholeRebuild('paid again');
    });

    it('a filter that reads live state (charges) keeps the whole-mat rebuild: a charge spent with no board event is caught by the next rebuild anywhere', () => {
        const { producers } = board();
        const charges = at(RR_CHARGES, P(8, 4));
        TileModifiers.rebuildAll();
        const target = producers.get('7,4');
        expect(yieldOf(target)).toBeCloseTo(105);

        // Spent down below the filter's line, with no event at all.
        target.usesRemaining = 3000;
        const count = countFromHere();
        TileModifiers.rebuildAround([P(0, 7)]);
        expect(count()).toBe(BoardState.tokens().length);
        expect(yieldOf(target)).toBeCloseTo(155);
        expectSameAsWholeRebuild('a charge-filtered rule');
        expect(charges).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// Every step of a long, mixed sequence equals a whole-mat rebuild
// ---------------------------------------------------------------------------

describe('⭐ exact through a long mixed sequence: after every rebuild, every Token equals a whole-mat rebuild', () => {
    /** A small deterministic PRNG (mulberry32), so a failure replays. */
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const TYPES = [PRODUCER, PRODUCER, PRODUCER, RR_NEAR, RR_NEAR_NODUP, RR_SELF, RR_SELF_NEAR, RR_BOARD, RR_UPKEEP_BOARD];

    for (const seed of [1, 2, 3, 4, 5]) {
        it(`seed ${seed}`, () => {
            const rand = rng(seed);
            const pick = (list) => list[Math.floor(rand() * list.length)];
            const point = () => ({ x: Math.round(ORIGIN.x + rand() * 8 * SPACING), y: Math.round(ORIGIN.y + rand() * 8 * SPACING) });

            for (let i = 0; i < 40; i++) at(pick(TYPES), point());
            at(RR_BOARD, point());
            TileModifiers.rebuildAll();

            let calls = 0;
            let rebuilt = 0;
            const count = countFromHere();
            for (let stepNo = 0; stepNo < 250; stepNo++) {
                const tokens = BoardState.tokens();
                const roll = rand();
                if (roll < 0.30 && tokens.length) {
                    // A step nobody names (a walking enemy, mid-walk).
                    const t = pick(tokens);
                    const p = point();
                    BoardState.setTokenPoint(t.id, p.x, p.y);
                    continue;
                }
                let points;
                if (roll < 0.55 && tokens.length) {
                    const t = pick(tokens);
                    const from = centreOf(t);
                    const to = point();
                    BoardState.setTokenPoint(t.id, to.x, to.y);
                    points = [from, to];
                } else if (roll < 0.70) {
                    const t = at(pick(TYPES), point());
                    points = [centreOf(t)];
                } else if (roll < 0.85 && tokens.length) {
                    const t = pick(tokens);
                    points = [centreOf(t)];
                    BoardState.removeToken(t.id);
                } else if (roll < 0.93) {
                    // An upkeep flip, as `BoardRunner.tick` makes one.
                    const payers = tokens.filter(t => t.typeId === RR_UPKEEP_BOARD);
                    if (!payers.length) continue;
                    const t = pick(payers);
                    const key = `stm_${RR_UPKEEP_BOARD}`;
                    t.blockUpkeep = t.blockUpkeep || {};
                    t.blockUpkeep[key] = { elapsedMs: 0, paid: !isStatementPaid(t, key) };
                    points = [centreOf(t)];
                } else {
                    // An event somewhere with nothing new in it.
                    points = [point()];
                }
                TileModifiers.rebuildAround(points);
                calls++;
                rebuilt += count();
                expectSameAsWholeRebuild(`seed ${seed}, step ${stepNo}`);
                rebuilds.mockClear();
            }
            // Some calls were partial: fewer rebuilds than a whole mat every time.
            expect(calls).toBeGreaterThan(50);
            expect(rebuilt).toBeLessThan(calls * BoardState.tokens().length);
        });
    }
});
