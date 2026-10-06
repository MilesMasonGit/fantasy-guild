import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { dockStatusLine } from '../ui/components/board/flagText.js';
import { migrateState } from '../systems/core/SaveMigration.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Heroes walk** (Hero Movement slice M1, `docs/archive/hero_movement_roadmap_v1.md`).
 *
 * Every other test file runs with instant arrival (`src/tests/setup/`); these
 * switch it OFF, so the walk is real: 120 u a second, ten ticks a second.
 * A small Token's art radius is 64 u, so a hero stands 64 + 16 = 80 u beside it.
 */

const SPEED = 120;

function hero(id, skills = { logging: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(point, typeId = 'fixture_producer') {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const body = (heroId) => BoardState.heroBodyOf(heroId);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    BoardState.setInstantArrival(false);
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    setMatTuning('walkSpeed', SPEED);
    // Pottering off unless a test is about it: a random stroll must never move
    // a hero these scenarios expect to be standing still.
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    // No Guild Hall: nothing but the scenario's own Tokens.
    for (const t of BoardState.tokens()) BoardState.removeToken(t.id);
    GameState.state.heroes = [hero('h1'), hero('h2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    BoardState.setInstantArrival(true);
    HeroMotion.setRandomForTests();
});

describe('⭐ walking costs work time (FP-26)', () => {
    it('claims the Token on setting off, but works it only on arrival', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });

        // Claimed at once (HMP-2) — but walking, so nobody works it yet.
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(tok.id);
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'walking', instanceId: tok.id });
        expect(BoardState.workerOf(tok.id)).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBeNull();

        // 220 u to the standing spot (800 − 80) at 120 u/s ≈ 1.8 s.
        run(1000);
        expect(Flags.statusOf('h1').state).toBe('walking');
        expect(tok.cycleElapsedMs || 0).toBe(0);
        expect(body('h1').x).toBeGreaterThan(500);
        expect(body('h1').x).toBeLessThan(720);

        run(1500);
        expect(Flags.statusOf('h1').state).toBe('working');
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        expect(tok.cycleElapsedMs).toBeGreaterThan(0);
    });

    it('covers the distance at the tuned speed', () => {
        put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        const start = { ...HeroMotion.heroPointOf('h1') };
        run(1000);
        const now = HeroMotion.heroPointOf('h1');
        expect(Math.hypot(now.x - start.x, now.y - start.y)).toBeCloseTo(SPEED, 6);
    });

    it('a very long tick (the game was asleep) arrives in one step, not in fast-forward', () => {
        const tok = put({ x: 1400, y: 900 });
        Flags.plant('h1', { x: 1100, y: 700 });
        BoardRunner.tick(60000);
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        expect(body('h1').moving).toBe(false);
    });
});

describe('⭐ beside the Token, from the side they came (HM-2)', () => {
    it('coming from the left, they stand on the left; the Token never moves', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        run(3000);
        expect(body('h1')).toMatchObject({ x: 800 - 80, y: 500 });
        expect(body('h1').facing).toBe(1);
        expect({ x: tok.x, y: tok.y }).toEqual({ x: 800, y: 500 });
    });

    it('coming from the right, they stand on the right, facing left', () => {
        put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 1100, y: 500 });
        run(3000);
        expect(body('h1')).toMatchObject({ x: 800 + 80, y: 500 });
        expect(body('h1').facing).toBe(-1);
    });

    it('stands on the other side rather than off the edge of the mat', () => {
        expect(HeroMotion.standingSpot('fixture_producer', { x: 70, y: 500 }, -1).x).toBe(70 + 80);
    });
});

describe('claims, moves and choices while walking', () => {
    it('two heroes never race for one Token: the walker already holds it (FP-25, HMP-2)', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 450, y: 500 });
        // h2 plants right beside it, but h1 claimed it the moment they set off.
        Flags.plant('h2', { x: 900, y: 500 });
        expect(BoardState.claimOfHero('h2')).toBeNull();
        expect(Flags.skipsOf(tok.id).map(s => s.reason)).toContain(Flags.SKIP.CLAIMED);
    });

    it('a Token moved while they walk: they follow it (HMP-3)', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        run(500);
        BoardState.setTokenPoint(tok.id, 800, 700);
        run(4000);
        expect(body('h1')).toMatchObject({ x: 720, y: 700 });
        expect(BoardState.workerOf(tok.id)).toBe('h1');
    });

    it('a Token moved after they arrived keeps its hero working while they catch up (FP-68)', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        run(3000);
        const progress = tok.cycleElapsedMs;
        BoardState.setTokenPoint(tok.id, 800, 600);
        run(100);
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        expect(tok.cycleElapsedMs).toBeGreaterThan(progress);
    });

    it('⭐ "nearest" is measured from the hero, not the flag (HM-4)', () => {
        const nearFlag = put({ x: 450, y: 500 });     // 150 u from the flag
        const nearHero = put({ x: 780, y: 500 });     // 180 u from the flag, 120 from the hero
        Flags.plant('h1', { x: 1500, y: 900 });       // somewhere with nothing to do
        body('h1').x = 900;                            // the hero stands here…
        body('h1').y = 500;
        Flags.plant('h1', { x: 600, y: 500 });        // …when the flag is moved
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(nearHero.id);
        expect(nearFlag.id).not.toBe(nearHero.id);
    });

    it('a new hero appears beside their flag (slice M3 walks them out of the Guild Hall)', () => {
        Flags.plant('h1', { x: 500, y: 500 });
        expect(body('h1')).toMatchObject(HeroMotion.idleSpot({ x: 500, y: 500 }));
    });

    it('a recall mid-walk takes them off the mat and lets go of the Token', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        run(500);
        Flags.furl('h1');
        expect(body('h1')).toBeNull();
        expect(BoardState.heroOfInstance(tok.id)).toBeNull();
    });

    it('with nothing to do they walk back to the flag, and that counts as idle', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        run(3000);
        BoardState.removeToken(tok.id);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, {});
        run(200);
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'walking', instanceId: null });
        expect(BoardRunner.isHeroIdle('h1')).toBe(true);
        run(3000);
        expect(Flags.statusOf('h1').state).toBe('idle');
        // Back beside the flag — the very spot the screen draws an idle hero,
        // so reaching it is not a jump (M2).
        expect(body('h1')).toMatchObject(HeroMotion.idleSpot({ x: 500, y: 500 }));
    });

    it('⭐ standing beside their Token, they turn to face it', () => {
        const tok = put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 1100, y: 500 });
        run(3000);
        expect(body('h1').x).toBeGreaterThan(tok.x);
        // Knocked the wrong way round (a mat edge sending them to the far side
        // does this; so does already standing there): the next tick turns them.
        body('h1').facing = 1;
        run(100);
        expect(body('h1').facing).toBe(-1);
    });
});

describe('⚠️ no rebuild storms', () => {
    it('a whole walk publishes one HERO_MOVED (on arrival) and a HEROES_WALKED per step', () => {
        put({ x: 800, y: 500 });
        Flags.plant('h1', { x: 500, y: 500 });
        let moved = 0;
        let walked = 0;
        const offA = EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, () => { moved++; });
        const offB = EventBus.subscribe(BOARD_EVENTS.HEROES_WALKED, () => { walked++; });
        run(3000);
        const walkedDuringWalk = walked;
        run(3000);
        offA();
        offB();
        expect(moved).toBe(1);
        expect(walkedDuringWalk).toBeGreaterThan(10);
        // Standing still: no more steps announced.
        expect(walked).toBe(walkedDuringWalk);
    });
});

describe('⭐ coming and going through the Guild Hall (M3)', () => {
    const HALL = { x: 900, y: 600 };
    let hall;
    beforeEach(() => {
        hall = BoardState.createTokenInstance('token_guild_hall', null);
        BoardState.addToken(hall, HALL.x, HALL.y);
    });

    it('a hero sent out appears at the Hall and walks to their first job (HMP-1)', () => {
        const tok = put({ x: 1300, y: 600 });
        Flags.plant('h1', { x: 1300, y: 700 });
        expect(HeroMotion.heroPointOf('h1')).toEqual(HALL);
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'walking', instanceId: tok.id });
        run(5000);
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        // They came from the Hall, on the left, so they stand on the left.
        expect(body('h1').x).toBe(1300 - 80);
    });

    it('⭐ "nearest" for the first job is measured from the Hall they walk out of (HM-4)', () => {
        const nearFlag = put({ x: 1450, y: 600 });     // 100 u from the flag
        const nearHall = put({ x: 1250, y: 600 });     // 100 u from the flag too, 350 from the Hall
        Flags.plant('h1', { x: 1350, y: 600 });
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(nearHall.id);
        expect(nearFlag.id).not.toBe(nearHall.id);
    });

    it('⭐ a recall: the flag is gone and the hero is in the Dock at once, but walks into the Hall (HM-5)', () => {
        put({ x: 1300, y: 600 });
        Flags.plant('h1', { x: 1300, y: 700 });
        run(5000);
        Flags.furl('h1');

        expect(BoardState.flagOf('h1')).toBeNull();
        const status = Flags.statusOf('h1');
        expect(status.state).toBe('returning');
        expect(dockStatusLine(status)).toBe('Returning to the Guild');
        expect(BoardRunner.isHeroIdle('h1')).toBe(true);

        run(1000);
        expect(body('h1').x).toBeLessThan(1300 - 80);        // on the way
        run(5000);
        expect(body('h1')).toBeNull();                       // in through the door
        expect(Flags.statusOf('h1').state).toBe('docked');
    });

    it('sent out again on the way home, they turn around — same figure, no jump (HM-5)', () => {
        put({ x: 1300, y: 600 });
        Flags.plant('h1', { x: 1300, y: 700 });
        run(5000);
        Flags.furl('h1');
        run(1000);
        const turning = { ...HeroMotion.heroPointOf('h1') };
        Flags.plant('h1', { x: 1300, y: 700 });
        expect(HeroMotion.heroPointOf('h1')).toEqual(turning);
        expect(HeroMotion.isReturning('h1')).toBe(false);
        run(5000);
        expect(Flags.statusOf('h1').state).toBe('working');
    });

    it('⭐ a defeated hero limps home at half speed, looking wounded (HM-6)', () => {
        Flags.plant('h1', { x: 1300, y: 600 });
        run(5000);
        const start = { ...HeroMotion.heroPointOf('h1') };
        Flags.furl('h1', 'defeat');
        expect(HeroMotion.isLimping('h1')).toBe(true);
        expect(dockStatusLine(Flags.statusOf('h1'))).toBe('Limping home');
        run(1000);
        const now = HeroMotion.heroPointOf('h1');
        expect(Math.hypot(now.x - start.x, now.y - start.y)).toBeCloseTo(SPEED * HeroMotion.LIMP_FACTOR, 6);
    });

    it('walks home to wherever the Hall now stands, and simply vanishes if it is gone', () => {
        Flags.plant('h1', { x: 1300, y: 600 });
        run(5000);
        Flags.furl('h1');
        BoardState.setTokenPoint(hall.id, 400, 300);
        run(1000);
        expect(body('h1').x).toBeLessThan(1300);
        BoardState.removeToken(hall.id);
        run(100);
        expect(body('h1')).toBeNull();
    });
});

describe('⭐ idle heroes potter near their flag (M4, HM-1)', () => {
    const FLAG = { x: 600, y: 600 };
    const HOME = { x: 672, y: 528 };                   // idleSpot(FLAG)
    const RADIUS = 80;
    const gap = (heroId) => {
        const p = HeroMotion.heroPointOf(heroId);
        return Math.hypot(p.x - HOME.x, p.y - HOME.y);
    };

    beforeEach(() => setMatTuning('potterRadius', RADIUS));

    it('pauses, then strolls to a spot within reach of the flag, then pauses again', () => {
        // random() = 0.5 every time: a 4 s pause, a stroll of 80·√0.5 ≈ 57 u.
        HeroMotion.setRandomForTests(() => 0.5);
        Flags.plant('h1', FLAG);
        expect(HeroMotion.heroPointOf('h1')).toEqual(HOME);

        run(3900);
        expect(HeroMotion.heroPointOf('h1')).toEqual(HOME);          // still pausing
        run(300);
        expect(HeroMotion.isPottering('h1')).toBe(true);             // set off

        run(3000);                                                  // 57 u at 60 u/s
        expect(body('h1').moving).toBe(false);
        expect(gap('h1')).toBeCloseTo(RADIUS * Math.sqrt(0.5), 6);
    });

    it('a stroll is still idle: the dock, the idle count and the status all say so', () => {
        HeroMotion.setRandomForTests(() => 0.5);
        Flags.plant('h1', FLAG);
        run(4500);
        expect(body('h1').moving).toBe(true);
        expect(Flags.statusOf('h1').state).toBe('idle');
        expect(BoardRunner.isHeroIdle('h1')).toBe(true);
    });

    it('strolls at half walking speed', () => {
        HeroMotion.setRandomForTests(() => 0.99);                    // a long stroll
        Flags.plant('h1', FLAG);
        run(6000);                                                  // pause ≈ 5.96 s, then off
        const start = { ...HeroMotion.heroPointOf('h1') };
        run(500);
        const now = HeroMotion.heroPointOf('h1');
        expect(Math.hypot(now.x - start.x, now.y - start.y)).toBeCloseTo(SPEED * HeroMotion.STROLL_FACTOR * 0.5, 6);
    });

    it('never wanders further than the tuned reach, over a long random watch', () => {
        let seed = 7;
        HeroMotion.setRandomForTests(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
        Flags.plant('h1', FLAG);
        let furthest = 0;
        let movingTicks = 0;
        for (let t = 0; t < 120000; t += 100) {
            BoardRunner.tick(100);
            furthest = Math.max(furthest, gap('h1'));
            if (body('h1').moving) movingTicks++;
        }
        expect(furthest).toBeLessThanOrEqual(RADIUS + 1e-6);
        expect(furthest).toBeGreaterThan(0);
        // Calm, not busy: they spend most of their time standing still.
        expect(movingTicks / 1200).toBeLessThan(0.5);
    });

    it('work appearing mid-stroll comes first: they go and do it', () => {
        HeroMotion.setRandomForTests(() => 0.5);
        Flags.plant('h1', FLAG);
        run(4500);
        expect(HeroMotion.isPottering('h1')).toBe(true);
        const tok = put({ x: 800, y: 700 });
        run(1500);
        expect(HeroMotion.isPottering('h1')).toBe(false);
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(tok.id);
        run(5000);
        expect(BoardState.workerOf(tok.id)).toBe('h1');
    });

    it('strolls go with the flag when it is moved', () => {
        HeroMotion.setRandomForTests(() => 0.5);
        Flags.plant('h1', FLAG);
        run(8000);
        Flags.plant('h1', { x: 1200, y: 800 });
        run(15000);
        const p = HeroMotion.heroPointOf('h1');
        const newHome = HeroMotion.idleSpot({ x: 1200, y: 800 });
        expect(Math.hypot(p.x - newHome.x, p.y - newHome.y)).toBeLessThanOrEqual(RADIUS + 1e-6);
    });

    it('Idle wander at 0 means they stand still beside the flag', () => {
        setMatTuning('potterRadius', 0);
        Flags.plant('h1', FLAG);
        run(30000);
        expect(HeroMotion.heroPointOf('h1')).toEqual(HOME);
    });

    it('pottering never announces HERO_MOVED (no rebuild storms)', () => {
        HeroMotion.setRandomForTests(() => 0.5);
        Flags.plant('h1', FLAG);
        let moved = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, () => { moved++; });
        run(30000);
        off();
        expect(moved).toBe(0);
    });
});

describe('⭐ saves remember what each hero is working (M5, HM-7)', () => {
    /** Save, load it back, and announce the load — as `SaveManager.loadGame` does. */
    async function saveAndReload() {
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });
    }

    beforeEach(() => {
        // A Guild Hall, so a hero who was NOT restored would visibly walk out of it.
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall', null), 300, 300);
    });

    it('⭐ a hero mid-cycle is back at their Token after a reload, the bar where it was', async () => {
        const tok = put({ x: 1300, y: 700 });
        Flags.plant('h1', { x: 1100, y: 700 });
        run(12000);                                   // out of the Hall, there, and working
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        const side = body('h1').x > tok.x ? 1 : -1;
        const progress = tok.cycleElapsedMs;
        expect(progress).toBeGreaterThan(0);

        await saveAndReload();

        const again = BoardState.getTokenById(tok.id);
        expect(again.cycleElapsedMs).toBe(progress);
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'working', instanceId: tok.id });
        expect(BoardState.workerOf(tok.id)).toBe('h1');
        // Standing where they stood — not walking out of the Hall.
        expect(body('h1')).toMatchObject({ ...HeroMotion.standingSpot(tok.typeId, again, side), moving: false });

        run(1000);
        expect(again.cycleElapsedMs).toBeGreaterThan(progress);
    });

    it('a hero still walking to their Token when saved starts beside their flag instead', async () => {
        const tok = put({ x: 1300, y: 700 });
        Flags.plant('h1', { x: 1100, y: 700 });
        run(1500);                                    // on the way, not there yet
        expect(Flags.statusOf('h1').state).toBe('walking');

        await saveAndReload();

        expect(HeroMotion.heroPointOf('h1')).toEqual(HeroMotion.idleSpot({ x: 1100, y: 700 }));
        expect(BoardState.workerOf(tok.id)).toBeNull();
    });

    it('an idle hero starts beside their flag, not at the Guild Hall', async () => {
        Flags.plant('h1', { x: 1400, y: 900 });
        run(20000);
        await saveAndReload();
        expect(HeroMotion.heroPointOf('h1')).toEqual(HeroMotion.idleSpot({ x: 1400, y: 900 }));
    });

    it('a saved note that no longer fits is dropped, and the hero chooses afresh', async () => {
        const tok = put({ x: 1300, y: 700 });
        Flags.plant('h1', { x: 1100, y: 700 });
        run(12000);
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        delete saved.state.board.tokens[tok.id];      // the Token is gone in the save
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });

        expect(BoardState.savedWorkClaims()).toEqual([]);
        expect(HeroMotion.heroPointOf('h1')).toEqual(HeroMotion.idleSpot({ x: 1100, y: 700 }));
    });

    it('letting go of the Token erases the note, so a reload does not put them back', async () => {
        const tok = put({ x: 1300, y: 700 });
        Flags.plant('h1', { x: 1100, y: 700 });
        run(12000);
        expect(BoardState.savedWorkClaims()).toEqual([['h1', expect.objectContaining({ instanceId: tok.id })]]);
        Flags.furl('h1');
        expect(BoardState.savedWorkClaims()).toEqual([]);
    });
});
