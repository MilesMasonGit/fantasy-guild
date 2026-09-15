import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import { getTilePushVectors } from '../config/boardGeometry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { idAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

/**
 * Token pushing, and what it does to heroes.
 *
 * ⚠️ Free Playmat 1.4b deleted HERO displacement: an incoming hero no longer
 * pushes a standing one, and a Token sent to the Tray no longer flies its hero
 * to the Dock. What survives is the Token push itself, a pushed Token carrying
 * its hero (claims follow the instance), and the recall particle.
 */
describe('Token & Hero Displacement Logic', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.heroes = [makeHero('hero_aldric')];
    });

    it('calculates outward quadrant push vectors correctly for board tiles', () => {
        // Tile 0 (Top-Left): pushes Up (dRow -1) primary, Left (dCol -1) secondary
        const tl = getTilePushVectors(0);
        expect(tl.primary).toEqual({ dRow: -1, dCol: 0 });
        expect(tl.secondary).toEqual({ dRow: 0, dCol: -1 });

        // Tile 5 (Top-Right): pushes Up (dRow -1) primary, Right (dCol 1) secondary
        const tr = getTilePushVectors(5);
        expect(tr.primary).toEqual({ dRow: -1, dCol: 0 });
        expect(tr.secondary).toEqual({ dRow: 0, dCol: 1 });

        // Tile 30 (Bottom-Left): pushes Left (dCol -1) primary, Down (dRow 1) secondary.
        // On a 6x6 the Guild Hall sits at row 3 / col 3, half a tile down-right
        // of true centre, so this corner is 3 columns from it but only 2 rows.
        // The farther axis wins, which makes the primary push horizontal here
        // where on an odd board it tied and went vertical.
        const bl = getTilePushVectors(30);
        expect(bl.primary).toEqual({ dRow: 0, dCol: -1 });
        expect(bl.secondary).toEqual({ dRow: 1, dCol: 0 });

        // Tile 35 (Bottom-Right): pushes Down (dRow 1) primary, Right (dCol 1) secondary
        const br = getTilePushVectors(35);
        expect(br.primary).toEqual({ dRow: 1, dCol: 0 });
        expect(br.secondary).toEqual({ dRow: 0, dCol: 1 });
    });

    it('pushes covered 1x1 token to primary adjacent quadrant cell when available', () => {
        // Tile 7 (row 1, col 1): primary push is Up (dRow -1 -> tile 1)
        const tok1 = { id: 'tok_1', typeId: 'token_woodcutter' };
        const tok2 = { id: 'tok_2', typeId: 'token_woodcutter' };

        BoardState.setToken(7, tok1);
        expect(BoardState.getToken(7)?.id).toBe('tok_1');
        expect(BoardState.getToken(1)).toBeNull();

        const res = Placement.placeToken(7, tok2);
        expect(res.success).toBe(true);

        // New token is on tile 8
        expect(BoardState.getToken(7)?.id).toBe('tok_2');
        // Pushed token moved to primary adjacent cell (tile 1)
        expect(BoardState.getToken(1)?.id).toBe('tok_1');
    });

    it('pushes covered 1x1 token to secondary quadrant cell when primary is occupied', () => {
        // Tile 7 (row 1, col 1): primary is tile 1, secondary is tile 6 (row 1, col 0)
        const tok1 = { id: 'tok_1', typeId: 'token_woodcutter' };
        const blocker = { id: 'tok_blocker', typeId: 'token_woodcutter' };
        const tokNew = { id: 'tok_new', typeId: 'token_woodcutter' };

        BoardState.setToken(7, tok1);
        BoardState.setToken(1, blocker); // Block primary push cell

        const res = Placement.placeToken(7, tokNew);
        expect(res.success).toBe(true);

        expect(BoardState.getToken(7)?.id).toBe('tok_new');
        expect(BoardState.getToken(1)?.id).toBe('tok_blocker');
        // Pushed to secondary cell (tile 6)
        expect(BoardState.getToken(6)?.id).toBe('tok_1');
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
        // Tile 0 (corner): block remaining in-bounds directions (tiles 1 and 6)
        BoardState.setToken(1, { id: 'tok_b1', typeId: 'token_woodcutter' });
        BoardState.setToken(6, { id: 'tok_b2', typeId: 'token_woodcutter' });

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
        const tok1 = { id: 'tok_work', typeId: 'fixture_producer', usesRemaining: 100 };
        const tok2 = { id: 'tok_drop', typeId: 'fixture_buff_yield', usesRemaining: 100 };

        BoardState.setToken(7, tok1);
        Placement.placeHero('hero_aldric', 7);

        expect(BoardState.workerOf(idAt(7))).toBe('hero_aldric');

        const res = Placement.placeToken(7, tok2);
        expect(res.success).toBe(true);

        // Token pushed to tile 1
        expect(BoardState.getToken(1)?.id).toBe('tok_work');
        // Hero moved along with token to tile 1 — the claim follows the instance
        expect(BoardState.workerOf(idAt(1))).toBe('hero_aldric');
        expect(BoardState.workerOf(idAt(7))).toBeNull();
    });

    it('returns hero to dock via particle fly on direct recall (right click)', () => {
        Placement.placeHero('hero_aldric', 7);
        expect(BoardState.displayTileOf('hero_aldric')).toBe(7);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.recallHero(7);
        expect(res.success).toBe(true);
        expect(BoardState.flagOf('hero_aldric')).toBeNull();
        expect(BoardState.displayTileOf('hero_aldric')).toBeNull();

        expect(collectedEvents.some(e => e.kind === 'hero' && e.destination === 'dock' && e.heroId === 'hero_aldric')).toBe(true);
    });
});
