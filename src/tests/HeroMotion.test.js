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

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Heroes walk** (Hero Movement slice M1, `docs/hero_movement_roadmap_v1.md`).
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

afterEach(() => BoardState.setInstantArrival(true));

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
