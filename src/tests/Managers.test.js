import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Managers from '../systems/board/Managers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

/**
 * Managers (D-35, D-104, D-140, D-151, D-133) — the phase where the AFK story
 * becomes real.
 *
 * The chain these close is **gold → Maps → Token Bank → Manager → board**, and
 * the reason it stops at the Bank is deliberate: a Manager can only move a
 * Token from storage, never conjure one. That is what makes the AFK story *"the
 * board runs as long as you left it supplies for"* rather than "automation runs
 * forever".
 *
 * ## ⭐ Spots, not tiles (Free Playmat slice 1.6d-2)
 * The scene is explicit mat points 160 u apart — the step the old board had —
 * so every reach these tests turn on is the distance it always was: a side
 * neighbour 160 u, a diagonal 226 u, and `DISTANT` far outside any radius.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** A hero with every skill high enough to pass Access. */
function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level: 50, xp: 0 };
    }
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

/** A spot on the 160 u lattice. */
const P = (row, col) => ({ x: 400 + col * 160, y: 300 + row * 160 });

/** Put a Token down at a point and hand back the instance. */
function place(point, typeId, uses = undefined) {
    const charges = uses === undefined ? tokenStartingUses(typeId) : uses;
    const instance = BoardState.createTokenInstance(typeId, charges);
    Placement.placeTokenAt(instance, point);
    return instance;
}

/** The Token standing exactly at a point, and its instance id. */
const tokenAt = (point) => BoardState.tokensAtPoint(point.x, point.y)[0] ?? null;
const idAt = (point) => tokenAt(point)?.id ?? null;

/** What ran dry at a point, or null. */
const vacancyAt = (point) => BoardState.vacancyAt(BoardState.spotIdAt(point.x, point.y));

/** Run the engine for `ms`, in realistic 100ms engine ticks. */
function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

/** `SPOT` and `NEIGHBOUR` are 160 u apart; `DISTANT` is far away. */
const SPOT = P(1, 3);
const NEIGHBOUR = P(1, 4);
const EARLIER = P(1, 2);        // 160 u on SPOT's other side
// ⚠️ Not row 5: the mat is 1126 u tall and a 1×1 Token's art circle must sit
// fully inside it, so a spot below y = 1062 would be nudged somewhere else and
// this test would pass because the Token never arrived, not because no Manager
// reached it.
const DISTANT = P(4, 5);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    resetMatTuning();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

describe('Type-specific restocking (D-35)', () => {
    it('replaces an exhausted Forest from the Vault', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);   // one 12s cycle spends the last charge

        expect(tokenAt(SPOT)?.typeId).toBe('fixture_producer');
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(0);
    });

    it('will not restock a type it does not manage', () => {
        // A Lumber Camp is not a general-purpose restocker. Type-specificity is
        // what makes automation something you buy cluster by cluster.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_consumer', 600));
        place(SPOT, 'fixture_consumer', 1);
        InventoryManager.addItem('fixture_oak_wood', 10);
        Placement.plantFlagAt('hero_1', SPOT);

        run(19000);

        expect(tokenAt(SPOT)).toBeNull();
        expect(BoardState.tokenBankCopies('fixture_consumer')).toHaveLength(1);
    });

    it('refreshes an enemy Token too — enemies are not a special case (D-104)', () => {
        // They deplete like resources, restock like resources and automate like
        // resources. One economic model covers the whole board.
        place(NEIGHBOUR, 'fixture_enemy_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_enemy', 20));
        place(SPOT, 'fixture_enemy', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(60000);

        expect(tokenAt(SPOT)?.typeId).toBe('fixture_enemy');
    });
});

describe('Eight neighbouring spots, and never depleting (D-140)', () => {
    /**
     * ⚠️ D-140's "eight adjacent tiles" is amended by FP-75: Near starts at
     * 164 u, so a Manager reaches its four side neighbours and no diagonal.
     * The same layout restocks again once Near is widened back to 272 u.
     */
    it('does not cover a diagonal neighbour at the shipped 164 u (FP-75), and does at 272 u', () => {
        const diagonal = P(0, 4);
        const worked = P(1, 5);               // 226 u from `diagonal`
        place(diagonal, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(worked, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', worked);

        run(13000);
        expect(tokenAt(worked)).toBeNull();

        setMatTuning('nearRadius', 272);
        expect(Managers.sweep()).toBe(1);
        expect(tokenAt(worked)?.typeId).toBe('fixture_producer');
        resetMatTuning();
    });

    it('does NOT reach beyond its neighbourhood', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(DISTANT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', DISTANT);

        run(13000);

        expect(tokenAt(DISTANT)).toBeNull();
    });

    it('never depletes, however many restocks it performs', () => {
        // A restocker needing restocking would be exactly the chore it exists
        // to remove, which is why permanence is a rule rather than a big number.
        const camp = place(NEIGHBOUR, 'fixture_manager');
        for (let i = 0; i < 6; i++) {
            TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 1));
        }
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(90000);

        expect(camp.usesRemaining).toBeNull();
        expect(tokenAt(NEIGHBOUR)?.typeId).toBe('fixture_manager');
    });
});

describe('⚠️ Restocking UNDER a working hero, who resumes (D-151)', () => {
    it('puts a fresh Token under the hero without re-placing them', () => {
        // This is the entire point of Managers. A hero whose Forest ran dry does
        // not need re-placing — a fresh one arrives under their feet.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);

        // The hero waited on the spot for the restock (FP-70) and claimed it.
        expect(BoardState.workTokenOf('hero_1')).toBe(idAt(SPOT));
        expect(BoardState.workerOf(idAt(SPOT))).toBe('hero_1');
    });

    it('and the hero then actually produces again, unattended', () => {
        // The behavioural test, not just the state one: output has to keep
        // arriving with nobody touching anything.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);
        const afterRestock = SpriteLayer.countOnBoard('fixture_oak_wood');
        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBeGreaterThan(afterRestock);
    });

    it('restocks an unstaffed spot as well — the hero is not a precondition', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);
        run(13000);                                  // restock #1, under the hero
        Placement.recallHeroById('hero_1');

        const standing = idAt(SPOT);
        if (standing) BoardState.removeToken(standing);
        BoardState.setVacancyAt(SPOT, 'fixture_producer');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        run(1000);

        expect(tokenAt(SPOT)?.typeId).toBe('fixture_producer');
    });
});

describe('An empty Vault fails silently (D-133)', () => {
    it('leaves the spot depleted and the hero idle', () => {
        // A Manager cannot conjure a Token, only move one from storage. This is
        // what turns logging off into a decision: the board runs as long as you
        // left it supplies for.
        place(NEIGHBOUR, 'fixture_manager');
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);

        expect(tokenAt(SPOT)).toBeNull();
        // No copy in the Vault, so no wait (FP-70, FPP-9): the flag stays
        // planted and the hero idles at it.
        expect(BoardState.displayPointOf('hero_1')).toEqual(SPOT);
        expect(BoardState.waitOfHero('hero_1')).toBeNull();
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });

    it('⚠️ raises the spot mark — the only cue a returning player gets (risk 15)', () => {
        // Silent failure while the player is away is an accepted cost, but it
        // must be legible on return: "I ran out of stock" has to be
        // distinguishable from "something else went wrong".
        place(NEIGHBOUR, 'fixture_manager');
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);

        expect(vacancyAt(SPOT)?.unstocked).toBe(true);
    });

    it('picks the work back up the moment the Vault is restocked', () => {
        place(NEIGHBOUR, 'fixture_manager');
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);
        run(13000);
        expect(tokenAt(SPOT)).toBeNull();

        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        run(1000);

        expect(tokenAt(SPOT)?.typeId).toBe('fixture_producer');
    });
});

describe('Only spots that ran dry', () => {
    it('never colonises ground that was simply always empty', () => {
        // Placing a Lumber Camp must not carpet the ground you were saving for
        // something else (owner decision 2026-08-06).
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));

        run(5000);

        expect(tokenAt(SPOT)).toBeNull();
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('drops its claim when the player fills the spot by hand', () => {
        place(NEIGHBOUR, 'fixture_manager');
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);
        run(13000);                                  // ran dry, Vault empty
        expect(vacancyAt(SPOT)).not.toBeNull();

        place(SPOT, 'fixture_buff_yield');

        expect(vacancyAt(SPOT)).toBeNull();
    });

    it('does not restock a Token the PLAYER lifted off — that was a choice', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 5000);
        Placement.returnTokenToTrayById(idAt(SPOT));

        run(5000);

        expect(tokenAt(SPOT)).toBeNull();
    });
});

describe('Overlapping Managers resolve first-come (D-140)', () => {
    it('lets the earlier-placed Manager do the job, stably (slice 1.6b; was the lowest index)', () => {
        // With no ordering, two overlapping Managers would drain unpredictably
        // different piles — a difference the player can see, for no benefit.
        const earlier = place(EARLIER, 'fixture_manager');
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));

        expect(Managers.managerFor(SPOT, 'fixture_producer')[0]).toBe(earlier.id);
    });

    it('restocks exactly once, not once per covering Manager', () => {
        place(EARLIER, 'fixture_manager');
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(SPOT, 'fixture_producer', 1);
        Placement.plantFlagAt('hero_1', SPOT);

        run(13000);

        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });
});
