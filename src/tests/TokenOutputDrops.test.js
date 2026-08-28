import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { colOf, rowOf, TILE_PX, TILE_STEP_PX } from '../config/boardGeometry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * Token outputs via floor drop (Recipe & Charges rework, P5 / concept §1).
 *
 * A recipe output carries exactly one of `itemId`, `tokenId` or `currency`
 * (pinned by `RecipeSchema.test.js`). Items become floor sprites and gold is
 * credited; before P5 a `tokenId` output matched neither branch in
 * `BoardRunner` and produced nothing at all.
 *
 * These tests pin the drop itself: that it goes through the same
 * `SpriteLayer.addSprite('token', …)` call a Map burst uses, that it carries
 * `tokenStartingUses` as its charges (with `null` meaning unlimited, R-4), and
 * that `chance` / `minQty` / `maxQty` / the source tile behave as they already
 * do for item outputs.
 *
 * ⚠️ **Fixture-proven only.** No shipped recipe declares a Token output.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const STATION = 17;

registerTokenTypes({
    /** The station under test: one skill, one pool, nothing else going on. */
    fixture_drop_bench: {
        id: 'fixture_drop_bench', name: 'Fixture Drop Bench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 900, sprite: 'skill_flask',
        requiresHero: false,
        config: { skill: 'fixture_drop_skill', skillRequired: 1, cycleTimeMs: 10000, xp: 0 },
        statements: [{
            id: 'stm_fixture_drop_bench',
            keyword: KEYWORD.STATION,
            payload: { skill: 'fixture_drop_skill' }
        }]
    },
    /** A limited Token to be crafted — 12 charges when fresh. */
    fixture_dropped_tool: {
        id: 'fixture_dropped_tool', name: 'Fixture Dropped Tool', tokenType: 'support',
        rarity: 'common', theme: 'fixture', uses: 12, sprite: 'skill_mining',
        requiresHero: false
    },
    /** An unlimited Token to be crafted — `uses: null` (R-4). */
    fixture_dropped_eternal: {
        id: 'fixture_dropped_eternal', name: 'Fixture Dropped Eternal', tokenType: 'support',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_mining',
        requiresHero: false
    }
});

registerRecipePools({
    fixture_drop_skill: [
        {
            id: 'drop_one_tool', levelRequirement: 0, requiresContext: [], inputs: [],
            outputs: [{ tokenId: 'fixture_dropped_tool', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 10000, xp: 0
        },
        {
            id: 'drop_eternal', levelRequirement: 1, requiresContext: [], inputs: [],
            outputs: [{ tokenId: 'fixture_dropped_eternal', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 10000, xp: 0
        },
        {
            id: 'drop_three_tools', levelRequirement: 1, requiresContext: [], inputs: [],
            outputs: [{ tokenId: 'fixture_dropped_tool', minQty: 3, maxQty: 3, chance: 100 }],
            durationMs: 10000, xp: 0
        },
        {
            id: 'drop_never', levelRequirement: 1, requiresContext: [], inputs: [],
            outputs: [{ tokenId: 'fixture_dropped_tool', minQty: 1, maxQty: 1, chance: 0 }],
            durationMs: 10000, xp: 0
        },
        {
            id: 'drop_tool_and_item', levelRequirement: 1, requiresContext: [], inputs: [],
            outputs: [
                { tokenId: 'fixture_dropped_tool', minQty: 1, maxQty: 1, chance: 100 },
                { itemId: 'fixture_oak_wood', minQty: 2, maxQty: 2, chance: 100 }
            ],
            durationMs: 10000, xp: 0
        }
    ]
});

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

/** Place the bench and set it to `recipeId`. */
function bench(recipeId) {
    const instance = BoardState.createTokenInstance(
        'fixture_drop_bench', tokenStartingUses('fixture_drop_bench')
    );
    Placement.placeToken(STATION, instance);
    const placed = BoardState.getToken(STATION);
    placed.selectedRecipeId = recipeId;
    Placement.placeHero('hero_1', STATION);
    return placed;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

const tokenSprites = () => SpriteLayer.getSprites().filter(s => s.kind === 'token');

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

describe('A recipe that outputs a Token drops it on the floor', () => {
    it('spawns a token sprite where before it produced nothing', () => {
        bench('drop_one_tool');
        run(11000);

        const drops = tokenSprites();
        expect(drops).toHaveLength(1);
        expect(drops[0].refId).toBe('fixture_dropped_tool');
        expect(drops[0].quantity).toBe(1);
    });

    it('gives the drop its starting charges', () => {
        bench('drop_one_tool');
        run(11000);

        expect(tokenSprites()[0].usesRemaining).toBe(12);
        expect(tokenSprites()[0].usesRemaining).toBe(tokenStartingUses('fixture_dropped_tool'));
    });

    it('drops an unlimited Token with `usesRemaining: null` (R-4)', () => {
        bench('drop_eternal');
        run(11000);

        const drop = tokenSprites()[0];
        expect(drop.refId).toBe('fixture_dropped_eternal');
        expect(drop.usesRemaining).toBeNull();
    });

    it('does not put the Token in the Vault or the Bank', () => {
        bench('drop_one_tool');
        run(11000);

        expect(TokenBank.contents()).toEqual([]);
        expect(InventoryManager.getItemCount('fixture_dropped_tool')).toBe(0);
    });

    it('collects off the floor as a real instance carrying those charges', () => {
        bench('drop_one_tool');
        run(11000);

        const instance = SpriteLayer.takeTokenSprite(tokenSprites()[0].id);
        expect(instance.typeId).toBe('fixture_dropped_tool');
        expect(instance.usesRemaining).toBe(12);
    });
});

describe('It obeys the drop mechanics item outputs already use', () => {
    it('honours a quantity range — one sprite per copy', () => {
        // Token sprites never merge (`addSprite` only stacks `kind: 'item'`),
        // and both collection paths build ONE instance from a sprite whatever
        // its quantity, so three copies have to be three sprites.
        bench('drop_three_tools');
        run(11000);

        const drops = tokenSprites();
        expect(drops).toHaveLength(3);
        expect(drops.every(s => s.quantity === 1)).toBe(true);
        expect(drops.every(s => s.usesRemaining === 12)).toBe(true);
    });

    it('honours `chance` — a 0% output drops nothing', () => {
        bench('drop_never');
        run(11000);

        expect(tokenSprites()).toHaveLength(0);
    });

    it('flies from the station tile, like an item output from the same cycle', () => {
        bench('drop_tool_and_item');
        run(11000);

        const expectedX = colOf(STATION) * TILE_STEP_PX + TILE_PX / 2;
        const expectedY = rowOf(STATION) * TILE_STEP_PX + TILE_PX / 2;

        const token = tokenSprites()[0];
        expect(token.fromX).toBeCloseTo(expectedX);
        expect(token.fromY).toBeCloseTo(expectedY);

        const item = SpriteLayer.getSprites().find(s => s.kind === 'item');
        expect(item.fromX).toBeCloseTo(token.fromX);
        expect(item.fromY).toBeCloseTo(token.fromY);
    });

    it('keeps making them — the floor has no capacity to run out of (D-138)', () => {
        // Item sprites and Map bursts both call `addSprite` unconditionally;
        // there is no board-full refusal to match. Litter piling up IS the
        // overflow behaviour.
        bench('drop_one_tool');
        for (let i = 0; i < 30; i++) SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, 5);

        run(110000);   // eleven cycles

        expect(tokenSprites().length).toBeGreaterThanOrEqual(10);
    });
});
