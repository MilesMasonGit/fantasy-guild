import { describe, it, expect, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { resetMatTuning, matTuning, matTuningDefault } from '../config/matTuning.js';
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
 * ⭐ The shipped spacing has to leave room for the game's whole Token cap: every Token the mat may
 * hold finds a legal spot on a shipped mat, and a place written at the most nodes a map may hold
 * has all of them on it.
 */
afterEach(() => { clearMat(); resetMatTuning(); });

describe('⭐ the spacing the game ships', () => {
    it('two standard Tokens sit 81 u apart at the closest, a step wider than the old 70', () => {
        expect(matTuningDefault('overlapPct')).toBe(30);
        expect(matTuningDefault('hitboxPct')).toBe(90);
        expect(MatPlacement.minGap('fixture_passive', 'fixture_passive')).toBeCloseTo(81.2, 6);
    });

    it('⭐ a mat fills to the Token cap, wherever each one is aimed', () => {
        GameState.initNew();
        for (const seed of [1, 2, 3]) {
            clearMat();
            const random = mulberry32(seed);
            for (let n = 0; n < BASE_TOKEN_CAP; n++) {
                const aim = { x: 64 + random() * 1792, y: 64 + random() * 912 };
                const spot = MatPlacement.findSpotAnywhere('fixture_passive', aim);
                expect(spot, `seed ${seed}: Token ${n + 1} of ${BASE_TOKEN_CAP}`).not.toBeNull();
                placeAt('fixture_passive', spot.x, spot.y);
            }
        }
    });

    it('⭐ a place written with all the nodes a map may hold has every one on it, none closer than the rule', () => {
        const summary = budget([{
            id: 'full', kind: 'base', biome: 'meadow', points: 64, nodes: [{ typeId: 'fixture_passive', weight: 1 }]
        }], { cap: BASE_TOKEN_CAP });
        const crowding = shippedCrowding();
        const gap = 2 * Math.round(64 * crowding.hitboxPct / 100) * (1 - crowding.overlapPct / 100);
        for (let i = 0; i < 12; i++) {
            const result = layout(summary, { seed: seedFromText(`spacing-${i}`), mat: shippedMat(), crowding, artRadius: () => 64 });
            expect(result.unplaced).toEqual([]);
            expect(result.nodes.length).toBe(summary.entries.reduce((n, e) => n + e.count, 0));
            for (let a = 0; a < result.nodes.length; a++) {
                for (let b = a + 1; b < result.nodes.length; b++) {
                    const d = Math.hypot(result.nodes[a].x - result.nodes[b].x, result.nodes[a].y - result.nodes[b].y);
                    expect(d).toBeGreaterThanOrEqual(gap - 1e-6);
                }
            }
        }
    });

    it('the hover lift is off in the shipped game', () => {
        expect(matTuning('hoverLift')).toBe(0);
    });
});
