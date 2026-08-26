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

/**
 * Managers (D-35, D-104, D-140, D-151, D-133) — the phase where the AFK story
 * becomes real.
 *
 * The chain these close is **gold → Maps → Token Bank → Manager → board**, and
 * the reason it stops at the Bank is deliberate: a Manager can only move a
 * Token from storage, never conjure one. That is what makes the AFK story *"the
 * board runs as long as you left it supplies for"* rather than "automation runs
 * forever".
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

function place(tile, typeId, uses = undefined) {
    const charges = uses === undefined ? tokenStartingUses(typeId) : uses;
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, charges));
    return BoardState.getToken(tile);
}

/** Run the engine for `ms`, in realistic 100ms engine ticks. */
function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

// Tile 10 and tile 11 are horizontal neighbours; tile 40 is far away.
const TILE = 10;
const NEIGHBOUR = 11;
const DISTANT = 40;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

describe('Type-specific restocking (D-35)', () => {
    it('replaces an exhausted Forest from the Vault', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);   // one 12s cycle spends the last charge

        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_producer');
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(0);
    });

    it('will not restock a type it does not manage', () => {
        // A Lumber Camp is not a general-purpose restocker. Type-specificity is
        // what makes automation something you buy cluster by cluster.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_consumer', 600));
        place(TILE, 'fixture_consumer', 1);
        InventoryManager.addItem('fixture_oak_wood', 10);
        Placement.placeHero('hero_1', TILE);

        run(19000);

        expect(BoardState.getToken(TILE)).toBeNull();
        expect(BoardState.tokenBankCopies('fixture_consumer')).toHaveLength(1);
    });

    it('refreshes an enemy Token too — enemies are not a special case (D-104)', () => {
        // They deplete like resources, restock like resources and automate like
        // resources. One economic model covers the whole board.
        place(NEIGHBOUR, 'fixture_enemy_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_enemy', 20));
        place(TILE, 'fixture_enemy', 1);
        Placement.placeHero('hero_1', TILE);

        run(60000);

        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_enemy');
    });
});

describe('Eight adjacent tiles, and never depleting (D-140)', () => {
    it('covers a diagonal neighbour', () => {
        place(4, 'fixture_manager');          // tile 4 is diagonal to tile 12
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(12, 'fixture_producer', 1);
        Placement.placeHero('hero_1', 12);

        run(13000);

        expect(BoardState.getToken(12)?.typeId).toBe('fixture_producer');
    });

    it('does NOT reach beyond its 8 tiles', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(DISTANT, 'fixture_producer', 1);
        Placement.placeHero('hero_1', DISTANT);

        run(13000);

        expect(BoardState.getToken(DISTANT)).toBeNull();
    });

    it('never depletes, however many restocks it performs', () => {
        // A restocker needing restocking would be exactly the chore it exists
        // to remove, which is why permanence is a rule rather than a big number.
        const camp = place(NEIGHBOUR, 'fixture_manager');
        for (let i = 0; i < 6; i++) {
            TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 1));
        }
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(90000);

        expect(camp.usesRemaining).toBeNull();
        expect(BoardState.getToken(NEIGHBOUR)?.typeId).toBe('fixture_manager');
    });
});

describe('⚠️ Restocking UNDER a working hero, who resumes (D-151)', () => {
    it('puts a fresh Token under the hero without re-placing them', () => {
        // This is the entire point of Managers. A hero whose Forest ran dry does
        // not need re-placing — a fresh one arrives under their feet.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);

        expect(BoardState.tileOfHero('hero_1')).toBe(TILE);
        expect(BoardState.heroOnTile(TILE)).toBe('hero_1');
    });

    it('and the hero then actually produces again, unattended', () => {
        // The behavioural test, not just the state one: output has to keep
        // arriving with nobody touching anything.
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);
        const afterRestock = SpriteLayer.countOnBoard('fixture_oak_wood');
        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBeGreaterThan(afterRestock);
    });

    it('restocks an unstaffed tile as well — the hero is not a precondition', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);
        run(13000);                                  // restock #1, under the hero
        Placement.recallHero(TILE);

        BoardState.setToken(TILE, null);
        BoardState.setVacancy(TILE, 'fixture_producer');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        run(1000);

        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_producer');
    });
});

describe('An empty Vault fails silently (D-133)', () => {
    it('leaves the tile depleted and the hero idle', () => {
        // A Manager cannot conjure a Token, only move one from storage. This is
        // what turns logging off into a decision: the board runs as long as you
        // left it supplies for.
        place(NEIGHBOUR, 'fixture_manager');
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);

        expect(BoardState.getToken(TILE)).toBeNull();
        expect(BoardState.tileOfHero('hero_1')).toBe(TILE);
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });

    it('⚠️ raises the tile mark — the only cue a returning player gets (risk 15)', () => {
        // Silent failure while the player is away is an accepted cost, but it
        // must be legible on return: "I ran out of stock" has to be
        // distinguishable from "something else went wrong".
        place(NEIGHBOUR, 'fixture_manager');
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);

        expect(BoardState.getVacancy(TILE)?.unstocked).toBe(true);
    });

    it('picks the work back up the moment the Vault is restocked', () => {
        place(NEIGHBOUR, 'fixture_manager');
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);
        run(13000);
        expect(BoardState.getToken(TILE)).toBeNull();

        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        run(1000);

        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_producer');
    });
});

describe('Only tiles that ran dry', () => {
    it('never colonises a tile that was simply always empty', () => {
        // Placing a Lumber Camp must not carpet the ground you were saving for
        // something else (owner decision 2026-08-06).
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));

        run(5000);

        expect(BoardState.getToken(TILE)).toBeNull();
        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });

    it('drops its claim when the player fills the tile by hand', () => {
        place(NEIGHBOUR, 'fixture_manager');
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);
        run(13000);                                  // ran dry, Vault empty
        expect(BoardState.getVacancy(TILE)).not.toBeNull();

        place(TILE, 'fixture_buff_yield');

        expect(BoardState.getVacancy(TILE)).toBeNull();
    });

    it('does not restock a Token the PLAYER lifted off — that was a choice', () => {
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 5000);
        Placement.returnTokenToTray(TILE);

        run(5000);

        expect(BoardState.getToken(TILE)).toBeNull();
    });
});

describe('Overlapping Managers resolve first-come (D-140)', () => {
    it('lets the lowest-indexed Manager do the job, stably', () => {
        // With no ordering, two overlapping Managers would drain unpredictably
        // different piles — a difference the player can see, for no benefit.
        place(9, 'fixture_manager');
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));

        expect(Managers.managerFor(TILE, 'fixture_producer')[0]).toBe(9);
    });

    it('restocks exactly once, not once per covering Manager', () => {
        place(9, 'fixture_manager');
        place(NEIGHBOUR, 'fixture_manager');
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        place(TILE, 'fixture_producer', 1);
        Placement.placeHero('hero_1', TILE);

        run(13000);

        expect(BoardState.tokenBankCopies('fixture_producer')).toHaveLength(1);
    });
});
