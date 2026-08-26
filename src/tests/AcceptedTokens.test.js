import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms, step = 500) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
        BoardRunner.tick(step);
    }
}

describe('Accepted Tokens & Tool Tiers System', () => {
    const TILE_NODE = 12;
    const TILE_TOOL = 13; // Adjacent tile

    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
        GameState.state.heroes = [makeHero('miner', 50)];
        GameState.state.inventory.maxSlots = 50;
    });

    it('a node requiring a tool produces NOTHING when no tool is adjacent', () => {
        place(TILE_NODE, 'fixture_copper_vein', 'miner');

        run(15000);

        // No tool placed — should not produce any output
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
    });

    it('a Tier 1 node runs and completes cycles when a Tier 1 tool is placed adjacent', () => {
        place(TILE_NODE, 'fixture_copper_vein', 'miner');
        place(TILE_TOOL, 'fixture_pickaxe_t1');

        run(15000); // 10s cycle + 5s

        // Produced output
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);

        // Tool spent 1 charge (10 -> 9)
        const tool = BoardState.getToken(TILE_TOOL);
        expect(tool.usesRemaining).toBe(9);
    });

    it('a Tier 2 node refuses to run with a Tier 1 tool, but runs with a Tier 2 tool', () => {
        place(TILE_NODE, 'fixture_iron_vein', 'miner');
        place(TILE_TOOL, 'fixture_pickaxe_t1'); // Tier 1 pickaxe on Tier 2 vein

        run(15000);

        // Under-tiered tool — nothing produced, tool charges untouched
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
        expect(BoardState.getToken(TILE_TOOL).usesRemaining).toBe(10);

        // Replace with Tier 2 Pickaxe
        BoardState.setToken(TILE_TOOL, null);
        place(TILE_TOOL, 'fixture_pickaxe_t2');

        run(15000);

        // Now it runs!
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
        expect(BoardState.getToken(TILE_TOOL).usesRemaining).toBe(9);
    });

    it('a higher tier tool can satisfy lower tier requirements', () => {
        place(TILE_NODE, 'fixture_copper_vein', 'miner'); // Tier 1 node
        place(TILE_TOOL, 'fixture_pickaxe_t2'); // Tier 2 tool

        run(15000);

        // Tier 2 pickaxe works on Tier 1 copper vein
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
        expect(BoardState.getToken(TILE_TOOL).usesRemaining).toBe(9);
    });
});
