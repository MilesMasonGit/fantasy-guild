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
 * The Token Bank's rules: the slot cap (D-137), overflow (D-138), selling
 * (D-146) and the one-Mythic-on-the-board rule (D-177).
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

describe('Selling is an escape valve, not a strategy (D-146)', () => {
    it('pays the flat rate for the rarity and removes one copy', () => {
        TokenBank.deposit(token('fixture_producer', 5000));
        TokenBank.deposit(token('fixture_producer', 5000));
        const before = GameState.state.currency.gold;

        const result = TokenBank.sell('fixture_producer');

        expect(result.success).toBe(true);
        expect(result.gold).toBe(TokenBank.SELL_VALUE.common);
        expect(GameState.state.currency.gold).toBe(before + TokenBank.SELL_VALUE.common);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('pays a fraction of base value when a Token is partially spent (rounds down)', () => {
        // fixture_producer: common (5g), capacity 5000
        // 2500 charges (50%) -> Math.floor(5 * 0.5) = 2g
        TokenBank.deposit(token('fixture_producer', 2500));
        expect(TokenBank.sell('fixture_producer').gold).toBe(2);
    });

    it('sells the MOST SPENT copy first — disposal takes the worst', () => {
        TokenBank.deposit(token('fixture_buff_unique', null));
        TokenBank.deposit(token('fixture_buff_unique', null));
        BoardState.setTokenBankCopies('fixture_buff_unique', [
            { usesRemaining: null }, { usesRemaining: 12 }
        ]);

        TokenBank.sell('fixture_buff_unique');

        const left = BoardState.tokenBankCopies('fixture_buff_unique');
        expect(left).toHaveLength(1);
        expect(left[0].usesRemaining).toBeNull();
    });

    it('refuses to sell what the Bank does not hold', () => {
        expect(TokenBank.sell('fixture_producer').success).toBe(false);
    });

    it('sells a Mythic like anything else (D-177 struck the protection)', () => {
        // Mythics are unique on the BOARD, not unique to own: duplicates are
        // spares, so a sale is no longer irreversible.
        TokenBank.deposit(token('fixture_mythic', 8000));
        const result = TokenBank.sell('fixture_mythic');

        expect(result.success).toBe(true);
        expect(result.gold).toBe(TokenBank.SELL_VALUE.mythic);
    });

    it('sells partial tokens for a proportional fraction of base value, rounded down', () => {
        // fixture_producer has capacity 5000 and rarity common (SELL_VALUE.common = 5)
        // 2500 charges = 50% -> Math.floor(5 * 0.5) = 2
        BoardState.setTokenBankCopies('fixture_producer', [{ usesRemaining: 2500 }]);
        const res = TokenBank.sell('fixture_producer');
        expect(res.success).toBe(true);
        expect(res.gold).toBe(2);
    });

    it('calculates totalSellValue across multiple copies worst-first', () => {
        // fixture_producer: base 5g, capacity 5000
        // copy A: 2500 uses (2g), copy B: 5000 uses (5g)
        BoardState.setTokenBankCopies('fixture_producer', [
            { usesRemaining: 5000 },
            { usesRemaining: 2500 }
        ]);

        expect(TokenBank.totalSellValue('fixture_producer', 1)).toBe(2);
        expect(TokenBank.totalSellValue('fixture_producer', 2)).toBe(7);
    });

    it('⚠️ pays NOTHING for a Token with no definition behind it (CR2-120)', () => {
        // A stale id left in an old save used to price itself at the `common`
        // rate, because the rarity lookup fell back to 'common' when the
        // definition was missing. A ghost was worth as much as a real Token.
        expect(TokenBank.sellValue('token_definitely_not_authored')).toBe(0);
        expect(TokenBank.sellValue('token_definitely_not_authored'))
            .toBeLessThan(TokenBank.sellValue('fixture_producer'));
    });

    it('carries the zero all the way through a real sale of a ghost', () => {
        // It is still sellable — that is the escape valve that lets a player
        // clear the debris — it simply pays nothing.
        BoardState.setTokenBankCopies('token_definitely_not_authored', [{ usesRemaining: null }]);
        const before = GameState.state.currency.gold;

        expect(TokenBank.totalSellValue('token_definitely_not_authored', 1)).toBe(0);
        const res = TokenBank.sell('token_definitely_not_authored');

        expect(res.success).toBe(true);
        expect(res.gold).toBe(0);
        expect(GameState.state.currency.gold).toBe(before);
        expect(BoardState.tokenBankCopies('token_definitely_not_authored')).toHaveLength(0);
    });

    it('still pays the base rate for a REAL Token whose rarity is not in the table', () => {
        // The other fallback in the same expression, and it is still wanted:
        // an authoring typo in `rarity` should price at the base rate, not at
        // nothing. Only a *missing definition* is worthless.
        registerTokenTypes({
            fixture_odd_rarity: {
                id: 'fixture_odd_rarity', name: 'Odd Rarity', tokenType: 'resource',
                rarity: 'legendarium', sprite: 'ore_copper'
            }
        });
        expect(TokenBank.sellValue('fixture_odd_rarity')).toBe(TokenBank.SELL_VALUE.common);
    });

    it('⚠️ pays badly enough that liquidating is never a plan', () => {
        // The constraint, pinned as a number: one Rare sells for less than the
        // cheapest Guild Upgrade rank. If this ever inverts, selling has become
        // income and the rate has drifted.
        expect(TokenBank.SELL_VALUE.rare).toBeLessThan(GuildUpgradeManager.getNextCost('bank_slots'));
    });
});

/**
 * Bulk selling (CR2-168 item 5, fixed 2026-08-26).
 *
 * Both sell controls used to call `TokenBank.sell()` once per copy in a loop.
 * `sell(typeId, quantity)` now does the whole sale in one go. The arithmetic
 * must be **identical** to what the loop produced — that is the only thing that
 * makes this a performance fix rather than an economy change — and the
 * announcements must collapse to one round.
 */
describe('Selling a stack in one go (CR2-168 item 5)', () => {
    /** Count every event published during `fn`, by name. */
    const countEvents = (fn) => {
        const counts = {};
        const realPublish = EventBus.publish.bind(EventBus);
        const spy = vi.spyOn(EventBus, 'publish').mockImplementation((name, payload) => {
            counts[name] = (counts[name] || 0) + 1;
            return realPublish(name, payload);
        });
        try { fn(); } finally { spy.mockRestore(); }
        counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
        return counts;
    };

    it('pays exactly what selling one at a time paid', () => {
        // Ten full commons at 5g plus one half-spent at 2g. Worst first, so
        // selling 3 takes the 2g copy and two 5g copies.
        const copies = [{ usesRemaining: 2500 }, ...Array.from({ length: 10 },
            () => ({ usesRemaining: 5000 }))];

        BoardState.setTokenBankCopies('fixture_producer', copies.map(c => ({ ...c })));
        const oneAtATimeStart = GameState.state.currency.gold;
        let loopGold = 0;
        for (let i = 0; i < 3; i++) loopGold += TokenBank.sell('fixture_producer').gold;
        const loopBankLeft = BoardState.tokenBankCopies('fixture_producer').length;
        const loopCredited = GameState.state.currency.gold - oneAtATimeStart;

        BoardState.setTokenBankCopies('fixture_producer', copies.map(c => ({ ...c })));
        const bulkStart = GameState.state.currency.gold;
        const res = TokenBank.sell('fixture_producer', 3);

        expect(res.gold).toBe(loopGold);
        expect(res.gold).toBe(2 + 5 + 5);
        expect(res.count).toBe(3);
        expect(GameState.state.currency.gold - bulkStart).toBe(loopCredited);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(loopBankLeft);
    });

    it('credits the gold exactly once, not once per copy', () => {
        BoardState.setTokenBankCopies('fixture_producer',
            Array.from({ length: 20 }, () => ({ usesRemaining: 5000 })));
        const before = GameState.state.currency.gold;

        const res = TokenBank.sell('fixture_producer', 20);

        expect(res.gold).toBe(20 * TokenBank.SELL_VALUE.common);
        expect(GameState.state.currency.gold).toBe(before + 20 * TokenBank.SELL_VALUE.common);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(0);
    });

    it('publishes one round of events for the whole sale', () => {
        BoardState.setTokenBankCopies('fixture_producer',
            Array.from({ length: 100 }, () => ({ usesRemaining: 5000 })));

        const counts = countEvents(() => TokenBank.sell('fixture_producer', 100));

        expect(counts.token_bank_updated).toBe(1);
        expect(counts.state_changed).toBe(1);
        expect(counts.currency_changed).toBe(1);
        // The old loop published at least 300 (100 each of the three above),
        // plus a round of notification aggregation per gold credit.
        expect(counts.total).toBeLessThan(10);
    });

    it('the quoted price and the gold paid are the same number', () => {
        // `totalSellValue` feeds the sell dialog; `sell` pays. They now share
        // one ordering function, so they cannot disagree about which copies go.
        BoardState.setTokenBankCopies('fixture_producer', [
            { usesRemaining: 5000 }, { usesRemaining: 1000 },
            { usesRemaining: 2500 }, { usesRemaining: 4000 }
        ]);

        const quoted = TokenBank.totalSellValue('fixture_producer', 3);
        expect(TokenBank.sell('fixture_producer', 3).gold).toBe(quoted);
    });

    it('sells the worst copies and leaves the best behind', () => {
        BoardState.setTokenBankCopies('fixture_producer', [
            { usesRemaining: 5000 }, { usesRemaining: 1000 }, { usesRemaining: 2500 }
        ]);

        TokenBank.sell('fixture_producer', 2);

        const left = BoardState.tokenBankCopies('fixture_producer');
        expect(left).toHaveLength(1);
        expect(left[0].usesRemaining).toBe(5000);
    });

    it('never disposes of an unlimited copy while a finite one is there (D-176)', () => {
        BoardState.setTokenBankCopies('fixture_buff_unique', [
            { usesRemaining: null }, { usesRemaining: 12 }, { usesRemaining: 30 }
        ]);

        TokenBank.sell('fixture_buff_unique', 2);

        const left = BoardState.tokenBankCopies('fixture_buff_unique');
        expect(left).toHaveLength(1);
        expect(left[0].usesRemaining).toBeNull();
    });

    it('sells what it has when asked for more, and says how many went', () => {
        BoardState.setTokenBankCopies('fixture_producer',
            [{ usesRemaining: 5000 }, { usesRemaining: 5000 }]);

        const res = TokenBank.sell('fixture_producer', 99);

        expect(res.success).toBe(true);
        expect(res.count).toBe(2);
        expect(res.gold).toBe(2 * TokenBank.SELL_VALUE.common);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(0);
    });

    it('defaults to one copy, so every existing caller is unchanged', () => {
        BoardState.setTokenBankCopies('fixture_producer',
            [{ usesRemaining: 5000 }, { usesRemaining: 5000 }]);

        const res = TokenBank.sell('fixture_producer');

        expect(res.count).toBe(1);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('refuses a zero or negative quantity without touching the Bank', () => {
        BoardState.setTokenBankCopies('fixture_producer', [{ usesRemaining: 5000 }]);
        const before = GameState.state.currency.gold;

        expect(TokenBank.sell('fixture_producer', 0).success).toBe(false);
        expect(TokenBank.sell('fixture_producer', -5).success).toBe(false);
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
        expect(GameState.state.currency.gold).toBe(before);
    });
});

describe('Mythics are unique on the BOARD, not to own (D-177)', () => {
    it('allows several copies in the Vault', () => {
        TokenBank.deposit(token('fixture_mythic', 8000));
        TokenBank.deposit(token('fixture_mythic', 8000));

        expect(BoardState.tokenBankCopies('fixture_mythic')).toHaveLength(2);
    });

    it('refuses a second copy onto the board, naming the reason', () => {
        expect(Placement.placeToken(10, token('fixture_mythic', 8000)).success).toBe(true);

        const result = Placement.placeToken(20, token('fixture_mythic', 8000));
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/only one/i);
    });

    it('lets a placed Mythic be MOVED — it does not trip over itself', () => {
        Placement.placeToken(10, token('fixture_mythic', 8000));
        expect(Placement.moveToken(10, 20).success).toBe(true);
        expect(BoardState.getToken(20).typeId).toBe('fixture_mythic');
    });

    it('frees the board once the placed copy is lifted off', () => {
        Placement.placeToken(10, token('fixture_mythic', 8000));
        Placement.returnTokenToTray(10);

        expect(Placement.placeToken(20, token('fixture_mythic', 8000)).success).toBe(true);
    });

    it('does not constrain non-Mythics at all', () => {
        expect(Placement.placeToken(10, token('fixture_producer', 5000)).success).toBe(true);
        expect(Placement.placeToken(20, token('fixture_producer', 5000)).success).toBe(true);
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
