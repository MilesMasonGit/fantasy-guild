import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { getUpgradeDef, getUpgradeCost, isUpgradeVisible, STATION_GRANT_UPGRADES } from '../config/guildUpgrades.js';
import * as OutpostManager from '../systems/loop/OutpostManager.js';

// Locks C-12: the guild tree is the ONLY source of Outpost cards (D-34), a
// node's rank IS how many copies you own (D-37), and nodes stay hidden until
// their region is unlocked (D-36).

vi.mock('../systems/economy/CurrencyManager.js', () => ({
    CurrencyManager: {
        spendGold: vi.fn(() => true),   // assume affluence; cost curves are C-15's problem
        addGold: vi.fn()
    }
}));

const ranks = () => GameState.state.progress.guildUpgrades;

function seed(unlockedAreas = ['area_guild_hall']) {
    GameState.initNew();
    GameState.state.outposts = undefined;
    GameState.state.playmatOrder = undefined;
    GameState.state.progress.guildUpgrades = {};
    GameState.state.collection.playsets = {};
    GameState.state.collection.unlockedAreaSets = unlockedAreas;
}

beforeEach(() => seed());

describe('Rank grants copies (D-37)', () => {
    it('buying rank 2 of a station node yields two installable copies', () => {
        expect(GuildUpgradeManager.purchase('outpost_wood_kiln').success).toBe(true);
        expect(GameState.state.collection.playsets['station_wood_kiln']).toBe(1);

        expect(GuildUpgradeManager.purchase('outpost_wood_kiln').success).toBe(true);
        expect(GameState.state.collection.playsets['station_wood_kiln']).toBe(2);
    });

    it('recomputes ownership from ranks rather than incrementing', () => {
        ranks().outpost_wood_kiln = 2;
        GameState.state.collection.playsets['station_wood_kiln'] = 99;   // drifted save

        GuildUpgradeManager.recompute();

        // Derived, never accumulated — the same rule every other stat follows.
        expect(GameState.state.collection.playsets['station_wood_kiln']).toBe(2);
    });

    it('owns nothing at rank 0 — the tree is the only source (D-34)', () => {
        GuildUpgradeManager.recompute();
        for (const def of STATION_GRANT_UPGRADES) {
            expect(GameState.state.collection.playsets[def.grantsStation]).toBe(0);
        }
    });

    it('refuses to exceed a node maxRank', () => {
        const def = getUpgradeDef('outpost_wood_kiln');
        for (let i = 0; i < def.maxRank; i++) {
            expect(GuildUpgradeManager.purchase('outpost_wood_kiln').success).toBe(true);
        }
        const result = GuildUpgradeManager.purchase('outpost_wood_kiln');
        expect(result.success).toBe(false);
        expect(GameState.state.collection.playsets['station_wood_kiln']).toBe(def.maxRank);
    });
});

describe('Area gating (D-36)', () => {
    it('hides a node whose region is not unlocked', () => {
        const gated = getUpgradeDef('outpost_smelting_furnace');
        expect(gated.requiresArea).toBe('area_misty_mountains');

        expect(isUpgradeVisible(gated, ['area_guild_hall'])).toBe(false);
        expect(isUpgradeVisible(gated, ['area_guild_hall', 'area_misty_mountains'])).toBe(true);
    });

    it('omits gated nodes from the tree display entirely', () => {
        const ids = GuildUpgradeManager.getDisplayList().map(u => u.id);
        expect(ids).toContain('outpost_wood_kiln');          // ungated
        expect(ids).not.toContain('outpost_smelting_furnace'); // needs the mountains
    });

    it('reveals the node once the region unlocks', () => {
        seed(['area_guild_hall', 'area_misty_mountains']);
        const ids = GuildUpgradeManager.getDisplayList().map(u => u.id);
        expect(ids).toContain('outpost_smelting_furnace');
    });

    it('refuses to BUY a gated node, not just to show it', () => {
        // Gating has to be a rule, not a UI filter — a stale screen or a
        // console call must not be able to buy past the region lock.
        const result = GuildUpgradeManager.purchase('outpost_smelting_furnace');
        expect(result.success).toBe(false);
        expect(GameState.state.collection.playsets['station_smelting_furnace']).toBeUndefined();
    });

    it('ungated nodes stay visible with no areas at all', () => {
        expect(isUpgradeVisible(getUpgradeDef('bank_tabs'), [])).toBe(true);
    });
});

describe('Outpost banners (D-21 / D-35)', () => {
    it('starts at one banner and adds one per rank', () => {
        expect(OutpostManager.getOutposts()).toHaveLength(1);

        expect(GuildUpgradeManager.purchase('outpost_slots').success).toBe(true);
        expect(OutpostManager.getOutposts()).toHaveLength(2);

        expect(GuildUpgradeManager.purchase('outpost_slots').success).toBe(true);
        expect(OutpostManager.getOutposts()).toHaveLength(3);
    });

    it('grants a card with each new banner so it is never empty (D-35)', () => {
        GuildUpgradeManager.purchase('outpost_slots');
        const cardId = getUpgradeDef('outpost_slots').grantsCardOnUnlock;
        const fresh = OutpostManager.getOutpost('outpost_2');
        expect(fresh.activeStationCardId).toBe(cardId);
    });

    it('makes the free card genuinely OWNED, not just installed', () => {
        const cardId = getUpgradeDef('outpost_slots').grantsCardOnUnlock;
        GuildUpgradeManager.purchase('outpost_slots');

        // Granting outside the rank system would leave the player holding a
        // card `playsets` says they don't own — allocations would then read
        // owned: 0, slotted: 1.
        expect(GameState.state.collection.playsets[cardId]).toBeGreaterThanOrEqual(1);
        const grantNode = STATION_GRANT_UPGRADES.find(u => u.grantsStation === cardId);
        expect(GuildUpgradeManager.getRank(grantNode.id)).toBeGreaterThanOrEqual(1);
    });

    it('hands over an empty banner rather than minting an over-cap copy', () => {
        const cardId = getUpgradeDef('outpost_slots').grantsCardOnUnlock;
        const grantNode = STATION_GRANT_UPGRADES.find(u => u.grantsStation === cardId);
        ranks()[grantNode.id] = grantNode.maxRank;      // already maxed

        GuildUpgradeManager.purchase('outpost_slots');

        expect(OutpostManager.getOutpost('outpost_2').activeStationCardId).toBeNull();
        expect(GameState.state.collection.playsets[cardId]).toBe(grantNode.maxRank);
    });

    it('is idempotent on reload — recompute must not keep adding banners', () => {
        ranks().outpost_slots = 2;
        GuildUpgradeManager.recompute();
        expect(OutpostManager.getOutposts()).toHaveLength(3);

        GuildUpgradeManager.recompute();
        GuildUpgradeManager.recompute();
        expect(OutpostManager.getOutposts()).toHaveLength(3);
    });

    it('never destroys a banner if rank somehow reads low', () => {
        ranks().outpost_slots = 2;
        GuildUpgradeManager.recompute();
        expect(OutpostManager.getOutposts()).toHaveLength(3);

        // A banner holds a hero, a card and production progress, so the count
        // is grow-only — unlike every other rank-derived stat.
        ranks().outpost_slots = 0;
        GuildUpgradeManager.recompute();
        expect(OutpostManager.getOutposts()).toHaveLength(3);
    });
});

describe('Cost curve', () => {
    it('escalates per rank, which is the brake on specialising (D-37)', () => {
        const def = getUpgradeDef('outpost_guild_smithy');
        const r0 = getUpgradeCost(def, 0);
        const r1 = getUpgradeCost(def, 1);
        const r2 = getUpgradeCost(def, 2);
        expect(r1).toBeGreaterThan(r0);
        expect(r2).toBeGreaterThan(r1);
    });
});
