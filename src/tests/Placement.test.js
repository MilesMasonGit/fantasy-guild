import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Flags from '../systems/board/Flags.js';
import { GUILD_HALL_TILE, TILE_COUNT } from '../config/boardGeometry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { idAt, pointAt, tileCentre } from './fixtures/mat.js';

/**
 * Placement and displacement — D-134, D-143, D-147, plus the forfeited-cycle
 * rule (D-54 / D-131).
 *
 * These are pure-logic rules with no engine behind them, which makes them cheap
 * to pin and unusually worth pinning: on a branch with no feature flag there is
 * no flag-off build to compare against, so board tests are the only thing that
 * will catch collateral damage.
 *
 * ## Under flags (Free Playmat slice 1.4b)
 * Dropping a hero plants their flag, and the flag claims the nearest Token the
 * hero can run. Heroes are never displaced any more: one hero per Token is a
 * claim (FP-25), a moved Token carries its hero and progress (FP-68), and a
 * Token leaving the board just ends the claim. The heroes here hold every
 * skill, because a hero only works a Token whose skill they hold (FP-48).
 *
 * ⚠️ Tile 0 is a valid index and is falsy. Several tests exist only to stop a
 * truthiness check creeping into placement.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

function makeHero(id, skillIds = getAllSkillIds()) {
    const skills = {};
    for (const s of skillIds) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
});

describe('Placing a Token', () => {
    it('puts a Token on an empty tile', () => {
        expect(Placement.placeToken(9, token('fixture_producer')).success).toBe(true);
        expect(BoardState.getToken(9).typeId).toBe('fixture_producer');
    });

    it('places on tile 0 — the falsy corner', () => {
        expect(Placement.placeToken(0, token('fixture_producer')).success).toBe(true);
        expect(BoardState.getToken(0).typeId).toBe('fixture_producer');
        expect(BoardState.hasToken(0)).toBe(true);
    });

    it('places on the Guild Hall tile (a standard placeable tile)', () => {
        const result = Placement.placeToken(GUILD_HALL_TILE, token('fixture_producer'));
        expect(result.success).toBe(true);
        expect(BoardState.getToken(GUILD_HALL_TILE).typeId).toBe('fixture_producer');
    });

    it('refuses an index off the board', () => {
        expect(Placement.placeToken(-1, token('t')).success).toBe(false);
        expect(Placement.placeToken(TILE_COUNT, token('t')).success).toBe(false);
    });
});

describe('Displacement — the incoming thing wins (D-134)', () => {
    it('pushes the old Token to an adjacent free cell when available', () => {
        Placement.placeToken(9, token('fixture_producer', 42));
        const result = Placement.placeToken(9, token('fixture_buff_yield'));

        expect(result.success).toBe(true);
        expect(BoardState.getToken(9).typeId).toBe('fixture_buff_yield');
        // Pushed to primary quadrant cell (tile 3)
        expect(BoardState.getToken(3).typeId).toBe('fixture_producer');
        expect(BoardState.getToken(3).usesRemaining).toBe(42);
    });

    it('shoves the old Token to the Tray when all adjacent push directions are blocked', () => {
        // Tile 0 (corner): block remaining in-bounds directions (tiles 1 and 6)
        Placement.placeToken(1, token('fixture_blocker'));
        Placement.placeToken(6, token('fixture_blocker'));
        Placement.placeToken(0, token('fixture_producer', 42));
        const result = Placement.placeToken(0, token('fixture_buff_yield'));

        expect(result.success).toBe(true);
        expect(BoardState.getToken(0).typeId).toBe('fixture_buff_yield');
        expect(result.displacedToken.typeId).toBe('fixture_producer');

        // Nothing is ever lost to displacement — it is in the Tray, intact.
        const tray = BoardState.getTray();
        expect(tray).toHaveLength(1);
        expect(tray[0].typeId).toBe('fixture_producer');
        expect(tray[0].usesRemaining).toBe(42);
    });

    it('moves a working hero along with the pushed Token', () => {
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);
        expect(BoardState.workTileOf('hero_1')).toBe(9);

        const result = Placement.placeToken(9, token('fixture_buff_yield'));

        expect(result.success).toBe(true);
        // Hero stayed with pushed token at tile 3 — the claim follows the instance
        expect(BoardState.workTileOf('hero_1')).toBe(3);
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('a working hero keeps their flag when their Token goes to the Tray, and stops working it', () => {
        // Corner tile 0: block remaining in-bounds directions (tiles 1 and 6)
        Placement.placeToken(1, token('fixture_blocker'));
        Placement.placeToken(6, token('fixture_blocker'));
        Placement.placeToken(0, token('fixture_producer'));
        Placement.placeHero('hero_1', 0);
        expect(BoardState.workTileOf('hero_1')).toBe(0);

        const result = Placement.placeToken(0, token('fixture_buff_yield'));
        Flags.assign(0);

        // Nobody is sent to the Dock any more (1.4b): the flag stays, and with
        // nothing workable in range the hero idles at it.
        expect(result.displacedHeroId).toBeUndefined();
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
        expect(BoardState.workTileOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(tileCentre(0));
    });

    it('does NOT hand the displaced hero to the arriving Token', () => {
        // The player chose where that person works. Silently reassigning them
        // to whatever landed would take the choice away (grid concept §3.6).
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);

        Placement.placeToken(9, token('fixture_buff_yield'));

        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('refuses the placement outright when no cell is free and the Tray is full, losing nothing', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('filler'));
        }
        // Corner tile 0: block remaining in-bounds directions (tiles 1 and 6)
        Placement.placeToken(1, token('fixture_blocker'));
        Placement.placeToken(6, token('fixture_blocker'));
        Placement.placeToken(0, token('fixture_producer'));
        Placement.placeHero('hero_1', 0);

        const result = Placement.placeToken(0, token('fixture_buff_yield'));

        expect(result.success).toBe(false);
        // The board is exactly as it was — Token and hero both still there.
        expect(BoardState.getToken(0).typeId).toBe('fixture_producer');
        expect(BoardState.workerOf(idAt(0))).toBe('hero_1');
    });
});

describe('Forfeited cycles (D-54, D-131)', () => {
    it('a displaced Token loses its in-flight cycle', () => {
        const forest = token('fixture_producer');
        Placement.placeToken(9, forest);
        forest.cycleElapsedMs = 5000;

        Placement.placeToken(9, token('fixture_buff_yield'));

        expect(BoardState.getToken(3).cycleElapsedMs).toBe(0);
    });

    it('⭐ a moved Token KEEPS its in-flight cycle (FP-68)', () => {
        const forest = token('fixture_producer');
        Placement.placeToken(9, forest);
        forest.cycleElapsedMs = 5000;

        Placement.moveToken(9, 11);

        expect(BoardState.getToken(11).cycleElapsedMs).toBe(5000);
    });

    it('pulling a hero off forfeits that tile’s cycle', () => {
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);
        BoardState.getToken(9).cycleElapsedMs = 7000;

        Placement.recallHero(9);

        expect(BoardState.getToken(9).cycleElapsedMs).toBe(0);
    });

    it('moving a hero forfeits the cycle they abandon', () => {
        Placement.placeToken(9, token('fixture_producer'));
        // Far enough from tile 9 (800 u) that the new flag cannot choose it again.
        Placement.placeToken(30, token('fixture_buff_yield'));
        Placement.placeHero('hero_1', 9);
        BoardState.getToken(9).cycleElapsedMs = 7000;

        Placement.placeHero('hero_1', 30);

        expect(BoardState.getToken(9).cycleElapsedMs).toBe(0);
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });
});

describe('Moving a Token', () => {
    it('moves it and clears the old tile', () => {
        Placement.placeToken(9, token('fixture_producer'));
        expect(Placement.moveToken(9, 20).success).toBe(true);
        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getToken(20).typeId).toBe('fixture_producer');
    });

    it('⭐ carries its hero along (FP-68)', () => {
        // "A moved token keeps its progress. It brings the Hero with it, and it
        // stays on the token even if outside of the flag radius." (owner)
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);

        const result = Placement.moveToken(9, 20);

        expect(result.success).toBe(true);
        expect(BoardState.workerOf(idAt(20))).toBe('hero_1');
        expect(BoardState.workTileOf('hero_1')).toBe(20);
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('rolls back completely if the destination refuses', () => {
        Placement.placeToken(9, token('fixture_producer'));
        const result = Placement.moveToken(9, 999);

        expect(result.success).toBe(false);
        expect(BoardState.getToken(9).typeId).toBe('fixture_producer');   // never left
    });

    it('can move the Guild Hall token between tiles', () => {
        Placement.placeToken(9, token('token_guild_hall'));
        expect(Placement.moveToken(9, 20).success).toBe(true);
        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getToken(20).typeId).toBe('token_guild_hall');
    });
});

describe('Placing a hero (D-111, D-147)', () => {
    it('puts a hero on a Token', () => {
        Placement.placeToken(9, token('fixture_producer'));
        expect(Placement.placeHero('hero_1', 9).success).toBe(true);
        expect(BoardState.workerOf(idAt(9))).toBe('hero_1');
    });

    it('one hero per Token: a second hero dropped there does not take it (FP-25)', () => {
        Placement.placeToken(9, token('fixture_producer'));
        const first = BoardState.getToken(9);
        Placement.placeHero('hero_1', 9);

        const result = Placement.placeHero('hero_2', 9);

        expect(result.success).toBe(true);
        expect(BoardState.workerOf(idAt(9))).toBe('hero_1');
        expect(BoardState.workTileOf('hero_2')).toBeNull();
        expect(Flags.skipsOf(first.id)).toContainEqual({ heroId: 'hero_2', reason: Flags.SKIP.CLAIMED });
    });

    it('moves tile-to-tile directly, without a trip through the Dock', () => {
        // The game's most frequent action must cost one drag, not two.
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeToken(20, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);

        Placement.placeHero('hero_1', 20);

        expect(BoardState.workTileOf('hero_1')).toBe(20);
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('never leaves a hero on two tiles at once', () => {
        Placement.placeToken(9, token('a'));
        Placement.placeToken(20, token('b'));
        Placement.placeToken(30, token('c'));
        Placement.placeHero('hero_1', 9);
        Placement.placeHero('hero_1', 20);
        Placement.placeHero('hero_1', 30);

        const standing = BoardState.heroesOnBoard()
            .filter(([heroId]) => heroId === 'hero_1');
        expect(standing).toHaveLength(1);
        expect(standing[0][1]).toEqual(tileCentre(30));   // a display point since slice 1.6c
    });

    it('allows planting on an empty tile, where they simply do nothing (D-57)', () => {
        const result = Placement.placeHero('hero_1', 9);
        expect(result.success).toBe(true);
        // They are genuinely THERE and genuinely doing nothing — two different
        // facts. An empty tile and the Dock are not the same place.
        expect(result.workedTile).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(tileCentre(9));
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('a Token placed under a planted flag is worked without re-placing them', () => {
        // The same courtesy a Manager extends (D-151), arrived at from the
        // player's side: drop a Forest under a flag and its hero starts on it.
        GameState.state.heroes = [makeHero('hero_1', ['logging'])];
        Placement.placeHero('hero_1', 9);
        Placement.placeToken(9, token('fixture_producer'));
        Flags.assign(1000);

        expect(BoardState.workTileOf('hero_1')).toBe(9);
        expect(BoardState.workerOf(idAt(9))).toBe('hero_1');
    });

    it('plants a hero on the Guild Hall token', () => {
        Placement.placeToken(GUILD_HALL_TILE, token('token_guild_hall'));
        expect(Placement.placeHero('hero_1', GUILD_HALL_TILE).success).toBe(true);
        // A Hall with no Wishing Well rank has no work cycle: the flag stands
        // there with nothing to claim.
        expect(BoardState.displayPointOf('hero_1')).toEqual(pointAt(GUILD_HALL_TILE, 'token_guild_hall'));
    });

    it('placing a hero where they already are is a no-op, not a forfeit', () => {
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);
        BoardState.getToken(9).cycleElapsedMs = 4000;

        Placement.placeHero('hero_1', 9);

        expect(BoardState.getToken(9).cycleElapsedMs).toBe(4000);
        expect(BoardState.workerOf(idAt(9))).toBe('hero_1');
    });

    it('works on tile 0', () => {
        Placement.placeToken(0, token('fixture_producer'));
        Placement.placeHero('hero_1', 0);
        expect(BoardState.workTileOf('hero_1')).toBe(0);
        expect(BoardState.workerOf(idAt(0))).toBe('hero_1');
    });
});

describe('Recalling a hero', () => {
    it('returns them to the Dock', () => {
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);

        expect(Placement.recallHero(9).heroId).toBe('hero_1');
        expect(BoardState.flagOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toBeNull();
        expect(BoardState.getToken(9).typeId).toBe('fixture_producer');   // Token stays
    });

    it('recallHeroById finds them wherever they are', () => {
        Placement.placeToken(35, token('fixture_producer'));
        Placement.placeHero('hero_1', 35);

        expect(Placement.recallHeroById('hero_1').success).toBe(true);
        expect(BoardState.flagOf('hero_1')).toBeNull();
        expect(BoardState.workTileOf('hero_1')).toBeNull();
    });

    it('recallHeroById on a hero already in the Dock succeeds quietly', () => {
        // Defeat calls this without knowing where the hero is; making the
        // no-op case an error would push that check outward.
        expect(Placement.recallHeroById('hero_nobody').success).toBe(true);
    });
});

describe('Returning a Token to the Tray', () => {
    it('lifts it off the board and frees the tile', () => {
        Placement.placeToken(9, token('fixture_producer'));
        expect(Placement.returnTokenToTray(9).success).toBe(true);
        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTray()[0].typeId).toBe('fixture_producer');
    });

    it('leaves the hero’s flag standing there, idle', () => {
        // Lifting a Token is a statement about the Token. Scattering the
        // workforce back to the Dock every time a tile is rearranged would make
        // reorganising expensive in exactly the way D-54 says it must not be.
        // `recallHero` is how a hero goes to the Dock.
        Placement.placeToken(9, token('fixture_producer'));
        Placement.placeHero('hero_1', 9);

        const result = Placement.returnTokenToTray(9);
        Flags.assign(0);

        expect(result.idledHeroId).toBe('hero_1');
        expect(BoardState.displayPointOf('hero_1')).toEqual(tileCentre(9));
        expect(BoardState.workTileOf('hero_1')).toBeNull();
    });

    it('refuses to remove the Guild Hall token from the playmat', () => {
        Placement.placeToken(9, token('token_guild_hall'));
        expect(Placement.returnTokenToTray(9).success).toBe(false);
    });
});

describe('The Token Bank (D-137, D-77)', () => {
    it('caps distinct types, never copies', () => {
        // Stacks are never capped: a hundred Forests is one slot.
        for (let i = 0; i < 100; i++) BoardState.addToTokenBank(token('fixture_producer'), 2);
        expect(BoardState.tokenBankSlotsUsed()).toBe(1);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(100);
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
        BoardState.addToTokenBank(token('fixture_producer', 12));
        BoardState.addToTokenBank(token('fixture_producer', 5000));
        BoardState.addToTokenBank(token('fixture_producer', 300));

        expect(BoardState.takeFromTokenBank('fixture_producer').usesRemaining).toBe(5000);
        expect(BoardState.takeFromTokenBank('fixture_producer').usesRemaining).toBe(300);
        expect(BoardState.takeFromTokenBank('fixture_producer').usesRemaining).toBe(12);
    });

    it('treats an unlimited-use Token as the fullest possible', () => {
        // null means unlimited (D-176), and must never sort as "less than 12".
        BoardState.addToTokenBank(token('fixture_producer', 12));
        BoardState.addToTokenBank(token('fixture_producer', null));
        expect(BoardState.takeFromTokenBank('fixture_producer').usesRemaining).toBeNull();
    });

    it('frees the slot when the last copy leaves', () => {
        BoardState.addToTokenBank(token('fixture_producer', 10));
        BoardState.takeFromTokenBank('fixture_producer');
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
        Placement.placeToken(9, token('b'));

        expect(BoardState.occupiedTiles().map(([i]) => i)).toEqual([0, 9, 30]);
    });

    it('counts 49 empty tiles on a fresh board', () => {
        expect(BoardState.emptyTiles()).toHaveLength(TILE_COUNT);
        expect(BoardState.emptyTiles()).toContain(GUILD_HALL_TILE);
    });
});

describe('Returning a Token to the Vault (Placement.returnTokenToVault)', () => {
    it('deposits the Token into the Vault and clears it from the tile without duplicating', () => {
        Placement.placeToken(9, token('fixture_producer', 5000));
        expect(BoardState.hasToken(9)).toBe(true);

        const result = Placement.returnTokenToVault(9);
        expect(result.success).toBe(true);
        expect(BoardState.hasToken(9)).toBe(false);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('refuses if there is no room in the Vault and leaves Token on board', () => {
        // Fill bank slots
        for (let i = 0; i < TokenBank.BASE_TOKEN_BANK_SLOTS; i++) {
            BoardState.addToTokenBank(token(`dummy_${i}`, 100), TokenBank.BASE_TOKEN_BANK_SLOTS);
        }
        Placement.placeToken(9, token('fixture_producer', 5000));

        const result = Placement.returnTokenToVault(9);
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/no room/i);
        expect(BoardState.hasToken(9)).toBe(true);
    });
});

describe('Passive vs Active Token Hero Constraints', () => {
    it('a hero may be dropped on a passive token, but never works it (1.4b)', () => {
        // The drop used to be refused. Under flags it just plants the flag;
        // a Token that needs no hero is never a candidate.
        Placement.placeToken(9, token('fixture_pickaxe_t1'));

        const result = Placement.placeHero('hero_1', 9);
        expect(result.success).toBe(true);
        expect(BoardState.workerOf(idAt(9))).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(tileCentre(9));
    });

    it('a passive token placed on a planted flag leaves the flag where it is', () => {
        Placement.placeHero('hero_1', 9);
        expect(BoardState.displayPointOf('hero_1')).toEqual(tileCentre(9));

        const result = Placement.placeToken(9, token('fixture_pickaxe_t1'));
        expect(result.success).toBe(true);
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
        expect(BoardState.workerOf(idAt(9))).toBeNull();
    });

    it('allows placing a hero on an active token (requiresHero === true)', () => {
        Placement.placeToken(9, token('fixture_producer'));

        const result = Placement.placeHero('hero_1', 9);
        expect(result.success).toBe(true);
        expect(BoardState.workTileOf('hero_1')).toBe(9);
    });
});
