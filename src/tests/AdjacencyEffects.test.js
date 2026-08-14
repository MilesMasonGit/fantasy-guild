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
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
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

describe('Support axes — XP_BONUS, FAIL_CHANCE, LOOT_MULT (CMS-20, CMS-25)', () => {
    /**
     * Three axes that existed as constants with **no consumer anywhere** until
     * Phase 4. The CMS may only offer what the board can actually do (CMS-5),
     * so the palette's support half needed building rather than exposing.
     *
     * FAIL_CHANCE and LOOT_MULT are CMS-25's **proc** shape: resolved through
     * the same three-bucket formula as every other axis, then rolled once per
     * cycle. Fixtures use 100 so the roll is deterministic.
     */
    it('widens XP the way YIELD widens output', () => {
        place(A, 'fixture_producer', 'hero_1');
        const skillId = 'logging';
        const before = GameState.state.heroes[0].skills[skillId].xp;

        place(NEIGHBOUR, 'fixture_buff_xp');   // +100%
        run(13000);

        // 4 XP authored, doubled.
        expect(GameState.state.heroes[0].skills[skillId].xp - before).toBe(8);
    });

    it('a failed cycle produces nothing and grants no XP', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_always_fails');
        const before = GameState.state.heroes[0].skills.logging.xp;

        run(13000);

        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(0);
        expect(GameState.state.heroes[0].skills.logging.xp).toBe(before);
    });

    it('a failed cycle still costs a charge — failure costs the cycle, it does not rewind it', () => {
        const token = place(A, 'fixture_producer', 'hero_1', 5);
        place(NEIGHBOUR, 'fixture_buff_always_fails');

        run(13000);

        expect(token.usesRemaining).toBe(4);
    });

    it('a failed cycle reports itself as failed, for the triggers Phase 6 adds', () => {
        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => seen.push(p.failed));

        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_always_fails');
        run(13000);

        unsub?.();
        expect(seen).toContain(true);
    });

    it('LOOT_MULT doubles a whole cycle\'s output', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_always_doubles');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(4);   // 2 doubled
    });

    it('leaves everything alone when no support buff is present', () => {
        place(A, 'fixture_producer', 'hero_1');
        run(13000);
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(2);
    });
});

describe('Targeted buffs — tag, id and tokenType (CMS-18, CMS-23)', () => {
    /**
     * D-119/D-120 keep untargeted buffs tiny because they touch everything
     * nearby. A **targeted** buff cannot be stacked onto everything
     * indiscriminately — you need the named target beside it for it to matter
     * at all — so it gets its own, larger effect budget (CMS-17). These
     * fixtures use +100% to make that unambiguous.
     *
     * Filtering happens when the tile's modifiers are rebuilt, not when an axis
     * is read: read time only knows the skill category, which cannot express
     * "this specific Token type".
     */
    it('applies a TAG-targeted buff to a Token carrying that tag', () => {
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_tag');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(4);
    });

    it('does NOT apply a tag-targeted buff to a Token without the tag', () => {
        place(A, 'fixture_producer', 'hero_1');   // no `seafood` tag
        place(NEIGHBOUR, 'fixture_buff_tag');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(2);
    });

    it('applies an ID-targeted buff only to that exact Token type', () => {
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_id');
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(4);

        place(FAR, 'fixture_producer_alt', 'hero_2');
        place(FAR - 1, 'fixture_buff_id');
        expect(TileModifiers.resolveAxis(FAR, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(2);
    });

    it('applies a TOKENTYPE-targeted buff to the whole category', () => {
        place(A, 'fixture_station', 'hero_1');            // tokenType: station
        place(NEIGHBOUR, 'fixture_buff_type');
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(4);

        place(FAR, 'fixture_producer', 'hero_2');         // tokenType: resource
        place(FAR - 1, 'fixture_buff_type');
        expect(TileModifiers.resolveAxis(FAR, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(2);
    });

    it('leaves an UNTARGETED buff applying to everything, as before', () => {
        // D-119/D-120 are unchanged — CMS-17 added a separate rule for targeted
        // buffs rather than amending the old one.
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_yield');
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 100)).toBeCloseTo(105);
    });

    it('⚠️ makes a buff with an unknown target mode inert, never universal', () => {
        // A typo in a target spec must fail closed. Failing open would turn a
        // deliberately narrow +100% into a board-wide one.
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_bad_target');

        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(2);
    });

    it('re-evaluates targeting when the Token on the tile changes', () => {
        // The buff stays put and the target moves. Targeting is resolved at
        // rebuild time, so replacing the Token must re-decide whether the
        // neighbour's buff reaches it.
        place(NEIGHBOUR, 'fixture_buff_tag');
        place(A, 'fixture_producer', 'hero_1');
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(2);

        Placement.returnTokenToTray(A);
        TileModifiers.rebuildAround(A);
        place(A, 'fixture_seafood_producer', 'hero_1');
        expect(TileModifiers.resolveAxis(A, EFFECT_TYPES.YIELD, 2)).toBeCloseTo(4);
    });

    it('actually changes what a targeted Token produces, end to end', () => {
        // The axis resolving is not the point — the output is.
        place(A, 'fixture_seafood_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_buff_tag');

        run(13000);

        expect(SpriteLayer.countOnBoard('item_fish')).toBe(4);   // 2 doubled
    });
});

describe('Skill-pooled recipes (CMS-39, CMS-76, CMS-77)', () => {
    /**
     * Recipes belong to a **skill**, and any station that opts in draws the
     * whole pool. The motivating case is a Kitchen with dozens of recipes,
     * where the old model — every station carrying its own `recipes[]` — would
     * mean copying the entire library into each new Cooking station by hand.
     *
     * Pooling is opt-in per station (CMS-76): Charcoal Kiln and Deep Kiln are
     * also smithing and stay simple fixed producers.
     */

    it('a pooled station with no context makes nothing, exactly like a private one', () => {
        InventoryManager.addItem('item_carrot', 10);
        const kitchen = place(A, 'fixture_kitchen', 'hero_1');

        run(20000);

        expect(SpriteLayer.countOnBoard('item_leek_potato_stew')).toBe(0);
        expect(kitchen.alert).toBe(BoardRunner.ALERT.NO_RECIPE);
    });

    it('runs a recipe it never declared, drawn from its skill pool', () => {
        InventoryManager.addItem('item_carrot', 10);
        place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        run(11000);

        // Nothing on fixture_kitchen mentions `pooled_stew` — it is authored
        // against the `cooking` skill, not against this station.
        expect(SpriteLayer.countOnBoard('item_leek_potato_stew')).toBe(1);
    });

    it('shares one pool between two stations of the same skill', () => {
        // The reason pooling exists: a second Cooking station needs no recipes
        // copied into it, and inherits everything the first one can make.
        InventoryManager.addItem('item_carrot', 10);
        place(A, 'fixture_camp_stove', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        run(11000);

        expect(SpriteLayer.countOnBoard('item_leek_potato_stew')).toBe(1);
    });

    it('uses the RECIPE\'s cycle time, not the station\'s (CMS-70)', () => {
        // The station says 16s; `pooled_stew` says 10s. A Feast can plausibly
        // take longer than Bread, which is what lets recipe complexity
        // correlate with time.
        InventoryManager.addItem('item_carrot', 10);
        place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        run(9000);
        expect(SpriteLayer.countOnBoard('item_leek_potato_stew')).toBe(0);

        run(2000);
        expect(SpriteLayer.countOnBoard('item_leek_potato_stew')).toBe(1);
    });

    it('awards the RECIPE\'s XP, not the station\'s', () => {
        InventoryManager.addItem('item_carrot', 10);
        place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        const before = GameState.state.heroes[0].skills.cooking.xp;
        run(11000);

        // 5 from the recipe, not 3 from the station's config.
        expect(GameState.state.heroes[0].skills.cooking.xp - before).toBe(5);
    });

    it('falls back to the station\'s cycle time for a PRIVATE station (CMS-79)', () => {
        // Nothing changed for stations that did not opt in — which is why no
        // shipped content needed migrating.
        InventoryManager.addItem('item_coal', 10);
        place(A, 'fixture_station', 'hero_1');
        place(NEIGHBOUR, 'fixture_context_a');

        run(15000);
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(0);

        run(2000);
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(1);
    });
});

describe('⚠️ Context COMBINATIONS gate a recipe (CMS-6, CMS-7)', () => {
    /**
     * The Kitchen mechanic: **Tool × Cookbook**. A Pie Tin narrows to a
     * category of dish, a Cookbook picks the dish within it, and swapping
     * either changes the output. This caps the number of context Tokens at
     * roughly (#tools + #cookbooks) rather than one per dish — the clutter
     * problem that killed the earlier spatial playmat.
     *
     * The engine already required EVERY tag rather than any, so this proves a
     * capability that existed but had never been exercised by content.
     */
    it('makes nothing with only the Tool beside it', () => {
        InventoryManager.addItem('item_blueberry', 10);
        const kitchen = place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_pie_tin');

        run(25000);

        expect(SpriteLayer.countOnBoard('item_blueberry_pie')).toBe(0);
        expect(kitchen.alert).toBe(BoardRunner.ALERT.NO_RECIPE);
    });

    it('makes nothing with only the Cookbook beside it', () => {
        InventoryManager.addItem('item_blueberry', 10);
        const kitchen = place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_cookbook');

        run(25000);

        expect(SpriteLayer.countOnBoard('item_blueberry_pie')).toBe(0);
        expect(kitchen.alert).toBe(BoardRunner.ALERT.NO_RECIPE);
    });

    it('makes the pie only when BOTH are adjacent', () => {
        InventoryManager.addItem('item_blueberry', 10);
        place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_pie_tin');
        place(16, 'fixture_cookbook');

        run(21000);

        expect(SpriteLayer.countOnBoard('item_blueberry_pie')).toBe(1);
    });

    it('resolves the two-tag recipe without conflicting against the one-tag recipe', () => {
        // Both pooled recipes are candidates for this station. Only the pie's
        // context is satisfied, so this must be a clean OK rather than D-20's
        // conflict state.
        place(A, 'fixture_kitchen', 'hero_1');
        place(NEIGHBOUR, 'fixture_pie_tin');
        place(16, 'fixture_cookbook');

        const resolved = RecipeResolver.resolveRecipe(A, BoardState.getToken(A));
        expect(resolved.status).toBe(RECIPE.OK);
        expect(resolved.recipe.id).toBe('pooled_pie');
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
