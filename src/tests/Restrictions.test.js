import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

/**
 * `Cannot` — the only rule in the game that says **no** to a placement.
 *
 * The owner's ruling, verbatim: *"Refuse, token flies back to it's last
 * location. We will have a warning that will flash to show the player that it
 * was rejected and why."* And: *"There should always be a last location, but we
 * can make it fly to the vault as a fallback in case."*
 *
 * So there are three things worth pinning, and they are the three things that
 * could each go quietly wrong:
 *
 * 1. **It refuses, and it says why.** A silent no on a drag is the worst
 *    possible outcome — the player learns nothing and blames the game.
 * 2. **It is symmetric.** Dropping a third Coast beside two others breaks the
 *    *existing* Coast's rule, not the newcomer's. A check that only asked the
 *    incoming Token would let that through, and it is the single easiest thing
 *    to get wrong here.
 * 3. **Nothing is ever destroyed.** Every refusal path leaves the Token
 *    somewhere the player can still reach it.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** A Coast that will not sit beside more than two other Coasts. */
const LIMIT_STATEMENT = {
    id: 'stm_coastlimit',
    keyword: KEYWORD.CANNOT,
    payload: { kind: 'adjacency_limit', max: 2 },
    to: { mode: 'tag', value: 'Coast' },
    when: null,
    upkeep: null
};

registerTokenTypes({
    fixture_coast: {
        id: 'fixture_coast', name: 'Fixture Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        tags: ['Coast'],
        statements: [LIMIT_STATEMENT],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'item_fish', quantity: 1, chance: 100 }]
        }
    },
    /** Carries the tag but no rule — the thing being counted, not the counter. */
    fixture_plain_coast: {
        id: 'fixture_plain_coast', name: 'Fixture Plain Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        tags: ['Coast'],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'item_fish', quantity: 1, chance: 100 }]
        }
    },
    /** A 2×2, to exercise the cascade path. */
    fixture_big_slab: {
        id: 'fixture_big_slab', name: 'Fixture Big Slab', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        size: 2, requiresHero: false
    }
});

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * A lattice of mat points 160 u apart, so the Coast layouts below keep exactly
 * the neighbourhoods they were written for at the 272 u Near set in `beforeEach`:
 * 8, 9 and 10 are a row 160 u apart, and 16 is a 226 u diagonal of 9.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
const big = (i) => ({ x: C(i).x + 80, y: C(i).y + 80 });

/** The Token standing exactly on spot `i`. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;

/** Put a Token straight on spot `i`, no rules — how a save rehydrates one. */
const seat = (i, instance) => BoardState.addToken(instance, C(i).x, C(i).y);

function place(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const where = typeId === 'fixture_big_slab' ? big(tile) : C(tile);
    return { result: Placement.placeTokenAt(instance, where), instance };
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    // ⚠️ The Coast layouts count diagonal neighbours, so Near is pinned at the
    // 8-tile ring (272 u); the shipped default is 164 u since FP-75.
    resetMatTuning();
    setMatTuning('nearRadius', 272);
});

describe('A `Cannot` refuses the placement, and says why', () => {
    it('lets the limit be reached', () => {
        // 8, 9, 10 are a row; 9 is nearby to both 8 and 10.
        expect(place(8, 'fixture_plain_coast').result.success).toBe(true);
        expect(place(10, 'fixture_plain_coast').result.success).toBe(true);
        expect(place(9, 'fixture_coast').result.success).toBe(true);
    });

    /**
     * ⭐ **FP-88 changed what a broken rule does to a drop** (slice 1.6d-1).
     * It used to refuse and fly the Token back. The owner's ruling is that the
     * drop is **nudged to the nearest spot that obeys the rule**, and flies back
     * only when no such spot is within nudge reach. The rule itself is unchanged
     * — what changed is that obeying it is now the engine's job rather than the
     * player's. The board is never left illegal either way.
     */
    it('nudges the drop clear of the rule instead of refusing it (FP-88)', () => {
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');       // also touches 9

        const { result, instance } = place(9, 'fixture_coast');

        expect(result.success).toBe(true);
        expect(result.nudged).toBe(true);
        expect(BoardState.getTokenById(instance.id)).not.toBeNull();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('never leaves the Token standing on the spot that would break the rule', () => {
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');

        place(9, 'fixture_coast');

        // It moved off the offending spot, and the board is legal.
        expect(tokenAt(9)).toBeFalsy();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('is symmetric — the newcomer can break somebody ELSE’s rule, and is moved for it', () => {
        // ⚠️ The trap in the whole feature. Only the Token on 9 carries the
        // rule; the third plain Coast carries none at all. It must still be
        // moved, because it is 9's neighbourhood that would go over.
        place(9, 'fixture_coast');
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');

        const { result } = place(16, 'fixture_plain_coast');

        expect(result.success).toBe(true);
        expect(result.nudged).toBe(true);
        expect(tokenAt(16)).toBeFalsy();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('does not count a Token this drop lands on top of and restocks', () => {
        // 17 touches 10 and 16, so its two-Coast limit is exactly met. Dropping
        // a matching Coast onto 16 tops the one already there up rather than
        // adding a fourth, so the count is unchanged and the drop is legal.
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');
        place(17, 'fixture_coast');

        const { result } = place(16, 'fixture_plain_coast');

        expect(result.success).toBe(true);
        expect(tokenAt(16)?.typeId).toBe('fixture_plain_coast');
        expect(Restrictions.violations()).toEqual([]);
    });

    it('ignores a restriction kind the engine does not know', () => {
        // A rule nobody can evaluate must never block a placement on a guess.
        registerTokenTypes({
            fixture_future_rule: {
                id: 'fixture_future_rule', name: 'Fixture Future Rule', tokenType: 'buff',
                rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
                statements: [{
                    id: 'stm_future', keyword: KEYWORD.CANNOT,
                    payload: { kind: 'be_in_the_outer_ring' },
                    to: { mode: 'all', value: '' }
                }]
            }
        });
        expect(place(20, 'fixture_future_rule').result.success).toBe(true);
    });
});

describe('A move that would break the rule is moved aside, not sent back (FP-88)', () => {
    it('lands the moved Token somewhere legal rather than leaving it behind', () => {
        place(9, 'fixture_coast');
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        const { instance } = place(30, 'fixture_plain_coast');   // far away, legal

        const result = Placement.moveTokenTo(instance.id, C(16));

        expect(result.success).toBe(true);
        // It left spot 30 and is not standing on the spot that breaks the rule.
        expect(tokenAt(30)).toBeFalsy();
        expect(tokenAt(16)).toBeFalsy();
        expect(BoardState.getTokenById(instance.id)).not.toBeNull();
        expect(Restrictions.violations()).toEqual([]);
    });
});

/**
 * ⭐ **A 2×2 can no longer shove anybody anywhere** (slice 1.6d-1).
 *
 * This suite used to describe the cascade: a large Token dropped over smaller
 * ones pushed them sideways, which could carry a Coast into reach of another
 * Coast nobody had touched — so the whole placement was refused. Free placement
 * deleted the cascade outright. The large Token now moves **itself** to the
 * nearest spot that fits, so the shove that created the illegal board cannot
 * happen, and there is nothing to refuse.
 */
describe('A 2×2 can no longer shove anybody into an illegal spot (slice 1.6d-1)', () => {
    /**
     * The board this sets up, on the old 6×6 layout:
     *
     * * the restricted Coast sits on **6**, with plain Coasts on **7** and
     *   **13** — two neighbours, exactly at its limit, perfectly legal;
     * * a third plain Coast sits on **18**, out of reach of 6 entirely.
     *
     * A 2×2 dropped on anchor **0** covers 0, 1, 6 and 7. It used to shove the
     * restricted Coast and one of its neighbours sideways, into reach of 18.
     */
    const setUpTheShove = () => {
        place(6, 'fixture_coast');
        place(7, 'fixture_plain_coast');
        place(13, 'fixture_plain_coast');
        place(18, 'fixture_plain_coast');
    };

    it('starts from a board that is perfectly legal', () => {
        setUpTheShove();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('moves itself instead of shoving, and the board stays legal', () => {
        setUpTheShove();
        const { result, instance } = place(0, 'fixture_big_slab');

        expect(result.success).toBe(true);
        expect(BoardState.getTokenById(instance.id)).not.toBeNull();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('⭐ leaves every Token that was already down exactly where it was', () => {
        // The old assertion said a refused cascade moved nothing. This is the
        // stronger version: an ACCEPTED drop moves nothing either, because
        // nothing is ever displaced any more.
        setUpTheShove();
        const before = BoardState.tokens().map(t => `${t.id}:${t.x},${t.y}`).sort();

        place(0, 'fixture_big_slab');

        const after = BoardState.tokens()
            .filter(t => t.typeId !== 'fixture_big_slab')
            .map(t => `${t.id}:${t.x},${t.y}`).sort();
        expect(after).toEqual(before);
    });

    it('still allows a 2×2 that breaks nothing', () => {
        // The refusal must be about the rule, not about 2×2 Tokens.
        place(6, 'fixture_coast');
        place(7, 'fixture_plain_coast');

        expect(place(0, 'fixture_big_slab').result.success).toBe(true);
    });
});

/**
 * The load-time repair's `relocate`, as `BoardRunner` passes it: the nearest
 * legal point within 640 u. (It lifted offenders into the Vault until the
 * Vault went in Token Lifecycle 9.3; now they move to a legal spot.)
 */
const relocate = (instance) => MatPlacement.findSpot(
    instance.typeId, { x: instance.x, y: instance.y },
    { excludeId: instance.id, plan: { id: instance.id }, reach: 640 }
);

describe('A saved board that already breaks a rule is repaired, never destroyed', () => {
    it('moves the offender to a legal spot on the mat', () => {
        // Build the illegal board directly, the way a save from before the rule
        // existed would rehydrate it — bypassing placement entirely.
        seat(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            seat(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }
        expect(Restrictions.violations()).not.toEqual([]);

        const count = BoardState.tokens().length;
        const moved = Restrictions.reconcile(relocate);

        expect(moved.length).toBeGreaterThan(0);
        expect(Restrictions.violations()).toEqual([]);
        // Nothing destroyed: every moved Token is still on the mat, where it went.
        expect(BoardState.tokens()).toHaveLength(count);
        for (const { id, to } of moved) {
            const t = BoardState.getTokenById(id);
            expect({ x: t.x, y: t.y }).toEqual(to);
        }
    });

    it('takes the fewest Tokens it can', () => {
        seat(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            seat(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }

        const moved = Restrictions.reconcile(relocate);

        // Four Tokens are involved; moving one fixes it. Moving more than
        // necessary would rearrange the player's mat for nothing.
        expect(moved).toHaveLength(1);
    });

    it('leaves the board alone when it is legal', () => {
        place(8, 'fixture_plain_coast');
        place(9, 'fixture_coast');

        expect(Restrictions.reconcile(relocate)).toEqual([]);
        expect(tokenAt(9)?.typeId).toBe('fixture_coast');
    });

    it('would rather leave an illegal board than destroy a Token', () => {
        seat(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            seat(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }

        // Nowhere legal to go.
        const moved = Restrictions.reconcile(() => null);

        expect(moved).toEqual([]);
        expect(tokenAt(9)?.typeId).toBe('fixture_coast');
    });
});

describe('The rule reads back as the sentence you wrote', () => {
    it('renders the owner’s own example, word for word', () => {
        expect(renderStatement(LIMIT_STATEMENT))
            .toBe('Cannot be nearby to more than 2 Coast Tokens.');
    });

    it('says "Tokens" with no filter, rather than going blank', () => {
        expect(renderStatement({
            keyword: KEYWORD.CANNOT,
            payload: { kind: 'adjacency_limit', max: 4 },
            to: { mode: 'all', value: '' }
        })).toBe('Cannot be nearby to more than 4 Tokens.');
    });

    it('shows an unfinished restriction as unfinished', () => {
        expect(renderStatement({ keyword: KEYWORD.CANNOT, payload: {} })).toBe('Cannot ….');
    });

    it('never offers a trigger or an upkeep on a restriction', () => {
        // A restriction that lapses when you run out of coal is a trap, not a
        // rule — and a restriction has no firing moment to attach to.
        const def = getTokenType('fixture_coast');
        expect(def.statements[0].when).toBeNull();
        expect(def.statements[0].upkeep).toBeNull();
    });
});
