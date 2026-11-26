// @vitest-environment jsdom
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
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import * as MatGeometry from '../config/matGeometry.js';
import { artRadiusOf, matW } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, boardArtSteps } from '../ui/components/base/TokenSprite.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { nameFootOf } from '../ui/components/board/matMarks.js';
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
 * ⭐ One Token size (owner 2026-11-26): the half-size "small" Token is retired. Every Token is drawn
 * and spaced as a standard one, whatever its old `artSize` says; a Token still carrying the field
 * gets an audit line until a change pack removes it. A 32 px picture is drawn at the standard size,
 * so at twice its old size, until the owner's 64 px art replaces it.
 */

const CFG = { cycleTimeMs: 5000, inputs: [], outputs: [] };

registerTokenTypes({
    one_standard: {
        id: 'one_standard', name: 'One Standard', tokenType: 'resource', sprite: 's_nature',
        size: 1, uses: 100, requiresHero: false, config: CFG
    },
    one_was_small: {
        id: 'one_was_small', name: 'One Was Small', tokenType: 'resource', sprite: 's_nature',
        size: 1, artSize: 'small', uses: 100, requiresHero: false, config: CFG
    },
    one_big_was_small: {
        id: 'one_big_was_small', name: 'One Big Was Small', tokenType: 'resource', sprite: 's_nature',
        size: 2, artSize: 'small', uses: 100, requiresHero: false, config: CFG
    }
});

beforeEach(() => {
    GameState.initNew();
    clearMat();
    resetMatTuning();
});

describe('⭐ one size: the game reads a leftover artSize as the standard', () => {
    it('the small-Token helpers are gone', () => {
        expect(MatGeometry.isSmallToken).toBeUndefined();
        expect(MatGeometry.tokenBodyScale).toBeUndefined();
        expect(MatGeometry.SMALL_TOKEN_SCALE).toBeUndefined();
    });

    it('a Token marked small has a standard 1×1 body: art radius, hitbox and gaps', () => {
        expect(artRadiusOf('one_was_small')).toBe(64);
        expect(artRadiusOf('one_standard')).toBe(64);
        expect(artRadiusOf('one_big_was_small')).toBe(144);
        expect(MatPlacement.hitRadiusOf('one_was_small')).toBe(64);
        expect(MatPlacement.minGap('one_was_small', 'one_was_small')).toBe(128);
        expect(MatPlacement.minGap('one_was_small', 'one_standard')).toBe(128);
    });

    it('it is hit, clamped and stood beside as a standard one', () => {
        const was = placeAt('one_was_small', 800, 400);
        expect(Flags.pointOnToken(was, { x: 860, y: 400 })).toBe(true);
        expect(Flags.tokenAtPoint({ x: 860, y: 400 })?.id).toBe(was.id);
        expect(MatPlacement.isLegal('one_was_small', { x: 64, y: 600 })).toBe(true);
        expect(MatPlacement.isLegal('one_was_small', { x: 63.9, y: 600 })).toBe(false);
        expect(MatPlacement.clampInside('one_was_small', { x: 0, y: 0 })).toEqual({ x: 64, y: 64 });
        expect(MatPlacement.isLegal('one_was_small', { x: matW() - 64, y: 600 })).toBe(true);
        expect(HeroMotion.standingSpot('one_was_small', { x: 800, y: 600 }, 1).x - 800).toBe(64 + HeroMotion.STAND_GAP);
    });

    it('drawn at the standard size on every surface, the mat and the hand included', () => {
        for (const surface of Object.values(TOKEN_SURFACE)) {
            expect(tokenSizeFor(surface, 'one_was_small'), surface).toBe(tokenSizeFor(surface, 'one_standard'));
        }
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'one_was_small')).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.CARRY, 'one_was_small')).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.FLOOR, 'one_was_small')).toBe(128);
        expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'one_big_was_small')).toBe(256);
    });

    it('⭐ at every fit it lands on a whole multiple of 64 screen px, as a standard Token does', () => {
        for (const fit of [0.1, 0.21, 0.31, 0.5, 0.75, 0.92, 1, 1.4, 2]) {
            const scale = boardScaleAt(fit);
            expect(tokenSizeFor(TOKEN_SURFACE.BOARD, 'one_was_small', scale) * fit).toBeCloseTo(boardArtSteps(fit) * 64, 6);
        }
    });

    it('⭐ the former small Tokens in the shipped content draw at the standard size: a 32 px stump at twice its old 64 u', () => {
        for (const id of ['token_oak_stump', 'token_wolf', 'token_wheat_sprout']) {
            expect(artRadiusOf(id), id).toBe(64);
            expect(tokenSizeFor(TOKEN_SURFACE.BOARD, id), id).toBe(128);
        }
    });
});

describe('⭐ the audit names a Token still carrying the field', () => {
    const linesOf = (id) => auditContent().filter(f => f.where === `Token "${id}"`).map(f => f.what);

    it('one line on a Token marked small, 1×1 or 2×2; none on one without the field', () => {
        const line = 'still carries a Token Size ("small"), which the game no longer reads: every Token is drawn and spaced at one size. A change pack removes it.';
        expect(linesOf('one_was_small')).toContain(line);
        expect(linesOf('one_big_was_small')).toContain(line);
        expect(linesOf('one_standard').some(w => w.includes('Token Size'))).toBe(false);
    });
});

describe('on the mat (MatBoard)', () => {
    const h = React.createElement;
    const mount = (fit = 1) => render(h(MatFitProvider, { value: fit }, h(DndContext, null, h(MatBoard))));

    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [];
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    function put(typeId, point) {
        const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(instance, point);
        return instance;
    }

    it('⭐ a Token marked small draws a 128 u box and 128 u art, exactly as a standard one', () => {
        const was = put('one_was_small', { x: 400, y: 400 });
        const standard = put('one_standard', { x: 900, y: 400 });
        const { container } = mount(1);
        for (const t of [was, standard]) {
            const art = container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
            expect(art.hasAttribute('data-token-small')).toBe(false);
            expect(parseFloat(art.style.width)).toBe(128);
            expect(drawnPoint(art).x).toBe(t.x - 64);
            expect(parseFloat(art.querySelector('img').style.width)).toBe(128);
        }
        const o = container.querySelector(`[data-token-overlay="${was.id}"]`);
        expect(parseFloat(o.style.width)).toBe(128);
        expect(nameFootOf('one_was_small', 1)).toBe(nameFootOf('one_standard', 1));
    });
});
