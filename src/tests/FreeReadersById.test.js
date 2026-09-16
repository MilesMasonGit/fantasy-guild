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
import * as BoardPromotion from '../systems/board/BoardPromotion.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { getPromotionCost, getPromotionGateSkills } from '../config/registries/jobRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { MAT_W, MAT_H } from '../config/matGeometry.js';
import { TokenProgressBar } from '../ui/components/board/TokenProgressBar.jsx';
import { TokenEventAlert } from '../ui/components/board/TokenEventAlert.jsx';
import { MatPointAlerts } from '../ui/components/board/MatPointAlerts.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { placeAt, clearMat, tileCentre } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.6b part 2 — the readers that were still tile-shaped.**
 *
 * The owner's framing rule: *"We won't have 'Tiles' in the new system. Tokens
 * and flags sit freely around the playmat."* Everything below names a Token by
 * its **instance id** and a place by a **mat point**, and each test moves a
 * Token the most direct way there is (`BoardState.setTokenPoint`, no placement
 * rules, no code that "carries" anything) to prove the answer follows the id.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const C = (i) => tileCentre(i);

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

function qualified(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    const cost = getPromotionCost('fighter');
    for (const skillId of getPromotionGateSkills('fighter')) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel;
    }
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

describe('⭐ a promotion offer is found by the Token’s instance id (PR-7, FP-61)', () => {
    it('after the Academy moves: the offer is still there, and a declined one is not asked again', () => {
        clearMat();
        const hero = qualified('hero_p');
        GameState.state.heroes = [hero];
        const academy = placeAt({ typeId: 'fixture_promotion', usesRemaining: 2, cycleElapsedMs: 0 }, C(14).x, C(14).y);

        const offers = [];
        const off = EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, (p) => offers.push(p));
        try {
            for (let i = 0; i < 40 && !offers.length; i++) BoardPromotion.tickToken(academy, 1000, hero.id);
            expect(offers).toHaveLength(1);
            expect(offers[0]).toMatchObject({ instanceId: academy.id, heroId: hero.id, jobId: 'fighter' });
            expect(offers[0]).not.toHaveProperty('tile');

            BoardState.setTokenPoint(academy.id, C(20).x, C(20).y);
            expect(BoardPromotion.getOffer(academy.id)).toMatchObject({ instanceId: academy.id, heroId: hero.id });

            expect(BoardPromotion.decline(academy.id).success).toBe(true);
            BoardState.setTokenPoint(academy.id, C(8).x, C(8).y);
            for (let i = 0; i < 60; i++) BoardPromotion.tickToken(academy, 1000, hero.id);
        } finally {
            off?.();
        }

        expect(offers, 'a declined offer was asked again').toHaveLength(1);
        expect(BoardPromotion.isDeclined(academy)).toBe(true);
        expect(BoardPromotion.getOffer(academy.id)).toBeNull();
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

describe('⭐ spawns land by point (stopgaps owned by slice 1.8)', () => {
    const spawnOf = (placement) => ({ payload: { typeId: 'fixture_passive', placement } });

    beforeEach(() => clearMat());

    it('here: a death drop lands on the point its bearer stood on', () => {
        const at = C(14);
        const bearer = placeAt('fixture_producer', at.x, at.y);
        BoardState.removeToken(bearer.id);   // it has already left, as on its own depletion

        const result = EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id, selfPoint: { x: bearer.x, y: bearer.y } });

        expect(result).toMatchObject({ ...at, replacedBearer: true });
        expect(BoardState.tokensAtPoint(at.x, at.y).map(t => t.typeId)).toEqual(['fixture_passive']);
        // STOPGAP until slice 1.6d: still on a tile centre, so the grid draws it.
        expect(BoardState.getToken(14)?.typeId).toBe('fixture_passive');
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
        expect(away).toBeGreaterThanOrEqual(61.2 - 1e-6);   // clear of the bearer
        expect(away).toBeLessThan(160);                     // but nearer than a tile step
        expect(BoardState.getTokenById(bearer.id)).not.toBeNull();
    });

    it('no room for the spawn skips it, and nothing is lost (FP-46)', () => {
        // ⚠️ Packed at exactly the minimum gap, which leaves NO legal point
        // inside the block: the hole between any four is only 43 u across. A mat
        // merely full of Tokens on tile centres has room everywhere now.
        const P = (c, r) => ({ x: 600 + c * 61.2, y: 380 + r * 61.2 });
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (c === 4 && r === 4) continue;
                placeAt('fixture_passive', P(c, r).x, P(c, r).y);
            }
        }
        const bearer = placeAt('fixture_producer', P(4, 4).x, P(4, 4).y);
        const before = BoardState.tokens().length;

        expect(EffectActions.spawn(spawnOf(PLACEMENT.NEAREST_FREE), { self: bearer.id })).toBeNull();
        expect(BoardState.tokens()).toHaveLength(before);
    });
});

describe('⭐ Map bursts throw from a real point', () => {
    let hall;
    beforeEach(() => {
        clearMat();
        hall = placeAt('token_guild_hall', C(21).x, C(21).y);
    });

    it('Cartographer.centreOfBoard is the Guild Hall’s point, follows it, and is the mat centre with no Hall', () => {
        expect(Cartographer.centreOfBoard()).toEqual({ x: hall.x, y: hall.y });
        expect(Cartographer.centreOfBoard()).not.toBe(24);
        BoardState.setTokenPoint(hall.id, C(35).x, C(35).y);
        expect(Cartographer.centreOfBoard()).toEqual(C(35));

        BoardState.removeToken(hall.id);
        expect(Cartographer.centreOfBoard()).toEqual({ x: MAT_W / 2, y: MAT_H / 2 });
    });

    it('a burst with no origin flies its loot out of the Guild Hall', () => {
        const result = Cartographer.openMap({ typeId: 'token_guild_hall_map', usesRemaining: 1 }, null);
        expect(result.success).toBe(true);

        const sprites = SpriteLayer.getSprites();
        expect(sprites.length).toBeGreaterThan(0);
        for (const s of sprites) expect({ x: s.fromX, y: s.fromY }).toEqual({ x: hall.x, y: hall.y });
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
            expect(Placement.placeToken(14, tool).success).toBe(true);
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
            expect(Flags.plant('hero_1', C(14)).success).toBe(true);
        } finally {
            off?.();
        }

        expect(seen).toEqual([{ heroId: 'hero_1', instanceId: forest.id, typeId: 'fixture_producer' }]);
        expect(progress.mock.calls.map(c => c[0])).toContain('hero_deployed');
    });

    it('loot_token_placed names the Token that came off the floor', () => {
        const sprite = SpriteLayer.addSprite('token', 'fixture_passive', 1, null, 900);
        const seen = [];
        const off = EventBus.subscribe('loot_token_placed', (p) => seen.push(p));
        const progress = vi.spyOn(QuestManager, 'reportProgress');
        try {
            dropOnMat({ typeId: 'fixture_passive', from: { spriteId: sprite.id } }, tileCentre(14));
        } finally {
            off?.();
        }

        const placed = BoardState.getToken(14);
        expect(placed?.typeId).toBe('fixture_passive');
        expect(seen).toEqual([{ instanceId: placed.id, typeId: 'fixture_passive' }]);
        expect(progress.mock.calls.map(c => c[0])).toContain('loot_token_placed');
    });
});

describe('⭐ the mat draws each Token by its instance id (slice 1.6c-2)', () => {
    it('a progress bar updates from its Token’s id, and ignores another Token’s', () => {
        clearMat();
        const tok = placeAt('fixture_producer', C(14).x, C(14).y);
        const other = placeAt('fixture_producer', C(15).x, C(15).y);
        const { container } = render(React.createElement(
            EngineContext.Provider, { value: { EventBus } },
            React.createElement(TokenProgressBar, { instanceId: tok.id, token: { typeId: tok.typeId, heroId: 'hero_1', instanceId: tok.id } })
        ));
        const fill = container.querySelector('.relative > div');

        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: other.id, percent: 80, elapsedMs: 8000, cycleTimeMs: 10000 }); });
        expect(fill.style.width).toBe('0%');

        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: tok.id, percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        expect(fill.style.width).toBe('50%');
    });

    it('a red alert shows on its own Token, and not on another', () => {
        clearMat();
        const tok = placeAt('fixture_producer', C(14).x, C(14).y);
        const other = placeAt('fixture_producer', C(15).x, C(15).y);
        const alert = (extra) => ({ severity: 'red', type: 'token_exhausted', name: 'Forest', message: 'Token Exhausted: Forest', ...extra });

        const first = render(React.createElement(TokenEventAlert, { instanceId: tok.id }));
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, alert({ instanceId: other.id })); });
        expect(first.container.querySelector('img')).toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, alert({ instanceId: tok.id })); });
        expect(first.container.querySelector('img')?.getAttribute('alt')).toBe('Token Exhausted: Forest');
    });

    it('⭐ a Token that has just left the mat says so at the point it stood on', () => {
        clearMat();
        const tok = placeAt('fixture_producer', C(14).x, C(14).y);
        const alert = (extra) => ({ severity: 'red', type: 'token_exhausted', name: 'Forest', message: 'Token Exhausted: Forest', ...extra });

        // Gone: the event still names it, and names where it stood. There is no
        // Token left to draw the news on, so the mat draws it at that point.
        BoardState.removeToken(tok.id);
        const { container } = render(React.createElement(MatPointAlerts));
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, alert({ instanceId: tok.id, ...C(14) })); });

        const mark = container.querySelector('[data-mat-point-alert]');
        expect(mark).not.toBeNull();
        expect(mark.querySelector('img')?.getAttribute('alt')).toBe('Token Exhausted: Forest');
        // Centred on the point the Token stood on, one Token wide.
        expect(parseFloat(mark.style.left)).toBe(C(14).x - 64);
        expect(parseFloat(mark.style.top)).toBe(C(14).y - 64);
    });
});
