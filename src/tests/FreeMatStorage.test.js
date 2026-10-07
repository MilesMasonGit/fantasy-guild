// @vitest-environment jsdom
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
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt } from './fixtures/mat.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names spots on a 160 u lattice for laying a board out.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/**
 * Free Playmat slice 1.6a — Tokens stored by instance id at a mat point, and
 * the save bump that goes with it.
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
    // ⚠️ Changed in Token Lifecycle 10.1: the Hall is joined by the starter
    // Oak Forest and Copper Mine, either side of it, all `placed`.
    it('holds the Hall in the middle of the mat, with the starter set beside it', () => {
        EngineBootstrap.createDefaultGameData();

        const onMat = BoardState.tokens();
        expect(onMat.map(t => t.typeId)).toEqual(['token_guild_hall', 'token_oak_forest', 'token_copper_mine']);
        // ⭐ The middle of the mat (slice 1.6d-3). It used to be (960, 643) —
        // half a step off centre, inherited from the deleted grid's Hall tile.
        expect({ x: onMat[0].x, y: onMat[0].y }).toEqual({ x: 880, y: 563 });
        expect(onMat.slice(1).map(t => ({ x: t.x, y: t.y }))).toEqual([{ x: 560, y: 563 }, { x: 1200, y: 563 }]);
        expect(onMat.every(t => t.origin === 'placed')).toBe(true);
        expect(Object.keys(GameState.state.board.tokens)).toEqual(onMat.map(t => t.id));
    });
});

describe('⭐ a save round trip keeps where every Token is', () => {
    it('keeps ids, x, y and placedAt', () => {
        const a = placeAt('fixture_producer', C(0).x, C(0).y);
        const big = placeAt('fixture_spot_big', 500, 420);
        const c = placeAt('fixture_manager', C(35).x, C(35).y);
        const before = BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y, placedAt: t.placedAt }));
        expect(before.map(t => t.placedAt)).toEqual([0, 1, 2]);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);
        GameState.state = migrated;

        const after = BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y, placedAt: t.placedAt }));
        expect(after).toEqual(before);
        expect(GameState.state.board.nextTokenOrder).toBe(3);
        // Every Token is still found by its id, which is the only way it is
        // named now that the tile view has gone (slice 1.6d-2).
        expect(BoardState.getTokenById(a.id).typeId).toBe('fixture_producer');
        expect(BoardState.getTokenById(big.id).typeId).toBe('fixture_spot_big');
        expect(BoardState.getTokenById(c.id).typeId).toBe('fixture_manager');
    });
});

describe('⭐ looking a Token up by id is a lookup, not a scan', () => {
    it('getTokenById never enumerates the Token map', () => {
        const target = placeAt('fixture_producer', C(9).x, C(9).y);
        placeAt('fixture_producer', C(10).x, C(10).y);
        placeAt('fixture_manager', C(11).x, C(11).y);

        const board = GameState.state.board;
        let enumerations = 0;
        board.tokens = new Proxy(board.tokens, {
            ownKeys(t) { enumerations++; return Reflect.ownKeys(t); }
        });
        expect(BoardState.getTokenById(target.id)).toBe(target);
        expect(BoardState.getTokenById('tok_nobody')).toBeNull();
        expect(enumerations).toBe(0);
    });
});

describe('spot vacancies are retired with the Managers (SP-55, 9.2)', () => {
    it('a spent Token leaves nothing owed behind', () => {
        const spent = placeAt(BoardState.createTokenInstance('fixture_spot_big', 1), 500, 420);
        Charges.destroyToken(spent);
        expect(BoardState.tokens().some(t => t.typeId === 'fixture_spot_big')).toBe(false);
        expect(GameState.state.board.vacancies).toBeUndefined();
    });

    it('an older save carrying board.vacancies still loads, and the field is dropped', async () => {
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        saved.state.board.vacancies = { spot_500_420: { typeId: 'fixture_spot_big', x: 500, y: 420, unstocked: true } };
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        BoardState.tokens();
        expect(GameState.state.board.vacancies).toBeUndefined();
    });
});
