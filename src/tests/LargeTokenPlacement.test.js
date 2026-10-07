import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * 2×2 Tokens on the free playmat.
 */

/** Test layout only: a spot on a 160 u lattice, and the centre of a 2×2 over it. */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
const big = (i) => ({ x: C(i).x + 80, y: C(i).y + 80 });

describe('2×2 Large Token Mechanics', () => {
    beforeEach(() => {
        GameState.state = {
            board: {
                tokens: {},
                nextTokenOrder: 0,
                flags: {},
                nextFlagOrder: 0,
                tray: [],
                tokenBank: {},
                maps: []
            },
            // Both hold mining: a hero only works a Token whose skill they
            // hold, and a Token with no skill is not workable.
            heroes: [
                { id: 'hero_1', name: 'Althea', skills: { mining: { level: 5, xp: 0 } }, level: 1 },
                { id: 'hero_2', name: 'Brom', skills: { mining: { level: 5, xp: 0 } }, level: 1 }
            ]
        };

        registerTokenTypes({
            fixture_small_mine: {
                id: 'fixture_small_mine',
                name: 'Small Mine',
                size: 1,
                uses: 10,
                requiresHero: true,
                config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 5000, inputs: [], outputs: [] }
            },
            fixture_large_fortress: {
                id: 'fixture_large_fortress',
                name: 'Large Fortress',
                size: 2,
                uses: 50,
                requiresHero: true,
                config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, inputs: [], outputs: [] }
            },
            fixture_large_passive_monolith: {
                id: 'fixture_large_passive_monolith',
                name: 'Passive Monolith',
                size: 2,
                uses: 100,
                requiresHero: false,
                config: null
            }
        });
    });

    describe('Placement', () => {
        /**
         * ⭐ Free placement (slice 1.6d-1) deleted the 2×2 cascade: a large
         * Token dropped over small ones no longer shoves them sideways or into
         * the Tray. It moves ITSELF to the nearest spot that clears them, so the
         * arrangement the player built is never rearranged behind their back.
         */
        it('⭐ never displaces the small Tokens it is dropped over — it moves itself', () => {
            const s1 = BoardState.createTokenInstance('fixture_small_mine', 10);
            const s2 = BoardState.createTokenInstance('fixture_small_mine', 10);
            Placement.placeTokenAt(s1, C(0));
            Placement.placeTokenAt(s2, C(7));

            // Dropped straight onto the first one, with the second alongside.
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            const res = Placement.placeTokenAt(large, C(0));

            expect(res.success).toBe(true);
            // Both small Tokens are exactly where they were, and none went to the Tray.
            expect(BoardState.getTokenById(s1.id)).not.toBeNull();
            expect({ x: s1.x, y: s1.y }).toEqual(C(0));
            expect({ x: s2.x, y: s2.y }).toEqual(C(7));
            // The large Token stands clear of both — small-to-large is 99.6 u.
            const placed = BoardState.getTokenById(large.id);
            expect(Math.hypot(placed.x - s1.x, placed.y - s1.y)).toBeGreaterThanOrEqual(99.6 - 1e-6);
            expect(Math.hypot(placed.x - s2.x, placed.y - s2.y)).toBeGreaterThanOrEqual(99.6 - 1e-6);
        });
    });

    describe('Hero Assignment & Staffing', () => {
        it('a hero planted on a 2×2 Token works it', () => {
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            Placement.placeTokenAt(large, big(0));

            const res = Placement.plantFlagAt('hero_1', big(0));
            expect(res.success).toBe(true);

            expect(BoardState.workTokenOf('hero_1')).toBe(large.id);
            expect(BoardState.workerOf(large.id)).toBe('hero_1');
        });

        it('one hero per 2×2 Token: a second hero dropped on it does not take it (FP-25)', () => {
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            Placement.placeTokenAt(large, big(0));

            Placement.plantFlagAt('hero_1', big(0));
            expect(BoardState.workTokenOf('hero_1')).toBe(large.id);

            // Nobody is displaced any more (1.4b): the second flag simply stands there.
            const res2 = Placement.plantFlagAt('hero_2', big(0));
            expect(res2.success).toBe(true);

            expect(BoardState.workTokenOf('hero_1')).toBe(large.id);
            expect(BoardState.workTokenOf('hero_2')).toBeNull();
            expect(BoardState.flagOf('hero_2')).not.toBeNull();
        });

        it('a hero dropped on a passive 2×2 token plants there but never works it', () => {
            const passiveLarge = BoardState.createTokenInstance('fixture_large_passive_monolith', 100);
            Placement.placeTokenAt(passiveLarge, big(0));

            const res = Placement.plantFlagAt('hero_1', big(0));
            expect(res.success).toBe(true);
            expect(BoardState.workerOf(passiveLarge.id)).toBeNull();
            expect(BoardState.flagOf('hero_1')).not.toBeNull();
        });
    });
});
