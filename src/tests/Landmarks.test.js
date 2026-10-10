import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as DiscardBin from '../systems/board/DiscardBin.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import { registerTokenTypes, isLandmarkType } from '../config/registries/tokenRegistry.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ A landmark (an endgame site, `landmark: true` on its type) stands outside the Token cap, is
 * never pushed, cannot be moved by the player and cannot be demolished.
 */

registerTokenTypes({
    fixture_lm_site: {
        id: 'fixture_lm_site', name: 'Fixture Site', tokenType: 'resource', landmark: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 1, sprite: 'skill_nature',
        config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 60000, xp: 0, inputs: [], outputs: [] }
    },
    fixture_lm_plain: {
        id: 'fixture_lm_plain', name: 'Fixture Plain', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, size: 1, sprite: 'skill_nature'
    },
    fixture_lm_big: {
        id: 'fixture_lm_big', name: 'Fixture Big', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, size: 2, sprite: 'skill_nature'
    }
});

beforeEach(() => {
    GameState.initNew();
    Landmarks.setLayoutEditing(false);
});

afterEach(() => {
    Landmarks.setLayoutEditing(false);
});

describe('a landmark is a Token type flag', () => {
    it('reads `landmark: true` from the type, and nothing else', () => {
        expect(isLandmarkType('fixture_lm_site')).toBe(true);
        expect(isLandmarkType('fixture_lm_plain')).toBe(false);
        expect(isLandmarkType('no_such_type')).toBe(false);
        expect(Landmarks.isLandmark(placeAt('fixture_lm_site', 300, 300))).toBe(true);
    });

    it('stands outside the Token cap', () => {
        placeAt('fixture_lm_site', 300, 300);
        placeAt('fixture_lm_plain', 600, 300);
        expect(MatCap.tokenCount()).toBe(1);
    });
});

describe('a landmark is never pushed', () => {
    it('an arrival that would push it lands elsewhere and leaves it where it stands', () => {
        const site = placeAt('fixture_lm_site', 400, 400);
        const spot = MatPlacement.forceSpot('fixture_lm_plain', { x: 430, y: 400 });
        expect(spot).toBeTruthy();
        expect(spot.pushed.map(p => p.id)).not.toContain(site.id);
    });

    it('the same arrival pushes an ordinary Token (the control)', () => {
        const plain = placeAt('fixture_lm_plain', 400, 400);
        const spot = MatPlacement.forceSpot('fixture_lm_plain', { x: 430, y: 400 });
        expect(spot.pushed.map(p => p.id)).toContain(plain.id);
    });

    it('a Token growing bigger beside it does not shove it, even where placed Tokens may be pushed', () => {
        const site = placeAt('fixture_lm_site', 400, 400);
        const small = placeAt('fixture_lm_plain', 480, 400);
        const grown = EffectActions.transformInstance(small, 'fixture_lm_big');
        expect(grown).toBeTruthy();
        expect(BoardState.getTokenById(site.id)).toMatchObject({ x: 400, y: 400 });
    });

    it('the same growth shoves an ordinary placed Token (the control)', () => {
        const plain = placeAt('fixture_lm_plain', 400, 400);
        const small = placeAt('fixture_lm_plain', 480, 400);
        EffectActions.transformInstance(small, 'fixture_lm_big');
        expect(BoardState.getTokenById(plain.id).x).not.toBe(400);
    });
});

describe('the player cannot move a landmark', () => {
    it('a drag to another point is refused and it stays put', () => {
        const site = placeAt('fixture_lm_site', 400, 400);
        const res = Placement.moveTokenTo(site.id, { x: 900, y: 600 });
        expect(res.success).toBe(false);
        expect(res.reason).toMatch(/cannot be moved/);
        expect(BoardState.getTokenById(site.id)).toMatchObject({ x: 400, y: 400 });
    });

    it('an ordinary Token still moves', () => {
        const plain = placeAt('fixture_lm_plain', 400, 400);
        expect(Placement.moveTokenTo(plain.id, { x: 900, y: 600 }).success).toBe(true);
    });

    it('the dev layout tool lifts the rule while it is on', () => {
        const site = placeAt('fixture_lm_site', 400, 400);
        Landmarks.setLayoutEditing(true);
        expect(Placement.moveTokenTo(site.id, { x: 900, y: 600 }).success).toBe(true);
        expect(BoardState.getTokenById(site.id)).toMatchObject({ x: 900, y: 600 });
    });
});

describe('a landmark cannot be demolished', () => {
    it('canDemolish: no for the Guild Hall and a landmark, yes for an ordinary Token', () => {
        expect(Demolition.canDemolish(placeAt('token_guild_hall', 880, 563))).toBe(false);
        expect(Demolition.canDemolish(placeAt('fixture_lm_site', 300, 300))).toBe(false);
        expect(Demolition.canDemolish(placeAt('fixture_lm_plain', 600, 300))).toBe(true);
        expect(Demolition.canDemolish(null)).toBe(false);
    });

    it('the discard bin refuses it', () => {
        const site = placeAt('fixture_lm_site', 300, 300);
        const res = DiscardBin.binToken(site.id);
        expect(res.success).toBe(false);
        expect(res.reason).toMatch(/cannot be discarded/);
        expect(BoardState.getTokenById(site.id)).toBeTruthy();
        const plain = placeAt('fixture_lm_plain', 600, 300);
        expect(DiscardBin.binToken(plain.id).success).toBe(true);
    });

    it('removing it for good is refused', () => {
        const site = placeAt('fixture_lm_site', 300, 300);
        expect(Placement.removePlacedToken(site.id).success).toBe(false);
        expect(BoardState.getTokenById(site.id)).toBeTruthy();
    });

    it('the dev layout tool lets the owner take a misplaced one off', () => {
        const site = placeAt('fixture_lm_site', 300, 300);
        Landmarks.setLayoutEditing(true);
        expect(Demolition.canDemolish(site)).toBe(true);
        expect(DiscardBin.binToken(site.id).success).toBe(true);
    });
});
