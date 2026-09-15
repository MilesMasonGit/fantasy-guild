import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as boardConstants from '../ui/components/board/boardConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { idAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const makeToken = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

describe('Cascade Placement & 2x2 Snapping', () => {
    beforeEach(() => {
        GameState.state = {
            board: {
                tiles: {},
                flags: {},
                vacancies: {},
                tray: [],
                tokenBank: {},
                maps: []
            },
            heroes: [
                { id: 'hero_1', name: 'Althea', skills: {}, level: 1 },
                { id: 'hero_2', name: 'Brom', skills: {}, level: 1 }
            ]
        };

        registerTokenTypes({
            fixture_small_1: {
                id: 'fixture_small_1',
                name: 'Small 1',
                size: 1,
                uses: 10,
                requiresHero: true
            },
            fixture_small_2: {
                id: 'fixture_small_2',
                name: 'Small 2',
                size: 1,
                uses: 10,
                requiresHero: true
            },
            fixture_small_3: {
                id: 'fixture_small_3',
                name: 'Small 3',
                size: 1,
                uses: 10,
                requiresHero: true
            },
            fixture_small_4: {
                id: 'fixture_small_4',
                name: 'Small 4',
                size: 1,
                uses: 10,
                requiresHero: true
            },
            fixture_big_mill: {
                id: 'fixture_big_mill',
                name: 'Big Mill',
                size: 2,
                uses: 50,
                requiresHero: true
            },
            fixture_big_passive: {
                id: 'fixture_big_passive',
                name: 'Big Passive Monument',
                size: 2,
                uses: 50,
                requiresHero: false
            }
        });
    });

    describe('Directional Cascade Pushing', () => {
        it('places into empty space without shifting anything', () => {
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(0)).toBe(bigMill);
            expect(BoardState.getOccupyingToken(0).anchorIndex).toBe(0);
            expect(BoardState.getOccupyingToken(1).anchorIndex).toBe(0);
            expect(BoardState.getOccupyingToken(6).anchorIndex).toBe(0);
            expect(BoardState.getOccupyingToken(7).anchorIndex).toBe(0);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('pushes a single 1x1 token into an adjacent empty tile in its quadrant direction', () => {
            // Place 1x1 token at tile 7 (BR of anchor 0)
            const smallToken = makeToken('fixture_small_1');
            Placement.placeToken(7, smallToken);

            expect(BoardState.getToken(7)).toBe(smallToken);

            // Place 2x2 token at anchor 0 (footprint [0, 1, 6, 7])
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(0)).toBe(bigMill);
            // Tile 7 should be pushed down (to tile 13)
            expect(BoardState.getToken(13)).toBe(smallToken);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('cascades a line of multiple 1x1 tokens outward to an empty slot', () => {
            const tokenA = makeToken('fixture_small_1');
            const tokenB = makeToken('fixture_small_2');
            Placement.placeToken(7, tokenA);
            Placement.placeToken(13, tokenB);

            // Tile 19 is empty
            expect(BoardState.getToken(19)).toBeNull();

            // Place 2x2 token at anchor 0
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(0)).toBe(bigMill);
            // Token B shifted to 19, Token A shifted to 13
            expect(BoardState.getToken(19)).toBe(tokenB);
            expect(BoardState.getToken(13)).toBe(tokenA);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('preserves assigned heroes on pushed tokens', () => {
            // Free Playmat 1.4b: the hero's claim follows the pushed instance.
            // A hero only works a Token with a work cycle and a skill they hold
            // (FP-47, FP-48), so this Token has both and the hero holds it.
            registerTokenTypes({
                fixture_small_worked: {
                    id: 'fixture_small_worked', name: 'Small Worked', size: 1, uses: 10, requiresHero: true,
                    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 5000, inputs: [], outputs: [] }
                }
            });
            GameState.state.heroes[0].skills = { mining: { level: 5, xp: 0 } };
            const smallToken = makeToken('fixture_small_worked');
            Placement.placeToken(7, smallToken);
            Placement.placeHero('hero_1', 7);

            expect(BoardState.workerOf(idAt(7))).toBe('hero_1');

            // Place 2x2 token at anchor 0
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(13)).toBe(smallToken);
            // Hero 1 should have moved with her token to tile 13
            expect(BoardState.workerOf(idAt(13))).toBe('hero_1');
            // Tile 7 is now under the big mill, which nobody works.
            expect(BoardState.workerOf(idAt(7))).toBeNull();
        });

        it('pushes multiple tokens in different quadrants simultaneously', () => {
            // Anchor 7 footprint is [7, 8, 13, 14]
            // TL: 7, TR: 8, BL: 13, BR: 14
            const tokenTL = makeToken('fixture_small_1');
            const tokenTR = makeToken('fixture_small_2');
            const tokenBL = makeToken('fixture_small_3');
            const tokenBR = makeToken('fixture_small_4');

            Placement.placeToken(7, tokenTL);
            Placement.placeToken(8, tokenTR);
            Placement.placeToken(13, tokenBL);
            Placement.placeToken(14, tokenBR);

            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(7, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(7)).toBe(bigMill);

            // TL pushed Up to 1
            expect(BoardState.getToken(1)).toBe(tokenTL);
            // TR pushed Up to 2
            expect(BoardState.getToken(2)).toBe(tokenTR);
            // BL pushed Down to 19
            expect(BoardState.getToken(19)).toBe(tokenBL);
            // BR pushed Down to 20
            expect(BoardState.getToken(20)).toBe(tokenBR);

            expect(BoardState.getTray().length).toBe(0);
        });

        it('falls back to Tray displacement when all cascade directions are blocked', () => {
            // Place 2x2 token near bottom-right at anchor 28 (footprint [28, 29, 34, 35])
            // Tile 35 (BR corner) has no open down or right tiles
            const smallToken = makeToken('fixture_small_1');
            Placement.placeToken(35, smallToken);

            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(28, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(28)).toBe(bigMill);
            // Small token should have been displaced to Tray
            expect(BoardState.getTray()).toContain(smallToken);
        });

        it('refuses 2x2 placement when Tray is full and cascade is blocked', () => {
            // Fill Tray to 8 items
            for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
                BoardState.addToTray(makeToken('fixture_small_1'));
            }
            expect(BoardState.getTray().length).toBe(BoardState.TRAY_CAPACITY);

            // Place token on blocked corner 35
            Placement.placeToken(35, makeToken('fixture_small_2'));

            // Attempt to place 2x2 token at anchor 28
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(28, bigMill);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('No room in the Tray');
        });

        it('allows 2x2 placement overlapping the Guild Hall tile', () => {
            // The Guild Hall tile is a standard placeable tile. Anchor 14 footprint is [14, 15, 20, 21]
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(14, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(14)).toBe(bigMill);
        });
    });
});
