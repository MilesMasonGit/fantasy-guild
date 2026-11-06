// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { getUpgradeDef, getUpgradePrice } from '../config/guildUpgrades.js';
import { isRosterFull } from '../systems/hero/logic/HeroLifecycle.js';
import * as World from '../systems/world/World.js';
import { nextSeed } from '../systems/atlas/seededRandom.js';
import { cleanGuildName, guildNameOf, renameGuild, GUILD_NAME_MAX } from '../systems/core/GuildName.js';
import { setWorldTablesForTests, resetWorldTablesForTests } from '../config/registries/worldTablesRegistry.js';
import { FIXTURE_WORLD_RAW } from './fixtures/worldTables.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The new-game screen's choices reach the game: the Guild's name (on the slot), the world rolled
 * there (its seed kept in the save, the same world generated again), and the first hero, made in
 * Bunk Beds' free first rank. A reroll never gives a world that fails the ledger's checks F.
 */

const stored = (slot = 0) => JSON.parse(localStorage.getItem(SaveManager.getSlotKey(slot)));

const SETUP = Object.freeze({
    guildName: '  The   Lantern Company ',
    worldSeed: 424242,
    hero: { name: 'Wren', spriteId: 'hf_bard_por', flagColour: 'orange' }
});

describe('⭐ a new game from the new-game screen', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => {
        GameLoop.stop();
        if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
        SaveManager.autoSaveTimer = null;
        SaveManager.currentSlot = null;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('names the Guild, keeps the rolled world and makes the first hero as chosen; the slot shows the name', async () => {
        expect(await EngineBootstrap.startSlot(1, { setup: SETUP })).toBe(true);
        expect(guildNameOf()).toBe('The Lantern Company');
        expect(GameState.state.world.seed).toBe(SETUP.worldSeed);
        expect(GameState.state.world).toEqual(World.previewWorld(SETUP.worldSeed));

        expect(GameState.heroes).toHaveLength(1);
        expect(GameState.heroes[0]).toMatchObject(SETUP.hero);

        const save = stored(1);
        expect(save.state.meta.guildName).toBe('The Lantern Company');
        expect(save.state.world.seed).toBe(SETUP.worldSeed);
        expect(save.state.heroes.map(h => h.name)).toEqual(['Wren']);
        expect(SaveManager.getAllSlotInfos()[1]).toMatchObject({ guildName: 'The Lantern Company', heroCount: 1 });
    });

    it('the first hero holds Bunk Beds\' free first rank: the roster is full, and the next rank is the second hero at its price', async () => {
        await EngineBootstrap.startSlot(0, { setup: SETUP });
        expect(GuildUpgradeManager.getRank('roster_size')).toBe(1);
        expect(GameState.state.progress.rosterLimit).toBe(1);
        expect(isRosterFull()).toBe(true);
        expect(getUpgradePrice(getUpgradeDef('roster_size'), 1)).toEqual([{ itemId: 'item_oak_wood', quantity: 20 }]);
    });

    it('with no screen (a run with no React) the game still starts with a hero and a world, and no Guild name', async () => {
        await EngineBootstrap.startSlot(0);
        expect(GameState.heroes).toHaveLength(1);
        expect(GameState.heroes[0].name).toBeTruthy();
        expect(GameState.state.world.seed).toBe(World.runSeedOf(GameState.state));
        expect(guildNameOf()).toBeNull();
        expect(SaveManager.getAllSlotInfos()[0].guildName).toBeNull();
    });

    it('the tutorial starts at equipping a tool: the hero is already there', async () => {
        await EngineBootstrap.startSlot(0, { setup: SETUP });
        GameLoop.stop();
        QuestTokens.ensure();
        expect(TUTORIAL_QUESTS[0].id).toBe('cart_tool');
        expect(QuestTokens.tutorialTokens().map(t => t.quest.id)).toEqual(['cart_tool']);
        expect(TUTORIAL_QUESTS.map(t => t.targetType)).not.toContain('hero_recruited');
    });
});

describe('the Guild\'s name', () => {
    it('is trimmed, its spaces made one, cut to its longest; nothing left is no name', () => {
        expect(cleanGuildName('  A   B ')).toBe('A B');
        expect(cleanGuildName('x'.repeat(40))).toHaveLength(GUILD_NAME_MAX);
        expect(cleanGuildName('   ')).toBeNull();
        expect(cleanGuildName(undefined)).toBeNull();
    });

    it('is renamed in the game being played; an empty name is refused and the old one kept', () => {
        GameState.initNew();
        expect(renameGuild('Ash Hollow')).toBe(true);
        expect(guildNameOf()).toBe('Ash Hollow');
        expect(renameGuild('  ')).toBe(false);
        expect(guildNameOf()).toBe('Ash Hollow');
    });
});

describe('⭐ a reroll never gives a world that fails the checks F', () => {
    afterEach(() => resetWorldTablesForTests());

    it('a seed whose world fails one is passed over for the next seed that passes', () => {
        // Fixture tables with no tolerance on a place's chests: now and then a world misses it.
        setWorldTablesForTests({ ...FIXTURE_WORLD_RAW, valueTolerance: 0 });
        let bad = null;
        for (let seed = 1; seed <= 400 && bad === null; seed++) {
            if (World.findingsOf(World.previewWorld(seed)).some(f => World.ROLL_CHECKS.includes(f.check))) bad = seed;
        }
        expect(bad, 'a failing seed in the first 400').not.toBeNull();
        const rolled = World.rollWorld(bad);
        expect(rolled.clean).toBe(true);
        expect(rolled.seed).not.toBe(bad);
        expect(rolled.tries).toBeGreaterThan(1);
        expect(World.findingsOf(rolled.world).filter(f => World.ROLL_CHECKS.includes(f.check))).toEqual([]);
        expect(rolled.world).toEqual(World.previewWorld(rolled.seed));
    });

    it('rolls from one seed replay; on the tables in force, every roll passes', () => {
        let seed = World.freshWorldSeed(1_700_000_000_000);
        const seen = new Set();
        for (let i = 0; i < 30; i++) {
            const rolled = World.rollWorld(seed);
            expect(rolled.clean, `seed ${seed}`).toBe(true);
            expect(World.rollWorld(seed).seed).toBe(rolled.seed);
            seen.add(rolled.seed);
            seed = nextSeed(rolled.seed);
        }
        expect(seen.size).toBe(30);
    }, 60000);
});
