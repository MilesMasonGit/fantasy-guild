import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { migrateState, IncompatibleSaveError } from '../systems/core/SaveMigration.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SlotHelper from '../systems/core/SaveSlotHelper.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Charges from '../systems/board/Charges.js';
import * as Managers from '../systems/board/Managers.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GUILD_HALL_TILE, footprintCentre } from '../config/boardGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, tileCentre } from './fixtures/mat.js';

/**
 * Free Playmat slice 1.6a — Tokens stored by instance id at a mat point, and
 * the save bump that goes with it (FP-44, FP-85, FP-19).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: vi.fn(() => 10) }
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerTokenTypes({
    fixture_spot_big: {
        id: 'fixture_spot_big', name: 'Fixture Big Spring', tokenType: 'resource',
        rarity: 'common', size: 2, uses: 5, requiresHero: false,
        config: { cycleTimeMs: 12000, inputs: [], outputs: [] }
    },
    fixture_spot_camp: {
        id: 'fixture_spot_camp', name: 'Fixture Spring Camp', tokenType: 'manager',
        rarity: 'common', uses: null, requiresHero: false, manages: ['fixture_spot_big'],
        config: null
    }
});

beforeEach(() => {
    localStorage.clear();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    resetMatTuning();
});

afterEach(() => {
    resetMatTuning();
});

describe('⭐ the save bump refuses old saves (FP-85)', () => {
    /** A save as 0.7.0 wrote it: Tokens keyed by tile. */
    function oldSave() {
        const data = GameState.serialize();
        data.version = '0.7.0';
        data.state.meta.version = '0.7.0';
        delete data.state.board.tokens;
        delete data.state.board.nextTokenOrder;
        data.state.board.tiles = { 21: { id: 'tok_hall', typeId: 'token_guild_hall', usesRemaining: null, cycleElapsedMs: 0 } };
        return data;
    }

    it('the schema is 0.8.0', () => {
        expect(GAME_VERSION).toBe('0.8.0');
    });

    it('migrateState refuses a 0.7.0 save', () => {
        const data = oldSave();
        expect(() => migrateState(data.state, data.version)).toThrow(IncompatibleSaveError);
    });

    it('loading a 0.7.0 slot returns false and leaves the running game alone', async () => {
        localStorage.setItem(SlotHelper.getSlotKey(0), JSON.stringify(oldSave()));
        const before = GameState.state;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(await SaveManager.loadSlot(0)).toBe(false);
        expect(GameState.state).toBe(before);
        warn.mockRestore();
    });
});

describe('⭐ a new game opens with the Guild Hall on the mat (FP-44)', () => {
    it('holds exactly the Hall on the mat, with a point, and nothing in the Tray', () => {
        EngineBootstrap.createDefaultGameData();

        const onMat = BoardState.tokens();
        expect(onMat.map(t => t.typeId)).toEqual(['token_guild_hall']);
        // STOPGAP point: the old Hall tile's centre until slice 1.6d.
        expect({ x: onMat[0].x, y: onMat[0].y }).toEqual(tileCentre(GUILD_HALL_TILE));
        expect(Object.keys(GameState.state.board.tokens)).toEqual([onMat[0].id]);
        expect(BoardState.getTray()).toEqual([]);
        // Every current reader still finds it on its tile.
        expect(BoardState.getToken(GUILD_HALL_TILE)?.id).toBe(onMat[0].id);
    });
});

describe('⭐ a save round trip keeps where every Token is', () => {
    it('keeps ids, x, y and placedAt, and the tile view still answers', () => {
        const a = placeAt('fixture_producer', ...Object.values(tileCentre(0)));
        const big = placeAt('fixture_spot_big', ...Object.values(footprintCentre(8, 2)));
        const c = placeAt('fixture_manager', ...Object.values(tileCentre(35)));
        const before = BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y, placedAt: t.placedAt }));
        expect(before.map(t => t.placedAt)).toEqual([0, 1, 2]);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);
        GameState.state = migrated;

        const after = BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y, placedAt: t.placedAt }));
        expect(after).toEqual(before);
        expect(GameState.state.board.nextTokenOrder).toBe(3);
        expect(BoardState.getToken(0)?.id).toBe(a.id);
        expect(BoardState.getOccupyingToken(15)?.instance.id).toBe(big.id);
        expect(BoardState.getToken(35)?.id).toBe(c.id);
    });
});

describe('⭐ looking a Token up by id is a lookup, not a scan', () => {
    it('getTokenById and findTokenById never enumerate the Token map', () => {
        const target = placeAt('fixture_producer', ...Object.values(tileCentre(9)));
        placeAt('fixture_producer', ...Object.values(tileCentre(10)));
        placeAt('fixture_manager', ...Object.values(tileCentre(11)));

        const board = GameState.state.board;
        let enumerations = 0;
        board.tokens = new Proxy(board.tokens, {
            ownKeys(t) { enumerations++; return Reflect.ownKeys(t); }
        });
        BoardState.occupiedTiles();          // build the tile view for the new object once
        enumerations = 0;

        expect(BoardState.getTokenById(target.id)).toBe(target);
        expect(BoardState.findTokenById(target.id)?.instance).toBe(target);
        expect(BoardState.findTokenById(target.id)?.anchor).toBe(9);
        expect(BoardState.getTokenById('tok_nobody')).toBeNull();
        expect(enumerations).toBe(0);
    });
});

describe('⭐ vacancies are spots, and a restock lands exactly there (FP-19)', () => {
    it('a spent 2×2 leaves a vacancy at its own point, and the Manager refills that point', () => {
        setMatTuning('nearRadius', 400);
        const spot = footprintCentre(8, 2);            // (464, 304) — not any tile's centre
        const spent = placeAt(BoardState.createTokenInstance('fixture_spot_big', 1), spot.x, spot.y);
        placeAt('fixture_spot_camp', ...Object.values(tileCentre(10)));

        Charges.destroyToken(8, spent);

        const vacancy = Object.values(GameState.state.board.vacancies);
        expect(vacancy).toEqual([{ typeId: 'fixture_spot_big', x: spot.x, y: spot.y, unstocked: false }]);
        expect(BoardState.getVacancy(8)?.typeId).toBe('fixture_spot_big');   // STOPGAP tile view

        TokenBank.deposit(BoardState.createTokenInstance('fixture_spot_big', 5));
        expect(Managers.sweep()).toBe(1);

        const restocked = BoardState.tokens().find(t => t.typeId === 'fixture_spot_big');
        expect({ x: restocked.x, y: restocked.y }).toEqual(spot);
        expect(restocked.id).not.toBe(spent.id);
        expect(GameState.state.board.vacancies).toEqual({});
    });
});
