import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import './fixtures/fixtureItems.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { getGlobalAggregator, aimedModifiers } from '../systems/effects/GuildModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { ceremonyFor } from '../ui/components/board/hallCeremony.js';

/**
 * Buying several ranks of a Guild Hall star at once (`GuildUpgradeManager.purchaseRanks`): the same
 * Bank, ranks, rules and counted purchases as that many single buys, one rank change, one event
 * (so one ceremony), and all or nothing when the Bank is short.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const ORE = 'fixture_copper_ore';
const OAK = 'item_oak_wood';

let seq = 0;
const xp = (value) => ({
    id: `stm_mr_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value, category: 'mining' },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
});
const rank = (price, value, lines = []) => ({ tier: 1, price, rules: [xp(value)], lines });

/** One five-rank star with mixed prices (one rank names an item twice), and a neighbour it opens. */
function sky() {
    return {
        constellations: { mining: { id: 'mining', name: 'Mining', label: { x: 1, y: 0 }, skill: 'mining' } },
        stars: {
            mr_lore: { id: 'mr_lore', constellation: 'mining', name: 'Lore', node: { x: 0.7, y: 0 }, links: [HALL_NODE], ranks: [
                rank([{ itemId: ORE, quantity: 5 }], 1),
                rank([{ itemId: ORE, quantity: 10 }, { itemId: OAK, quantity: 3 }], 2),
                rank([{ itemId: OAK, quantity: 4 }, { itemId: OAK, quantity: 2 }], 4, [{ itemId: ORE, quantity: 2 }]),
                rank([{ itemId: ORE, quantity: 20 }], 6),
                rank([], 9)
            ] },
            mr_next: { id: 'mr_next', constellation: 'mining', name: 'Next', node: { x: 1.0, y: 0 }, links: ['mr_lore'], ranks: [
                rank([{ itemId: ORE, quantity: 1 }], 1)
            ] }
        }
    };
}

const SKY = sky();

function hero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function fresh(ore = 1000, oak = 1000) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('hero_1')];
    GameState.state.inventory.maxSlots = 200;
    registerHallSky(SKY);
    GuildUpgradeManager.recompute();
    if (ore) InventoryManager.addItem(ORE, ore);
    if (oak) InventoryManager.addItem(OAK, oak);
}

/** What a buy leaves behind: the Bank, the ranks, the guild's rules, and the purchases counted. */
function outcome(events) {
    const guild = getGlobalAggregator();
    return {
        bank: { ore: InventoryManager.getItemCount(ORE), oak: InventoryManager.getItemCount(OAK) },
        ranks: { ...GameState.state.progress.guildUpgrades },
        sources: HallRules.installedSources(),
        miningXp: guild.resolveAxis(EFFECT_TYPES.XP_BONUS, 100, 'mining'),
        aimed: aimedModifiers().length,
        rosterLimit: GameState.state.progress.rosterLimit,
        heroes: GameState.state.heroes.length,
        counted: events.reduce((n, e) => n + (e.count || 1), 0),
        lastRank: events[events.length - 1]?.rank
    };
}

function listen() {
    const events = [];
    const off = EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, (d) => events.push(d));
    return { events, off };
}

beforeEach(() => fresh());

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});

describe('buying several ranks at once', () => {
    for (const [from, n] of [[0, 3], [1, 3], [0, 5], [2, 2]]) {
        it(`ranks ${from + 1} to ${from + n} cost and give exactly what ${n} single buys would`, () => {
            fresh();
            for (let i = 0; i < from; i++) expect(GuildUpgradeManager.purchase('mr_lore').success).toBe(true);
            const singles = listen();
            for (let i = 0; i < n; i++) expect(GuildUpgradeManager.purchase('mr_lore').success).toBe(true);
            singles.off();
            const bySingles = outcome(singles.events);

            fresh();
            for (let i = 0; i < from; i++) expect(GuildUpgradeManager.purchase('mr_lore').success).toBe(true);
            const multi = listen();
            expect(GuildUpgradeManager.purchaseRanks('mr_lore', n)).toEqual({ success: true });
            multi.off();

            expect(outcome(multi.events)).toEqual(bySingles);
            expect(singles.events).toHaveLength(n);
            expect(multi.events).toEqual([{ upgradeId: 'mr_lore', rank: from + n, fromRank: from, count: n }]);
        });
    }

    it('prices the ranks together, an item named twice merged', () => {
        expect(GuildUpgradeManager.getRanksCost('mr_lore', 1)).toEqual([{ itemId: ORE, quantity: 5 }]);
        expect(GuildUpgradeManager.getRanksCost('mr_lore', 3)).toEqual([{ itemId: ORE, quantity: 15 }, { itemId: OAK, quantity: 9 }]);
        expect(GuildUpgradeManager.getRanksCost('mr_lore', 6)).toBeNull();
        expect(GuildUpgradeManager.getRanksCost('mr_lore', 0)).toBeNull();
    });

    it('takes nothing and buys nothing when the Bank is short for the whole lot', () => {
        fresh(14, 1000);   // ranks 1 and 2 need 15 ore together
        const { events, off } = listen();
        const r = GuildUpgradeManager.purchaseRanks('mr_lore', 2);
        off();
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/Not enough items/);
        expect(InventoryManager.getItemCount(ORE)).toBe(14);
        expect(InventoryManager.getItemCount(OAK)).toBe(1000);
        expect(GuildUpgradeManager.getRank('mr_lore')).toBe(0);
        expect(events).toEqual([]);
        // One rank alone is still affordable.
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 1).success).toBe(true);
    });

    it('refuses more ranks than are left, a locked star and a count below one', () => {
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 6)).toEqual({ success: false, error: 'Only 5 ranks left' });
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 0).success).toBe(false);
        expect(GuildUpgradeManager.purchaseRanks('mr_next', 1).success).toBe(false);
        expect(GuildUpgradeManager.getRank('mr_lore')).toBe(0);
        expect(InventoryManager.getItemCount(ORE)).toBe(1000);
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 5).success).toBe(true);
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 1)).toEqual({ success: false, error: 'Already at max rank' });
    });

    it('recruits a hero for every Roster Size rank, as single buys do', () => {
        const left = 3;
        for (let i = 0; i < left; i++) expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        const bySingles = { limit: GameState.state.progress.rosterLimit, heroes: GameState.state.heroes.length };
        expect(bySingles.heroes).toBeGreaterThan(1);
        fresh();
        expect(GuildUpgradeManager.purchaseRanks('roster_size', left).success).toBe(true);
        expect({ limit: GameState.state.progress.rosterLimit, heroes: GameState.state.heroes.length }).toEqual(bySingles);
    });

    it('plays one ceremony: the stars it opened and the constellation it finished, from its rank before', () => {
        expect(GuildUpgradeManager.purchaseRanks('mr_lore', 3).success).toBe(true);
        const c = ceremonyFor('mr_lore', 3, GuildUpgradeManager.getRanks(), 0);
        expect(c.opened).toEqual(['mr_next']);
        // From rank 2 nothing new opens: the neighbour opened with rank 1.
        expect(ceremonyFor('mr_lore', 3, GuildUpgradeManager.getRanks()).opened).toEqual([]);
    });
});
