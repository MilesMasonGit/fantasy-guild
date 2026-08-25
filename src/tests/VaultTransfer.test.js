import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as VaultTransfer from '../systems/board/VaultTransfer.js';
import { EventBus } from '../systems/core/EventBus.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * `VaultTransfer` is the single home of the Vault deposit/withdraw rule
 * (CR2-134, CR2-146, CR2-169).
 *
 * These tests exist because the rule used to live in four React components that
 * had drifted apart — different refusals, different announcements, different
 * accepted origins. Testing the components would have meant testing the drift;
 * testing the engine function is what makes "all four behave the same" a fact
 * rather than a hope.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const token = (typeId, uses = null) => BoardState.createTokenInstance(typeId, uses);

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
    // The Vault-storage gate opens at tutorial step 5; every test here is about
    // what happens *after* it is open, except the one that is about the gate.
    GameState.state.quests.completedTutorials = ['tutorial_5'];
    registerTokenTypes({
        fixture_map: {
            id: 'fixture_map', name: 'Fixture Map', tokenType: 'map',
            mapId: 'fixture_map_content'
        }
    });
});

/** Count how many times each event fires while `fn` runs. */
function countEvents(names, fn) {
    const counts = Object.fromEntries(names.map(n => [n, 0]));
    const offs = names.map(n => EventBus.subscribe(n, () => { counts[n] += 1; }));
    try { fn(); } finally { offs.forEach(off => off()); }
    return counts;
}

describe('depositFrom — one rule, whatever the Token is sitting on', () => {
    it('stores a Token that is loose on the Tray, and takes it out of the Tray', () => {
        BoardState.addToTray(token('fixture_producer', 100));

        const res = VaultTransfer.depositFrom({ traySlot: 0 });

        expect(res.success).toBe(true);
        expect(BoardState.getTray()).toHaveLength(0);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('stores a loose loot Token floating over the grid', () => {
        SpriteLayer.addSprite('token', 'fixture_producer', 1, 10, 100);
        const spriteId = SpriteLayer.getSprites()[0].id;

        const res = VaultTransfer.depositFrom({ spriteId });

        expect(res.success).toBe(true);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('refuses a Map with the same words wherever it is dragged from (D-156)', () => {
        BoardState.addToTray(token('fixture_map'));

        const fromTray = VaultTransfer.depositFrom({ traySlot: 0 });
        const fromPlaymat = VaultTransfer.depositFrom({ boardMapId: 'anything' });

        expect(fromTray).toEqual({ success: false, reason: 'Maps cannot be stored — open it.' });
        expect(fromPlaymat).toEqual({ success: false, reason: 'Maps cannot be stored — open it.' });
        // Refused, not eaten.
        expect(BoardState.getTray()).toHaveLength(1);
    });

    it('refuses a new type when the Vault is full, and leaves the Token where it was (D-138)', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));
        BoardState.addToTray(token('fixture_buff_yield'));

        const res = VaultTransfer.depositFrom({ traySlot: 0 });

        expect(res).toEqual({ success: false, reason: 'No room in the Vault' });
        expect(BoardState.getTray()).toHaveLength(1);
    });

    it('puts a loose loot Token back on the floor when the Vault refuses it', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));
        SpriteLayer.addSprite('token', 'fixture_buff_yield', 1, 10, null);
        const spriteId = SpriteLayer.getSprites()[0].id;

        const res = VaultTransfer.depositFrom({ spriteId });

        expect(res.success).toBe(false);
        expect(SpriteLayer.getSprites()).toHaveLength(1);
    });

    it('refuses everything while Vault storage is still locked', () => {
        GameState.state.quests.completedTutorials = [];
        GameState.state.quests.tutorialStep = 0;
        GameState.state.quests.active = [
            { id: 'tutorial_5', targetType: 'loot_token_placed', isTutorial: true, currentCount: 0, requiredCount: 1 }
        ];
        BoardState.addToTray(token('fixture_producer'));

        const res = VaultTransfer.depositFrom({ traySlot: 0 });

        expect(res.success).toBe(false);
        expect(res.reason).toContain('Token Vault storage unlocks');
        expect(BoardState.getTray()).toHaveLength(1);
    });

    it('announces a successful deposit exactly once (CR2-033, CR2-146)', () => {
        BoardState.addToTray(token('fixture_producer', 100));

        const counts = countEvents(
            ['vault_deposited', 'token_bank_updated'],
            () => VaultTransfer.depositFrom({ traySlot: 0 })
        );

        expect(counts).toEqual({ vault_deposited: 1, token_bank_updated: 1 });
    });

    it('says nothing about a deposit that was refused', () => {
        BoardState.addToTray(token('fixture_map'));

        const counts = countEvents(
            ['vault_deposited', 'token_bank_updated'],
            () => VaultTransfer.depositFrom({ traySlot: 0 })
        );

        expect(counts).toEqual({ vault_deposited: 0, token_bank_updated: 0 });
    });
});

describe('withdrawTo — and the double-count that used to come with it (CR2-146)', () => {
    it('moves the fullest copy onto the Tray (D-77)', () => {
        // `fixture_producer` holds 5,000 charges, so these two stay two copies
        // after consolidation — one full, one part-used — rather than merging.
        TokenBank.deposit(token('fixture_producer', 5000));
        TokenBank.deposit(token('fixture_producer', 800));

        const res = VaultTransfer.withdrawTo('fixture_producer');

        expect(res.success).toBe(true);
        expect(BoardState.getTray()).toHaveLength(1);
        expect(BoardState.getTray()[0].usesRemaining).toBe(5000);
        expect(BoardState.tokenBankCopies('fixture_producer')[0].usesRemaining).toBe(800);
    });

    it('announces a withdrawal exactly ONCE — the tutorial counter must move by 1, not 2', () => {
        TokenBank.deposit(token('fixture_producer', 100));

        const counts = countEvents(
            ['vault_withdrawn', 'token_bank_updated'],
            () => VaultTransfer.withdrawTo('fixture_producer')
        );

        expect(counts).toEqual({ vault_withdrawn: 1, token_bank_updated: 1 });
    });

    it('puts the copy straight back when the Tray has no room (D-138)', () => {
        TokenBank.deposit(token('fixture_producer', 100));
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('fixture_buff_unique'));
        }

        const res = VaultTransfer.withdrawTo('fixture_producer');

        expect(res).toEqual({ success: false, reason: 'No room in the Tray' });
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('refuses when the Vault holds no copy of that type', () => {
        const res = VaultTransfer.withdrawTo('fixture_producer');

        expect(res.success).toBe(false);
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('can place the withdrawn copy straight onto a playmat tile', () => {
        TokenBank.deposit(token('fixture_producer', 100));

        const res = VaultTransfer.withdrawTo('fixture_producer', { tile: 10 });

        expect(res.success).toBe(true);
        expect(BoardState.getToken(10)?.typeId).toBe('fixture_producer');
        expect(BoardState.getTray()).toHaveLength(0);
    });
});
