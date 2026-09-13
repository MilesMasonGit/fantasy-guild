import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardPromotion from '../systems/board/BoardPromotion.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as PromotionSystem from '../systems/hero/PromotionSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { getPromotionCost, getPromotionGateSkills, getJobSkills } from '../config/registries/jobRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { chargeDeltaOf } from '../config/registries/chargeMomentRegistry.js';

/**
 * ⭐ **Promotion on the board — read from the Promotes rule** (Promotes rule P3).
 *
 * Ported from the unmerged `promotion-tokens` branch, where the job was a
 * Token field. The owner's rulings are carried over unchanged (PR-4…PR-8): the
 * hero **trains first and is asked afterwards**, the Token is the whole price,
 * declining costs nothing and moves nobody, and nothing trains that could never
 * be accepted. New here: the job comes from "Promotes the hero to Fighter.", and
 * the price is the rule's own charge cost.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const TILE = 24;
const CYCLE_MS = 20000;

/** A hero who qualifies for Fighter — every fixture Token's job. */
function makeQualified(id = 'hero_1') {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    const cost = getPromotionCost('fighter');
    for (const skillId of getPromotionGateSkills('fighter')) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel;
    }
    return hero;
}

/** A hero who does not qualify: trained in nothing. */
function makeUnqualified(id = 'hero_low') {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    Object.values(hero.skills).forEach(s => { s.level = 1; });
    return hero;
}

/** Place a fixture Token and stand a hero on it. */
function setup(hero, { uses = 1, typeId = 'fixture_promotion' } = {}) {
    GameState.state.heroes = [hero];
    BoardState.setToken(TILE, { typeId, usesRemaining: uses, cycleElapsedMs: 0 });
    BoardState.setHeroTile(hero.id, TILE);
    return BoardState.getToken(TILE);
}

/** Run the tile until it offers, or give up. Returns the offers seen. */
function trainToOffer(heroId, ticks = 40) {
    const offers = [];
    const unsub = EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, d => offers.push(d));
    for (let i = 0; i < ticks; i++) {
        const instance = BoardState.getToken(TILE);
        if (!instance) break;
        BoardPromotion.tickTile(TILE, instance, 1000, heroId);
        if (offers.length) break;
    }
    if (typeof unsub === 'function') unsub();
    return offers;
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    GameState.state.heroes = [];
    BoardState.init?.();
});

describe('⭐ the job comes from the rule', () => {
    it('reads "Promotes the hero to Fighter." off the Token', () => {
        const instance = { typeId: 'fixture_promotion' };
        expect(BoardPromotion.isPromotionToken(instance)).toBe(true);
        expect(BoardPromotion.jobFor(instance).id).toBe('fighter');
    });

    it('is not a promotion Token without the rule, or with a job that does not exist', () => {
        registerTokenTypes({
            fixture_promotion_unknown_job: {
                id: 'fixture_promotion_unknown_job', name: 'Nowhere Yard', uses: 1, requiresHero: true,
                statements: [{ id: 's', keyword: 'promotes', payload: { jobId: 'not_a_job' } }]
            }
        });
        expect(BoardPromotion.isPromotionToken({ typeId: 'fixture_producer' })).toBe(false);
        expect(BoardPromotion.isPromotionToken({ typeId: 'fixture_promotion_unknown_job' })).toBe(false);
    });

    it('ignores the retired promotion field — only the rule counts', () => {
        registerTokenTypes({
            fixture_promotion_field_only: {
                id: 'fixture_promotion_field_only', name: 'Old Yard', uses: 1, requiresHero: true,
                promotion: { jobId: 'fighter' }
            }
        });
        expect(BoardPromotion.isPromotionToken({ typeId: 'fixture_promotion_field_only' })).toBe(false);
    });
});

describe('Training happens first, and the offer comes after (PR-5)', () => {
    it('makes no offer part-way through the cycle', () => {
        const hero = makeQualified();
        const instance = setup(hero);

        const offers = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, d => offers.push(d));
        BoardPromotion.tickTile(TILE, instance, CYCLE_MS / 2, hero.id);
        if (typeof unsub === 'function') unsub();

        expect(offers).toHaveLength(0);
        expect(hero.jobId, 'and nothing has happened to the hero').toBe('recruit');
    });

    it('offers once the cycle completes', () => {
        const hero = makeQualified();
        setup(hero);

        const offers = trainToOffer(hero.id);

        expect(offers).toHaveLength(1);
        expect(offers[0]).toMatchObject({ tile: TILE, heroId: hero.id, jobId: 'fighter' });
    });

    /** ⚠️ The offer is an *offer*. Nothing may move until the player answers. */
    it('changes nothing about the hero when it offers', () => {
        const hero = makeQualified();
        const skillsBefore = Object.keys(hero.skills).sort();
        setup(hero);

        trainToOffer(hero.id);

        expect(hero.jobId).toBe('recruit');
        expect(Object.keys(hero.skills).sort()).toEqual(skillsBefore);
        expect(BoardState.getToken(TILE).usesRemaining, 'the Token is unspent').toBe(1);
    });

    it('resets a half-finished cycle when the hero walks away', () => {
        const hero = makeQualified();
        const instance = setup(hero);
        BoardPromotion.tickTile(TILE, instance, CYCLE_MS / 2, hero.id);
        expect(instance.cycleElapsedMs).toBeGreaterThan(0);

        BoardPromotion.tickTile(TILE, instance, 1000, null);

        expect(instance.cycleElapsedMs).toBe(0);
    });

    it('runs from the real board loop, not only when called directly', () => {
        const hero = makeQualified();
        setup(hero);

        const offers = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, d => offers.push(d));
        for (let i = 0; i < 25 && !offers.length; i++) BoardRunner.tick(1000);
        if (typeof unsub === 'function') unsub();

        expect(offers).toHaveLength(1);
        expect(offers[0].jobId).toBe('fighter');
    });
});

describe('It refuses BEFORE the work, never after (PR-8)', () => {
    it('does not train a hero who fails the skill gate, and says so on the tile', () => {
        const hero = makeUnqualified();
        const instance = setup(hero);

        const result = BoardPromotion.tickTile(TILE, instance, CYCLE_MS, hero.id);

        expect(instance.cycleElapsedMs, 'no progress at all').toBe(0);
        expect([ALERT.UNSKILLED, ALERT.ACCESS]).toContain(result.alert);
    });

    it('never offers to a hero who cannot take the job', () => {
        const hero = makeUnqualified();
        setup(hero);

        expect(trainToOffer(hero.id)).toHaveLength(0);
    });

    it('is silently inert for a hero who already holds the job — no alert', () => {
        const hero = makeQualified();
        setup(hero);
        PromotionSystem.promote(hero.id, 'fighter');

        const instance = BoardState.getToken(TILE);
        const result = BoardPromotion.tickTile(TILE, instance, CYCLE_MS, hero.id);

        expect(result.alert, 'having arrived is not a problem').toBeNull();
        expect(instance.cycleElapsedMs).toBe(0);
    });

    /** New in P3: the price is the rule's, so a Token can be unable to pay it. */
    it('does not train on a Token that could never pay the price — and marks it', () => {
        const hero = makeQualified();
        const instance = setup(hero, { typeId: 'fixture_promotion_costly', uses: 1 });

        const result = BoardPromotion.tickTile(TILE, instance, CYCLE_MS, hero.id);

        expect(result.alert).toBe(ALERT.CHARGES);
        expect(instance.cycleElapsedMs).toBe(0);
        expect(trainToOffer(hero.id)).toHaveLength(0);
    });
});

describe('⭐ the price is the rule’s own charge cost (PR-6)', () => {
    it('⚠️ still costs ONE charge in the migrated shape — chargeDelta 0 with no moment authored', () => {
        // Both shipped Academies were built this way by P2. Reading that 0 as
        // authored would make them promote heroes for free, forever.
        expect(chargeDeltaOf({ keyword: 'promotes', chargeDelta: 0 })).toBe(-1);
        expect(BoardPromotion.priceOf({ typeId: 'fixture_promotion' })).toBe(1);
    });

    it('spends an authored price', () => {
        const hero = makeQualified();
        setup(hero, { typeId: 'fixture_promotion_costly', uses: 3 });
        trainToOffer(hero.id);

        const result = BoardPromotion.accept(TILE);

        expect(result).toMatchObject({ success: true, spent: 2 });
        expect(BoardState.getToken(TILE).usesRemaining).toBe(1);
    });

    it('spends nothing when the author wrote a price of 0 — an unlimited academy', () => {
        const hero = makeQualified();
        setup(hero, { typeId: 'fixture_promotion_free', uses: 1 });
        trainToOffer(hero.id);

        const result = BoardPromotion.accept(TILE);

        expect(result).toMatchObject({ success: true, spent: 0 });
        expect(BoardState.getToken(TILE).usesRemaining).toBe(1);
    });

    it('treats a positive number as no price, never as a refund', () => {
        expect(chargeDeltaOf({ keyword: 'promotes', chargeDelta: 3, chargeWhen: 'on_promote' })).toBe(3);
        registerTokenTypes({
            fixture_promotion_refund: {
                id: 'fixture_promotion_refund', name: 'Refund Yard', uses: 1, requiresHero: true,
                statements: [{ id: 's', keyword: 'promotes', payload: { jobId: 'fighter' }, chargeDelta: 3, chargeWhen: 'on_promote' }]
            }
        });
        expect(BoardPromotion.priceOf({ typeId: 'fixture_promotion_refund' })).toBe(0);
    });
});

describe('Accepting is the only thing that costs anything', () => {
    it('promotes the hero onto exactly the new job sheet', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);

        const result = BoardPromotion.accept(TILE);

        expect(result.success).toBe(true);
        expect(hero.jobId).toBe('fighter');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills('fighter')].sort());
    });

    it('spends the Token — that is the whole price', () => {
        const hero = makeQualified();
        setup(hero, { uses: 2 });
        trainToOffer(hero.id);

        BoardPromotion.accept(TILE);

        expect(BoardState.getToken(TILE).usesRemaining).toBe(1);
    });

    it('takes no gold and no materials', () => {
        const hero = makeQualified();
        GameState.state.currency.gold = 1000;
        setup(hero);
        trainToOffer(hero.id);

        BoardPromotion.accept(TILE);

        expect(GameState.state.currency.gold).toBe(1000);
    });

    it('removes a Token whose last charge it just spent, and says so', () => {
        const hero = makeQualified();
        setup(hero, { uses: 1 });
        trainToOffer(hero.id);
        const depleted = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, d => depleted.push(d));

        BoardPromotion.accept(TILE);
        if (typeof unsub === 'function') unsub();

        expect(BoardState.getToken(TILE)).toBeNull();
        expect(depleted).toHaveLength(1);
        expect(depleted[0]).toMatchObject({ tile: TILE, typeId: 'fixture_promotion', heroId: hero.id });
    });

    it('leaves the hero standing where they were, not sent to the Dock', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);

        BoardPromotion.accept(TILE);

        expect(BoardState.tileOfHero(hero.id)).toBe(TILE);
    });

    /** ⚠️ A stale offer must not become a free promotion. */
    it('re-checks eligibility rather than trusting the offer', () => {
        const hero = makeQualified();
        setup(hero, { uses: 2 });
        trainToOffer(hero.id);

        // The hero gets there by another route while the ceremony is open.
        PromotionSystem.promote(hero.id, 'fighter');

        const result = BoardPromotion.accept(TILE);

        expect(result.success).toBe(false);
        expect(BoardState.getToken(TILE).usesRemaining, 'and the Token is not spent').toBe(2);
    });

    it('does nothing when there is no offer standing', () => {
        const hero = makeQualified();
        setup(hero, { uses: 2 });

        expect(BoardPromotion.accept(TILE)).toMatchObject({ success: false, reason: 'NO_OFFER' });
        expect(hero.jobId).toBe('recruit');
        expect(BoardState.getToken(TILE).usesRemaining).toBe(2);
    });
});

describe('Declining costs nothing and moves nobody (PR-7)', () => {
    it('spends no charge and does not promote', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);

        BoardPromotion.decline(TILE);

        expect(hero.jobId).toBe('recruit');
        expect(BoardState.getToken(TILE).usesRemaining).toBe(1);
    });

    it('leaves the hero standing on the Token', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);

        BoardPromotion.decline(TILE);

        expect(BoardState.tileOfHero(hero.id)).toBe(TILE);
    });

    /** ⚠️ The cycle does not restart: re-asking a player who said no is nagging. */
    it('holds the tile paused instead of training again', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);
        BoardPromotion.decline(TILE);

        const offers = trainToOffer(hero.id, 60);

        expect(offers).toHaveLength(0);
        expect(BoardPromotion.isPaused(BoardState.getToken(TILE))).toBe(true);
    });

    it('raises no alert while paused — the player chose this', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);
        BoardPromotion.decline(TILE);

        const result = BoardPromotion.tickTile(TILE, BoardState.getToken(TILE), 1000, hero.id);

        expect(result.alert).toBeNull();
    });

    it('asks again once the hero leaves and returns', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);
        BoardPromotion.decline(TILE);

        BoardPromotion.tickTile(TILE, BoardState.getToken(TILE), 1000, null);
        expect(BoardPromotion.isPaused(BoardState.getToken(TILE))).toBe(false);

        expect(trainToOffer(hero.id)).toHaveLength(1);
    });

    it('asks again when a DIFFERENT hero is put down', () => {
        const hero = makeQualified('hero_1');
        const other = makeQualified('hero_2');
        setup(hero);
        GameState.state.heroes = [hero, other];
        trainToOffer(hero.id);
        BoardPromotion.decline(TILE);

        expect(trainToOffer(other.id)).toHaveLength(1);
    });
});

describe('The offer survives a reload', () => {
    it('is stored on the instance, which is saved board state', () => {
        const hero = makeQualified();
        setup(hero);
        trainToOffer(hero.id);

        const instance = BoardState.getToken(TILE);
        expect(instance.promotionPaused).toBe(true);
        expect(instance.promotionHeroId).toBe(hero.id);

        // A save is the instance as JSON; the offer must read back from that alone.
        const reloaded = JSON.parse(JSON.stringify(instance));
        BoardState.setToken(TILE, reloaded);
        expect(BoardPromotion.getOffer(TILE)).toMatchObject({ tile: TILE, heroId: hero.id, jobId: 'fighter' });
    });
});

describe('⚠️ Tokens only (PR-3), and nothing else promotes (PR-9)', () => {
    const SRC = join(process.cwd(), 'src');
    const walk = (dir) => readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === 'tests' ? [] : walk(path);
        return /\.(js|jsx)$/.test(name) ? [path] : [];
    });
    const files = walk(SRC).map((path) => ({ path: path.slice(SRC.length + 1).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }));

    it('reads the Promotes rule in exactly one engine place, and that place reads Tokens', () => {
        const readers = files
            .filter((f) => f.path.startsWith('systems/') && !f.path.startsWith('systems/effects/'))
            .filter((f) => /promotedJobOf|KEYWORD\.PROMOTES/.test(f.text))
            .map((f) => f.path);
        expect(readers).toEqual(['systems/board/BoardPromotion.js']);
        const promo = files.find((f) => f.path === 'systems/board/BoardPromotion.js').text;
        expect(promo).toMatch(/getTokenType\(/);
    });

    it('calls PromotionSystem.promote from BoardPromotion alone — the Change Job screen only plans', () => {
        const callers = files
            .filter((f) => /\.promote\(/.test(f.text))
            .map((f) => f.path)
            .filter((p) => p !== 'systems/hero/PromotionSystem.js');
        expect(callers).toEqual(['systems/board/BoardPromotion.js']);
    });
});
