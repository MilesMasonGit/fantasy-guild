// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Orders from '../systems/board/Orders.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { STEP_MS } from '../ui/components/board/frameClock.js';
import { WorkBarFill } from '../ui/components/board/WorkPlateLayer.jsx';
import { PLATE } from '../ui/components/board/workPlate.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.6b part 2 — the readers that were still tile-shaped.**
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this lays the scenes below out on a plain 160 u lattice so that neighbouring
 * numbers are neighbours on the mat.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;

function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    hero.effects = [];
    return hero;
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    TileModifiers.clearAll();
    BoardCombat.clearAll();
    GameState.state.heroes = [fighter('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    cleanup();
    BoardCombat.clearAll();
});

describe('⭐ a fight is keyed by the enemy Token’s instance id (FPP-4)', () => {
    it('survives its enemy being moved, with no code that carries it, and fightOfHero still finds it', () => {
        clearMat();
        const bear = placeAt('fixture_enemy', C(14).x, C(14).y);
        BoardCombat.tickToken(bear, 100, 'hero_1');
        const fight = BoardCombat.getFight(bear.id);
        expect(fight, 'no fight started').toBeTruthy();
        const hp = fight.combat.enemyHp;
        hp.current = hp.max - 5;

        // The rawest move there is: no Placement, no fight hand-over.
        BoardState.setTokenPoint(bear.id, C(22).x, C(22).y);
        BoardCombat.tickToken(BoardState.getTokenById(bear.id), 100, 'hero_1');

        expect(BoardCombat.getFight(bear.id)).toBe(fight);
        expect(BoardCombat.fightOfHero('hero_1')).toBe(fight);
        expect(fight.instanceId).toBe(bear.id);
        expect(hp.current, 'the enemy was made whole again').toBeLessThanOrEqual(hp.max - 5);
    });

    it('and there is no move-the-fight code left to keep it that way', () => {
        const combat = fs.readFileSync(path.resolve(here, '../systems/board/BoardCombat.js'), 'utf8');
        const placement = fs.readFileSync(path.resolve(here, '../systems/board/Placement.js'), 'utf8');
        expect(combat + placement).not.toMatch(/moveFight|detachFight|attachFight/);
    });
});

describe('⭐ statement roles name Tokens by instance id', () => {
    it('self and source resolve to the right Token after it moves — not to what stands where it was', () => {
        clearMat();
        const a = placeAt(BoardState.createTokenInstance('fixture_producer', 10), C(14).x, C(14).y);
        BoardState.setTokenPoint(a.id, C(16).x, C(16).y);
        const b = placeAt(BoardState.createTokenInstance('fixture_producer', 10), C(14).x, C(14).y);

        const restores = { ...makeStatement(KEYWORD.RESTORES), target: { role: ROLE.SELF }, payload: { amount: 3 } };
        expect(EffectActions.restore(restores, { self: a.id })).toBe(3);
        expect(a.usesRemaining).toBe(13);
        expect(b.usesRemaining).toBe(10);

        expect(EffectActions.restore({ ...restores, target: { role: ROLE.SOURCE } }, { self: b.id, source: a.id })).toBe(3);
        expect(a.usesRemaining).toBe(16);
        expect(b.usesRemaining).toBe(10);

        BoardState.setClaim('hero_1', { instanceId: a.id, typeId: a.typeId, x: a.x, y: a.y });
        expect(EffectActions.heroFor(ROLE.SOURCE, { self: b.id, source: a.id })).toBe('hero_1');
        expect(EffectActions.heroFor(ROLE.SELF, { self: b.id, source: a.id })).toBeNull();
    });
});

describe('⭐ spawns land by point (slices 1.6b and 1.8)', () => {
    const spawnOf = (placement) => ({ payload: { typeId: 'fixture_passive', placement } });

    beforeEach(() => clearMat());

    it('here: a death drop lands on the point its bearer stood on', () => {
        const at = C(14);
        const bearer = placeAt('fixture_producer', at.x, at.y);
        BoardState.removeToken(bearer.id);   // it has already left, as on its own depletion

        const result = EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id, selfPoint: { x: bearer.x, y: bearer.y } });

        expect(result).toMatchObject({ ...at, replacedBearer: true });
        expect(BoardState.tokensAtPoint(at.x, at.y).map(t => t.typeId)).toEqual(['fixture_passive']);
    });

    it('here: a living bearer is replaced where it stands', () => {
        const at = C(27);
        const bearer = placeAt('fixture_producer', at.x, at.y);

        EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id });

        expect(BoardState.getTokenById(bearer.id)).toBeNull();
        expect(BoardState.tokens().map(t => [t.typeId, t.x, t.y])).toEqual([['fixture_passive', at.x, at.y]]);
    });

    /**
     * ⭐ Free placement (slice 1.6d-1): there are no tiles left to be "free", so
     * `nearest_free` means the nearest POINT that clears every neighbour. That
     * is much closer than the old 160 u tile step — the spawn tucks in beside
     * its bearer rather than taking a whole square of its own.
     */
    it('nearest_free: the nearest legal point to the bearer’s point', () => {
        const bearer = placeAt('fixture_producer', C(14).x, C(14).y);
        for (const t of [13, 15, 8]) placeAt('fixture_passive', C(t).x, C(t).y);   // left, right, above

        const result = EffectActions.spawn(spawnOf(PLACEMENT.NEAREST_FREE), { self: bearer.id });

        expect(result.replacedBearer).toBe(false);
        const away = Math.hypot(result.x - bearer.x, result.y - bearer.y);
        expect(away).toBeGreaterThanOrEqual(69.6 - 1e-6);   // clear of the bearer
        expect(away).toBeLessThan(160);                     // but nearer than a whole step
        expect(BoardState.getTokenById(bearer.id)).not.toBeNull();
    });

    it('a crowded spawn pushes its neighbours aside, never its bearer (FP-17, slice 1.8)', () => {
        // ⚠️ Packed at exactly the minimum gap, which leaves NO legal point
        // inside the block: the hole between any four is only 49 u across. So
        // `findSpot` finds nothing and the spawn has to push.
        const P = (c, r) => ({ x: 600 + c * 69.6, y: 380 + r * 69.6 });
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (c === 4 && r === 4) continue;
                placeAt('fixture_passive', P(c, r).x, P(c, r).y);
            }
        }
        const bearer = placeAt('fixture_producer', P(4, 4).x, P(4, 4).y);
        const before = BoardState.tokens().length;

        const result = EffectActions.spawn(spawnOf(PLACEMENT.NEAREST_FREE), { self: bearer.id });

        expect(result).not.toBeNull();
        expect(BoardState.tokens()).toHaveLength(before + 1);
        expect(BoardState.getTokenById(bearer.id)).toMatchObject({ x: bearer.x, y: bearer.y });
        const all = BoardState.tokens();
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                const gap = MatPlacement.minGap(all[i].typeId, all[j].typeId);
                expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThanOrEqual(gap - 1e-6);
            }
        }
        for (const t of all) expect(MatPlacement.insideMat(t.typeId, t)).toBe(true);
    });

    it('a spawn on a truly full mat is skipped, and nothing is lost (FP-46)', () => {
        // The smallest mat, packed edge to edge at the minimum gap: no free
        // point anywhere and nowhere for a push to go.
        setMatTuning('matSteps', 6);
        try {
            // A grid at the minimum gap, plus a last row and column flush with
            // the far edges so no sliver of room is left there. (Those two
            // overlap their neighbours slightly, which a push must tolerate.)
            const r = 64;
            const line = (max) => {
                const out = [];
                for (let v = r; v <= max - r + 1e-6; v += 69.6) out.push(v);
                if (max - r - out[out.length - 1] > 1e-6) out.push(max - r);
                return out;
            };
            const points = [];
            for (const y of line(matH())) for (const x of line(matW())) points.push({ x, y });
            const [first, ...rest] = points;
            const bearer = placeAt('fixture_producer', first.x, first.y);
            for (const p of rest) placeAt('fixture_passive', p.x, p.y);
            const before = BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y }));

            expect(EffectActions.spawn(spawnOf(PLACEMENT.NEAREST_FREE), { self: bearer.id })).toBeNull();
            expect(BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y }))).toEqual(before);
        } finally {
            resetMatTuning();
        }
    });
});

// The Map bursts that used to throw from this point were deleted in Token
// Lifecycle 9.1 (their test went with them); the point itself moved to
// `Placement`, where the Shop and the Vault still aim what they land.
describe('⭐ Tokens land beside a real point', () => {
    let hall;
    beforeEach(() => {
        clearMat();
        hall = placeAt('token_guild_hall', C(21).x, C(21).y);
    });

    it('Placement.centreOfBoard is the Guild Hall’s point, follows it, and is the mat centre with no Hall', () => {
        expect(Placement.centreOfBoard()).toEqual({ x: hall.x, y: hall.y });
        expect(Placement.centreOfBoard()).not.toBe(24);
        BoardState.setTokenPoint(hall.id, C(35).x, C(35).y);
        expect(Placement.centreOfBoard()).toEqual(C(35));

        BoardState.removeToken(hall.id);
        expect(Placement.centreOfBoard()).toEqual({ x: matW() / 2, y: matH() / 2 });
    });
});

describe('⭐ quest events carry instanceId, and still count', () => {
    beforeEach(() => QuestManager.init());
    afterEach(() => {
        QuestManager.cleanup();
        vi.restoreAllMocks();
    });

    it('TOKEN_PLACED names the placed Token, and a context placement still counts', () => {
        const seen = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_PLACED, (p) => seen.push(p));
        const progress = vi.spyOn(QuestManager, 'reportProgress');
        const tool = BoardState.createTokenInstance('fixture_context_a', 40);
        try {
            expect(Placement.placeTokenAt(tool, C(14)).success).toBe(true);
        } finally {
            off?.();
        }

        expect(seen.at(-1)).toEqual({ instanceId: tool.id, typeId: 'fixture_context_a' });
        const targets = progress.mock.calls.map(c => c[0]);
        expect(targets).toContain('token_placed');
        expect(targets).toContain('context_token_placed');
    });

    it('hero_deployed names the Token the flag was planted on', () => {
        const forest = placeAt('fixture_producer', C(14).x, C(14).y);
        const seen = [];
        const off = EventBus.subscribe('hero_deployed', (p) => seen.push(p));
        const progress = vi.spyOn(QuestManager, 'reportProgress');
        try {
            expect(Orders.orderAt('hero_1', C(14)).success).toBe(true);
        } finally {
            off?.();
        }

        expect(seen).toEqual([{ heroId: 'hero_1', instanceId: forest.id, typeId: 'fixture_producer' }]);
        expect(progress.mock.calls.map(c => c[0])).toContain('hero_deployed');
    });

    // 'loot_token_placed names the Token that came off the floor' went with
    // Token loot (Token Lifecycle 9.3): the event has no publisher now, and
    // the tutorial quest that counts it is re-pointed in 9.5.
});

describe('⭐ the mat draws each Token by its instance id (slice 1.6c-2)', () => {
    it('a work bar updates from its Token’s id, and ignores another Token’s', () => {
        vi.useFakeTimers();
        try {
            clearMat();
            const tok = placeAt('fixture_producer', C(14).x, C(14).y);
            const other = placeAt('fixture_producer', C(15).x, C(15).y);
            // The Token's bubbles feed the bar; its plate's fill draws it.
            const { container } = render(React.createElement(React.Fragment, null,
                React.createElement(TokenBubbles, { instanceId: tok.id, token: { typeId: tok.typeId, heroId: 'hero_1', instanceId: tok.id } }),
                React.createElement(WorkBarFill, { instanceId: tok.id })));
            const bar = container.querySelector('[data-work-bar]');
            // The bar draws on the shared step clock's next step, in art pixels.
            const step = () => act(() => { vi.advanceTimersByTime(STEP_MS + 20); });

            act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: other.id, percent: 80, elapsedMs: 8000, cycleTimeMs: 10000 }); });
            step();
            expect(bar.getAttribute('data-work-bar-fill')).toBe('0');

            act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: tok.id, percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
            step();
            expect(Number(bar.getAttribute('data-work-bar-fill')) / PLATE.FILL_STEPS).toBeCloseTo(0.5, 1);
        } finally {
            cleanup();
            vi.useRealTimers();
        }
    });
});
