import { describe, it, expect, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { resetMatTuning, matTuning, matTuningDefault } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { reachRadius } from '../systems/board/nearby.js';
import * as BoardState from '../systems/board/BoardState.js';
import { BASE_TOKEN_CAP } from '../systems/board/MatCap.js';
import { budget } from '../systems/atlas/Budget.js';
import { layout } from '../systems/atlas/Layout.js';
import { shippedMat, shippedCrowding } from '../systems/atlas/layoutInputs.js';
import { mulberry32, seedFromText } from '../systems/atlas/seededRandom.js';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ The shipped spacing (owner 2026-11-26): Tokens never overlap. The closest two may stand is
 * edges touching, 128 u centre to centre for two standard Tokens, and the one reach stays 240 u.
 */
afterEach(() => { clearMat(); resetMatTuning(); });

registerTokenTypes({
    spacing_big: {
        id: 'spacing_big', name: 'Spacing Big', tokenType: 'passive', sprite: 's_social',
        size: 2, uses: 100, requiresHero: false, config: null
    }
});

/** Every Token on the mat, with how many others stand within the standard reach of it. */
function crowdOf(tokens, reach) {
    return tokens.map(a => tokens.filter(b => b !== a && Math.hypot(a.x - b.x, a.y - b.y) <= reach).length);
}

describe('⭐ the spacing the game ships: edges touching, never overlapping', () => {
    it('hitbox 100 %, overlap 0 %: two standard Tokens stand 128 u apart at the closest', () => {
        expect(matTuningDefault('hitboxPct')).toBe(100);
        expect(matTuningDefault('overlapPct')).toBe(0);
        expect(MatPlacement.hitRadiusOf('fixture_passive')).toBe(64);
        expect(MatPlacement.minGap('fixture_passive', 'fixture_passive')).toBe(128);
    });

    it('a 2×2 follows from the same rule: its whole art, edges touching', () => {
        expect(MatPlacement.hitRadiusOf('spacing_big')).toBe(144);
        expect(MatPlacement.minGap('spacing_big', 'fixture_passive')).toBe(208);
        expect(MatPlacement.minGap('spacing_big', 'spacing_big')).toBe(288);
    });

    it('edges touching is legal; any overlap is refused, and so is the old closest (81 u)', () => {
        GameState.initNew();
        clearMat();
        placeAt('fixture_passive', 800, 500);
        expect(MatPlacement.isLegal('fixture_passive', { x: 928, y: 500 })).toBe(true);
        expect(MatPlacement.isLegal('fixture_passive', { x: 927.5, y: 500 })).toBe(false);
        expect(MatPlacement.isLegal('fixture_passive', { x: 881, y: 500 })).toBe(false);
        placeAt('spacing_big', 1300, 500);
        expect(MatPlacement.isLegal('fixture_passive', { x: 1300 - 208, y: 500 })).toBe(true);
        expect(MatPlacement.isLegal('fixture_passive', { x: 1300 - 207.5, y: 500 })).toBe(false);
    });

    it('a drop onto a Token is nudged out to edges touching', () => {
        GameState.initNew();
        clearMat();
        placeAt('fixture_passive', 800, 500);
        const spot = MatPlacement.findSpot('fixture_passive', { x: 830, y: 500 });
        expect(spot).not.toBeNull();
        const d = Math.hypot(spot.x - 800, spot.y - 500);
        expect(d).toBeGreaterThanOrEqual(128 - 1e-6);
        expect(d).toBeLessThan(136);
    });

    it('⭐ the reach stays 240 u: the game value, the tuner row and the live reach', () => {
        expect(STANDARD_REACH_U).toBe(240);
        expect(matTuningDefault('reach')).toBe(240);
        expect(reachRadius()).toBe(240);
    });

    it('⭐ a mat filled at random never has 13 Tokens within reach of one, and every pair is clear of 128 u', () => {
        GameState.initNew();
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            clearMat();
            const random = mulberry32(seed);
            for (let n = 0; n < BASE_TOKEN_CAP; n++) {
                const aim = { x: 64 + random() * 1792, y: 64 + random() * 912 };
                const spot = MatPlacement.findSpotAnywhere('fixture_passive', aim);
                if (!spot) break;
                placeAt('fixture_passive', spot.x, spot.y);
            }
            const tokens = BoardState.tokens();
            expect(tokens.length, `seed ${seed}: the mat takes a good many`).toBeGreaterThan(60);
            expect(Math.max(...crowdOf(tokens, reachRadius())), `seed ${seed}`).toBeLessThanOrEqual(12);
            for (let a = 0; a < tokens.length; a++) {
                for (let b = a + 1; b < tokens.length; b++) {
                    expect(Math.hypot(tokens[a].x - tokens[b].x, tokens[a].y - tokens[b].y)).toBeGreaterThanOrEqual(128 - 1e-6);
                }
            }
        }
    });

    it('⭐ a place written with all the nodes a map may hold has nearly every one on it, none closer than 128 u', () => {
        const summary = budget([{
            id: 'full', kind: 'base', biome: 'meadow', points: 64, nodes: [{ typeId: 'fixture_passive', weight: 1 }]
        }], { cap: BASE_TOKEN_CAP });
        const total = summary.entries.reduce((n, e) => n + e.count, 0);
        const crowding = shippedCrowding();
        expect(crowding).toEqual({ hitboxPct: 100, overlapPct: 0 });
        // ⚠️ A map's 64 nodes are close to what the mat holds edges touching, round the Hall's
        // clearing: now and then one finds no room and is left out, as a drop on a full mat is.
        let left = 0;
        for (let i = 0; i < 12; i++) {
            const result = layout(summary, { seed: seedFromText(`spacing-${i}`), mat: shippedMat(), crowding, artRadius: () => 64 });
            left += result.unplaced.length;
            expect(result.nodes.length + result.unplaced.length).toBe(total);
            for (let a = 0; a < result.nodes.length; a++) {
                for (let b = a + 1; b < result.nodes.length; b++) {
                    const d = Math.hypot(result.nodes[a].x - result.nodes[b].x, result.nodes[a].y - result.nodes[b].y);
                    expect(d).toBeGreaterThanOrEqual(128 - 1e-6);
                }
            }
        }
        expect(left).toBeLessThanOrEqual(3);
    });

    it('the hover lift is off in the shipped game', () => {
        expect(matTuning('hoverLift')).toBe(0);
    });
});
