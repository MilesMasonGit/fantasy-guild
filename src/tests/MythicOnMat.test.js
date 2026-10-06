import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';

/**
 * The one-Mythic-on-the-mat rule and the Roster track's recompute.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const token = (typeId, uses = null) => BoardState.createTokenInstance(typeId, uses);

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name two spots on the mat, far enough apart to be independent.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;

/** Drop a Token on spot `i`, through the real placement rules. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
});

describe('Mythics are unique on the mat (D-177)', () => {
    it('refuses a second copy onto the mat, naming the reason', () => {
        expect(put(10, token('fixture_mythic', 8000)).success).toBe(true);

        const result = put(20, token('fixture_mythic', 8000));
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/only one/i);
    });

    it('lets a placed Mythic be MOVED — it does not trip over itself', () => {
        const mythic = token('fixture_mythic', 8000);
        put(10, mythic);

        expect(Placement.moveTokenTo(mythic.id, C(20)).success).toBe(true);
        expect(tokenAt(20).typeId).toBe('fixture_mythic');
    });

    it('frees the mat once the placed copy is removed', () => {
        // It was "lifted into the Vault" until 9.3; removal is the one way off now.
        const mythic = token('fixture_mythic', 8000);
        put(10, mythic);
        Placement.removePlacedToken(mythic.id);

        expect(put(20, token('fixture_mythic', 8000)).success).toBe(true);
    });

    it('does not constrain non-Mythics at all', () => {
        expect(put(10, token('fixture_producer', 5000)).success).toBe(true);
        expect(put(20, token('fixture_producer', 5000)).success).toBe(true);
    });
});

describe('The Roster upgrade track', () => {
    it('raises the roster cap (D-181)', () => {
        GuildUpgradeManager.getRanks().roster_size = 3;
        GuildUpgradeManager.recompute();
        expect(GameState.state.progress.rosterLimit).toBe(3);
    });
});
