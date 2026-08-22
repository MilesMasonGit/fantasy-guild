import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import { getTilePushVectors } from '../ui/components/board/boardConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

describe('Token & Hero Displacement Logic', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    it('calculates outward quadrant push vectors correctly for board tiles', () => {
        // Tile 0 (Top-Left): pushes Up (dRow -1) primary, Left (dCol -1) secondary
        const tl = getTilePushVectors(0);
        expect(tl.primary).toEqual({ dRow: -1, dCol: 0 });
        expect(tl.secondary).toEqual({ dRow: 0, dCol: -1 });

        // Tile 6 (Top-Right): pushes Up (dRow -1) primary, Right (dCol 1) secondary
        const tr = getTilePushVectors(6);
        expect(tr.primary).toEqual({ dRow: -1, dCol: 0 });
        expect(tr.secondary).toEqual({ dRow: 0, dCol: 1 });

        // Tile 42 (Bottom-Left): pushes Down (dRow 1) primary, Left (dCol -1) secondary
        const bl = getTilePushVectors(42);
        expect(bl.primary).toEqual({ dRow: 1, dCol: 0 });
        expect(bl.secondary).toEqual({ dRow: 0, dCol: -1 });

        // Tile 48 (Bottom-Right): pushes Down (dRow 1) primary, Right (dCol 1) secondary
        const br = getTilePushVectors(48);
        expect(br.primary).toEqual({ dRow: 1, dCol: 0 });
        expect(br.secondary).toEqual({ dRow: 0, dCol: 1 });
    });

    it('pushes covered 1x1 token to primary adjacent quadrant cell when available', () => {
        // Tile 8 (row 1, col 1): primary push is Up (dRow -1 -> tile 1)
        const tok1 = { id: 'tok_1', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_2', typeId: 'token_woodcutter' };

        BoardState.setToken(8, tok1);
        expect(BoardState.getToken(8)?.id).toBe('tok_1');
        expect(BoardState.getToken(1)).toBeNull();

        const res = Placement.placeToken(8, tok2);
        expect(res.success).toBe(true);

        // New token is on tile 8
        expect(BoardState.getToken(8)?.id).toBe('tok_2');
        // Pushed token moved to primary adjacent cell (tile 1)
        expect(BoardState.getToken(1)?.id).toBe('tok_1');
    });

    it('pushes covered 1x1 token to secondary quadrant cell when primary is occupied', () => {
        // Tile 8 (row 1, col 1): primary is tile 1, secondary is tile 7 (row 1, col 0)
        const tok1 = { id: 'tok_1', typeId: 'token_woodcutter' };
        const blocker = { id: 'tok_blocker', typeId: 'token_woodcutter' };
        const tokNew = { id: 'tok_new', typeId: 'token_woodcutter' };

        BoardState.setToken(8, tok1);
        BoardState.setToken(1, blocker); // Block primary push cell

        const res = Placement.placeToken(8, tokNew);
        expect(res.success).toBe(true);

        expect(BoardState.getToken(8)?.id).toBe('tok_new');
        expect(BoardState.getToken(1)?.id).toBe('tok_blocker');
        // Pushed to secondary cell (tile 7)
        expect(BoardState.getToken(7)?.id).toBe('tok_1');
    });

    it('pushes in secondary/tertiary directions when primary outward direction is out of bounds', () => {
        // Tile 0 (corner): Up and Left are out of bounds; pushes to tile 1 (Right)
        const tok1 = { id: 'tok_corner', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_incoming', typeId: 'token_woodcutter' };

        BoardState.setToken(0, tok1);

        const pushedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_PUSHED, e => pushedEvents.push(e));

        const res = Placement.placeToken(0, tok2);
        expect(res.success).toBe(true);

        expect(BoardState.getToken(0)?.id).toBe('tok_incoming');
        // Pushed into tile 1
        expect(BoardState.getToken(1)?.id).toBe('tok_corner');

        // Smooth slide animation event published!
        expect(pushedEvents.some(e => e.fromTile === 0 && e.toTile === 1)).toBe(true);
    });

    it('returns covered token to Tray with particle fly event when all adjacent cells are blocked', () => {
        // Tile 0 (corner): block remaining in-bounds directions (tiles 1 and 7)
        BoardState.setToken(1, { id: 'tok_b1', typeId: 'token_woodcutter' });
        BoardState.setToken(7, { id: 'tok_b2', typeId: 'token_woodcutter' });

        const tok1 = { id: 'tok_corner', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_incoming', typeId: 'token_woodcutter' };

        BoardState.setToken(0, tok1);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.placeToken(0, tok2);
        expect(res.success).toBe(true);

        expect(BoardState.getToken(0)?.id).toBe('tok_incoming');
        // Displaced token is now in Tray
        const trayTokens = BoardState.getTray();
        expect(trayTokens.some(t => t.id === 'tok_corner')).toBe(true);

        // Particle fly event published with destination 'tray'
        expect(collectedEvents.some(e => e.kind === 'token' && e.destination === 'tray' && e.instanceId === 'tok_corner')).toBe(true);
    });

    it('moves paired hero together with pushed token to maintain pairing', () => {
        const tok1 = { id: 'tok_work', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_drop', typeId: 'token_woodcutter' };

        BoardState.setToken(8, tok1);
        BoardState.setHeroTile('hero_aldric', 8);

        expect(BoardState.heroOnTile(8)).toBe('hero_aldric');

        const res = Placement.placeToken(8, tok2);
        expect(res.success).toBe(true);

        // Token pushed to tile 1
        expect(BoardState.getToken(1)?.id).toBe('tok_work');
        // Hero moved along with token to tile 1
        expect(BoardState.heroOnTile(1)).toBe('hero_aldric');
        expect(BoardState.heroOnTile(8)).toBeNull();
    });

    it('returns hero to dock via particle fly when token is displaced to Tray', () => {
        // Tile 0 (corner): block remaining in-bounds directions (tiles 1 and 7)
        BoardState.setToken(1, { id: 'tok_b1', typeId: 'token_woodcutter' });
        BoardState.setToken(7, { id: 'tok_b2', typeId: 'token_woodcutter' });

        const tok1 = { id: 'tok_corner', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_new', typeId: 'token_woodcutter' };

        BoardState.setToken(0, tok1);
        BoardState.setHeroTile('hero_aldric', 0);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.placeToken(0, tok2);
        expect(res.success).toBe(true);

        // Hero vacated from tile 0 and recalled to dock
        expect(BoardState.heroOnTile(0)).toBeNull();
        expect(BoardState.tileOfHero('hero_aldric')).toBeNull();

        // Hero particle fly event to dock published
        expect(collectedEvents.some(e => e.kind === 'hero' && e.destination === 'dock' && e.heroId === 'hero_aldric')).toBe(true);
    });

    it('pushes existing hero to adjacent free cell when incoming hero is placed', () => {
        // Tile 8: primary is tile 1
        BoardState.setHeroTile('hero_old', 8);
        expect(BoardState.heroOnTile(8)).toBe('hero_old');

        const pushedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_PUSHED, e => pushedEvents.push(e));

        const res = Placement.placeHero('hero_new', 8);
        expect(res.success).toBe(true);

        expect(BoardState.heroOnTile(8)).toBe('hero_new');
        // Old hero pushed to tile 1
        expect(BoardState.heroOnTile(1)).toBe('hero_old');
        // TILE_PUSHED event emitted for hero animation
        expect(pushedEvents.some(e => e.fromTile === 8 && e.toTile === 1 && e.heroId === 'hero_old')).toBe(true);
    });

    it('particle-flies hero back to dock when pushed by incoming hero with no adjacent cell available', () => {
        // Corner tile 0: block remaining directions with heroes on tiles 1 and 7
        BoardState.setHeroTile('hero_b1', 1);
        BoardState.setHeroTile('hero_b2', 7);
        BoardState.setHeroTile('hero_corner', 0);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.placeHero('hero_drop', 0);
        expect(res.success).toBe(true);

        expect(BoardState.heroOnTile(0)).toBe('hero_drop');
        expect(BoardState.tileOfHero('hero_corner')).toBeNull();

        // Particle fly event published for hero_corner to dock
        expect(collectedEvents.some(e => e.kind === 'hero' && e.destination === 'dock' && e.heroId === 'hero_corner')).toBe(true);
    });

    it('returns hero to dock via particle fly on direct recall (right click)', () => {
        BoardState.setHeroTile('hero_aldric', 8);
        expect(BoardState.heroOnTile(8)).toBe('hero_aldric');

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.recallHero(8);
        expect(res.success).toBe(true);
        expect(BoardState.heroOnTile(8)).toBeNull();
        expect(BoardState.tileOfHero('hero_aldric')).toBeNull();

        expect(collectedEvents.some(e => e.kind === 'hero' && e.destination === 'dock' && e.heroId === 'hero_aldric')).toBe(true);
    });
});
