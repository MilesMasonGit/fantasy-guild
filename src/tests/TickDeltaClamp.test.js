import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { TimeManager } from '../systems/core/TimeManager.js';
import { TimeBankManager } from '../systems/core/TimeBankManager.js';
import { MAX_TICK_DELTA_MS, TIME_BANK } from '../config/loopConstants.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import './fixtures/testTokens.js';

// a single tick used to carry the whole gap since the last one, so a sleeping
// laptop added its entire sleep to `meta.totalPlaytime` and `time.gameTimeMs`
// while producing nothing. The delta is now clamped, and the remainder is
// routed to the Time Bank rather than discarded.

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** The monotonic clock `TimeManager` measures the delta with. */
let perfClock = 0;
const advancePerf = ms => { perfClock += ms; };

/** The wall clock — settable by the player's OS, read only for time AWAY. */
let wallClock = 1_000_000_000_000;
const advanceWall = ms => { wallClock += ms; };

describe('Tick delta clamp (CR2-041 / CR3-101)', () => {
    let perfSpy;
    let wallSpy;
    let wasRunning;

    beforeEach(() => {
        perfClock = 0;
        wallClock = 1_000_000_000_000;
        perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => perfClock);
        wallSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallClock);

        GameState.initNew();
        TimeBankManager.isSpending = false;
        TimeBankManager.activeMultiplier = 1;
        TimeManager.setTimeScale(1);
        TimeManager.init();
        GameState.state.time.timeBankMs = 0;
        GameState.state.meta.totalPlaytime = 0;
        GameState.state.time.gameTimeMs = 0;

        wasRunning = GameLoop.isRunning;
    });

    afterEach(() => {
        GameLoop.isRunning = wasRunning;
        perfSpy.mockRestore();
        wallSpy.mockRestore();
    });

    // ------------------------------------------------------------------
    // The clock itself
    // ------------------------------------------------------------------

    it('clamps an eight-hour gap to the maximum tick delta', () => {
        advancePerf(EIGHT_HOURS_MS);
        expect(TimeManager.update()).toBe(MAX_TICK_DELTA_MS);
    });

    it('passes a normal frame delta through unchanged', () => {
        advancePerf(100);
        expect(TimeManager.update()).toBe(100);
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('passes a slow frame well under the ceiling through unchanged', () => {
        advancePerf(750);
        expect(TimeManager.update()).toBe(750);
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('does not advance game time by eight hours', () => {
        advancePerf(EIGHT_HOURS_MS);
        TimeManager.update();
        expect(TimeManager.getGameTime()).toBe(MAX_TICK_DELTA_MS);
    });

    it('parks the undelivered remainder as overflow, once', () => {
        advancePerf(EIGHT_HOURS_MS);
        TimeManager.update();
        expect(TimeManager.consumeOverflow()).toBe(EIGHT_HOURS_MS - MAX_TICK_DELTA_MS);
        // Taken, not left lying around for the next tick to bank again.
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('produces no overflow while paused', () => {
        TimeManager.pause();
        advancePerf(EIGHT_HOURS_MS);
        expect(TimeManager.update()).toBe(0);
        expect(TimeManager.consumeOverflow()).toBe(0);
        TimeManager.resume();
    });

    // ------------------------------------------------------------------
    // the monotonic clock itself cannot go backwards
    // ------------------------------------------------------------------

    describe('a monotonic read that goes backward (CR3-101 safety floor)', () => {
        it('floors the delta at 0, never negative', () => {
            advancePerf(1000);
            TimeManager.update(); // establishes lastTickTime at perfClock=1000

            perfClock -= 5000; // a clock that should never happen, handled anyway
            expect(TimeManager.update()).toBe(0);
        });

        it('does not pollute the Time Bank overflow with a negative amount', () => {
            advancePerf(1000);
            TimeManager.update();

            perfClock -= 5000;
            TimeManager.update();
            expect(TimeManager.consumeOverflow()).toBe(0);
        });
    });

    // ------------------------------------------------------------------
    // the WALL clock (Date.now, the one the player's OS can move) must
    // have no effect on the in-session delta at all
    // ------------------------------------------------------------------

    describe('the wall clock cannot move the game while it is open (CR3-101)', () => {
        it('a 5s backward step of the wall clock produces no negative delta', () => {
            advancePerf(100);
            expect(TimeManager.update()).toBe(100);

            advanceWall(-5000); // the PC's clock, not performance.now

            advancePerf(100);
            expect(TimeManager.update()).toBe(100);
            expect(TimeManager.consumeOverflow()).toBe(0);
        });

        it('a 1h forward step of the wall clock delivers a normal delta, not an hour', () => {
            advancePerf(100);
            expect(TimeManager.update()).toBe(100);

            advanceWall(60 * 60 * 1000); // the PC's clock, not performance.now

            advancePerf(100);
            expect(TimeManager.update()).toBe(100);
            expect(TimeManager.consumeOverflow()).toBe(0);
        });
    });

    // ------------------------------------------------------------------
    // the player-visible symptom — replayed CYCLE_START, and a forward
    // jump feeding the Time Bank while playing
    // ------------------------------------------------------------------

    describe('the board does not notice a moved wall clock while playing (CR3-101)', () => {
        const POINT = { x: 400, y: 200 };
        let started;
        let unsubscribe;

        function makeWorkerHero(id) {
            const skills = {};
            for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
            return {
                id, name: id, status: 'idle', level: 50, skills,
                hp: { current: 100, max: 100 }, equipment: new Array(9).fill(null)
            };
        }

        beforeEach(() => {
            InventoryManager.init();
            SpriteLayer.init();
            BoardState.clear?.();
            TileModifiers.rebuildAll();
            GameState.state.heroes = [makeWorkerHero('hero_1')];

            const instance = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
            Placement.placeTokenAt(instance, POINT);
            TileModifiers.rebuildAround([instance]);
            Placement.plantFlagAt('hero_1', POINT);

            started = [];
            unsubscribe = EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => started.push(p));

            // The real board_runner handler, driven through the real
            // TimeManager-measured delta rather than a hand-fed one, so the
            // clock fix is actually what's under test.
            GameLoop.onTick('test_cr3101_board_runner', (delta) => BoardRunner.tick(delta));
            GameLoop.isRunning = true;
            TimeBankManager.init(); // idempotent; wires the time_overflow subscription
        });

        afterEach(() => {
            unsubscribe?.();
            GameLoop.offTick('test_cr3101_board_runner');
        });

        it('a 5s backward step of the wall clock produces no burst of CYCLE_START', () => {
            // Run well into the fixture's 12s cycle, at a normal 100ms cadence,
            // so a cycle has already started once.
            for (let i = 0; i < 30; i++) {
                advancePerf(100);
                GameLoop.tick();
            }
            expect(started.length).toBe(1);
            started.length = 0; // discard the one legitimate start

            // The PC's wall clock jumps back 5s. performance.now is untouched —
            // this is exactly what changing the system clock does in real life.
            advanceWall(-5000);

            const deltas = [];
            for (let i = 0; i < 50; i++) {
                advancePerf(100);
                GameLoop.tick();
                deltas.push(TimeManager.getDelta());
            }

            expect(deltas.every(d => d === 100)).toBe(true);
            expect(started).toEqual([]);
        });

        it('a 1h forward step of the wall clock banks nothing while playing', () => {
            for (let i = 0; i < 10; i++) {
                advancePerf(100);
                GameLoop.tick();
            }

            advanceWall(60 * 60 * 1000);

            for (let i = 0; i < 10; i++) {
                advancePerf(100);
                GameLoop.tick();
            }

            expect(TimeBankManager.getBankedMs()).toBe(0);
        });
    });

    // ------------------------------------------------------------------
    // The saved fields — the symptom the ticket reproduced
    // ------------------------------------------------------------------

    describe('through the shipped time_tracking handler', () => {
        let unregister = false;

        beforeEach(() => {
            // The real handler EngineBootstrap registers, reproduced here so
            // the assertion is about the two SAVED fields and not about the
            // clock in isolation. Kept in step with
            // `EngineBootstrap._registerTickHandlers`.
            GameLoop.onTick('test_time_tracking', (delta) => {
                GameState.updateTime({
                    gameTimeMs: GameState.time.gameTimeMs + delta,
                    lastTickAt: Date.now()
                });
                GameState.state.meta.totalPlaytime =
                    (GameState.state.meta.totalPlaytime || 0) + delta;
            });
            unregister = true;
            GameLoop.isRunning = true;
        });

        afterEach(() => {
            if (unregister) GameLoop.offTick('test_time_tracking');
            unregister = false;
        });

        it('an eight-hour gap adds at most one clamped tick of playtime', () => {
            advancePerf(EIGHT_HOURS_MS);
            GameLoop.tick();

            expect(GameState.state.meta.totalPlaytime).toBe(MAX_TICK_DELTA_MS);
            expect(GameState.state.time.gameTimeMs).toBe(MAX_TICK_DELTA_MS);
            expect(GameState.state.meta.totalPlaytime).toBeLessThan(EIGHT_HOURS_MS);
        });

        it('normal ticks still accumulate playtime as before', () => {
            for (let i = 0; i < 5; i++) {
                advancePerf(100);
                GameLoop.tick();
            }
            expect(GameState.state.meta.totalPlaytime).toBe(500);
            expect(GameState.state.time.gameTimeMs).toBe(500);
        });
    });

    // ------------------------------------------------------------------
    // Where the excess goes
    // ------------------------------------------------------------------

    describe('routing the excess to the Time Bank', () => {
        beforeEach(() => {
            TimeBankManager.init();     // idempotent; wires the subscription
            GameLoop.isRunning = true;
        });

        it('banks the time the clamp refused to deliver', () => {
            advancePerf(EIGHT_HOURS_MS);
            GameLoop.tick();

            expect(TimeBankManager.getBankedMs())
                .toBe(EIGHT_HOURS_MS - MAX_TICK_DELTA_MS);
        });

        it('banks nothing on a normal tick', () => {
            advancePerf(100);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(0);
        });

        it('still honours the 24-hour bank cap', () => {
            advancePerf(TIME_BANK.MAX_MS * 3);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(TIME_BANK.MAX_MS);
        });

        it('does not double-bank on the following tick', () => {
            advancePerf(EIGHT_HOURS_MS);
            GameLoop.tick();
            const afterFirst = TimeBankManager.getBankedMs();

            advancePerf(100);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(afterFirst);
        });
    });
});
