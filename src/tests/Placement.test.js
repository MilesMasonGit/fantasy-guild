import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { GUILD_HALL_TILE, TILE_COUNT } from '../ui/components/board/boardConstants.js';

/**
 * Placement and displacement — D-134, D-143, D-147, plus the forfeited-cycle
 * rule (D-54 / D-131).
 *
 * These are pure-logic rules with no engine behind them, which makes them cheap
 * to pin and unusually worth pinning: on a branch with no feature flag there is
 * no flag-off build to compare against, so board tests are the only thing that
 * will catch collateral damage.
 *
 * ⚠️ Tile 0 is a valid index and is falsy. Several tests exist only to stop a
 * truthiness check creeping into placement.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

beforeEach(() => {
    GameState.initNew();
});

describe('Placing a Token', () => {
    it('puts a Token on an empty tile', () => {
        expect(Placement.placeToken(10, token('token_forest')).success).toBe(true);
        expect(BoardState.getToken(10).typeId).toBe('token_forest');
    });

    it('places on tile 0 — the falsy corner', () => {
        expect(Placement.placeToken(0, token('token_forest')).success).toBe(true);
        expect(BoardState.getToken(0).typeId).toBe('token_forest');
        expect(BoardState.hasToken(0)).toBe(true);
    });

    it('refuses the Guild Hall (D-106)', () => {
        const result = Placement.placeToken(GUILD_HALL_TILE, token('token_forest'));
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/guild hall/i);
        expect(BoardState.getToken(GUILD_HALL_TILE)).toBeNull();
    });

    it('refuses an index off the board', () => {
        expect(Placement.placeToken(-1, token('t')).success).toBe(false);
        expect(Placement.placeToken(TILE_COUNT, token('t')).success).toBe(false);
    });
});

describe('Displacement — the incoming thing wins (D-134)', () => {
    it('shoves the old Token to the Tray rather than destroying it', () => {
        Placement.placeToken(10, token('token_forest', 42));
        const result = Placement.placeToken(10, token('token_sawmill'));

        expect(result.success).toBe(true);
        expect(BoardState.getToken(10).typeId).toBe('token_sawmill');
        expect(result.displacedToken.typeId).toBe('token_forest');

        // Nothing is ever lost to displacement — it is in the Tray, intact.
        const tray = BoardState.getTray();
        expect(tray).toHaveLength(1);
        expect(tray[0].typeId).toBe('token_forest');
        expect(tray[0].usesRemaining).toBe(42);
    });

    it('knocks a working hero back to the Dock (D-143)', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);
        expect(BoardState.tileOfHero('hero_1')).toBe(10);

        const result = Placement.placeToken(10, token('token_sawmill'));

        expect(result.displacedHeroId).toBe('hero_1');
        // The Dock is "not on any tile" — there is no second list to check.
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('does NOT hand the displaced hero to the arriving Token', () => {
        // The player chose where that person works. Silently reassigning them
        // to whatever landed would take the choice away (grid concept §3.6).
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        Placement.placeToken(10, token('token_sawmill'));

        expect(BoardState.getToken(10).heroId).toBeNull();
    });

    it('refuses the placement outright when the Tray is full, losing nothing', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('filler'));
        }
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        const result = Placement.placeToken(10, token('token_sawmill'));

        expect(result.success).toBe(false);
        // The board is exactly as it was — Token and hero both still there.
        expect(BoardState.getToken(10).typeId).toBe('token_forest');
        expect(BoardState.getToken(10).heroId).toBe('hero_1');
    });
});

describe('Forfeited cycles (D-54, D-131)', () => {
    it('a displaced Token loses its in-flight cycle', () => {
        const forest = token('token_forest');
        Placement.placeToken(10, forest);
        forest.cycleElapsedMs = 5000;

        Placement.placeToken(10, token('token_sawmill'));

        expect(BoardState.getTray()[0].cycleElapsedMs).toBe(0);
    });

    it('a moved Token loses its in-flight cycle', () => {
        const forest = token('token_forest');
        Placement.placeToken(10, forest);
        forest.cycleElapsedMs = 5000;

        Placement.moveToken(10, 11);

        expect(BoardState.getToken(11).cycleElapsedMs).toBe(0);
    });

    it('pulling a hero off forfeits that tile’s cycle', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);
        BoardState.getToken(10).cycleElapsedMs = 7000;

        Placement.recallHero(10);

        expect(BoardState.getToken(10).cycleElapsedMs).toBe(0);
    });

    it('moving a hero forfeits the cycle they abandon', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeToken(11, token('token_sawmill'));
        Placement.placeHero('hero_1', 10);
        BoardState.getToken(10).cycleElapsedMs = 7000;

        Placement.placeHero('hero_1', 11);

        expect(BoardState.getToken(10).cycleElapsedMs).toBe(0);
        expect(BoardState.getToken(10).heroId).toBeNull();
    });
});

describe('Moving a Token', () => {
    it('moves it and clears the old tile', () => {
        Placement.placeToken(10, token('token_forest'));
        expect(Placement.moveToken(10, 20).success).toBe(true);
        expect(BoardState.getToken(10)).toBeNull();
        expect(BoardState.getToken(20).typeId).toBe('token_forest');
    });

    it('leaves the hero behind rather than dragging them along', () => {
        // Moving a Token says nothing about where its worker should be.
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        const result = Placement.moveToken(10, 20);

        expect(result.heroLeftBehind).toBe('hero_1');
        expect(BoardState.getToken(20).heroId).toBeNull();
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('rolls back completely if the destination refuses', () => {
        Placement.placeToken(10, token('token_forest'));
        const result = Placement.moveToken(10, GUILD_HALL_TILE);

        expect(result.success).toBe(false);
        expect(BoardState.getToken(10).typeId).toBe('token_forest');   // never left
        expect(BoardState.getToken(GUILD_HALL_TILE)).toBeNull();
    });

    it('refuses to move the Guild Hall itself', () => {
        expect(Placement.moveToken(GUILD_HALL_TILE, 10).success).toBe(false);
    });
});

describe('Placing a hero (D-111, D-147)', () => {
    it('puts a hero on a Token', () => {
        Placement.placeToken(10, token('token_forest'));
        expect(Placement.placeHero('hero_1', 10).success).toBe(true);
        expect(BoardState.heroOnTile(10)).toBe('hero_1');
    });

    it('knocks the occupant to the Dock — one hero per Token, always', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        const result = Placement.placeHero('hero_2', 10);

        expect(result.displacedHeroId).toBe('hero_1');
        expect(BoardState.heroOnTile(10)).toBe('hero_2');
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('moves tile-to-tile directly, without a trip through the Dock', () => {
        // The game's most frequent action must cost one drag, not two.
        Placement.placeToken(10, token('token_forest'));
        Placement.placeToken(20, token('token_sawmill'));
        Placement.placeHero('hero_1', 10);

        Placement.placeHero('hero_1', 20);

        expect(BoardState.tileOfHero('hero_1')).toBe(20);
        expect(BoardState.heroOnTile(10)).toBeNull();
    });

    it('never leaves a hero on two tiles at once', () => {
        Placement.placeToken(10, token('a'));
        Placement.placeToken(20, token('b'));
        Placement.placeToken(30, token('c'));
        Placement.placeHero('hero_1', 10);
        Placement.placeHero('hero_1', 20);
        Placement.placeHero('hero_1', 30);

        const occupied = BoardState.occupiedTiles()
            .filter(([, inst]) => inst.heroId === 'hero_1');
        expect(occupied).toHaveLength(1);
        expect(occupied[0][0]).toBe(30);
    });

    it('allows standing on an empty tile, where they simply do nothing (D-57)', () => {
        const result = Placement.placeHero('hero_1', 10);
        expect(result.success).toBe(true);
        expect(result.workedTile).toBeNull();
        // No Token means no state to hold them — the Dock and an empty tile are
        // the same thing as far as the board is concerned.
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('refuses the Guild Hall — nobody works it (D-106)', () => {
        expect(Placement.placeHero('hero_1', GUILD_HALL_TILE).success).toBe(false);
    });

    it('placing a hero where they already are is a no-op, not a forfeit', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);
        BoardState.getToken(10).cycleElapsedMs = 4000;

        Placement.placeHero('hero_1', 10);

        expect(BoardState.getToken(10).cycleElapsedMs).toBe(4000);
        expect(BoardState.heroOnTile(10)).toBe('hero_1');
    });

    it('works on tile 0', () => {
        Placement.placeToken(0, token('token_forest'));
        Placement.placeHero('hero_1', 0);
        expect(BoardState.tileOfHero('hero_1')).toBe(0);
        expect(BoardState.heroOnTile(0)).toBe('hero_1');
    });
});

describe('Recalling a hero', () => {
    it('returns them to the Dock', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        expect(Placement.recallHero(10).heroId).toBe('hero_1');
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
        expect(BoardState.getToken(10).typeId).toBe('token_forest');   // Token stays
    });

    it('recallHeroById finds them wherever they are', () => {
        Placement.placeToken(37, token('token_forest'));
        Placement.placeHero('hero_1', 37);

        expect(Placement.recallHeroById('hero_1').success).toBe(true);
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('recallHeroById on a hero already in the Dock succeeds quietly', () => {
        // Retirement and defeat both call this without knowing where the hero
        // is; making the no-op case an error would push that check outward.
        expect(Placement.recallHeroById('hero_nobody').success).toBe(true);
    });
});

describe('Returning a Token to the Tray', () => {
    it('lifts it off the board and frees the tile', () => {
        Placement.placeToken(10, token('token_forest'));
        expect(Placement.returnTokenToTray(10).success).toBe(true);
        expect(BoardState.getToken(10)).toBeNull();
        expect(BoardState.getTray()[0].typeId).toBe('token_forest');
    });

    it('sends any hero on it back to the Dock', () => {
        Placement.placeToken(10, token('token_forest'));
        Placement.placeHero('hero_1', 10);

        const result = Placement.returnTokenToTray(10);

        expect(result.displacedHeroId).toBe('hero_1');
        expect(BoardState.tileOfHero('hero_1')).toBeNull();
    });

    it('refuses to remove the Guild Hall', () => {
        expect(Placement.returnTokenToTray(GUILD_HALL_TILE).success).toBe(false);
    });
});

describe('The Token Bank (D-137, D-77)', () => {
    it('caps distinct types, never copies', () => {
        // Stacks are never capped: a hundred Forests is one slot.
        for (let i = 0; i < 100; i++) BoardState.addToTokenBank(token('token_forest'), 2);
        expect(BoardState.tokenBankSlotsUsed()).toBe(1);
        expect(BoardState.tokenBankCopies('token_forest')).toHaveLength(100);
    });

    it('refuses a NEW type at the slot cap but still accepts a held one', () => {
        BoardState.addToTokenBank(token('a'), 2);
        BoardState.addToTokenBank(token('b'), 2);
        expect(BoardState.addToTokenBank(token('c'), 2)).toBe(false);
        expect(BoardState.addToTokenBank(token('a'), 2)).toBe(true);
    });

    it('draws a FULL Token before a partial one (D-77)', () => {
        // A player must never be handed a nearly-spent Token while a fresh one
        // sits in storage.
        BoardState.addToTokenBank(token('token_forest', 12));
        BoardState.addToTokenBank(token('token_forest', 5000));
        BoardState.addToTokenBank(token('token_forest', 300));

        expect(BoardState.takeFromTokenBank('token_forest').usesRemaining).toBe(5000);
        expect(BoardState.takeFromTokenBank('token_forest').usesRemaining).toBe(300);
        expect(BoardState.takeFromTokenBank('token_forest').usesRemaining).toBe(12);
    });

    it('treats an unlimited-use Token as the fullest possible', () => {
        // null means unlimited (D-176), and must never sort as "less than 12".
        BoardState.addToTokenBank(token('token_forest', 12));
        BoardState.addToTokenBank(token('token_forest', null));
        expect(BoardState.takeFromTokenBank('token_forest').usesRemaining).toBeNull();
    });

    it('frees the slot when the last copy leaves', () => {
        BoardState.addToTokenBank(token('token_forest', 10));
        BoardState.takeFromTokenBank('token_forest');
        expect(BoardState.tokenBankSlotsUsed()).toBe(0);
    });

    it('returns null for a type it does not hold', () => {
        expect(BoardState.takeFromTokenBank('token_nothing')).toBeNull();
    });
});

describe('Board queries', () => {
    it('lists occupied tiles in index order, sparsely', () => {
        Placement.placeToken(30, token('c'));
        Placement.placeToken(0, token('a'));
        Placement.placeToken(10, token('b'));

        expect(BoardState.occupiedTiles().map(([i]) => i)).toEqual([0, 10, 30]);
    });

    it('counts 48 empty tiles on a fresh board — the Guild Hall is not one', () => {
        expect(BoardState.emptyTiles()).toHaveLength(TILE_COUNT - 1);
        expect(BoardState.emptyTiles()).not.toContain(GUILD_HALL_TILE);
    });
});
