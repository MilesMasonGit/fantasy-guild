import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, bucketsFor, describeModifierDirection } from '../config/registries/modifierPalette.js';
import { RESPAWN_MIN_MS } from '../config/registries/tokenConstants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Grow Time (brief 230 S1a): a support in reach speeds how long a Token takes to grow (a Sapling
 * into a Tree) and to refill after a rest (a vein), stacking down to the standard floor. Read once
 * per Token and kept until its neighbourhood, the Region's rules or the content change, never per
 * tick: a day's catch-up asks it 86,400 times per growing Token.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const grow = (value, to, extra = {}) => ({
    id: `stm_${Math.random().toString(36).slice(2)}`, keyword: 'provides', to,
    payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value, ...extra }
});
const support = (id, statement) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    statements: [statement]
});

registerTokenTypes({
    gt_sapling: {
        id: 'gt_sapling', name: 'GT Sapling', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', tags: ['Oak'], grows: { into: 'gt_tree', afterMs: 30000 }
    },
    gt_tree: {
        id: 'gt_tree', name: 'GT Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 5, sprite: 's_nature', tags: ['Oak'],
        config: {
            skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    },
    gt_vein: {
        id: 'gt_vein', name: 'GT Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 3, sprite: 's_industry', tags: ['Copper'],
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
        },
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    gt_quick_vein: {
        id: 'gt_quick_vein', name: 'GT Quick Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 3, sprite: 's_industry', tags: ['Copper'],
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
        },
        respawn: { mode: 'refill', afterMs: 1000 }
    },
    gt_forest: support('gt_forest', grow(-0.5, { mode: 'tag', value: 'Oak' })),
    gt_grove: support('gt_grove', grow(-0.2, { mode: 'tag', value: 'Oak' })),
    gt_forestry_only: support('gt_forestry_only', grow(-0.5, { mode: 'all' }, { category: 'forestry' })),
    gt_mining_only: support('gt_mining_only', grow(-0.5, { mode: 'all' }, { category: 'mining' })),
    gt_cart: support('gt_cart', grow(-0.5, { mode: 'tag', value: 'Copper' })),
    gt_work_buff: support('gt_work_buff', {
        id: 'stm_gt_work_buff', keyword: 'provides', to: { mode: 'tag', value: 'Oak' },
        payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.5 }
    })
});

const AT = { x: 800, y: 600 };
const ring = (n, r = 150) => Array.from({ length: n }, (_, i) => ({
    x: Math.round(AT.x + r * Math.cos((2 * Math.PI * i) / n)),
    y: Math.round(AT.y + r * Math.sin((2 * Math.PI * i) / n))
}));

/** A Token at the middle with `count` copies of a support round it, buffs built. */
function scene(typeId, supportType = null, count = 0, uses = undefined) {
    const t = placeAt(typeId, AT.x, AT.y);
    if (uses !== undefined) t.usesRemaining = uses;
    if (supportType) for (const p of ring(count)) placeAt(supportType, p.x, p.y);
    TileModifiers.rebuildAll();
    return t;
}

const typeAtMiddle = () => BoardState.tokensAtPoint(AT.x, AT.y)[0]?.typeId ?? null;
const tick = (ms) => { for (let t = 0; t < ms; t += 100) TimedChanges.tick(100); };

/** When, in 100 ms steps, the Token at the middle stops being `typeId`. */
function grewAfter(typeId, max = 60000) {
    for (let t = 0; t <= max; t += 100) {
        if (typeAtMiddle() !== typeId) return t;
        TimedChanges.tick(100);
    }
    return null;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    clearMat();
});

afterEach(() => {
    clearMat();
    getGlobalAggregator().clearAll();
    vi.restoreAllMocks();
});

describe('the Grow Time axis, as authored', () => {
    it('is offered: a percentage, a reduction is the buff, narrowable to a skill', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.GROW_TIME);
        expect(entry).toMatchObject({ label: 'Grow Time', inverted: true, categories: 'skill', when: 'never' });
        expect(bucketsFor(entry)).toEqual(['percentage']);
        expect(describeModifierDirection(entry, -0.2).isBuff).toBe(true);
        expect(describeModifierDirection(entry, 0.2).isBuff).toBe(false);
    });

    it('reads as a plain sentence', () => {
        const names = { token: (id) => id, item: (id) => id, skill: (id) => id };
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, to: { mode: 'tag', value: 'Oak' },
            payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.2 } }, names))
            .toBe('Makes nearby Oak Tokens grow and refill 20% faster.');
    });
});

describe('a Sapling near a Forest', () => {
    it('grows in its authored time with nothing near', () => {
        scene('gt_sapling');
        expect(grewAfter('gt_sapling')).toBe(30000);
    });

    it('⭐ a −50 % Forest in reach halves it, and the bubble says so', () => {
        const sapling = scene('gt_sapling', 'gt_forest', 1);
        expect(TimedChanges.nextGrowth(sapling)).toMatchObject({ inMs: 15000, totalMs: 15000, into: 'gt_tree' });
        expect(grewAfter('gt_sapling')).toBe(15000);
        expect(typeAtMiddle()).toBe('gt_tree');
    });

    it('two −20 % groves stack: 30 s becomes 18 s', () => {
        scene('gt_sapling', 'gt_grove', 2);
        expect(grewAfter('gt_sapling')).toBe(18000);
    });

    it('⭐ five −20 % groves stack to the floor: 6 s, not nothing', () => {
        const sapling = scene('gt_sapling', 'gt_grove', 5);
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(6000);
        expect(grewAfter('gt_sapling')).toBe(6000);
    });

    it('a Forest out of reach does nothing', () => {
        placeAt('gt_sapling', AT.x, AT.y);
        placeAt('gt_forest', AT.x + 400, AT.y);
        TileModifiers.rebuildAll();
        expect(grewAfter('gt_sapling')).toBe(30000);
    });

    it('a Work Time support does not touch growth', () => {
        scene('gt_sapling', 'gt_work_buff', 1);
        expect(grewAfter('gt_sapling')).toBe(30000);
    });

    it('narrows to the skill of what it grows into: a Forestry rule reaches it, a Mining one does not', () => {
        scene('gt_sapling', 'gt_forestry_only', 1);
        expect(grewAfter('gt_sapling')).toBe(15000);

        clearMat();
        TileModifiers.clearAll();
        scene('gt_sapling', 'gt_mining_only', 1);
        expect(grewAfter('gt_sapling')).toBe(30000);
    });

    it('a Region rule (the guild-wide scope) speeds it too, and its going is seen', () => {
        const sapling = scene('gt_sapling');
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(30000);
        getGlobalAggregator().addModifier({ source: 'region:test', type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 });
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(15000);
        getGlobalAggregator().removeModifiersBySource('region:test');
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(30000);
    });
});

describe('a resting vein near a support', () => {
    it('refills in its authored rest with nothing near', () => {
        const vein = scene('gt_vein', null, 0, 0);
        expect(Respawn.nextRespawn(vein)).toMatchObject({ mode: 'refill', inMs: 12000, totalMs: 12000 });
        tick(11900);
        expect(vein.usesRemaining).toBe(0);
        tick(100);
        expect(vein.usesRemaining).toBe(3);
    });

    it('⭐ a −50 % support in reach halves the rest, and the countdown says so', () => {
        const vein = scene('gt_vein', 'gt_cart', 1, 0);
        expect(Respawn.nextRespawn(vein)).toMatchObject({ inMs: 6000, totalMs: 6000 });
        expect(Respawn.respawnState(vein).afterMs).toBe(6000);
        tick(5900);
        expect(vein.usesRemaining).toBe(0);
        tick(100);
        expect(vein.usesRemaining).toBe(3);
    });

    it('stacks to the floor: five give 2.4 s, a fifth of 12 s', () => {
        const vein = scene('gt_vein', 'gt_cart', 5, 0);
        expect(Respawn.restMsOf(vein)).toBe(2400);
    });

    it('never rests under the engine’s shortest rest', () => {
        const vein = scene('gt_quick_vein', 'gt_cart', 5, 0);
        expect(Respawn.restMsOf(vein)).toBe(RESPAWN_MIN_MS);
    });
});

describe('⚠️ read once per Token, not per tick (GDD §14, catch-up)', () => {
    it('a thousand ticks of a sped Sapling read its neighbours once', () => {
        // The Sapling grows in 15 s; 10 s of 10 ms ticks asks its time 1000 times.
        scene('gt_sapling', 'gt_forest', 1);
        const reads = vi.spyOn(ModifierAggregator.prototype, 'collectPercentages');
        for (let i = 0; i < 1000; i++) TimedChanges.tick(10);
        expect(typeAtMiddle()).toBe('gt_sapling');
        // Once from the Sapling's own aggregator, once from the guild-wide one.
        expect(reads.mock.calls.length).toBe(2);
    });

    it('a support arriving later is read at once, and one leaving too', () => {
        const sapling = scene('gt_sapling');
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(30000);

        const forest = placeAt('gt_forest', AT.x + 150, AT.y);
        TileModifiers.rebuildAround([{ x: forest.x, y: forest.y }]);
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(15000);

        BoardState.removeToken(forest.id);
        TileModifiers.rebuildAround([{ x: forest.x, y: forest.y }]);
        expect(TimedChanges.nextGrowth(sapling).totalMs).toBe(30000);
    });

    it('a clock part-way through keeps its time when a Forest arrives: only the finish moves', () => {
        const sapling = scene('gt_sapling');
        tick(20000);
        expect(sapling.clocks.growMs).toBe(20000);
        const forest = placeAt('gt_forest', AT.x + 150, AT.y);
        TileModifiers.rebuildAround([{ x: forest.x, y: forest.y }]);
        // 20 s already counted against a 15 s growth: it grows on the next tick.
        expect(TimedChanges.nextGrowth(sapling).inMs).toBe(0);
        tick(100);
        expect(typeAtMiddle()).toBe('gt_tree');
    });

    it('a Token off the mat gets its authored time', () => {
        expect(TileModifiers.growTimeOf({ id: 'nowhere', typeId: 'gt_sapling' }, 30000)).toBe(30000);
        expect(TileModifiers.growTimeOf(null, 30000)).toBe(30000);
    });
});
