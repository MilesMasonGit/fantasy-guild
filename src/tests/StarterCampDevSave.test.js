import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { saveLiveMatToCms, devPlaceToken, DEFAULT_CMS_URL } from '../ui/dev/starterCampDev.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The QA panel's "Save this mat as the Starter Camp": it posts the live mat, in the shape the
 * loader reads, to the CMS's Starter Camp route; and "Place Token" puts any Token on the mat to lay
 * the camp out with.
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    placeAt('token_guild_hall', 880, 563);
    placeAt('fixture_producer', 500, 563);
    InventoryManager.addItem('fixture_oak_wood', 4);
});

const okResponse = (body) => ({ ok: true, json: async () => body });

describe('Save this mat as the Starter Camp', () => {
    it('posts the live mat to the CMS route, in exactly the shape the loader reads', async () => {
        const fetchFn = vi.fn(async () => okResponse({ success: true, tokens: 1, bank: 1 }));
        const result = await saveLiveMatToCms({ cmsUrl: 'http://localhost:5174/', savedAt: 'then', fetchFn });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        const [url, options] = fetchFn.mock.calls[0];
        expect(url).toBe('http://localhost:5174/api/starter-camp');
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({ camp: StarterCamp.campFromLiveMat({ savedAt: 'then' }).camp });
        expect(result.ok).toBe(true);
        expect(result.message).toContain('1 Token');
        expect(result.message).toContain('Starter Camp page');
    });

    it('says plainly when the CMS is not running', async () => {
        const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        const result = await saveLiveMatToCms({ cmsUrl: DEFAULT_CMS_URL, savedAt: 'then', fetchFn });
        expect(result.ok).toBe(false);
        expect(result.message).toContain(`Could not reach the CMS at ${DEFAULT_CMS_URL}`);
    });

    it('passes on the CMS\'s own refusal', async () => {
        const fetchFn = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'That is not a Starter Camp' }) }));
        const result = await saveLiveMatToCms({ cmsUrl: DEFAULT_CMS_URL, savedAt: 'then', fetchFn });
        expect(result).toEqual({ ok: false, message: 'The CMS refused it: That is not a Starter Camp' });
    });
});

describe('Place Token', () => {
    it('puts any Token type on the mat beside the Guild Hall, placed and fresh', () => {
        const res = devPlaceToken('fixture_producer');
        expect(res.success).toBe(true);
        const placed = BoardState.getTokenById(res.instance.id);
        expect(placed.origin).toBe('placed');
        expect(BoardState.tokens()).toHaveLength(3);
    });

    it('refuses a type that does not exist', () => {
        expect(devPlaceToken('token_nowhere').success).toBe(false);
        expect(BoardState.tokens()).toHaveLength(2);
    });
});
