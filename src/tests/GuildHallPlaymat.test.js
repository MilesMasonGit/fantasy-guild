import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import {
    isTileAccessible, getUpgradeDefByTile, getUpgradeCost, getUpgradeDef,
    ROSTER_BASE
} from '../config/guildUpgrades.js';
import { BOARD_SIZE, GUILD_HALL_TILE as GH } from '../config/boardGeometry.js';

// The six upgrade tiles, named by where they sit relative to the Guild Hall so
// this file does not have to be rewritten every time the board is resized.
const TOP = GH - BOARD_SIZE;        // roster_size
const BOTTOM = GH + BOARD_SIZE;     // wishing_well
const LEFT = GH - 1;                // bank_slots
const FAR_LEFT = GH - 2;            // bank_tabs
const RIGHT = GH + 1;               // token_bank_slots
const FAR_RIGHT = GH + 2;           // token_bank_tabs

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.currency = { gold: 10000 };
    GameState.state.progress.guildUpgrades = {};
});

describe('Guild Hall 6x6 Playmat Upgrade Board', () => {
    it('configures tile mappings correctly around center Guild Hall', () => {
        expect(getUpgradeDefByTile(TOP)?.id).toBe('roster_size');
        expect(getUpgradeDefByTile(LEFT)?.id).toBe('bank_slots');
        expect(getUpgradeDefByTile(FAR_LEFT)?.id).toBe('bank_tabs');
        expect(getUpgradeDefByTile(RIGHT)?.id).toBe('token_bank_slots');
        expect(getUpgradeDefByTile(FAR_RIGHT)?.id).toBe('token_bank_tabs');
    });

    it('makes the 4 cardinal tiles directly adjacent to center accessible by default', () => {
        const ranks = {};
        expect(isTileAccessible(TOP, ranks)).toBe(true);
        expect(isTileAccessible(LEFT, ranks)).toBe(true);
        expect(isTileAccessible(RIGHT, ranks)).toBe(true);
        expect(isTileAccessible(BOTTOM, ranks)).toBe(true);
    });

    it('locks the outer tiles until their direct cardinal neighbor has rank >= 1', () => {
        const ranks = {};
        expect(isTileAccessible(FAR_LEFT, ranks)).toBe(false);  // Bank Tabs needs Bank Slots
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(false); // Vault Tabs needs Vault Slots

        ranks.bank_slots = 1;
        expect(isTileAccessible(FAR_LEFT, ranks)).toBe(true);   // Bank Tabs now unlocked!
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(false); // Vault Tabs still locked

        ranks.token_bank_slots = 1;
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(true);  // Vault Tabs now unlocked!
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
