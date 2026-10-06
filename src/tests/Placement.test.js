import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * Placement — plus the forfeited-cycle rule.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

/**
 * The scene, in mat units. `A` and `B` are a legal gap apart (160 u, well over
 * the 61.2 u two small Tokens need); `FAR` is far enough that a flag planted at
 * one cannot see the other; `CORNER` is the closest a 1×1 Token's art may sit to
 * the mat's top-left and still be fully on it.
 */
const A = { x: 400, y: 300 };
const B = { x: 560, y: 300 };
const FAR = { x: 1400, y: 900 };
const CORNER = { x: 64, y: 64 };

/** Put a Token down at a point and hand back the instance now on the mat. */
function place(typeId, point, uses = 100) {
    const instance = token(typeId, uses);
    const result = Placement.placeTokenAt(instance, point);
    expect(result.success).toBe(true);
    return instance;
}

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
    it('puts a Token on an empty spot, exactly where it was let go', () => {
        const instance = place('fixture_producer', A);
        const landed = BoardState.getTokenById(instance.id);
        expect(landed.typeId).toBe('fixture_producer');
        expect({ x: landed.x, y: landed.y }).toEqual(A);
    });

    it('places against the mat’s corner, with the art still fully on the mat', () => {
        const instance = place('fixture_producer', CORNER);
        expect({ x: instance.x, y: instance.y }).toEqual(CORNER);
    });

    it('refuses a Token with no point to land on', () => {
        expect(Placement.placeTokenAt(token('fixture_producer'), null).success).toBe(false);
        expect(Placement.placeTokenAt(token('fixture_producer'), { x: NaN, y: 0 }).success).toBe(false);
    });

    it('refuses something that is not a Token', () => {
        expect(Placement.placeTokenAt({}, A).success).toBe(false);
    });
});

/**
 * ⭐ **Nothing is displaced any more** (Free Playmat slice 1.6d-1).
 *
 * There are no tiles, so the question is gone with them: a Token dropped where
 * there is no room moves **itself** to the nearest spot that fits. The
 * arrangement the player built is never rearranged behind their back, nothing is
 * bumped to the Tray, and no hero is parted from their work by someone else's
 * drop.
 */
describe('⭐ Nothing is displaced any more (slice 1.6d-1)', () => {
    it('a Token dropped on an occupied spot moves ITSELF clear', () => {
        const sitting = place('fixture_producer', A, 42);

        const incoming = token('fixture_buff_yield');
        const result = Placement.placeTokenAt(incoming, A);

        expect(result.success).toBe(true);
        // The Token already down has not moved and has not lost a charge.
        const stayed = BoardState.getTokenById(sitting.id);
        expect({ x: stayed.x, y: stayed.y }).toEqual(A);
        expect(stayed.usesRemaining).toBe(42);
        // The newcomer is on the mat, standing clear.
        const landed = BoardState.getTokenById(incoming.id);
        expect(landed).not.toBeNull();
        expect(Math.hypot(landed.x - A.x, landed.y - A.y)).toBeGreaterThanOrEqual(61.2 - 1e-6);
    });

    it('nothing is ever bumped to the Tray by a drop', () => {
        place('fixture_producer', A, 42);

        const result = Placement.placeTokenAt(token('fixture_buff_yield'), A);

        expect(result.success).toBe(true);
        expect(result.displacedToken).toBeNull();
    });

    it('a working hero keeps the Token they were on when something lands beside it', () => {
        const worked = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);
        expect(BoardState.workerOf(worked.id)).toBe('hero_1');

        const result = Placement.placeTokenAt(token('fixture_buff_yield'), A);

        expect(result.success).toBe(true);
        // Their Token never moved, so neither did they.
        expect(BoardState.workerOf(worked.id)).toBe('hero_1');
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
    });
});

describe('Forfeited cycles (D-54, D-131)', () => {
    it('a Token already down keeps its cycle when something lands beside it', () => {
        const forest = place('fixture_producer', A);
        forest.cycleElapsedMs = 5000;

        Placement.placeTokenAt(token('fixture_buff_yield'), A);

        // It was not touched, so there was nothing to forfeit.
        expect(BoardState.getTokenById(forest.id).cycleElapsedMs).toBe(5000);
    });

    it('a Token arriving on the mat starts with no cycle progress', () => {
        const arriving = token('fixture_producer');
        arriving.cycleElapsedMs = 5000;

        Placement.placeTokenAt(arriving, A);

        expect(BoardState.getTokenById(arriving.id).cycleElapsedMs).toBe(0);
    });

    it('⭐ a moved Token KEEPS its in-flight cycle (FP-68)', () => {
        const forest = place('fixture_producer', A);
        forest.cycleElapsedMs = 5000;

        Placement.moveTokenTo(forest.id, B);

        const moved = BoardState.getTokenById(forest.id);
        expect({ x: moved.x, y: moved.y }).toEqual(B);
        expect(moved.cycleElapsedMs).toBe(5000);
    });

    it('pulling a hero off forfeits that Token’s cycle', () => {
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);
        BoardState.getTokenById(forest.id).cycleElapsedMs = 7000;

        Placement.recallHeroById('hero_1');

        expect(BoardState.getTokenById(forest.id).cycleElapsedMs).toBe(0);
    });

    it('moving a hero forfeits the cycle they abandon', () => {
        const forest = place('fixture_producer', A);
        // Far enough from A that the new flag cannot choose it again.
        place('fixture_buff_yield', FAR);
        Placement.plantFlagAt('hero_1', A);
        BoardState.getTokenById(forest.id).cycleElapsedMs = 7000;

        Placement.plantFlagAt('hero_1', FAR);

        expect(BoardState.getTokenById(forest.id).cycleElapsedMs).toBe(0);
        expect(BoardState.workerOf(forest.id)).toBeNull();
    });
});

describe('Moving a Token', () => {
    it('moves it, and nothing is left behind at the old point', () => {
        const forest = place('fixture_producer', A);

        expect(Placement.moveTokenTo(forest.id, B).success).toBe(true);

        expect(BoardState.tokensAtPoint(A.x, A.y)).toHaveLength(0);
        const moved = BoardState.getTokenById(forest.id);
        expect(moved.typeId).toBe('fixture_producer');
        expect({ x: moved.x, y: moved.y }).toEqual(B);
    });

    it('⭐ carries its hero along (FP-68)', () => {
        // "A moved token keeps its progress. It brings the Hero with it, and it
        // stays on the token even if outside of the flag radius." (owner)
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);

        const result = Placement.moveTokenTo(forest.id, FAR);

        expect(result.success).toBe(true);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');
        expect(BoardState.workTokenOf('hero_1')).toBe(forest.id);
    });

    it('rolls back completely if the destination is not a point', () => {
        const forest = place('fixture_producer', A);

        const result = Placement.moveTokenTo(forest.id, null);

        expect(result.success).toBe(false);
        const stayed = BoardState.getTokenById(forest.id);   // never left
        expect({ x: stayed.x, y: stayed.y }).toEqual(A);
    });

    it('refuses to move a Token that is not on the mat', () => {
        expect(Placement.moveTokenTo('tok_nobody', A).success).toBe(false);
    });

    it('can move the Guild Hall token around the mat', () => {
        const hall = place('token_guild_hall', A);

        expect(Placement.moveTokenTo(hall.id, B).success).toBe(true);

        const moved = BoardState.getTokenById(hall.id);
        expect(moved.typeId).toBe('token_guild_hall');
        expect({ x: moved.x, y: moved.y }).toEqual(B);
    });
});

describe('Planting a hero’s flag (D-111, D-147)', () => {
    it('puts a hero on a Token', () => {
        const forest = place('fixture_producer', A);
        expect(Placement.plantFlagAt('hero_1', A).success).toBe(true);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');
    });

    it('one hero per Token: a second hero dropped there does not take it (FP-25)', () => {
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);

        const result = Placement.plantFlagAt('hero_2', A);

        expect(result.success).toBe(true);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');
        expect(BoardState.workTokenOf('hero_2')).toBeNull();
        expect(Flags.skipsOf(forest.id)).toContainEqual({ heroId: 'hero_2', reason: Flags.SKIP.CLAIMED });
    });

    it('moves spot-to-spot directly, without a trip through the Dock', () => {
        // The game's most frequent action must cost one drag, not two.
        const first = place('fixture_producer', A);
        const second = place('fixture_producer', FAR);
        Placement.plantFlagAt('hero_1', A);

        Placement.plantFlagAt('hero_1', FAR);

        expect(BoardState.workTokenOf('hero_1')).toBe(second.id);
        expect(BoardState.workerOf(first.id)).toBeNull();
    });

    it('never leaves a hero standing in two places at once', () => {
        Placement.plantFlagAt('hero_1', A);
        Placement.plantFlagAt('hero_1', B);
        Placement.plantFlagAt('hero_1', FAR);

        const standing = BoardState.heroesOnBoard()
            .filter(([heroId]) => heroId === 'hero_1');
        expect(standing).toHaveLength(1);
        expect(standing[0][1]).toEqual(FAR);   // a display point since slice 1.6c
    });

    it('allows planting on empty ground, where they simply do nothing (D-57)', () => {
        const result = Placement.plantFlagAt('hero_1', A);
        expect(result.success).toBe(true);
        // They are genuinely THERE and genuinely doing nothing — two different
        // facts. Empty ground and the Dock are not the same place.
        expect(BoardState.workTokenOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);
    });

    it('a Token placed under a planted flag is worked without re-placing them', () => {
        // The same courtesy a Manager extends, arrived at from the player's
        // side: drop a Forest under a flag and its hero starts on it.
        GameState.state.heroes = [makeHero('hero_1', ['logging'])];
        Placement.plantFlagAt('hero_1', A);
        const forest = place('fixture_producer', A);
        Flags.assign(1000);

        expect(BoardState.workTokenOf('hero_1')).toBe(forest.id);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');
    });

    it('plants a hero on the Guild Hall token', () => {
        const hall = place('token_guild_hall', A);
        expect(Placement.plantFlagAt('hero_1', A).success).toBe(true);
        // A Hall with no Wishing Well rank has no work cycle: the flag stands
        // there with nothing to claim.
        expect(BoardState.displayPointOf('hero_1')).toEqual({ x: hall.x, y: hall.y });
    });

    it('planting a hero where they already are is a no-op, not a forfeit', () => {
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);
        BoardState.getTokenById(forest.id).cycleElapsedMs = 4000;

        Placement.plantFlagAt('hero_1', A);

        expect(BoardState.getTokenById(forest.id).cycleElapsedMs).toBe(4000);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');
    });

    it('refuses a plant with no point', () => {
        expect(Placement.plantFlagAt('hero_1', null).success).toBe(false);
    });
});

describe('Recalling a hero', () => {
    it('returns them to the Dock', () => {
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);

        expect(Placement.recallHeroById('hero_1').heroId).toBe('hero_1');
        expect(BoardState.flagOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toBeNull();
        expect(BoardState.getTokenById(forest.id).typeId).toBe('fixture_producer');   // Token stays
    });

    it('recallHeroById finds them wherever they are', () => {
        place('fixture_producer', FAR);
        Placement.plantFlagAt('hero_1', FAR);

        expect(Placement.recallHeroById('hero_1').success).toBe(true);
        expect(BoardState.flagOf('hero_1')).toBeNull();
        expect(BoardState.workTokenOf('hero_1')).toBeNull();
    });

    it('recallHeroById on a hero already in the Dock succeeds quietly', () => {
        // Defeat calls this without knowing where the hero is; making the
        // no-op case an error would push that check outward.
        expect(Placement.recallHeroById('hero_nobody').success).toBe(true);
    });

    /** Moved here from `TokenHeroDisplacement.test.js`, deleted with the push in 1.6d-1. */
    it('flies them to the Dock as a particle on a direct recall (right click)', () => {
        place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);

        const collected = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collected.push(e));

        const res = Placement.recallHeroById('hero_1');

        expect(res.success).toBe(true);
        expect(BoardState.flagOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toBeNull();
        expect(collected.some(e => e.kind === 'hero' && e.destination === 'dock' && e.heroId === 'hero_1')).toBe(true);
        unsub();
    });
});

// Was 'Returning a Token to the Vault (right-click)'. Right-click to the Vault
// went in Token Lifecycle 9.3; Remove (5.2) is the one way off the mat, and
// these pin that it behaves as the Vault route did for the mat and the hero.
describe('Taking a Token off the mat (removePlacedToken)', () => {
    it('lifts it off the mat and leaves the ground clear', () => {
        const forest = place('fixture_producer', A);

        expect(Placement.removePlacedToken(forest.id).success).toBe(true);

        expect(BoardState.getTokenById(forest.id)).toBeNull();
        expect(BoardState.tokensAtPoint(A.x, A.y)).toHaveLength(0);
    });

    it('leaves the hero’s flag standing there, idle', () => {
        // Lifting a Token is a statement about the Token. `recallHero` is how a
        // hero goes to the Dock.
        const forest = place('fixture_producer', A);
        Placement.plantFlagAt('hero_1', A);

        const result = Placement.removePlacedToken(forest.id);
        Flags.assign(0);

        expect(result.idledHeroId).toBe('hero_1');
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);
        expect(BoardState.workTokenOf('hero_1')).toBeNull();
    });

    it('refuses to remove the Guild Hall token from the playmat', () => {
        const hall = place('token_guild_hall', A);
        expect(Placement.removePlacedToken(hall.id).success).toBe(false);
    });

    it('refuses a Token that is not on the mat', () => {
        expect(Placement.removePlacedToken('tok_nobody').success).toBe(false);
    });
});

// 'The Token Bank' went with the Vault (Token Lifecycle 9.3).

describe('Board queries', () => {
    it('lists the Tokens on the mat in arrival order', () => {
        const third = place('c', FAR);
        const first = place('a', A);
        const second = place('b', B);

        // `tokens()` is ordered by when each arrived, which replaced "lowest
        // tile index" as the board's one ordering (slice 1.6a).
        expect(BoardState.tokens().map(t => t.id)).toEqual([third.id, first.id, second.id]);
    });

    it('a fresh mat has nothing standing on it', () => {
        expect(BoardState.tokens()).toHaveLength(0);
    });
});

// 'Returning a Token to the Vault (Placement.returnTokenToVaultById)' went with
// the Vault (Token Lifecycle 9.3); removal is `RemoveToken.test.js`.

describe('Passive vs Active Token Hero Constraints', () => {
    it('a hero may be dropped on a passive token, but never works it (1.4b)', () => {
        const pick = place('fixture_pickaxe_t1', A);

        const result = Placement.plantFlagAt('hero_1', A);
        expect(result.success).toBe(true);
        expect(BoardState.workerOf(pick.id)).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);
    });

    it('a passive token placed on a planted flag leaves the flag where it is', () => {
        Placement.plantFlagAt('hero_1', A);
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);

        const pick = token('fixture_pickaxe_t1');
        const result = Placement.placeTokenAt(pick, A);
        expect(result.success).toBe(true);
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
        expect(BoardState.workerOf(pick.id)).toBeNull();
    });

    it('allows planting a hero on an active token (requiresHero === true)', () => {
        const forest = place('fixture_producer', A);

        const result = Placement.plantFlagAt('hero_1', A);
        expect(result.success).toBe(true);
        expect(BoardState.workTokenOf('hero_1')).toBe(forest.id);
    });
});
