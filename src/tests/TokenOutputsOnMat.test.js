import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * ⭐ TL-8 (owner, 2026-09-26, Token Lifecycle slice 9.3): **a Token a recipe
 * makes lands straight on the mat beside the station that made it**, like a
 * Shop purchase. It is `placed`, carries its starting charges, counts toward
 * the mat cap, and if there is no room the cycle waits. No Token loot, no
 * Vault.
 *
 * Replaces `TokenOutputDrops.test.js`, which pinned the retired behaviour
 * (the Token dropped on the floor as a loot sprite bound for the Vault).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names the one spot on the mat the bench stands on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

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
    /** Filler for crowding the station (Token Lifecycle 5.3). */
    fixture_drop_crowd: {
        id: 'fixture_drop_crowd', name: 'Fixture Crowd', tokenType: 'support',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_mining',
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
        },
        {
            // Like the Copper Pickaxe: ingredients in, one Token out.
            id: 'tool_for_wood', levelRequirement: 1, requiresContext: [],
            inputs: [{ itemId: 'fixture_oak_wood', quantity: 2 }],
            outputs: [{ tokenId: 'fixture_dropped_tool', minQty: 1, maxQty: 1, chance: 100 }],
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
    Placement.placeTokenAt(instance, C(STATION));
    instance.selectedRecipeId = recipeId;
    Placement.plantFlagAt('hero_1', C(STATION));
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** Every crafted Token standing on the mat. */
const made = (typeId = null) => BoardState.tokens().filter(t =>
    t.typeId === (typeId || t.typeId) && t.typeId.startsWith('fixture_dropped_'));

const tokenSprites = () => SpriteLayer.getSprites().filter(s => s.kind === 'token');

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => resetMatTuning());

describe('⭐ A Token a recipe makes stands on the mat beside its station (TL-8)', () => {
    it('places it as a `placed` Token, and makes no loot sprite', () => {
        bench('drop_one_tool');
        run(11000);

        const tools = made('fixture_dropped_tool');
        expect(tools).toHaveLength(1);
        expect(BoardState.originOf(tools[0])).toBe(BoardState.ORIGIN.PLACED);
        expect(tokenSprites()).toHaveLength(0);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('lands it beside the station, not on top of it and not across the mat', () => {
        const station = bench('drop_one_tool');
        run(11000);

        const [tool] = made('fixture_dropped_tool');
        const d = Math.hypot(tool.x - station.x, tool.y - station.y);
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(200);
    });

    it('gives it its starting charges', () => {
        bench('drop_one_tool');
        run(11000);

        expect(made('fixture_dropped_tool')[0].usesRemaining).toBe(tokenStartingUses('fixture_dropped_tool'));
    });

    it('gives an unlimited Token `usesRemaining: null` (R-4)', () => {
        bench('drop_eternal');
        run(11000);

        expect(made('fixture_dropped_eternal')[0].usesRemaining).toBeNull();
    });

    it('does not put it in the Bank', () => {
        bench('drop_one_tool');
        run(11000);

        expect(InventoryManager.getItemCount('fixture_dropped_tool')).toBe(0);
    });

    it('counts toward the mat cap', () => {
        bench('drop_one_tool');
        const before = MatCap.placedCount();
        run(11000);

        expect(MatCap.placedCount()).toBe(before + 1);
    });

    it('makes one Token per copy of a quantity range', () => {
        bench('drop_three_tools');
        run(11000);

        expect(made('fixture_dropped_tool')).toHaveLength(3);
    });

    it('honours `chance` — a 0% output makes nothing', () => {
        bench('drop_never');
        run(11000);

        expect(made()).toHaveLength(0);
    });

    it('leaves item outputs of the same cycle dropping as loot, as before (TL-9)', () => {
        bench('drop_tool_and_item');
        run(11000);

        expect(made('fixture_dropped_tool')).toHaveLength(1);
        const items = SpriteLayer.getSprites().filter(s => s.kind === 'item');
        expect(items).toHaveLength(1);
        expect(items[0].refId).toBe('fixture_oak_wood');
    });
});

describe('⭐ With no room, the cycle waits and nothing is lost (TL-8)', () => {
    it('holds a finished cycle when the mat is at its cap: no Token, no sprite, nothing spent', () => {
        InventoryManager.addItem('fixture_oak_wood', 10);
        const station = bench('tool_for_wood');
        setMatTuning('matCap', MatCap.placedCount());   // the bench fills the mat

        run(15000);

        expect(made()).toHaveLength(0);
        expect(tokenSprites()).toHaveLength(0);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(10);
        expect(station.alert).toBe(ALERT.NO_ROOM);
        expect(station.cycleElapsedMs).toBeGreaterThanOrEqual(10000);
    });

    it('completes and pays as soon as there is room again', () => {
        InventoryManager.addItem('fixture_oak_wood', 10);
        const station = bench('tool_for_wood');
        setMatTuning('matCap', MatCap.placedCount());
        run(15000);

        setMatTuning('matCap', 40);
        run(200);

        expect(made('fixture_dropped_tool')).toHaveLength(1);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(8);
        expect(station.alert).not.toBe(ALERT.NO_ROOM);
    });

    it('reserves room for every copy a cycle could make, not just one', () => {
        bench('drop_three_tools');
        setMatTuning('matCap', MatCap.placedCount() + 2);   // room for two of three

        run(15000);

        expect(made()).toHaveLength(0);
    });
});

describe('A crowded station still places what it makes (Token Lifecycle 5.3)', () => {
    it('lands the Token on the nearest free spot anywhere on the mat, pushing nothing', () => {
        const station = BoardState.createTokenInstance('fixture_drop_bench', 900);
        BoardState.addToken(station, 900, 560);
        const crowd = [];
        for (let dx = -400; dx <= 400; dx += 50) {
            for (let dy = -400; dy <= 400; dy += 50) {
                if ((dx === 0 && dy === 0) || Math.hypot(dx, dy) > 400) continue;
                const t = BoardState.createTokenInstance('fixture_drop_crowd', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, 900 + dx, 560 + dy);
                crowd.push({ id: t.id, x: t.x, y: t.y });
            }
        }

        expect(Placement.hasRoomForProduct(station.id, 'fixture_dropped_tool')).toBe(true);
        const res = Placement.placeProduct(station.id, 'fixture_dropped_tool');
        expect(res.success).toBe(true);

        const [tool] = made('fixture_dropped_tool');
        expect(Math.hypot(tool.x - 900, tool.y - 560)).toBeGreaterThan(400);
        expect({ x: station.x, y: station.y }).toEqual({ x: 900, y: 560 });
        for (const c of crowd) {
            const t = BoardState.getTokenById(c.id);
            expect({ x: t.x, y: t.y }).toEqual({ x: c.x, y: c.y });
        }
    });
});

describe('Token loot is gone from the sprite layer', () => {
    it('refuses to make a Token sprite at all', () => {
        expect(SpriteLayer.addSprite('token', 'fixture_dropped_tool', 1, null)).toBeNull();
        expect(tokenSprites()).toHaveLength(0);
    });

    it('has no Token pickup or Vault routes left', () => {
        expect(SpriteLayer.takeTokenSprite).toBeUndefined();
        expect(SpriteLayer.sendTokenToVault).toBeUndefined();
        expect(Placement.returnTokenToVaultById).toBeUndefined();
    });
});
