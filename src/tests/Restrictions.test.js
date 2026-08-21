import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';

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

function place(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return { result: Placement.placeToken(tile, instance), instance };
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
});

describe('A `Cannot` refuses the placement, and says why', () => {
    it('lets the limit be reached', () => {
        // 8, 9, 10 are a row; 9 is adjacent to both 8 and 10.
        expect(place(8, 'fixture_plain_coast').result.success).toBe(true);
        expect(place(10, 'fixture_plain_coast').result.success).toBe(true);
        expect(place(9, 'fixture_coast').result.success).toBe(true);
    });

    it('refuses the one that would exceed it, in words a player can act on', () => {
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');       // also touches 9

        const { result } = place(9, 'fixture_coast');

        expect(result.success).toBe(false);
        expect(result.reason).toContain('Fixture Coast');
        expect(result.reason).toContain('more than 2');
        expect(result.reason).toContain('Coast');
        // Not a stack trace, not an error code.
        expect(result.reason).not.toContain('undefined');
    });

    it('leaves the tile empty when it refuses — a refusal is not a half-placement', () => {
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');

        place(9, 'fixture_coast');

        expect(BoardState.getToken(9)).toBeFalsy();
    });

    it('is symmetric — the newcomer can break somebody ELSE’s rule', () => {
        // ⚠️ The trap in the whole feature. Only the Token on 9 carries the
        // rule; the third plain Coast carries none at all. Dropping it must
        // still be refused, because it is 9's neighbourhood that goes over.
        place(9, 'fixture_coast');
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');

        const { result } = place(16, 'fixture_plain_coast');

        expect(result.success).toBe(false);
        expect(result.reason).toContain('Fixture Coast');
        expect(BoardState.getToken(16)).toBeFalsy();
    });

    it('does not count a Token that this very drop is displacing', () => {
        // 17 touches 10 and 16, so its two-Coast limit is exactly met. Dropping
        // a fresh Coast onto 16 covers the one already there and sends it to
        // the Tray, so the count is unchanged and the drop is legal.
        //
        // Counting the Token on its way off the board would refuse a placement
        // that breaks nothing — the quiet, maddening kind of false refusal.
        place(10, 'fixture_plain_coast');
        place(16, 'fixture_plain_coast');
        place(17, 'fixture_coast');

        const { result } = place(16, 'fixture_plain_coast');

        expect(result.success).toBe(true);
        expect(BoardState.getToken(16)?.typeId).toBe('fixture_plain_coast');
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

describe('The Token goes back where it came from', () => {
    it('a refused move leaves it on the tile it started on', () => {
        place(9, 'fixture_coast');
        place(8, 'fixture_plain_coast');
        place(10, 'fixture_plain_coast');
        place(30, 'fixture_plain_coast');        // far away, legal

        const result = Placement.moveToken(30, 16);

        expect(result.success).toBe(false);
        expect(BoardState.getToken(30)?.typeId).toBe('fixture_plain_coast');
        expect(BoardState.getToken(16)).toBeFalsy();
    });
});

describe('A 2×2 cascade is refused rather than allowed to shove somebody into an illegal spot', () => {
    /**
     * The board this sets up, on the 7×7 grid:
     *
     * * the restricted Coast sits on **7**, with plain Coasts on **8** and
     *   **15** — two neighbours, exactly at its limit, perfectly legal;
     * * a third plain Coast sits on **21**, out of reach of 7 entirely.
     *
     * Dropping a 2×2 on anchor **0** covers 0, 1, 7 and 8, so it shoves both
     * the restricted Coast and one of its neighbours sideways — and where they
     * land, 21 is suddenly in reach. Nobody dropped anything next to anything;
     * the cascade did it.
     */
    const setUpTheShove = () => {
        place(7, 'fixture_coast');
        place(8, 'fixture_plain_coast');
        place(15, 'fixture_plain_coast');
        place(21, 'fixture_plain_coast');
    };

    it('starts from a board that is perfectly legal', () => {
        setUpTheShove();
        expect(Restrictions.violations()).toEqual([]);
    });

    it('refuses the placement, naming the rule the shove would break', () => {
        setUpTheShove();
        const { result } = place(0, 'fixture_big_slab');

        expect(result.success).toBe(false);
        expect(result.reason).toContain('Fixture Coast');
        expect(result.reason).toContain('more than 2');
    });

    it('⭐ moves nothing at all — a refused cascade is a no-op', () => {
        // The design's alternative was to let the shove happen and then mark or
        // rescue whatever it broke. This is the assertion that says we did not
        // do that: no Token is left standing where the cascade put it.
        setUpTheShove();
        const before = [...BoardState.occupiedTiles()].map(([t, i]) => `${t}:${i.typeId}`).sort();

        place(0, 'fixture_big_slab');

        const after = [...BoardState.occupiedTiles()].map(([t, i]) => `${t}:${i.typeId}`).sort();
        expect(after).toEqual(before);
        expect(BoardState.getTray()).toEqual([]);
    });

    it('still allows a cascade that breaks nothing', () => {
        // The refusal must be about the rule, not about 2×2 Tokens.
        place(7, 'fixture_coast');
        place(8, 'fixture_plain_coast');

        expect(place(0, 'fixture_big_slab').result.success).toBe(true);
    });
});

describe('A saved board that already breaks a rule is repaired, never destroyed', () => {
    it('lifts the offender into the Vault', () => {
        // Build the illegal board directly, the way a save from before the rule
        // existed would rehydrate it — bypassing placement entirely.
        BoardState.setToken(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            BoardState.setToken(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }
        expect(Restrictions.violations()).not.toEqual([]);

        const moved = Restrictions.reconcile(instance => TokenBank.deposit(instance));

        expect(moved.length).toBeGreaterThan(0);
        expect(Restrictions.violations()).toEqual([]);
        // Nothing destroyed: every lifted Token is in the Vault.
        for (const { typeId } of moved) {
            expect(BoardState.tokenBankCopies(typeId).length).toBeGreaterThan(0);
        }
    });

    it('takes the fewest Tokens it can', () => {
        BoardState.setToken(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            BoardState.setToken(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }

        const moved = Restrictions.reconcile(instance => TokenBank.deposit(instance));

        // Four Tokens are involved; removing one fixes it. Confiscating more
        // than necessary would cost the player Tokens they never had to lose.
        expect(moved).toHaveLength(1);
    });

    it('leaves the board alone when it is legal', () => {
        place(8, 'fixture_plain_coast');
        place(9, 'fixture_coast');

        expect(Restrictions.reconcile(() => true)).toEqual([]);
        expect(BoardState.getToken(9)?.typeId).toBe('fixture_coast');
    });

    it('would rather leave an illegal board than destroy a Token', () => {
        BoardState.setToken(9, BoardState.createTokenInstance('fixture_coast', 500));
        for (const tile of [8, 10, 16]) {
            BoardState.setToken(tile, BoardState.createTokenInstance('fixture_plain_coast', 500));
        }

        // A Vault that refuses everything.
        const moved = Restrictions.reconcile(() => false);

        expect(moved).toEqual([]);
        expect(BoardState.getToken(9)?.typeId).toBe('fixture_coast');
    });
});

describe('The rule reads back as the sentence you wrote', () => {
    it('renders the owner’s own example, word for word', () => {
        expect(renderStatement(LIMIT_STATEMENT))
            .toBe('Cannot be adjacent to more than 2 Coast Tokens.');
    });

    it('says "Tokens" with no filter, rather than going blank', () => {
        expect(renderStatement({
            keyword: KEYWORD.CANNOT,
            payload: { kind: 'adjacency_limit', max: 4 },
            to: { mode: 'all', value: '' }
        })).toBe('Cannot be adjacent to more than 4 Tokens.');
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
