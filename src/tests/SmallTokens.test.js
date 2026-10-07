import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import {
    artRadiusOf, isSmallToken, tokenBodyScale, matW, SMALL_TOKEN_SCALE
} from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import {
    tokenSizeFor, TOKEN_SURFACE, boardScaleAt, boardArtSteps
} from '../ui/components/base/TokenSprite.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { DisallowBadge, StationGearBadge } from '../ui/components/board/TokenBadges.jsx';
import { RING_D_U } from '../ui/components/board/ringRow.js';
import { TOKEN_BAR_GAP_U } from '../ui/components/board/boardConstants.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback **B8.1 — small Tokens: the size field**.
 */

const CFG = { cycleTimeMs: 5000, inputs: [], outputs: [] };

registerTokenTypes({
    b8_standard: {
        id: 'b8_standard', name: 'B8 Standard', tokenType: 'resource', sprite: 'skill_nature',
        size: 1, uses: 100, requiresHero: false, config: CFG
    },
    b8_small: {
        id: 'b8_small', name: 'B8 Small', tokenType: 'resource', sprite: 'skill_nature',
        size: 1, artSize: 'small', uses: 100, requiresHero: false, config: CFG
    },
    b8_small_explicit_standard: {
        id: 'b8_small_explicit_standard', name: 'B8 Explicit Standard', tokenType: 'resource',
        sprite: 'skill_nature', size: 1, artSize: 'standard', uses: 100, requiresHero: false, config: CFG
    },
    b8_large_small: {
        id: 'b8_large_small', name: 'B8 Large Marked Small', tokenType: 'resource', sprite: 'skill_nature',
        size: 2, artSize: 'small', uses: 100, requiresHero: false, config: CFG
    },
    b8_small_spawner: {
        id: 'b8_small_spawner', name: 'B8 Small Spawner', tokenType: 'resource', sprite: 'skill_nature',
        size: 1, artSize: 'small', uses: null, requiresHero: false,
        spawner: { spawns: [{ typeId: 'b8_standard', weight: 1 }], allowance: 5, intervalMs: 1000 }
    }
});

beforeEach(() => {
    GameState.initNew();
    clearMat();
    resetMatTuning();
});

describe('the one helper: body scale and art radius', () => {
    it('a small 1×1 is half: radius 32 u against 64 u', () => {
        expect(SMALL_TOKEN_SCALE).toBe(0.5);
        expect(isSmallToken('b8_small')).toBe(true);
        expect(tokenBodyScale('b8_small')).toBe(0.5);
        expect(artRadiusOf('b8_small')).toBe(32);
        expect(artRadiusOf('b8_standard')).toBe(64);
    });

    it("a missing or 'standard' artSize is standard; unknown types are standard", () => {
        expect(isSmallToken('b8_standard')).toBe(false);
        expect(isSmallToken('b8_small_explicit_standard')).toBe(false);
        expect(artRadiusOf('b8_small_explicit_standard')).toBe(64);
        expect(isSmallToken('no_such_token')).toBe(false);
        expect(artRadiusOf('no_such_token')).toBe(64);
    });

    it('⚠️ a 2×2 marked small is ignored: it stays a full 2×2', () => {
        expect(isSmallToken('b8_large_small')).toBe(false);
        expect(tokenBodyScale('b8_large_small')).toBe(1);
        expect(artRadiusOf('b8_large_small')).toBe(144);
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'b8_large_small')).toBe(256);
    });

    it('accepts a definition as well as an id', () => {
        expect(isSmallToken({ size: 1, artSize: 'small' })).toBe(true);
        expect(isSmallToken({ artSize: 'small' })).toBe(true);
        expect(isSmallToken({ size: 2, artSize: 'small' })).toBe(false);
        expect(isSmallToken(null)).toBe(false);
    });
});

describe('hit area: the smaller circle', () => {
    it('⭐ a point 40 u from centre hits a standard Token and misses a small one', () => {
        const standard = placeAt('b8_standard', 400, 400);
        const small = placeAt('b8_small', 800, 400);
        expect(Flags.pointOnToken(standard, { x: 440, y: 400 })).toBe(true);
        expect(Flags.pointOnToken(small, { x: 840, y: 400 })).toBe(false);
        expect(Flags.pointOnToken(small, { x: 830, y: 400 })).toBe(true);
        expect(Flags.tokenAtPoint({ x: 840, y: 400 })).toBeNull();
        expect(Flags.tokenAtPoint({ x: 830, y: 400 })?.id).toBe(small.id);
        expect(Flags.tokenAtPoint({ x: 440, y: 400 })?.id).toBe(standard.id);
    });

    it('the hitbox is 80% of the halved radius, rounded (26 u)', () => {
        expect(MatPlacement.hitRadiusOf('b8_small')).toBe(26);
        expect(MatPlacement.hitRadiusOf('b8_standard')).toBe(51);
    });
});

describe('spacing: small Tokens pack closer, never overlap', () => {
    it('gaps: small–small 31.2 u, small–standard 46.2 u, standard–standard unchanged', () => {
        expect(MatPlacement.minGap('b8_small', 'b8_small')).toBeCloseTo(31.2, 6);
        expect(MatPlacement.minGap('b8_small', 'b8_standard')).toBeCloseTo(46.2, 6);
        expect(MatPlacement.minGap('b8_standard', 'b8_standard')).toBeCloseTo(61.2, 6);
    });

    it('two small Tokens: just outside 31.2 u is legal, just inside is refused', () => {
        placeAt('b8_small', 800, 600);
        expect(MatPlacement.isLegal('b8_small', { x: 800 + 31.4, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('b8_small', { x: 800 + 31.0, y: 600 })).toBe(false);
        // A standard one needs the bigger gap from the same small Token.
        expect(MatPlacement.isLegal('b8_standard', { x: 800 + 31.4, y: 600 })).toBe(false);
    });

    it('⭐ a small Token beside a standard one keeps the 46.2 u gap, both ways round', () => {
        placeAt('b8_standard', 800, 600);
        expect(MatPlacement.isLegal('b8_small', { x: 800 + 46.4, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('b8_small', { x: 800 + 46.0, y: 600 })).toBe(false);
        clearMat();
        placeAt('b8_small', 800, 600);
        expect(MatPlacement.isLegal('b8_standard', { x: 800 + 46.4, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('b8_standard', { x: 800 + 46.0, y: 600 })).toBe(false);
    });

    it('⭐ findSpot nudges a small drop off a small Token to closer than a standard pair could sit', () => {
        placeAt('b8_small', 800, 600);
        const spot = MatPlacement.findSpot('b8_small', { x: 800, y: 600 });
        expect(spot).not.toBeNull();
        const d = Math.hypot(spot.x - 800, spot.y - 600);
        expect(d).toBeGreaterThanOrEqual(31.2 - 1e-6);
        expect(d).toBeLessThan(61.2);
    });

    it('a row of small drops lands with every pair clear of 31.2 u', () => {
        for (let i = 0; i < 8; i++) {
            const instance = BoardState.createTokenInstance('b8_small', tokenStartingUses('b8_small'));
            const result = Placement.placeTokenAt(instance, { x: 800, y: 600 });
            expect(result?.success ?? true).not.toBe(false);
        }
        const all = BoardState.tokens();
        expect(all.length).toBe(8);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
                expect(d).toBeGreaterThanOrEqual(31.2 - 1e-6);
            }
        }
    });

    it('the mat edge uses the smaller art circle', () => {
        expect(MatPlacement.isLegal('b8_small', { x: 32, y: 400 })).toBe(true);
        expect(MatPlacement.isLegal('b8_small', { x: 31.9, y: 400 })).toBe(false);
        expect(MatPlacement.isLegal('b8_small', { x: matW() - 32, y: 400 })).toBe(true);
        expect(MatPlacement.clampInside('b8_small', { x: 0, y: 0 })).toEqual({ x: 32, y: 32 });
    });

    it('a hero stands closer to a small Token (radius + STAND_GAP)', () => {
        const at = { x: 800, y: 600 };
        expect(HeroMotion.standingSpot('b8_small', at, 1).x - 800).toBe(32 + HeroMotion.STAND_GAP);
        expect(HeroMotion.standingSpot('b8_standard', at, 1).x - 800).toBe(64 + HeroMotion.STAND_GAP);
    });
});

describe('drawing: half-size art, whole pixel steps', () => {
    it('on the mat and in the hand: half; in listings: the full icon', () => {
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'b8_small')).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'b8_standard')).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.CARRY, 'b8_small')).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.FLOOR, 'b8_small')).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.TRAY, 'b8_small')).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.INSPECT, 'b8_small')).toBe(64);
        expect(tokenSizeFor(TOKEN_SURFACE.CATALOGUE, 'b8_small')).toBe(32);
        // A bare number is a footprint and means what it always did.
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 1)).toBe(128);
    });

    it('⭐ FP-99: at every fit a small Token lands on a whole multiple of 32 screen px, half the standard', () => {
        for (const fit of [0.1, 0.21, 0.31, 0.5, 0.75, 0.92, 1, 1.4, 2]) {
            const scale = boardScaleAt(fit);
            const smallScreen = tokenSizeFor(TOKEN_SURFACE.BOARD, 'b8_small', scale) * fit;
            const standardScreen = tokenSizeFor(TOKEN_SURFACE.BOARD, 'b8_standard', scale) * fit;
            expect(smallScreen).toBeCloseTo(boardArtSteps(fit) * 32, 6);
            expect(smallScreen).toBeCloseTo(standardScreen / 2, 6);
        }
    });
});

describe('on the mat (MatBoard)', () => {
    const h = React.createElement;
    const mount = (fit = 1) => render(h(EngineContext.Provider, { value: { GameState, EventBus } },
        h(MatFitProvider, { value: fit }, h(DndContext, null, h(MatBoard)))));

    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [];
    });
    afterEach(cleanup);

    function put(typeId, point) {
        const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(instance, point);
        return instance;
    }

    it('⭐ a small Token draws a 64 u box and 64 u art at 1:1; a standard one 128', () => {
        const small = put('b8_small', { x: 400, y: 400 });
        const standard = put('b8_standard', { x: 900, y: 400 });
        const { container } = mount(1);

        const art = container.querySelector(`[data-token-art][data-token-id="${small.id}"]`);
        expect(art.getAttribute('data-token-small')).toBe('true');
        expect(parseFloat(art.style.width)).toBe(64);
        expect(drawnPoint(art).x).toBe(small.x - 32);
        expect(parseFloat(art.querySelector('img').style.width)).toBe(64);

        const big = container.querySelector(`[data-token-art][data-token-id="${standard.id}"]`);
        expect(big.getAttribute('data-token-small')).toBeNull();
        expect(parseFloat(big.style.width)).toBe(128);
        expect(parseFloat(big.querySelector('img').style.width)).toBe(128);
    });

    it('⭐ the ring row under a small Token keeps full-size rings, hung just below the small box', () => {
        const spawner = put('b8_small_spawner', { x: 600, y: 500 });
        put('b8_standard', { x: 1200, y: 500 });
        const { container } = mount(1);

        const o = container.querySelector(`[data-token-overlay="${spawner.id}"]`);
        expect(parseFloat(o.style.width)).toBe(64);
        const row = o.querySelector('[data-ring-row]');
        expect(row).not.toBeNull();
        expect(drawnPoint(o).y + drawnPoint(row).y).toBeCloseTo(spawner.y + 32 + TOKEN_BAR_GAP_U, 5);
        const ring = row.querySelector('[data-ring="spawner"]');
        expect(parseFloat(ring.style.width)).toBe(RING_D_U);
        expect(parseFloat(ring.style.height)).toBe(RING_D_U);
    });
});

describe('corner badges on a small Token', () => {
    afterEach(cleanup);

    it('hang off the corners instead of covering the art; standard ones unchanged', () => {
        const { container } = render(React.createElement('div', null,
            React.createElement(DisallowBadge, { small: true }),
            React.createElement(StationGearBadge, { small: true, recipe: null })
        ));
        const marked = container.querySelectorAll('[data-badge-corner="small"]');
        expect(marked.length).toBe(2);
        for (const el of marked) expect(el.className).toMatch(/-top-3/);

        cleanup();
        const plain = render(React.createElement(DisallowBadge, {}));
        const el = plain.container.querySelector('[data-tile-disallowed]');
        expect(el.getAttribute('data-badge-corner')).toBeNull();
        expect(el.className).toMatch(/right-1 top-1/);
    });
});
