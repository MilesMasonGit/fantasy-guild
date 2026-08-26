import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Placement from '../systems/board/Placement.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { logger } from '../utils/Logger.js';
import { resetMissingContentWarnings } from '../utils/missingContent.js';

/**
 * CR2-108(c) — the four places that used to swallow an unresolvable content id
 * in silence now say so once.
 *
 * Each case asks the same two questions, because both halves matter equally:
 * a good id must stay silent (or the warnings become noise nobody reads), and
 * a bad id must be reported exactly once (or a hot path floods the console).
 *
 * These assert on *warning behaviour only*. Nothing here checks that the game
 * changed course, because by the owner's ruling of 2026-08-19 it deliberately
 * does not: the audit and these warnings make silence visible and change
 * nothing else.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

let warn;

/** Only the lines this feature produces — other modules warn about other things. */
function missingContentWarnings() {
    return warn.mock.calls.filter(([, text]) =>
        typeof text === 'string' && text.includes('does not exist, so'));
}

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
    resetMissingContentWarnings();
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warn.mockRestore();
});

describe('A drop that pays nothing (LootSystem)', () => {
    it('names the item once when the loot table points at nothing', () => {
        LootSystem._rollEntryDetails({ itemId: 'ghost_item' }, 'area');
        LootSystem._rollEntryDetails({ itemId: 'ghost_item' }, 'area');
        LootSystem._rollEntryDetails({ itemId: 'ghost_item' }, 'area');

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('LootSystem');
        expect(lines[0][1]).toContain('"ghost_item"');
        expect(lines[0][1]).toContain('pays out nothing');
    });

    it('says nothing at all for an item that exists', () => {
        LootSystem._rollEntryDetails({ itemId: 'item_oak_wood' }, 'area');
        expect(missingContentWarnings()).toHaveLength(0);
    });
});

describe('Loot with no artwork (SpriteLayer.addSprite)', () => {
    it('names a missing item once, however many drop', () => {
        SpriteLayer.addSprite('item', 'ghost_item', 1, 10);
        SpriteLayer.addSprite('item', 'ghost_item', 1, 20);

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('SpriteLayer');
        expect(lines[0][1]).toContain('"ghost_item"');
    });

    it('names a missing Token once', () => {
        SpriteLayer.addSprite('token', 'ghost_token', 1, 10, 100);
        SpriteLayer.addSprite('token', 'ghost_token', 1, 20, 100);

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][1]).toContain('Token "ghost_token"');
    });

    it('says nothing for content that resolves', () => {
        SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        SpriteLayer.addSprite('token', 'fixture_producer', 1, 20, 100);
        expect(missingContentWarnings()).toHaveLength(0);
    });

    // The sprite is still created — warn-only means the loot does not vanish
    // just because its name has gone stale.
    it('still puts the sprite on the board', () => {
        expect(SpriteLayer.addSprite('item', 'ghost_item', 1, 10)).not.toBeNull();
    });
});

describe('A Token that will never do anything (Placement.placeToken)', () => {
    it('names it once, however many times it is placed', () => {
        Placement.placeToken(0, { typeId: 'ghost_token' });
        Placement.returnTokenToTray(0);
        Placement.placeToken(1, { typeId: 'ghost_token' });

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('Placement');
        expect(lines[0][1]).toContain('"ghost_token"');
    });

    it('says nothing for a Token that exists', () => {
        Placement.placeToken(0, BoardState.createTokenInstance('fixture_producer', 100));
        expect(missingContentWarnings()).toHaveLength(0);
    });

    it('still places it — warn-only changes nothing about the move', () => {
        expect(Placement.placeToken(0, { typeId: 'ghost_token' }).success).toBe(true);
    });
});

describe('A Vault deposit with nothing behind it (TokenBank.deposit)', () => {
    it('names it once, however many copies go in', () => {
        TokenBank.deposit({ typeId: 'ghost_token' });
        TokenBank.deposit({ typeId: 'ghost_token' });

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('TokenBank');
        expect(lines[0][1]).toContain('"ghost_token"');
    });

    it('says nothing for a Token that exists', () => {
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 100));
        expect(missingContentWarnings()).toHaveLength(0);
    });

    it('still banks it', () => {
        expect(TokenBank.deposit({ typeId: 'ghost_token' })).toBe(true);
    });
});

describe('Each site speaks for itself', () => {
    // De-duplication is per site as well as per id: the same stale id showing up
    // in the Vault and on the board are two different things to fix, and one
    // hiding the other is how a half-finished rename stays half-finished.
    it('reports the same stale id separately at two different sites', () => {
        TokenBank.deposit({ typeId: 'ghost_token' });
        SpriteLayer.addSprite('token', 'ghost_token', 1, 10, 100);

        const lines = missingContentWarnings();
        expect(lines).toHaveLength(2);
        expect(lines.map(l => l[0])).toEqual(['TokenBank', 'SpriteLayer']);
    });
});
