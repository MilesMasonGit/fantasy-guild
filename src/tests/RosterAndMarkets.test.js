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
import { generateHero, generateCandidates } from '../systems/hero/HeroGenerator.js';
import { tokenStartingUses, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { getJobSkills, STARTING_JOB_ID } from '../config/registries/jobRegistry.js';
import { FOUNDATION_SKILL_IDS } from '../config/registries/skillRegistry.js';

/**
 * Phase 6 — the roster, recruitment, and what a Market now costs to run.
 *
 * These three are grouped because they are the same decision seen from three
 * angles: the guild is bigger, its people arrive identical, and the thing that
 * turns goods into gold is now locked behind a specific job.
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

describe('Recruits are interchangeable, and the UI no longer pretends otherwise (D-73)', () => {
    it('every candidate is a Recruit holding the same six skills', () => {
        const candidates = generateCandidates(3);
        expect(candidates).toHaveLength(3);

        for (const c of candidates) {
            expect(c.jobId).toBe(STARTING_JOB_ID);
            expect(Object.keys(c.skills).sort()).toEqual([...FOUNDATION_SKILL_IDS].sort());
            for (const s of Object.values(c.skills)) expect(s.level).toBe(1);
        }
    });

    it('candidates differ by name and nothing else', () => {
        const candidates = generateCandidates(5);
        const sheets = candidates.map(c =>
            Object.entries(c.skills).map(([k, v]) => `${k}:${v.level}`).sort().join(',')
        );
        expect(new Set(sheets).size, 'all candidates should be mechanically identical').toBe(1);
    });

    it('the class/trait reveal is gone from the candidate payload', () => {
        // It advertised a rolled attribute that never did anything. Leaving it
        // would keep implying a difference between candidates that is not real.
        const [candidate] = generateCandidates(1);
        expect(candidate.revealed).toBeUndefined();
        expect(candidate.className).toBeUndefined();
        expect(candidate.traitName).toBeUndefined();
    });
});

describe('A Market demands Commerce (D-259)', () => {
    it('a Market asks for Commerce', () => {
        // ⚠️ Deliberately the fixture, not "every Market in the content set".
        // Reading live content here made this suite fail whenever the owner was
        // mid-way through authoring a Market — an engine test breaking because
        // content is half-written, which is exactly what the fixture split
        // exists to stop. `ContentRules.test.js` is where shipped Tokens are
        // checked for being well-formed.
        expect(getAllTokenTypes().fixture_market.config.skill).toBe('commerce');
    });

    it('refuses a hero without Commerce, however good they are otherwise', () => {
        // The whole point of D-259: a Market is not a thing any hero can run.
        GameState.state.heroes = [makeHero('hero_1', FOUNDATION_SKILL_IDS, 99)];
        const token = place(10, 'fixture_market');
        // A Commerce flag, so the Market is a candidate; the flag skips it as
        // UNSKILLED for hover rather than raising a red mark (Free Playmat 1.4b,
        // FP-48, FP-60).
        Flags.plant('hero_1', C(10), { skill: 'commerce' });
        InventoryManager.addItem('fixture_market_goods', 100);
        run(20000);

        expect(Flags.skipsOf(token.id).map(s => s.reason)).toEqual([BoardRunner.ALERT.UNSKILLED]);
        expect(token.alert).toBeFalsy();
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    // ⚠️ Changed in slice 2.2 (SP-65). This used to assert the Market paid
    // out gold. Gold is retired, so it now proves the Market still RUNS for a
    // Commerce hero (it eats its goods) while crediting no gold.
    it('runs for a hero who holds Commerce, and pays no gold (SP-65)', () => {
        GameState.state.heroes = [makeHero('hero_1', ['commerce'], 50)];
        place(10, 'fixture_market', 'hero_1');
        InventoryManager.addItem('fixture_market_goods', 100);
        run(20000);

        expect(InventoryManager.getItemCount('fixture_market_goods')).toBeLessThan(100);
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    it('a Merchant is the only job that brings Commerce', () => {
        const withCommerce = ['knight', 'warlord', 'zealot', 'paladin', 'druid', 'scout',
            'merchant', 'assassin', 'conjurer', 'astromancer', 'scientist', 'engineer']
            .filter(id => getJobSkills(id).includes('commerce'));

        expect(withCommerce).toEqual(['merchant']);
    });
});

// 'Raw selling carries the opening economy (D-263)' and the Market premium
// over raw selling were deleted with `CommerceSystem` (Token Lifecycle 9.4):
// there is no raw selling any more.
