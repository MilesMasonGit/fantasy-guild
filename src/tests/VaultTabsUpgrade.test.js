import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as TokenGroups from '../systems/board/TokenGroups.js';
import { GUILD_UPGRADES } from '../config/guildUpgrades.js';

/**
 * The Vault Tabs upgrade track (D-243).
 *
 * ⚠️ **This pins a join, not a formula.** Three pieces have to agree, and each
 * is edited in a different file:
 *   `guildUpgrades.js` defines the node → `GuildUpgradeManager.recompute()`
 *   writes `board.tokenTabsUnlocked` → `TokenGroups.pad()` grows the strip on
 *   its next read.
 *
 * Break any link and nothing throws — the player simply buys an upgrade and
 * gets no tab. That is the failure this exists to catch.
 *
 * The manager's own discipline is **recompute, never increment** ("so saves can
 * never drift and rank-0 equals the game's defaults"), so these assert the
 * derived value rather than a running total.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

beforeEach(() => {
    GameState.initNew();
    GameState.state.board = { tiles: {}, tokenBank: {}, tray: [], heroTiles: {}, vacancies: {} };
});

const setRank = (rank) => {
    GuildUpgradeManager.getRanks().token_bank_tabs = rank;
    GuildUpgradeManager.recompute();
};

describe('The Vault Tabs node', () => {
    it('exists, and matches the Bank tabs node it mirrors', () => {
        const vault = GUILD_UPGRADES.find(u => u.id === 'token_bank_tabs');
        const bank = GUILD_UPGRADES.find(u => u.id === 'bank_tabs');

        expect(vault).toBeDefined();
        // 5 free + 15 purchased = 20, the same as the Bank (D-243).
        expect(vault.maxRank).toBe(bank.maxRank);
        expect(vault.maxRank).toBe(TokenGroups.TOKEN_TAB_CAP - TokenGroups.TOKEN_TAB_FREE);
    });

    it('is a separate purchase from Vault capacity', () => {
        // Two nodes touch the Vault: tabs are organisation, slots are capacity
        // (D-137). Collapsing them would make one purchase do two jobs.
        expect(GUILD_UPGRADES.find(u => u.id === 'token_bank_tabs')).toBeDefined();
        expect(GUILD_UPGRADES.find(u => u.id === 'token_bank_slots')).toBeDefined();
    });
});

describe('Buying a rank actually grows the strip', () => {
    it('starts at the free allowance with no ranks bought', () => {
        GuildUpgradeManager.recompute();

        expect(GameState.state.board.tokenTabsUnlocked).toBe(TokenGroups.TOKEN_TAB_FREE);
        expect(TokenGroups.list()).toHaveLength(TokenGroups.TOKEN_TAB_FREE);
    });

    it('adds one tab per rank, end to end', () => {
        setRank(3);

        expect(GameState.state.board.tokenTabsUnlocked).toBe(8);
        expect(TokenGroups.unlockedCount()).toBe(8);
        expect(TokenGroups.list()).toHaveLength(8);
    });

    it('reaches exactly the hard cap at max rank', () => {
        const def = GUILD_UPGRADES.find(u => u.id === 'token_bank_tabs');
        setRank(def.maxRank);

        expect(GameState.state.board.tokenTabsUnlocked).toBe(TokenGroups.TOKEN_TAB_CAP);
        expect(TokenGroups.list()).toHaveLength(TokenGroups.TOKEN_TAB_CAP);
    });

    it('recomputes from rank rather than incrementing, so a reload cannot drift', () => {
        setRank(4);
        expect(GameState.state.board.tokenTabsUnlocked).toBe(9);

        // Whatever a stale save claimed, the rank is the truth.
        GameState.state.board.tokenTabsUnlocked = 999;
        GuildUpgradeManager.recompute();
        expect(GameState.state.board.tokenTabsUnlocked).toBe(9);
    });

    it('leaves the item Bank alone', () => {
        setRank(5);
        expect(GameState.state.inventory.maxTabs).toBe(5);   // bank_tabs still rank 0
    });
});
