import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { tokenStartingUses, getAllTokenTypes, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { HERO_SKILL_IDS } from '../config/registries/skillRegistry.js';

/**
 * Phase 6 — the roster, recruitment, and what a Market now costs to run.
 *
 * These three are grouped because they are the same decision seen from three
 * angles: the guild is bigger, its people arrive identical, and a Market is
 * worked like any other Token.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id, held, level = 50) {
    const skills = {};
    for (const s of held) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat for the Market to stand on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.inventory.maxSlots = 50;
});

describe('The roster runs to eight (owner, 2026-09-21; D-251 had twelve)', () => {
    it('the Roster Size track tops out at 8 heroes', () => {
        const def = getUpgradeDef('roster_size');
        expect(def.maxRank).toBe(8);
        expect(def.statLabel(def.maxRank)).toContain('8');
    });

    it('buying every rank actually raises the cap to 8', () => {
        // The number in the definition and the number the game enforces are
        // written in different files; this is the join between them.
        const def = getUpgradeDef('roster_size');
        GameState.state.progress.guildUpgrades = { roster_size: def.maxRank };
        GuildUpgradeManager.recompute();

        expect(GameState.state.progress.rosterLimit).toBe(8);
        expect(HeroManager.getRosterLimit()).toBe(8);
    });

    it('an eighth hero can be fielded, and a ninth cannot', () => {
        GameState.state.progress.rosterLimit = 8;
        GameState.state.heroes = [];

        for (let i = 0; i < 8; i++) {
            expect(HeroManager.addHero(generateHero()), `hero ${i + 1}`).not.toBeNull();
        }
        expect(HeroManager.isRosterFull()).toBe(true);
        expect(HeroManager.addHero(generateHero())).toBeNull();
    });

    it('a save from the twelve-hero days keeps every hero, but cannot recruit', () => {
        // Bought ranks 9–12 under the old track, and holds ten heroes.
        GameState.state.progress.guildUpgrades = { roster_size: 12 };
        GuildUpgradeManager.recompute();
        GameState.state.heroes = Array.from({ length: 10 }, () => generateHero());

        expect(GameState.state.progress.rosterLimit).toBe(8);
        expect(GameState.state.heroes).toHaveLength(10);
        expect(HeroManager.isRosterFull()).toBe(true);
        expect(HeroManager.addHero(generateHero())).toBeNull();
    });
});

describe('New heroes are interchangeable', () => {
    it('every new hero holds the same twenty skills at level 1, and no job', () => {
        const candidates = Array.from({ length: 3 }, () => generateHero());
        expect(candidates).toHaveLength(3);

        for (const c of candidates) {
            expect(c).not.toHaveProperty('jobId');
            expect(Object.keys(c.skills).sort()).toEqual([...HERO_SKILL_IDS].sort());
            for (const s of Object.values(c.skills)) expect(s.level).toBe(1);
        }
    });

    it('new heroes differ by name and nothing else', () => {
        const candidates = Array.from({ length: 5 }, () => generateHero());
        const sheets = candidates.map(c =>
            Object.entries(c.skills).map(([k, v]) => `${k}:${v.level}`).sort().join(',')
        );
        expect(new Set(sheets).size, 'all candidates should be mechanically identical').toBe(1);
    });
});

// Rewritten with classless heroes: Commerce is cut and every hero holds every skill, so a Market is
// an ordinary Token any hero runs with its skill, and a Token still naming Commerce runs for no one.
describe('A Market is worked like any Token (D-259 retired)', () => {
    it('runs for any hero, and pays no gold (SP-65)', () => {
        GameState.state.heroes = [generateHero({ name: 'hero_1' })];
        GameState.state.heroes[0].id = 'hero_1';
        place(10, 'fixture_market', 'hero_1');
        InventoryManager.addItem('fixture_market_goods', 100);
        run(20000);

        expect(InventoryManager.getItemCount('fixture_market_goods')).toBeLessThan(100);
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    it('one still worked with the cut Commerce runs for no hero, and says so on hover only', () => {
        registerTokenTypes({
            fixture_cut_market: { ...getAllTokenTypes().fixture_market, id: 'fixture_cut_market', config: { ...getAllTokenTypes().fixture_market.config, skill: 'commerce' } }
        });
        GameState.state.heroes = [makeHero('hero_1', HERO_SKILL_IDS, 99)];
        const token = place(10, 'fixture_cut_market');
        Flags.plant('hero_1', C(10));
        InventoryManager.addItem('fixture_market_goods', 100);
        run(20000);

        expect(Flags.skipsOf(token.id).map(s => s.reason)).toEqual([BoardRunner.ALERT.UNSKILLED]);
        expect(token.alert).toBeFalsy();
        expect(InventoryManager.getItemCount('fixture_market_goods')).toBe(100);
    });
});

// 'Raw selling carries the opening economy' and the Market premium over raw
// selling were deleted with `CommerceSystem` (Token Lifecycle 9.4): there is
// no raw selling any more.
