import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * The Guild Hall's quest Tokens on a mat with no room for them.
 *
 * A bounty rides the bounty clock: one try when it comes round, and with nowhere to land that
 * bounty is missed and the next is tried a whole interval later (owner: a missed bus waits for the
 * next one), never searched for again on the ticks between. With no Hall at all the clock is held
 * full, as before: that is cheap to ask every tick. Nothing else is owed (the tutorial's steps
 * are gone), so a check never searches the mat.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const MIN = 60_000;
const EVERY = 3 * MIN;
const HALL = { x: 420, y: 300 };

const bounties = () => QuestTokens.bountyTokens();

function newGame() {
    resetMatTuning();
    setMatTuning('matSteps', 6);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
    QuestTokens.resetRuntime();
    GameState.state.quests = { clockMs: 0 };
    return placeAt('token_guild_hall', HALL.x, HALL.y);
}

/**
 * Fill every spot a quest Token could land on, searching exactly as the Hall does, with placed
 * quest-sized blockers that carry no quest (a placed Token is never pushed).
 */
function packMat() {
    const blockers = [];
    for (let i = 0; i < 1000; i++) {
        const landed = QuestTokens.spawnQuest({
            id: `fill_${i}`, title: 'fill', tutorial: false, requiredCount: 1, currentCount: 0, rewardItems: [], done: false
        });
        if (!landed) return blockers;
        BoardState.removeToken(landed.id);
        blockers.push(placeAt(QUEST_TOKEN_TYPE, landed.x, landed.y));
    }
    throw new Error('the mat never filled');
}

/** Take the three blockers nearest the Hall off the mat: room beside it. */
function makeRoom(blockers) {
    const near = [...blockers].sort((a, b) => Math.hypot(a.x - HALL.x, a.y - HALL.y) - Math.hypot(b.x - HALL.x, b.y - HALL.y));
    for (const b of near.slice(0, 3)) BoardState.removeToken(b.id);
}

/** How many placement searches `fn` made (every landing asks `findSpot` first). */
function searchesDuring(fn) {
    const spy = vi.spyOn(MatPlacement, 'findSpot');
    try {
        fn();
        return spy.mock.calls.length;
    } finally {
        spy.mockRestore();
    }
}

/** `n` ticks of 100 ms. */
function ticks(n) {
    for (let i = 0; i < n; i++) QuestTokens.tick(100);
}

afterEach(() => resetMatTuning());

describe('⭐ a bounty with nowhere to land is missed, and the next is tried a whole interval later', () => {
    beforeEach(() => newGame());

    it('the mat is packed: no quest Token fits anywhere', () => {
        packMat();
        expect(QuestTokens.spawnBounty()).toBeNull();
    });

    it('tries once when the clock comes round, then not on any tick until the next lap', () => {
        packMat();
        expect(searchesDuring(() => QuestTokens.tick(EVERY - 100))).toBe(0);
        expect(searchesDuring(() => QuestTokens.tick(100))).toBeGreaterThan(0);   // the try, missed
        expect(bounties()).toHaveLength(0);
        expect(QuestTokens.clockMs()).toBe(0);                                     // a fresh lap
        expect(QuestTokens.nextBountyInMs()).toBe(EVERY);

        expect(searchesDuring(() => ticks(EVERY / 100 - 1))).toBe(0);              // no search per tick
        expect(searchesDuring(() => QuestTokens.tick(100))).toBeGreaterThan(0);   // the next try
        expect(bounties()).toHaveLength(0);
    });

    it('room made just after a miss is taken at the next try, not before', () => {
        const blockers = packMat();
        QuestTokens.tick(EVERY);                         // missed
        makeRoom(blockers);
        ticks(EVERY / 100 - 1);
        expect(bounties()).toHaveLength(0);
        QuestTokens.tick(100);                           // one whole interval after the miss
        expect(bounties()).toHaveLength(1);
        expect(QuestTokens.clockMs()).toBe(0);
    });

    it('a step of several intervals tries once a lap, as small ticks do', () => {
        packMat();
        expect(searchesDuring(() => QuestTokens.tick(3.5 * EVERY))).toBeGreaterThan(0);
        expect(bounties()).toHaveLength(0);
        expect(QuestTokens.clockMs()).toBe(EVERY / 2);
    });

    it('with no Guild Hall the clock is held full and nothing is searched or rolled', () => {
        const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
        BoardState.removeToken(hall.id);
        const draws = vi.spyOn(Math, 'random');
        try {
            expect(searchesDuring(() => ticks(100))).toBe(0);
            expect(searchesDuring(() => QuestTokens.tick(10 * MIN))).toBe(0);
            expect(draws).not.toHaveBeenCalled();
        } finally {
            draws.mockRestore();
        }
        expect(QuestTokens.clockMs()).toBe(EVERY);
        expect(bounties()).toHaveLength(0);
        // The Hall comes back: the bounty owed lands on the next tick.
        placeAt('token_guild_hall', HALL.x, HALL.y);
        QuestTokens.tick(100);
        expect(bounties()).toHaveLength(1);
    });
});

describe('⭐ nothing is owed: a check never searches the mat', () => {
    beforeEach(() => newGame());

    it('a check asked for (a load, travel) on a packed, still mat searches nothing between bounty tries', () => {
        packMat();
        QuestTokens.requestCheck();
        expect(searchesDuring(() => ticks(50))).toBe(0);
        QuestTokens.requestCheck();
        expect(searchesDuring(() => QuestTokens.tick(100))).toBe(0);
    });
});

describe('⭐ catch-up steps end exactly as live ticks do', () => {
    /** Twelve game-minutes on a packed mat in `step` ms steps, room made at 4 min. */
    function play(step) {
        newGame();
        const blockers = packMat();
        const landedAt = [];
        let t = 0;
        let roomMade = false;
        while (t < 12 * MIN) {
            if (!roomMade && t >= 4 * MIN) {
                makeRoom(blockers);
                roomMade = true;
            }
            QuestTokens.tick(step);
            t += step;
            while (landedAt.length < bounties().length) landedAt.push(t);
        }
        return { landedAt, points: bounties().map(b => [b.x, b.y]), clock: QuestTokens.clockMs() };
    }

    it('100 ms ticks and 1000 ms steps land the same bounties at the same tries, in the same places', () => {
        const live = play(100);
        const catchUp = play(1000);
        // Missed at 3 min; room from 4 min; lands at the next tries, 6 and 9 min, then at the cap.
        expect(live.landedAt).toEqual([6 * MIN, 9 * MIN]);
        expect(catchUp).toEqual(live);
    });
});
