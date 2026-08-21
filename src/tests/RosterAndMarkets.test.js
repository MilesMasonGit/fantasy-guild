import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MARKET_PREMIUM } from './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { CommerceSystem } from '../systems/economy/CommerceSystem.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
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

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
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

describe('The roster runs to twelve (D-251)', () => {
    it('the Roster Size track tops out at 12 heroes', () => {
        const def = getUpgradeDef('roster_size');
        expect(5 + def.maxRank).toBe(12);
        expect(def.statLabel(def.maxRank)).toContain('12');
    });

    it('buying every rank actually raises the cap to 12', () => {
        // The number in the definition and the number the game enforces are
        // written in different files; this is the join between them.
        const def = getUpgradeDef('roster_size');
        GameState.state.progress.guildUpgrades = { roster_size: def.maxRank };
        GuildUpgradeManager.recompute();

        expect(GameState.state.progress.rosterLimit).toBe(12);
        expect(HeroManager.getRosterLimit()).toBe(12);
    });

    it('a twelfth hero can be fielded, and a thirteenth cannot', () => {
        GameState.state.progress.rosterLimit = 12;
        GameState.state.heroes = [];

        for (let i = 0; i < 12; i++) {
            expect(HeroManager.addHero(generateHero()), `hero ${i + 1}`).not.toBeNull();
        }
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
        const token = place(10, 'fixture_market', 'hero_1');
        InventoryManager.addItem('item_market_goods', 100);
        const goldBefore = CurrencyManager.getCurrency('gold');

        run(20000);

        expect(token.alert).toBe(BoardRunner.ALERT.UNSKILLED);
        expect(CurrencyManager.getCurrency('gold')).toBe(goldBefore);
    });

    it('runs for a hero who holds Commerce, and pays out in gold', () => {
        GameState.state.heroes = [makeHero('hero_1', ['commerce'], 50)];
        place(10, 'fixture_market', 'hero_1');
        InventoryManager.addItem('item_market_goods', 100);
        const goldBefore = CurrencyManager.getCurrency('gold');

        run(20000);

        expect(CurrencyManager.getCurrency('gold')).toBeGreaterThan(goldBefore);
    });

    it('a Merchant is the only job that brings Commerce', () => {
        const withCommerce = ['knight', 'warlord', 'zealot', 'paladin', 'druid', 'scout',
            'merchant', 'assassin', 'conjurer', 'astromancer', 'scientist', 'engineer']
            .filter(id => getJobSkills(id).includes('commerce'));

        expect(withCommerce).toEqual(['merchant']);
    });
});

describe('Raw selling carries the opening economy (D-263)', () => {
    it('sells from the Bank with no hero, no Token and no skill', () => {
        // This is what makes gating Markets behind a Tier-2 job survivable: the
        // player is never without a way to turn goods into gold, only without
        // the premium one.
        InventoryManager.addItem('item_market_goods', 10);
        const goldBefore = CurrencyManager.getCurrency('gold');

        const result = CommerceSystem.sellItem('item_market_goods', 10);

        expect(result.success).toBe(true);
        expect(result.totalGold).toBeGreaterThan(0);
        expect(CurrencyManager.getCurrency('gold')).toBe(goldBefore + result.totalGold);
        expect(InventoryManager.getItemCount('item_market_goods')).toBe(0);
    });

    it('a Market beats it by roughly 20%, which is the whole reason to want one', () => {
        // ⚠️ Two things changed here, both of them fixes.
        //
        // It used to find "the first Market in the content set", so it broke the
        // moment the owner authored a Market that was not finished yet — an
        // engine test failing over half-written content. It now reads the
        // fixture, whose input has a fixed Bank price.
        //
        // And it used to assert only `payout > raw`, sitting under a comment
        // claiming a "3× / limit of 30" rule. **The owner never set that rule.**
        // The real one, stated 2026-08-20, is a ~20% premium over the Bank's
        // sell price — `MARKET_PREMIUM`.
        const market = getAllTokenTypes().fixture_market;
        const input = market.config.inputs[0];
        const payout = market.config.outputs.find(o => o.currency === 'gold').quantity;
        const raw = CommerceSystem.getItemPrice(input.itemId) * input.quantity;

        expect(payout, `${market.id} must beat selling its input raw`).toBeGreaterThan(raw);
        expect(payout / raw).toBeCloseTo(MARKET_PREMIUM, 2);
    });
});
