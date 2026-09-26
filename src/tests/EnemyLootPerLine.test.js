import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';

/**
 * Enemy drops roll per line (Token Lifecycle slice 7.8, owner decision TL-10).
 *
 * A defeated enemy's loot used to be ONE weighted pick over its drop list, so a
 * Goblin (Bones 100%, Copper Ore 30%) dropped Bones OR Ore, never both. Each
 * line now rolls on its own `chance`, exactly like a station's outputs.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerTokenTypes({
    fixture_enemy_two_lines: {
        id: 'fixture_enemy_two_lines', name: 'Two-Line Enemy', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 20, sprite: 'skill_occult',
        enemy: { level: 2, style: 'melee' },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0,
            inputs: [],
            outputs: [
                { itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'fixture_oak_wood', chance: 100, minQty: 2, maxQty: 2 }
            ]
        }
    }
});

/** A seeded random (LCG), so a run of many kills is repeatable. */
function seeded(seed = 7) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => vi.restoreAllMocks());

describe('Every drop line rolls on its own (TL-10)', () => {
    it('an enemy with two 100% lines drops BOTH on every kill, on the board', () => {
        const kills = [];
        const unsub = EventBus.subscribe('loot_generated', p => kills.push(p));

        const at = { x: 400, y: 300 };
        const enemy = BoardState.createTokenInstance(
            'fixture_enemy_two_lines', tokenStartingUses('fixture_enemy_two_lines'));
        Placement.placeTokenAt(enemy, at);
        TileModifiers.rebuildAround([enemy]);
        Placement.plantFlagAt('hero_1', at);
        for (let t = 0; t < 120000; t += 100) BoardRunner.tick(100);
        unsub();

        expect(kills.length).toBeGreaterThan(1);
        for (const k of kills) {
            expect(k.drops.map(d => [d.itemId, d.quantity])).toEqual([
                ['item_blackberry', 1],
                ['fixture_oak_wood', 2]
            ]);
        }
        // Still sprites, still not banked until collected (D-40, D-138).
        const ids = SpriteLayer.getSprites().map(s => s.refId);
        expect(ids).toEqual(expect.arrayContaining(['item_blackberry', 'fixture_oak_wood']));
        expect(InventoryManager.getItemCount('item_blackberry')).toBe(0);
    });

    it('a 30% line lands about 30% of the time, independently of a 100% line', () => {
        vi.spyOn(Math, 'random').mockImplementation(seeded(11));
        const drops = [
            { itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'fixture_oak_wood', chance: 30, minQty: 1, maxQty: 1 }
        ];

        const N = 2000;
        let always = 0, sometimes = 0;
        for (let i = 0; i < N; i++) {
            const got = LootSystem.rollEachLine(drops, 'area').map(d => d.itemId);
            if (got.includes('item_blackberry')) always++;
            if (got.includes('fixture_oak_wood')) sometimes++;
        }

        expect(always).toBe(N);
        expect(sometimes / N).toBeGreaterThan(0.26);
        expect(sometimes / N).toBeLessThan(0.34);
    });

    it('quantities are rolled over the authored min–max', () => {
        vi.spyOn(Math, 'random').mockImplementation(seeded(3));
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
            const [d] = LootSystem.rollEachLine(
                [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 3 }], 'area');
            seen.add(d.quantity);
        }
        expect([...seen].sort()).toEqual([1, 2, 3]);
    });

    it('a kill off the board banks every line that landed', () => {
        LootSystem.handleCombatVictory({
            enemyId: 'fixture_enemy_two_lines', instanceId: null, areaId: 'area',
            drops: [
                { itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'fixture_oak_wood', chance: 100, minQty: 2, maxQty: 2 }
            ]
        });
        expect(InventoryManager.getItemCount('item_blackberry')).toBe(1);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(2);
    });
});
