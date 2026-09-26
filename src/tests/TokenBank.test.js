import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * The Token Bank's rules: the slot cap (D-137), overflow (D-138) and the
 * one-Mythic-on-the-board rule (D-177). Selling (D-146) went with gold (9.4).
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

describe('Stacks are never capped; slots are (D-137)', () => {
    it('accepts unlimited COPIES of a type it already holds', () => {
        // Capping quantity would punish a productive board, which is the
        // opposite of what the economy is for.
        GameState.state.board.tokenBankSlots = 1;
        for (let i = 0; i < 500; i++) TokenBank.deposit(token('fixture_buff_unique'));

        expect(BoardState.tokenBankCopies('fixture_buff_unique')).toHaveLength(500);
        expect(BoardState.tokenBankSlotsUsed()).toBe(1);
    });

    it('refuses a NEW type once every slot is taken', () => {
        GameState.state.board.tokenBankSlots = 2;
        expect(TokenBank.deposit(token('fixture_producer'))).toBe(true);
        expect(TokenBank.deposit(token('fixture_buff_unique'))).toBe(true);

        expect(TokenBank.deposit(token('fixture_buff_yield'))).toBe(false);
    });

    it('still accepts a held type at the cap', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));
        expect(TokenBank.deposit(token('fixture_producer'))).toBe(true);
    });

    it('frees the slot when the last copy leaves', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));
        TokenBank.withdraw('fixture_producer');

        expect(TokenBank.deposit(token('fixture_buff_yield'))).toBe(true);
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

        SpriteLayer.addSprite('token', 'fixture_producer', 1, 10);
        const [sprite] = SpriteLayer.getSprites();

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(false);
        expect(SpriteLayer.getSprites()).toHaveLength(1);
    });

    it('cascades Tray → Vault before giving up', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(token('token_filler'));
        }

        SpriteLayer.addSprite('token', 'fixture_producer', 1, 10);
        const [sprite] = SpriteLayer.getSprites();

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });
});

// Selling (D-146, CR2-168) went with gold (Token Lifecycle 9.4, SP-65):
// `TokenBank.sell`, `sellValue`, `copySellValue`, `totalSellValue` and
// `SELL_VALUE` are deleted, and so are their tests.
describe('The Bank pane no longer prices anything (9.4)', () => {
    it('has no selling left, and contents() carries no sell value', () => {
        expect(TokenBank.sell).toBeUndefined();
        expect(TokenBank.sellValue).toBeUndefined();
        expect(TokenBank.SELL_VALUE).toBeUndefined();
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        const [row] = TokenBank.contents();
        expect(row.typeId).toBe('fixture_producer');
        expect(row).not.toHaveProperty('sellValue');
    });
});

describe('Mythics are unique on the BOARD, not to own (D-177)', () => {
    it('allows several copies in the Vault', () => {
        TokenBank.deposit(token('fixture_mythic', 8000));
        TokenBank.deposit(token('fixture_mythic', 8000));

        expect(BoardState.tokenBankCopies('fixture_mythic')).toHaveLength(2);
    });

    it('refuses a second copy onto the board, naming the reason', () => {
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

    it('frees the board once the placed copy is lifted off', () => {
        const mythic = token('fixture_mythic', 8000);
        put(10, mythic);
        Placement.returnTokenToVaultById(mythic.id);

        expect(put(20, token('fixture_mythic', 8000)).success).toBe(true);
    });

    it('does not constrain non-Mythics at all', () => {
        expect(put(10, token('fixture_producer', 5000)).success).toBe(true);
        expect(put(20, token('fixture_producer', 5000)).success).toBe(true);
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
        expect(GameState.state.progress.rosterLimit).toBe(3);
    });

});

describe('A successful deposit announces itself to the rest of the game (CR2-033)', () => {
    /**
     * `vault_deposited` used to be published by hand in `TokenVaultTab`, so a
     * "deposit a Token" quest only advanced when the player used that one tab.
     * It now comes out of the engine, where every deposit route funnels — and
     * only when the deposit actually happened.
     */
    beforeEach(() => {
        registerTokenTypes({
            fixture_map: {
                id: 'fixture_map', name: 'Fixture Map', tokenType: 'map',
                mapId: 'fixture_map_content'
            }
        });
    });

    it('publishes vault_deposited, with the type id, on a deposit made through the engine', () => {
        const seen = [];
        const off = EventBus.subscribe('vault_deposited', d => seen.push(d));

        expect(TokenBank.deposit(token('fixture_producer', 5000))).toBe(true);

        off();
        expect(seen).toEqual([{ typeId: 'fixture_producer' }]);
    });

    it('stays silent when a full Vault refuses the deposit', () => {
        GameState.state.board.tokenBankSlots = 1;
        TokenBank.deposit(token('fixture_producer'));

        const seen = [];
        const off = EventBus.subscribe('vault_deposited', d => seen.push(d));

        expect(TokenBank.deposit(token('fixture_buff_yield'))).toBe(false);

        off();
        expect(seen).toEqual([]);
    });

    it('stays silent when a Map is refused (D-156)', () => {
        const seen = [];
        const off = EventBus.subscribe('vault_deposited', d => seen.push(d));

        expect(TokenBank.deposit(token('fixture_map'))).toBe(false);

        off();
        expect(seen).toEqual([]);
    });
});
