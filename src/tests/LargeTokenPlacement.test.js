import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as adjacency from '../systems/board/adjacency.js';
import * as boardConstants from '../ui/components/board/boardConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

describe('2x2 Large Token Mechanics', () => {
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

        // Register test tokens with 1x1 and 2x2 sizes
        registerTokenTypes({
            fixture_small_mine: {
                id: 'fixture_small_mine',
                name: 'Small Mine',
                size: 1,
                uses: 10,
                requiresHero: true,
                config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
            },
            fixture_large_fortress: {
                id: 'fixture_large_fortress',
                name: 'Large Fortress',
                size: 2,
                uses: 50,
                requiresHero: true,
                config: { cycleTimeMs: 10000, inputs: [], outputs: [] }
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

    describe('Geometry & Bounds Checks', () => {
        it('calculates 4-tile footprint for 2x2 token', () => {
            const fp = boardConstants.tileFootprint(0, 2);
            expect(fp).toEqual([0, 1, 7, 8]);
        });

        it('validates in-bounds footprint and rejects right/bottom edge overflows', () => {
            expect(boardConstants.isFootprintInBounds(0, 2)).toBe(true);
            expect(boardConstants.isFootprintInBounds(6, 2)).toBe(false); // Col 6 is rightmost column
            expect(boardConstants.isFootprintInBounds(42, 2)).toBe(false); // Row 6 is bottom row
        });

        it('refuses placing 2x2 token that overflows board boundary', () => {
            const inst = BoardState.createTokenInstance('fixture_large_fortress');
            const resultRight = Placement.placeToken(6, inst); // Col 6
            expect(resultRight.success).toBe(false);
            expect(resultRight.reason).toContain('Token does not fit');

            const resultBottom = Placement.placeToken(42, inst); // Row 6
            expect(resultBottom.success).toBe(false);
            expect(resultBottom.reason).toContain('Token does not fit');
        });

        it('allows placing 2x2 token that overlaps Tile 24', () => {
            const inst = BoardState.createTokenInstance('fixture_large_fortress');
            // Tile 24 is now a standard placeable tile.
            expect(Placement.placeToken(16, inst).success).toBe(true);
            expect(BoardState.getToken(16)).toBe(inst);
        });
    });

    describe('Placement, Footprint & State Querying', () => {
        it('places a 2x2 token at anchor tile and query helpers recognize all 4 tiles', () => {
            const inst = BoardState.createTokenInstance('fixture_large_fortress', 50);
            const res = Placement.placeToken(0, inst);
            expect(res.success).toBe(true);

            expect(BoardState.getToken(0)).toBe(inst);
            expect(BoardState.getToken(1)).toBe(null); // Subordinate tiles don't hold duplicate objects

            // getOccupyingToken returns the token for all 4 tiles
            for (const t of [0, 1, 7, 8]) {
                const occ = BoardState.getOccupyingToken(t);
                expect(occ).not.toBe(null);
                expect(occ.anchorIndex).toBe(0);
                expect(occ.instance.typeId).toBe('fixture_large_fortress');
                expect(occ.footprint).toEqual([0, 1, 7, 8]);
                expect(BoardState.hasToken(t)).toBe(true);
            }

            expect(BoardState.getOccupyingToken(2)).toBe(null);
            expect(BoardState.hasToken(2)).toBe(false);

            // emptyTiles excludes all 4 tiles
            const empty = BoardState.emptyTiles();
            expect(empty).not.toContain(0);
            expect(empty).not.toContain(1);
            expect(empty).not.toContain(7);
            expect(empty).not.toContain(8);
            expect(empty).toContain(2);
        });

        it('displaces existing small tokens across all 4 covered tiles into the Tray', () => {
            const s1 = BoardState.createTokenInstance('fixture_small_mine', 10);
            const s2 = BoardState.createTokenInstance('fixture_small_mine', 10);
            Placement.placeToken(0, s1);
            Placement.placeToken(8, s2);

            expect(BoardState.getTray().length).toBe(0);

            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            const res = Placement.placeToken(0, large);

            expect(res.success).toBe(true);
            // Corner tile 0 has no valid cascade direction and is displaced to Tray
            expect(BoardState.getTray()).toContain(s1);
            // Tile 8 cascades/shifts down to tile 15
            expect(BoardState.getToken(15)).toBe(s2);
            expect(BoardState.getOccupyingToken(0).instance.typeId).toBe('fixture_large_fortress');
            expect(BoardState.getOccupyingToken(8).instance.typeId).toBe('fixture_large_fortress');
        });

        it('refuses placement if Tray has insufficient space for all displaced tokens', () => {
            // Fill tray to 18 items (TRAY_CAPACITY is 18)
            for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
                BoardState.addToTray(BoardState.createTokenInstance('fixture_small_mine'));
            }

            // Place small token at corner 0 (cannot cascade anywhere, must displace to Tray)
            Placement.placeToken(0, BoardState.createTokenInstance('fixture_small_mine'));

            // Tray is full, 1 token needs to be displaced to Tray
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            const res = Placement.placeToken(0, large);

            expect(res.success).toBe(false);
            expect(res.reason).toContain('No room in the Tray');
            expect(BoardState.getToken(0).typeId).toBe('fixture_small_mine');
        });
    });

    describe('Hero Assignment & Staffing', () => {
        it('assigns hero to anchor when placed on any of the 4 constituent tiles', () => {
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            Placement.placeToken(0, large);

            // Place hero on subordinate tile 8
            const res = Placement.placeHero('hero_1', 8);
            expect(res.success).toBe(true);
            expect(res.workedTile).toBe(0);

            // Hero is recorded at anchor tile 0
            expect(BoardState.tileOfHero('hero_1')).toBe(0);
            expect(BoardState.heroOnTile(0)).toBe('hero_1');
        });

        it('pushes previous hero to adjacent cell when dropping a new hero onto 2x2 token', () => {
            const large = BoardState.createTokenInstance('fixture_large_fortress', 50);
            Placement.placeToken(0, large);

            Placement.placeHero('hero_1', 1);
            expect(BoardState.tileOfHero('hero_1')).toBe(0);

            // Place hero_2 on tile 7
            const res2 = Placement.placeHero('hero_2', 7);
            expect(res2.success).toBe(true);
            expect(res2.displacedHeroId).toBe('hero_1');

            expect(BoardState.tileOfHero('hero_2')).toBe(0);
            // hero_1 is pushed to an adjacent free cell
            expect(res2.heroPushTarget).toBeDefined();
            expect(BoardState.tileOfHero('hero_1')).toBe(res2.heroPushTarget);
        });

        it('refuses placing hero on passive 2x2 token', () => {
            const passiveLarge = BoardState.createTokenInstance('fixture_large_passive_monolith', 100);
            Placement.placeToken(0, passiveLarge);

            const res = Placement.placeHero('hero_1', 0);
            expect(res.success).toBe(false);
            expect(res.reason).toContain('operates passively');
        });
    });

    describe('12-Tile Perimeter Adjacency', () => {
        it('computes 12 surrounding tiles for an interior 2x2 footprint', () => {
            // Anchor at tile 8 (row 1, col 1) on 7x7
            // Footprint is [8, 9, 15, 16] (rows 1-2, cols 1-2)
            // Exterior perimeter should be 12 tiles:
            // Top row: 0, 1, 2, 3
            // Row 1: 7, 10
            // Row 2: 14, 17
            // Bottom row: 21, 22, 23, 24
            const footprint = boardConstants.tileFootprint(8, 2);
            expect(footprint).toEqual([8, 9, 15, 16]);

            const perim = adjacency.neighboursOfFootprint(footprint);
            expect(perim).toEqual([0, 1, 2, 3, 7, 10, 14, 17, 21, 22, 23, 24]);
            expect(perim.length).toBe(12);
        });

        it('computes perimeter neighbours along corner/edges correctly', () => {
            // Anchor at tile 0 (row 0, col 0)
            // Footprint: [0, 1, 7, 8]
            // Perimeter should be:
            // Right of row 0: 2
            // Right of row 1: 9
            // Row below (row 2): 14, 15, 16
            const fpCorner = boardConstants.tileFootprint(0, 2);
            const perimCorner = adjacency.neighboursOfFootprint(fpCorner);
            expect(perimCorner).toEqual([2, 9, 14, 15, 16]);
            expect(perimCorner.length).toBe(5);
        });
    });
});
