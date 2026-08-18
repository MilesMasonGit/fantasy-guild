import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import {
    GUILD_HALL_TILE, isTileAccessible, getUpgradeDefByTile, getUpgradeCost, getUpgradeDef,
    ROSTER_BASE
} from '../config/guildUpgrades.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.currency = { gold: 10000 };
    GameState.state.progress.guildUpgrades = {};
});

describe('Guild Hall 7x7 Playmat Upgrade Board', () => {
    it('configures tile mappings correctly around center Guild Hall', () => {
        expect(getUpgradeDefByTile(17)?.id).toBe('roster_size');
        expect(getUpgradeDefByTile(23)?.id).toBe('bank_slots');
        expect(getUpgradeDefByTile(22)?.id).toBe('bank_tabs');
        expect(getUpgradeDefByTile(25)?.id).toBe('token_bank_slots');
        expect(getUpgradeDefByTile(26)?.id).toBe('token_bank_tabs');
    });

    it('makes the 4 cardinal tiles directly adjacent to center accessible by default', () => {
        const ranks = {};
        expect(isTileAccessible(17, ranks)).toBe(true); // Top
        expect(isTileAccessible(23, ranks)).toBe(true); // Left
        expect(isTileAccessible(25, ranks)).toBe(true); // Right
        expect(isTileAccessible(31, ranks)).toBe(true); // Bottom
    });

    it('locks outer tiles (22, 26) until their direct cardinal neighbor has rank >= 1', () => {
        const ranks = {};
        expect(isTileAccessible(22, ranks)).toBe(false); // Bank Tabs (needs Bank Slots 23)
        expect(isTileAccessible(26, ranks)).toBe(false); // Vault Tabs (needs Vault Slots 25)

        // Upgrade Tile 23 (Bank Slots) to rank 1
        ranks.bank_slots = 1;
        expect(isTileAccessible(22, ranks)).toBe(true); // Bank Tabs now unlocked!
        expect(isTileAccessible(26, ranks)).toBe(false); // Vault Tabs still locked

        // Upgrade Tile 25 (Vault Slots) to rank 1
        ranks.token_bank_slots = 1;
        expect(isTileAccessible(26, ranks)).toBe(true); // Vault Tabs now unlocked!
    });

    it('refuses purchase of locked tile', () => {
        const res = GuildUpgradeManager.purchase('bank_tabs');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Requires adjacent upgrade');
    });

    it('allows purchasing roster_size rank 0 for free and recruits initial starter hero', () => {
        expect(GameState.heroes.length).toBe(0);
        const def = getUpgradeDef('roster_size');
        expect(getUpgradeCost(def, 0)).toBe(0);

        const res = GuildUpgradeManager.purchase('roster_size');
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('roster_size')).toBe(1);
        expect(GameState.heroes.length).toBe(1);
        // D-251: the cap is ROSTER_BASE + rank, not the raw rank. This used to
        // assert `1` against the drifted `Math.max(1, rank)` formula, which
        // contradicted the roster-of-twelve tests in RosterAndMarkets.
        expect(GameState.progress.rosterLimit).toBe(ROSTER_BASE + 1);
    });

    it('recruits another hero on subsequent roster_size upgrades and charges gold', () => {
        GuildUpgradeManager.purchase('roster_size'); // Rank 1 (free)
        expect(GameState.heroes.length).toBe(1);

        const def = getUpgradeDef('roster_size');
        const cost1 = getUpgradeCost(def, 1);
        expect(cost1).toBeGreaterThan(0);

        const initialGold = GameState.state.currency.gold;
        const res = GuildUpgradeManager.purchase('roster_size'); // Rank 2
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('roster_size')).toBe(2);
        expect(GameState.heroes.length).toBe(2);
        expect(GameState.progress.rosterLimit).toBe(ROSTER_BASE + 2);
        expect(GameState.state.currency.gold).toBe(initialGold - cost1);
    });

    it('unlocks dependent tracks upon upgrading predecessor', () => {
        expect(GuildUpgradeManager.isAccessible('bank_tabs')).toBe(false);

        // Buy bank_slots
        GuildUpgradeManager.purchase('bank_slots');
        expect(GuildUpgradeManager.getRank('bank_slots')).toBe(1);

        // Now bank_tabs should be accessible and purchasable
        expect(GuildUpgradeManager.isAccessible('bank_tabs')).toBe(true);
        const res = GuildUpgradeManager.purchase('bank_tabs');
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('bank_tabs')).toBe(1);
    });
});
