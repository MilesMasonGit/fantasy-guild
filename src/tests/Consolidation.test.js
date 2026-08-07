import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * Consolidation (D-77) — the arithmetic that decides whether the Bank quietly
 * creates or destroys value.
 *
 * A partially-used Token returning to the Bank merges with other partials of
 * the same type and re-packs into as many **full** Tokens as possible plus at
 * most one remainder:
 *
 * ```
 * Bank has:  Forest (3,000 uses left)        capacity 5,000
 * Returning: Forest (4,000 uses left)
 * Result:    1× Forest (5,000, full) + 1× Forest (2,000)
 * ```
 *
 * ⚠️ **Totals must be conserved exactly.** This is the rule that makes D-54's
 * free repositioning safe: if a round trip through the Bank could ever gain or
 * lose a charge, picking a Token up and putting it back becomes either an
 * exploit or a punishment. Tested hard for that reason.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const FOREST_CAP = tokenStartingUses('fixture_producer');   // 5000

/** Put a copy of `typeId` with `uses` charges into the Bank, rules and all. */
function bank(typeId, uses) {
    return TokenBank.deposit(BoardState.createTokenInstance(typeId, uses));
}

/** Total charges held of one type. `null` (unlimited) is excluded. */
function totalCharges(typeId) {
    return BoardState.tokenBankCopies(typeId)
        .filter(c => c.usesRemaining != null)
        .reduce((sum, c) => sum + c.usesRemaining, 0);
}

beforeEach(() => {
    GameState.initNew();
});

describe('Re-packing (D-77)', () => {
    it('merges two partials into one full Token plus a remainder', () => {
        bank('fixture_producer', 3000);
        bank('fixture_producer', 4000);

        const copies = BoardState.tokenBankCopies('fixture_producer');
        const charges = copies.map(c => c.usesRemaining).sort((a, b) => b - a);
        expect(charges).toEqual([FOREST_CAP, 7000 - FOREST_CAP]);
    });

    it('holds at most ONE partial, however many partials arrive', () => {
        // Otherwise the Bank degrades into a ragged list of near-dead copies,
        // and per-type state becomes per-instance sprawl.
        for (let i = 0; i < 9; i++) bank('fixture_producer', 1200);

        const partials = BoardState.tokenBankCopies('fixture_producer')
            .filter(c => c.usesRemaining !== FOREST_CAP);
        expect(partials.length).toBeLessThanOrEqual(1);
    });

    it('packs exact multiples into full Tokens with no remainder at all', () => {
        bank('fixture_producer', FOREST_CAP / 2);
        bank('fixture_producer', FOREST_CAP / 2);

        const copies = BoardState.tokenBankCopies('fixture_producer');
        expect(copies).toHaveLength(1);
        expect(copies[0].usesRemaining).toBe(FOREST_CAP);
    });
});

describe('⚠️ Totals are conserved exactly', () => {
    it('conserves the total across an arbitrary pile of partials', () => {
        const amounts = [4321, 17, 5000, 999, 2500, 1, 3333];
        for (const n of amounts) bank('fixture_producer', n);

        expect(totalCharges('fixture_producer')).toBe(amounts.reduce((a, b) => a + b, 0));
    });

    it('gains nothing from picking a Token up and putting it back', () => {
        // The no-refresh-exploit rule. If this ever fails, D-54's "repositioning
        // is free" becomes "repositioning is a charge printer".
        bank('fixture_producer', 3200);
        bank('fixture_producer', 4100);
        const before = totalCharges('fixture_producer');

        for (let i = 0; i < 20; i++) {
            const taken = TokenBank.withdraw('fixture_producer');
            TokenBank.deposit(taken);
        }

        expect(totalCharges('fixture_producer')).toBe(before);
    });

    it('loses nothing when a full Token is withdrawn and returned untouched', () => {
        bank('fixture_producer', FOREST_CAP);
        bank('fixture_producer', 1500);

        const taken = TokenBank.withdraw('fixture_producer');
        expect(taken.usesRemaining).toBe(FOREST_CAP);      // full drawn first
        TokenBank.deposit(taken);

        expect(totalCharges('fixture_producer')).toBe(FOREST_CAP + 1500);
    });
});

describe('Placement draws a FULL Token first (D-77)', () => {
    it('hands out the full copy while a partial sits in storage', () => {
        // A player must never be handed a nearly-spent Token while a fresh one
        // is available — which matters most for Managers, since a restock that
        // installed the worst copy would make automation feel like a downgrade.
        bank('fixture_producer', 900);
        bank('fixture_producer', FOREST_CAP);

        expect(TokenBank.withdraw('fixture_producer').usesRemaining).toBe(FOREST_CAP);
    });

    it('falls through to the partial once the full ones are gone', () => {
        bank('fixture_producer', 900);
        bank('fixture_producer', FOREST_CAP);

        TokenBank.withdraw('fixture_producer');
        expect(TokenBank.withdraw('fixture_producer').usesRemaining).toBe(900);
    });
});

describe('Unlimited-use Tokens never merge (D-176)', () => {
    it('leaves an unlimited copy alone beside finite ones', () => {
        // `null` and `0` are opposites, not neighbours. Pooling an unlimited
        // Token's charges into a finite pile would silently destroy the thing
        // that made it unlimited.
        bank('fixture_buff_unique', null);
        bank('fixture_buff_unique', null);

        const copies = BoardState.tokenBankCopies('fixture_buff_unique');
        expect(copies).toHaveLength(2);
        expect(copies.every(c => c.usesRemaining == null)).toBe(true);
    });

    it('treats an unlimited Token as the fullest possible on withdrawal', () => {
        bank('fixture_buff_unique', null);
        expect(TokenBank.withdraw('fixture_buff_unique').usesRemaining).toBeNull();
    });
});
