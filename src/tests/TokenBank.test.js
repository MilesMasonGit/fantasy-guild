import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';

/**
 * The Token Bank's rules: the slot cap (D-137), overflow (D-138), selling
 * (D-146) and the one-Mythic-on-the-board rule (D-177).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const token = (typeId, uses = null) => BoardState.createTokenInstance(typeId, uses);

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
});

describe('Stacks are never capped; slots are (D-137)', () => {
    it('accepts unlimited COPIES of a type it already holds', () => {
        // Capping quantity would punish a productive board, which is the
        // opposite of what the economy is for.
        GameState.state.board.tokenBankSlots = 1;
        for (let i = 0; i < 500; i++) TokenBank.deposit(token('token_shrine'));

        expect(BoardState.tokenBankCopies('token_shrine')).toHaveLength(500);
        expect(BoardState.tokenBankSlotsUsed()).toBe(1);
    });

    it('refuses a NEW type once every slot is taken', () => {
        GameState.state.board.tokenBankSlots = 2;
        expect(TokenBank.deposit(token('token_forest'))).toBe(true);
        expect(TokenBank.deposit(token('token_shrine'))).toBe(true);

        expect(TokenBank.deposit(token('token_sawmill'))).toBe(false);
    });

    it('still accepts a held type at the cap', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('token_forest'));
        expect(TokenBank.deposit(token('token_forest'))).toBe(true);
    });

    it('frees the slot when the last copy leaves', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('token_forest'));
        TokenBank.withdraw('token_forest');

        expect(TokenBank.deposit(token('token_sawmill'))).toBe(true);
    });
});

describe('Nothing is ever lost to a full Bank (D-138)', () => {
    it('leaves an uncollectable Token sprite on the board', () => {
        // A full Bank announces itself VISIBLY, as litter piling up across the
        // grid, rather than through an error dialog. This is also what protects
        // a Mythic drop from being wasted for want of storage.
        GameState.state.board.tokenBankSlots = 0;
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('token_filler'));
        }

        SpriteLayer.addSprite('token', 'token_forest', 1, 10);
        const [sprite] = SpriteLayer.getSprites();

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(false);
        expect(SpriteLayer.getSprites()).toHaveLength(1);
    });

    it('cascades Tray → Vault before giving up', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('token_filler'));
        }

        SpriteLayer.addSprite('token', 'token_forest', 1, 10);
        const [sprite] = SpriteLayer.getSprites();

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        expect(BoardState.tokenBankCopies('token_forest')).toHaveLength(1);
    });
});

describe('Selling is an escape valve, not a strategy (D-146)', () => {
    it('pays the flat rate for the rarity and removes one copy', () => {
        TokenBank.deposit(token('token_forest', 5000));
        TokenBank.deposit(token('token_forest', 5000));
        const before = GameState.state.currency.gold;

        const result = TokenBank.sell('token_forest');

        expect(result.success).toBe(true);
        expect(result.gold).toBe(TokenBank.SELL_VALUE.common);
        expect(GameState.state.currency.gold).toBe(before + TokenBank.SELL_VALUE.common);
        expect(BoardState.tokenBankCopies('token_forest')).toHaveLength(1);
    });

    it('pays the same whether the Token is fresh or nearly spent', () => {
        // Flat by owner decision (2026-08-06). Knowingly the weaker model —
        // running a Token to zero before selling loses nothing — but the rate is
        // low enough that the "exploit" is worth a handful of gold.
        TokenBank.deposit(token('token_forest', 1));
        expect(TokenBank.sell('token_forest').gold).toBe(TokenBank.SELL_VALUE.common);
    });

    it('sells the MOST SPENT copy first — disposal takes the worst', () => {
        TokenBank.deposit(token('token_shrine', null));
        TokenBank.deposit(token('token_shrine', null));
        BoardState.setTokenBankCopies('token_shrine', [
            { usesRemaining: null }, { usesRemaining: 12 }
        ]);

        TokenBank.sell('token_shrine');

        const left = BoardState.tokenBankCopies('token_shrine');
        expect(left).toHaveLength(1);
        expect(left[0].usesRemaining).toBeNull();
    });

    it('refuses to sell what the Bank does not hold', () => {
        expect(TokenBank.sell('token_forest').success).toBe(false);
    });

    it('sells a Mythic like anything else (D-177 struck the protection)', () => {
        // Mythics are unique on the BOARD, not unique to own: duplicates are
        // spares, so a sale is no longer irreversible.
        TokenBank.deposit(token('token_heartwood', 8000));
        const result = TokenBank.sell('token_heartwood');

        expect(result.success).toBe(true);
        expect(result.gold).toBe(TokenBank.SELL_VALUE.mythic);
    });

    it('⚠️ pays badly enough that liquidating is never a plan', () => {
        // The constraint, pinned as a number: one Rare sells for less than the
        // cheapest Guild Upgrade rank. If this ever inverts, selling has become
        // income and the rate has drifted.
        expect(TokenBank.SELL_VALUE.rare).toBeLessThan(GuildUpgradeManager.getNextCost('bank_slots'));
    });
});

describe('Mythics are unique on the BOARD, not to own (D-177)', () => {
    it('allows several copies in the Vault', () => {
        TokenBank.deposit(token('token_heartwood', 8000));
        TokenBank.deposit(token('token_heartwood', 8000));

        expect(BoardState.tokenBankCopies('token_heartwood')).toHaveLength(2);
    });

    it('refuses a second copy onto the board, naming the reason', () => {
        expect(Placement.placeToken(10, token('token_heartwood', 8000)).success).toBe(true);

        const result = Placement.placeToken(20, token('token_heartwood', 8000));
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/only one/i);
    });

    it('lets a placed Mythic be MOVED — it does not trip over itself', () => {
        Placement.placeToken(10, token('token_heartwood', 8000));
        expect(Placement.moveToken(10, 20).success).toBe(true);
        expect(BoardState.getToken(20).typeId).toBe('token_heartwood');
    });

    it('frees the board once the placed copy is lifted off', () => {
        Placement.placeToken(10, token('token_heartwood', 8000));
        Placement.returnTokenToTray(10);

        expect(Placement.placeToken(20, token('token_heartwood', 8000)).success).toBe(true);
    });

    it('does not constrain non-Mythics at all', () => {
        expect(Placement.placeToken(10, token('token_forest', 5000)).success).toBe(true);
        expect(Placement.placeToken(20, token('token_forest', 5000)).success).toBe(true);
    });
});

describe('The Storage upgrade track', () => {
    it('starts at the base cap and rises with rank', () => {
        GuildUpgradeManager.recompute();
        expect(TokenBank.slotCap()).toBe(TokenBank.BASE_TOKEN_BANK_SLOTS);

        GuildUpgradeManager.getRanks().token_bank_slots = 3;
        GuildUpgradeManager.recompute();

        expect(TokenBank.slotCap()).toBe(
            TokenBank.BASE_TOKEN_BANK_SLOTS + 3 * TokenBank.SLOTS_PER_RANK
        );
    });

    it('is RECOMPUTED from rank, never incremented — reloading cannot drift it', () => {
        GuildUpgradeManager.getRanks().token_bank_slots = 2;
        GuildUpgradeManager.recompute();
        GuildUpgradeManager.recompute();
        GuildUpgradeManager.recompute();

        expect(TokenBank.slotCap()).toBe(
            TokenBank.BASE_TOKEN_BANK_SLOTS + 2 * TokenBank.SLOTS_PER_RANK
        );
    });

    it('raises the roster cap on the Roster track (D-181)', () => {
        GuildUpgradeManager.getRanks().roster_size = 3;
        GuildUpgradeManager.recompute();
        expect(GameState.state.progress.rosterLimit).toBe(8);
    });
});
