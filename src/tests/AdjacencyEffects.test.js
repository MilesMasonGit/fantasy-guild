import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import { RECIPE } from '../systems/board/RecipeResolver.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * Adjacency — the spatial half of the game.
 *
 * **Adjacency governs *what*, not *how much*.** Context Tokens define what a
 * station makes, which is binary and decisive (D-18); numerical effects are
 * deliberately small (D-119/D-120). These tests hold both halves apart, because
 * the failure mode is drift toward the second — bigger buff numbers are an easy
 * lever and the wrong one (risk 2).
 *
 * ⚠️ This file also covers the thing the gap analysis found broken: **only
 * `SPEED` crossed scopes in the old engine**, so a Context Token could never
 * actually change a neighbour's yield or input cost. Widening those axes is
 * decision `G-5`.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/** Place a Token, rebuilding the modifier scope exactly as the engine does. */
function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2'), makeHero('hero_3')];
    GameState.state.inventory.maxSlots = 50;
});

// tiles 17 and 18 are adjacent; 17 and 45 are not.
const A = 17, NEIGHBOUR = 18, FAR = 45;

describe('⚠️ G-5 — a NEIGHBOUR can change YIELD (this did not work before)', () => {
    it('a Sawmill beside a Forest raises its output', () => {
        // The whole point of D-119. Previously YIELD was card-local, so the
        // Sawmill parsed, registered cleanly, and did nothing.
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_yield');

        const resolved = TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100);
        expect(resolved).toBeCloseTo(105);          // +5%
    });

    it('does nothing from a NON-adjacent tile — reach is exactly 8 (D-81)', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(FAR, 'fixture_buff_yield');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(100);
    });

    it('a Tool Rack beside a station shortens its WORK_TIME', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_speed');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.WORK_TIME, 10000)).toBeCloseTo(9000);
    });

    it('resolves back to base once the neighbour is removed', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_yield');
        Placement.returnTokenToTray(NEIGHBOUR);
        TileModifiers.rebuildAround(NEIGHBOUR);

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(100);
    });
});

describe('Stacking is uncapped, because effects are SMALL (D-23, D-120)', () => {
    it('two Sawmills give twice one Sawmill, never the square of it', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_yield');
        place(16, 'fixture_buff_yield');
        TileModifiers.rebuildTile(A);

        // +5% and +5% = +10%. Compounding would give 1.1025 — the bug the
        // three-bucket rule exists to prevent.
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(110);
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).not.toBeCloseTo(110.25);
    });

    it('eight Sawmills still only give a small number', () => {
        // The design's own argument for leaving stacking uncapped. If this ever
        // reads as large, the buff numbers have drifted, not the rule.
        //
        // Centred on tile 10, whose 8 neighbours are all placeable. Tile 17 —
        // used elsewhere in this file — borders the Guild Hall, which refuses
        // everything (D-106), so only 7 would land there.
        const CENTRE = 10;
        place(CENTRE, 'fixture_producer', 'hero_1');
        for (const n of [2, 3, 4, 9, 11, 16, 17, 18]) place(n, 'fixture_buff_yield');
        TileModifiers.rebuildTile(CENTRE);

        const resolved = TileModifiers.resolveAxis(CENTRE, EFFECT_TYPES.YIELD, 100);
        expect(resolved).toBeCloseTo(140);              // +40%, not +400%
        expect(resolved).toBeLessThan(200);
    });

    it('honours a "does not stack with duplicates" flag (D-82)', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_unique');
        place(16, 'fixture_buff_unique');
        TileModifiers.rebuildTile(A);

        // Two Shrines, one effect — the Token opted out of repetition.
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(110);
    });
});

describe('Hero buffs are NOT tile modifiers (D-112, D-152)', () => {
    it('a Campfire does not touch the Token beside it', () => {
        // A Buff Token targets EITHER the adjacent Token or the adjacent hero.
        // A Campfire heals the person; it must not quietly become a yield buff.
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_hero');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(100);
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.HP_REGEN, 0)).toBeCloseTo(0);
    });
});

describe('Context crafting — adjacency DEFINES what a station makes (D-18)', () => {
    it('a Forge with nothing beside it makes nothing at all', () => {
        const forge = place(A, 'fixture_station', 'hero_1');
        InventoryManager.addItem('item_coal', 10);

        run(20000);

        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(0);
        expect(forge.alert).toBe(BoardRunner.ALERT.NO_RECIPE);
    });

    it('the same Forge with a Helmet Schematic makes helmets', () => {
        InventoryManager.addItem('item_coal', 10);
        place(A, 'fixture_station', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        run(17000);

        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(1);
        expect(BoardState.getToken(A).alert).toBeFalsy();
    });

    it('swapping the schematic changes what it makes — no menu involved', () => {
        InventoryManager.addItem('item_coal', 10);
        InventoryManager.addItem('item_oak_wood', 10);
        place(A, 'fixture_station', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');
        run(17000);
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(1);

        // Move a Token, change the product. That IS the interface.
        Placement.returnTokenToTray(NEIGHBOUR);
        TileModifiers.rebuildAround(NEIGHBOUR);
        place(NEIGHBOUR, 'fixture_context_b');
        run(17000);

        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(2);
    });

    it('CONFLICTING context is an error state, not a silent priority order (D-20)', () => {
        InventoryManager.addItem('item_coal', 10);
        InventoryManager.addItem('item_oak_wood', 10);
        const forge = place(A, 'fixture_station', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');
        place(16, 'fixture_context_b');

        run(20000);

        expect(forge.alert).toBe(BoardRunner.ALERT.CONFLICT);
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(0);
        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(0);
    });

    it('a context Token serves EVERY adjacent station (D-113)', () => {
        // One schematic between two Forges drives both.
        InventoryManager.addItem('item_coal', 20);
        place(16, 'fixture_station', 'hero_1');
        place(18, 'fixture_station', 'hero_2');
        place(17, 'fixture_context_a');

        run(17000);

        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(2);
    });

    it('a context Token with nothing relevant adjacent is inert (D-19)', () => {
        place(A, 'fixture_context_a');
        place(NEIGHBOUR, 'fixture_producer', 'hero_1');   // not a context-driven station

        run(13000);

        // The Forest works normally; the schematic simply does nothing.
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBeGreaterThan(0);
        expect(RecipeResolver.servesFrom(A)).toEqual([]);
    });
});

describe('Support wears per cycle SERVED (D-126, D-157)', () => {
    it('a schematic loses one use per cycle the station completes', () => {
        InventoryManager.addItem('item_coal', 20);
        place(A, 'fixture_station', 'hero_1');
        const schematic = place(NEIGHBOUR, 'fixture_context_a', null, 10);

        run(17000);

        expect(schematic.usesRemaining).toBe(9);
    });

    it('⚠️ serving TWO stations wears it twice as fast — a rate trade, not free value', () => {
        // This is D-157's whole point: one Token serving three stations gives
        // the same TOTAL benefit as one serving a single station, three times
        // faster and wearing out three times sooner. Clustering buys throughput
        // now at the cost of restocking sooner. It is not strictly better.
        InventoryManager.addItem('item_coal', 40);
        place(16, 'fixture_station', 'hero_1');
        place(18, 'fixture_station', 'hero_2');
        const schematic = place(17, 'fixture_context_a', null, 10);

        run(17000);

        expect(schematic.usesRemaining).toBe(8);      // TWO cycles served
    });

    it('an unlimited-use buff never wears (D-176)', () => {
        place(A, 'fixture_producer', 'hero_1');
        const shrine = place(NEIGHBOUR, 'fixture_buff_unique');   // uses: null
        run(13000 * 2);
        expect(shrine.usesRemaining).toBeNull();
    });

    it('a spent schematic disappears, and the station stops making that thing', () => {
        InventoryManager.addItem('item_coal', 20);
        const forge = place(A, 'fixture_station', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a', null, 1);

        run(17000);
        expect(BoardState.getToken(NEIGHBOUR)).toBeNull();

        run(20000);
        // With its context gone the Forge is back to making nothing at all.
        expect(forge.alert).toBe(BoardRunner.ALERT.NO_RECIPE);
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(1);
    });
});

describe('End to end — a buff actually changes what lands on the board', () => {
    it('a Shrine beside a Forest raises the wood it produces', () => {
        // +10% on a base of 2 gives 2.2 — "2, plus a 20% chance of a 3rd".
        // Deterministic here by forcing the roll.
        const rng = vi.spyOn(Math, 'random').mockReturnValue(0.01);   // always rounds up
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_unique');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(3);
        rng.mockRestore();
    });

    it('and produces the plain amount without it', () => {
        const rng = vi.spyOn(Math, 'random').mockReturnValue(0.01);
        place(A, 'fixture_producer', 'hero_1');
        run(13000);
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(2);
        rng.mockRestore();
    });
});

describe('Scope composition — the rule Phase 0 pinned before it had a consumer', () => {
    it('tile and guild scopes merge into ONE bucket set, never compounding', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_yield');            // +5% from the tile scope

        getGlobalAggregator().addModifier({
            source: 'guild:aura_test', type: EFFECT_TYPES.YIELD,
            bucket: 'percentage', value: 0.05
        });

        // +5% and +5% = +10%. Resolved separately and multiplied it would be
        // +10.25% — small here, and exactly how "small adjacency effects"
        // quietly become large ones.
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(110);
        getGlobalAggregator().clearAll();
    });
});
