import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as boardConstants from '../ui/components/board/boardConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

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
                heroTiles: {},
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

    describe('Intersection Anchor Snapping', () => {
        it('calculates closest 2x2 anchor from cursor coordinates (center-aligned)', () => {
            // Center of 2x2 at top-left intersection (128, 128) -> anchor 0
            expect(boardConstants.closest2x2Anchor(128, 128)).toBe(0);

            // Center of 2x2 at (256, 128) -> col 1, row 0 -> anchor 1
            expect(boardConstants.closest2x2Anchor(256, 128)).toBe(1);

            // Center of 2x2 at (256, 256) -> col 1, row 1 -> anchor 8
            expect(boardConstants.closest2x2Anchor(256, 256)).toBe(8);

            // Near bottom-right edge (850, 850) -> clamped to col 5, row 5 -> anchor 40
            expect(boardConstants.closest2x2Anchor(850, 850)).toBe(40);

            // Negative coordinates clamp safely to (0, 0)
            expect(boardConstants.closest2x2Anchor(-50, -50)).toBe(0);
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
            expect(BoardState.getOccupyingToken(7).anchorIndex).toBe(0);
            expect(BoardState.getOccupyingToken(8).anchorIndex).toBe(0);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('pushes a single 1x1 token into an adjacent empty tile in its quadrant direction', () => {
            // Place 1x1 token at tile 8 (BR of anchor 0)
            const smallToken = makeToken('fixture_small_1');
            Placement.placeToken(8, smallToken);

            expect(BoardState.getToken(8)).toBe(smallToken);

            // Place 2x2 token at anchor 0 (footprint [0, 1, 7, 8])
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(0)).toBe(bigMill);
            // Tile 8 should be pushed down (to tile 15)
            expect(BoardState.getToken(15)).toBe(smallToken);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('cascades a line of multiple 1x1 tokens outward to an empty slot', () => {
            const tokenA = makeToken('fixture_small_1');
            const tokenB = makeToken('fixture_small_2');
            Placement.placeToken(8, tokenA);
            Placement.placeToken(15, tokenB);

            // Tile 22 is empty
            expect(BoardState.getToken(22)).toBeNull();

            // Place 2x2 token at anchor 0
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(0)).toBe(bigMill);
            // Token B shifted to 22, Token A shifted to 15
            expect(BoardState.getToken(22)).toBe(tokenB);
            expect(BoardState.getToken(15)).toBe(tokenA);
            expect(BoardState.getTray().length).toBe(0);
        });

        it('preserves assigned heroes on pushed tokens', () => {
            const smallToken = makeToken('fixture_small_1');
            Placement.placeToken(8, smallToken);
            BoardState.setHeroTile('hero_1', 8);

            expect(BoardState.heroOnTile(8)).toBe('hero_1');

            // Place 2x2 token at anchor 0
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(0, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(15)).toBe(smallToken);
            // Hero 1 should have moved with her token to tile 15
            expect(BoardState.heroOnTile(15)).toBe('hero_1');
            expect(BoardState.heroOnTile(8)).toBeNull();
        });

        it('pushes multiple tokens in different quadrants simultaneously', () => {
            // Anchor 8 footprint is [8, 9, 15, 16]
            // TL: 8, TR: 9, BL: 15, BR: 16
            const tokenTL = makeToken('fixture_small_1');
            const tokenTR = makeToken('fixture_small_2');
            const tokenBL = makeToken('fixture_small_3');
            const tokenBR = makeToken('fixture_small_4');

            Placement.placeToken(8, tokenTL);
            Placement.placeToken(9, tokenTR);
            Placement.placeToken(15, tokenBL);
            Placement.placeToken(16, tokenBR);

            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(8, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(8)).toBe(bigMill);

            // TL pushed Up to 1
            expect(BoardState.getToken(1)).toBe(tokenTL);
            // TR pushed Up to 2
            expect(BoardState.getToken(2)).toBe(tokenTR);
            // BL pushed Down to 22
            expect(BoardState.getToken(22)).toBe(tokenBL);
            // BR pushed Down to 23
            expect(BoardState.getToken(23)).toBe(tokenBR);

            expect(BoardState.getTray().length).toBe(0);
        });

        it('falls back to Tray displacement when all cascade directions are blocked', () => {
            // Place 2x2 token near bottom-right at anchor 40 (footprint [40, 41, 47, 48])
            // Tile 48 (BR corner) has no open down or right tiles
            const smallToken = makeToken('fixture_small_1');
            Placement.placeToken(48, smallToken);

            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(40, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(40)).toBe(bigMill);
            // Small token should have been displaced to Tray
            expect(BoardState.getTray()).toContain(smallToken);
        });

        it('refuses 2x2 placement when Tray is full and cascade is blocked', () => {
            // Fill Tray to 8 items
            for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
                BoardState.addToTray(makeToken('fixture_small_1'));
            }
            expect(BoardState.getTray().length).toBe(BoardState.TRAY_CAPACITY);

            // Place token on blocked corner 48
            Placement.placeToken(48, makeToken('fixture_small_2'));

            // Attempt to place 2x2 token at anchor 40
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(40, bigMill);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('No room in the Tray');
        });

        it('allows 2x2 placement on Tile 16 overlapping Tile 24', () => {
            // Tile 24 is now a standard placeable tile. Anchor 16 footprint is [16, 17, 23, 24]
            const bigMill = makeToken('fixture_big_mill');
            const result = Placement.placeToken(16, bigMill);

            expect(result.success).toBe(true);
            expect(BoardState.getToken(16)).toBe(bigMill);
        });
    });
});
