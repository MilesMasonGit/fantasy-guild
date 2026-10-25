import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Wild Forests and Stumps can be cleared (brief 230 S2a): a Token type marked `clearable` may be
 * marked for demolition even where a map placed it. Everything else a map placed still may not,
 * and the Starter Camp's layout stays as it was laid.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const plain = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
registerTokenTypes({
    cl_forest: plain('cl_forest', { clearable: true }),
    cl_stump: plain('cl_stump', { clearable: true, grows: { into: 'cl_tree', afterMs: 60000 } }),
    cl_tree: plain('cl_tree', { staysPut: true, uses: 3 })
});

/** A Token a map wrote: a fixture. */
function mapNode(typeId, x) {
    const t = placeAt(typeId, x, 500);
    t.fixture = BoardState.FIXTURE.MAP;
    return t;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    clearMat();
});
afterEach(() => clearMat());

describe('⭐ clearing a wild Forest or Stump', () => {
    it('a map\'s Forest and Stump of a clearable type may be marked; a map\'s Tree may not', () => {
        const forest = mapNode('cl_forest', 300);
        const stump = mapNode('cl_stump', 600);
        const tree = mapNode('cl_tree', 900);

        expect(Demolition.refusalOf(forest)).toBeNull();
        expect(Demolition.refusalOf(stump)).toBeNull();
        expect(Demolition.refusalOf(tree)).toBe(Demolition.REFUSAL.MAP_NODE);

        expect(Demolition.mark(stump)).toEqual({ success: true });
        expect(Demolition.isMarked(stump)).toBe(true);
        expect(Demolition.mark(tree)).toMatchObject({ success: false, code: Demolition.REFUSAL.MAP_NODE });
    });

    it('it stays a fixed Token (no drag) while it stands; clearing is the only way it goes', () => {
        const stump = mapNode('cl_stump', 600);
        expect(FixedTokens.isFixed(stump)).toBe(true);
        expect(Demolition.canDemolish(stump)).toBe(true);
        Demolition.mark(stump);
        expect(Demolition.finish(stump)).toBe(true);
        expect(BoardState.getTokenById(stump.id)).toBeNull();
    });

    it('the Starter Camp\'s own Tokens stay as laid, clearable type or not', () => {
        const forest = placeAt('cl_forest', 300, 500);
        forest.fixture = BoardState.FIXTURE.CAMP;
        expect(Demolition.refusalOf(forest)).toBe(Demolition.REFUSAL.CAMP);
    });

    it('a planted or placed one was always clearable, and still is', () => {
        const stump = placeAt('cl_stump', 600, 500);
        expect(Demolition.refusalOf(stump)).toBeNull();
    });
});
