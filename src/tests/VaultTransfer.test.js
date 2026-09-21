import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as VaultTransfer from '../systems/board/VaultTransfer.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
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
    registerTokenTypes({
        fixture_map: {
            id: 'fixture_map', name: 'Fixture Map', tokenType: 'map',
            mapId: 'fixture_map_content'
        }
    });
});

/** Stand a Token on the mat, away from the Guild Hall. */
function onMat(instance, x = 300, y = 300) {
    BoardState.addToken(instance, x, y);
    return instance;
}

/** Count how many times each event fires while `fn` runs. */
function countEvents(names, fn) {
    const counts = Object.fromEntries(names.map(n => [n, 0]));
    const offs = names.map(n => EventBus.subscribe(n, () => { counts[n] += 1; }));
    try { fn(); } finally { offs.forEach(off => off()); }
    return counts;
}

describe('depositFrom — one rule, whatever the Token is sitting on', () => {
    it('stores a Token standing on the mat, and takes it off the mat', () => {
        const t = onMat(token('fixture_producer', 100));

        const res = VaultTransfer.depositFrom({ instanceId: t.id });

        expect(res.success).toBe(true);
        expect(BoardState.getTokenById(t.id)).toBeNull();
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('ignores a Tray slot — the Tray was retired in slice 1.9', () => {
        BoardState.addToTray(token('fixture_producer', 100));
        expect(VaultTransfer.depositFrom({ traySlot: 0 }).success).toBe(false);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(0);
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
        const map = onMat(token('fixture_map'));

        const fromToken = VaultTransfer.depositFrom({ instanceId: map.id });
        const fromPlaymat = VaultTransfer.depositFrom({ boardMapId: 'anything' });

        expect(fromToken).toMatchObject({ success: false, reason: 'Maps cannot be stored — open it.' });
        expect(fromPlaymat).toEqual({ success: false, reason: 'Maps cannot be stored — open it.' });
        // Refused, not eaten.
        expect(BoardState.getTokenById(map.id)).not.toBeNull();
    });

    it('refuses a new type when the Vault is full, and leaves the Token where it was (D-138)', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));
        const t = onMat(token('fixture_buff_yield'));

        const res = VaultTransfer.depositFrom({ instanceId: t.id });

        expect(res).toMatchObject({ success: false, reason: 'No room in the Vault' });
        expect(BoardState.getTokenById(t.id)).not.toBeNull();
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

    it('accepts a deposit on a brand-new save — the Vault is unlocked from the start (FP-62)', () => {
        GameState.state.quests.completedTutorials = [];
        GameState.state.quests.tutorialStep = 0;
        const t = onMat(token('fixture_producer'));

        expect(VaultTransfer.depositFrom({ instanceId: t.id }).success).toBe(true);
    });

    it('announces a successful deposit exactly once (CR2-033, CR2-146)', () => {
        const t = onMat(token('fixture_producer', 100));

        const counts = countEvents(
            ['vault_deposited', 'token_bank_updated'],
            () => VaultTransfer.depositFrom({ instanceId: t.id })
        );

        expect(counts).toEqual({ vault_deposited: 1, token_bank_updated: 1 });
    });

    it('says nothing about a deposit that was refused', () => {
        const map = onMat(token('fixture_map'));

        const counts = countEvents(
            ['vault_deposited', 'token_bank_updated'],
            () => VaultTransfer.depositFrom({ instanceId: map.id })
        );

        expect(counts).toEqual({ vault_deposited: 0, token_bank_updated: 0 });
    });
});

describe('withdrawTo — and the double-count that used to come with it (CR2-146)', () => {
    it('with no point, puts the fullest copy on the mat beside the Guild Hall (D-77, FP-18)', () => {
        // `fixture_producer` holds 5,000 charges, so these two stay two copies
        // after consolidation — one full, one part-used — rather than merging.
        TokenBank.deposit(token('fixture_producer', 5000));
        TokenBank.deposit(token('fixture_producer', 800));

        const res = VaultTransfer.withdrawTo('fixture_producer');

        expect(res.success).toBe(true);
        expect(BoardState.getTray()).toHaveLength(0);
        const [placed] = BoardState.tokens().filter(t => t.typeId === 'fixture_producer');
        expect(placed.usesRemaining).toBe(5000);
        const hall = Cartographer.centreOfBoard();
        expect(Math.hypot(placed.x - hall.x, placed.y - hall.y)).toBeLessThanOrEqual(MatPlacement.nudgeReach() + 1e-6);
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

    it('puts the copy straight back when the mat has no room for it (D-138, FP-46)', () => {
        TokenBank.deposit(token('fixture_producer', 100));
        setMatTuning('nudgeReach', 0);
        try {
            // Aimed at a point already taken, with no nudge allowed.
            onMat(token('fixture_buff_unique'), 600, 600);
            const res = VaultTransfer.withdrawTo('fixture_producer', { at: { x: 600, y: 600 } });

            expect(res.success).toBe(false);
            expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
        } finally {
            resetMatTuning();
        }
    });

    it('refuses when the Vault holds no copy of that type', () => {
        const res = VaultTransfer.withdrawTo('fixture_producer');

        expect(res.success).toBe(false);
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('can place the withdrawn copy straight onto a mat point', () => {
        TokenBank.deposit(token('fixture_producer', 100));

        // `at` is a MAT POINT (slice 1.6d).
        const res = VaultTransfer.withdrawTo('fixture_producer', { at: { x: 900, y: 700 } });

        expect(res.success).toBe(true);
        expect(BoardState.getTray()).toHaveLength(0);
        const [placed] = BoardState.tokens().filter(t => t.typeId === 'fixture_producer');
        expect({ x: placed.x, y: placed.y }).toEqual({ x: 900, y: 700 });
    });
});
