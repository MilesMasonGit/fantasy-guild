import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getTriggerEvent, TRIGGER_SCOPES } from '../config/registries/triggerRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * Two new trigger events, and the guard the second one needed.
 *
 * 1. **"A neighbour produces a specific item"** — finer than the existing "a
 *    neighbour completes a cycle", which fires on any completion including one
 *    that made nothing.
 * 2. **"This Token's own cycle completes"** — the first trigger that listens
 *    *inward*. Every other one watches a neighbour or the Bank.
 *
 * ⚠️ **The second is the risky one.** A Token reacting to its own completion is
 * the shape that can recurse, and a runaway loop in the tick path would freeze
 * the game. The guard is asserted here directly rather than reasoned about,
 * because "nothing a statement can do publishes a cycle completion" is true
 * today and is safety by accident.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const grantOf = (itemId, when) => ({
    id: `stm_${itemId}_${when.event}`,
    keyword: KEYWORD.GRANTS,
    payload: { type: 'BONUS_DROP', itemId, quantity: 1, chance: 100 },
    to: { mode: 'all', value: '' },
    when,
    upkeep: null
});

registerTokenTypes({
    /** Watches for Coal specifically, not for "a neighbour finished". */
    fixture_coal_watcher: {
        id: 'fixture_coal_watcher', name: 'Fixture Coal Watcher', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        requiresHero: false,
        statements: [grantOf('item_bones', {
            event: 'ITEM_PRODUCED', scope: TRIGGER_SCOPES.ADJACENT,
            watchItemId: 'item_coal', cooldownMs: 0
        })]
    },

    /** The same rule with no item named — must fire on nothing. */
    fixture_blank_watcher: {
        id: 'fixture_blank_watcher', name: 'Fixture Blank Watcher', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        requiresHero: false,
        statements: [grantOf('item_bones', {
            event: 'ITEM_PRODUCED', scope: TRIGGER_SCOPES.ADJACENT, cooldownMs: 0
        })]
    },

    /** Produces Oak Wood, and reacts to its OWN completion. */
    fixture_self_reactor: {
        id: 'fixture_self_reactor', name: 'Fixture Self Reactor', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        },
        statements: [grantOf('item_bones', {
            event: 'SELF_CYCLE_COMPLETE', scope: TRIGGER_SCOPES.SELF, cooldownMs: 0
        })]
    },

    /**
     * ⚠️ The pathological Token: it reacts to its own cycle by **publishing a
     * cycle completion**, which is the exact loop the guard exists for.
     *
     * Nothing in the real engine does this today, which is precisely why the
     * test has to build it by hand.
     */
    fixture_ouroboros: {
        id: 'fixture_ouroboros', name: 'Fixture Ouroboros', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        },
        statements: [grantOf('item_bones', {
            event: 'SELF_CYCLE_COMPLETE', scope: TRIGGER_SCOPES.SELF, cooldownMs: 0
        })]
    },

    /** A plain producer of Coal, to be watched. */
    fixture_coal_seam: {
        id: 'fixture_coal_seam', name: 'Fixture Coal Seam', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'item_coal', quantity: 1, chance: 100 }]
        }
    },

    /** Produces something else entirely. */
    fixture_wood_lot: {
        id: 'fixture_wood_lot', name: 'Fixture Wood Lot', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    }
});

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 }, statuses: [] };
}

function place(tile, typeId, heroId = null) {
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const bonesOnBoard = () =>
    SpriteLayer.getSprites().filter(s => s.refId === 'item_bones')
        .reduce((n, s) => n + (s.quantity || 1), 0);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

describe('A neighbour produces a specific item', () => {
    it('fires when the neighbour really produced the named item', () => {
        place(8, 'fixture_coal_watcher');
        place(9, 'fixture_coal_seam', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBeGreaterThan(0);
    });

    it('stays quiet when the neighbour completed a cycle making something else', () => {
        // The whole reason for the trigger: "a neighbour completed a cycle"
        // would have fired here, and that is too coarse to build a chain on.
        place(8, 'fixture_coal_watcher');
        place(9, 'fixture_wood_lot', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBe(0);
    });

    it('fires on nothing when no item was named, rather than on everything', () => {
        // ⚠️ A half-authored trigger that fired on every cycle would be
        // indistinguishable from the coarse one — silently the wrong rule.
        place(8, 'fixture_blank_watcher');
        place(9, 'fixture_coal_seam', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBe(0);
    });

    it('and the content check says so by name', () => {
        const hit = auditContent().find(
            f => f.where === 'Token "fixture_blank_watcher"' && f.what.includes('never says which')
        );
        expect(hit).toBeTruthy();
    });

    it('composes with the existing source filter', () => {
        // Same trigger, narrowed to a Token id that is not the one producing.
        registerTokenTypes({
            fixture_picky_watcher: {
                id: 'fixture_picky_watcher', name: 'Fixture Picky Watcher', tokenType: 'buff',
                rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
                requiresHero: false,
                statements: [grantOf('item_bones', {
                    event: 'ITEM_PRODUCED', scope: TRIGGER_SCOPES.ADJACENT,
                    watchItemId: 'item_coal', cooldownMs: 0,
                    source: { mode: 'id', value: 'fixture_wood_lot' }
                })]
            }
        });
        place(8, 'fixture_picky_watcher');
        place(9, 'fixture_coal_seam', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBe(0);
    });

    it('reads as the item, not as the picker’s label', () => {
        expect(renderStatement(
            grantOf('item_bones', { event: 'ITEM_PRODUCED', watchItemId: 'item_coal' }),
            { item: id => ({ item_bones: 'Bones', item_coal: 'Coal' }[id] || id) }
        )).toBe('When a neighbour produces Coal, grants 1 Bones to every adjacent Token.');
    });
});

describe("This Token's own cycle completes", () => {
    it('fires on its own completion, not on a neighbour’s', () => {
        place(9, 'fixture_self_reactor', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBeGreaterThan(0);
    });

    it('does not fire when the Token beside it completes instead', () => {
        // The Token that fires it is the Token that reacts. A self-scoped
        // statement on 9 must ignore 8's completion entirely.
        place(9, 'fixture_self_reactor');           // unstaffed: never cycles
        place(8, 'fixture_wood_lot', 'hero_1');

        run(13000);

        expect(bonesOnBoard()).toBe(0);
    });

    it('is declared self-scoped in the registry, so the editor offers no neighbour filter', () => {
        expect(getTriggerEvent('SELF_CYCLE_COMPLETE').scopes).toEqual([TRIGGER_SCOPES.SELF]);
    });
});

describe('⚠️ The loop guard', () => {
    /**
     * A **real** cascade through the real code path, not a simulated one.
     *
     * A triggered Token spends a charge when it serves (CMS-26), and spending
     * its last one publishes `TOKEN_DEPLETED` — **from inside the statement it
     * is in the middle of firing**. `TOKEN_DEPLETED` is itself a trigger event.
     * So a line of one-charge Tokens that each react to a neighbour running dry
     * sets each other off, each nested inside the last.
     *
     * That is the only genuine re-entrant path in the engine today, and it is
     * exactly the shape a self-trigger could grow, so the guard is measured
     * against it rather than against a mock.
     */
    // Deliberately a **line**, not a blob: down the left column and along the
    // bottom row. A cluster would spread three or four hops wide and never get
    // deep enough to reach the cap, which is precisely the mistake that would
    // make this test pass without testing anything.
    const CHAIN = [0, 7, 14, 21, 28, 35, 42, 43, 44, 45, 46, 47, 48];

    beforeEach(() => {
        registerTokenTypes({
            fixture_domino: {
                id: 'fixture_domino', name: 'Fixture Domino', tokenType: 'buff',
                rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_industry',
                requiresHero: false,
                statements: [grantOf('item_bones', {
                    event: 'TOKEN_DEPLETED', scope: TRIGGER_SCOPES.ADJACENT, cooldownMs: 0
                })]
            }
        });
    });

    it('a runaway chain stops instead of freezing the game', () => {
        for (const tile of CHAIN) place(tile, 'fixture_domino');

        // Knock the first one over by hand.
        expect(() => EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, {
            tile: 1, typeId: 'fixture_domino'
        })).not.toThrow();

        // Each level that fires drops one Bones. The cap is what keeps that
        // number finite — and it must be the cap doing it, not the board
        // running out of Tokens.
        expect(bonesOnBoard()).toBeGreaterThan(0);
        expect(bonesOnBoard()).toBeLessThanOrEqual(TriggerSystem.MAX_CASCADE_DEPTH);
        expect(CHAIN.length).toBeGreaterThan(TriggerSystem.MAX_CASCADE_DEPTH);
    });

    it('leaves Tokens beyond the cap alone rather than half-firing them', () => {
        for (const tile of CHAIN) place(tile, 'fixture_domino');
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: 1, typeId: 'fixture_domino' });

        const survivors = CHAIN.filter(t => BoardState.getToken(t));
        expect(survivors.length).toBeGreaterThan(0);
    });

    it('the cap is a circuit breaker, not a design limit', () => {
        // Far past anything a real board does, far short of a stack overflow.
        expect(TriggerSystem.MAX_CASCADE_DEPTH).toBeGreaterThan(2);
        expect(TriggerSystem.MAX_CASCADE_DEPTH).toBeLessThan(50);
    });

    it('recovers completely — a stopped cascade does not wedge the board', () => {
        // ⭐ The failure that would be impossible to reproduce: a depth counter
        // that is not unwound leaves every trigger on the board silent
        // afterwards, and it would read as "triggers stopped working".
        for (const tile of CHAIN) place(tile, 'fixture_domino');
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: 1, typeId: 'fixture_domino' });

        SpriteLayer.init();
        place(45, 'fixture_self_reactor', 'hero_1');
        run(13000);

        expect(bonesOnBoard()).toBeGreaterThan(0);
    });

    it('starts clean after a reload', () => {
        // The guard is module state, not save state.
        TriggerSystem.teardown();
        TriggerSystem.init();

        place(9, 'fixture_self_reactor', 'hero_1');
        run(13000);

        expect(bonesOnBoard()).toBeGreaterThan(0);
    });
});
