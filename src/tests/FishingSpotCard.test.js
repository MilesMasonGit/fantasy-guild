// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { catchPoolsOf, poolsAt } from '../config/registries/catchPools.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { spotFishIds, spotFishRows, luresIn } from '../ui/components/board/spotFish.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * What a fishing spot shows the player: its card lists every fish it can give where it stands, each
 * with its sprite, the tool kind that catches it, its Fishing level (greyed while no hero has it)
 * and the lure that picks it; resting the pointer on it shows those fish in the speech bubble.
 */

registerItems({
    spot_trout: { id: 'spot_trout', name: 'Spot Trout', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', fish: { level: 5 } },
    spot_salmon: { id: 'spot_salmon', name: 'Spot Salmon', type: 'material', stackable: true, equipSlot: '', sprite: 'i_salmon_raw', fish: { level: 40 } },
    spot_shark: { id: 'spot_shark', name: 'Spot Shark', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', fish: { level: 60 } },
    spot_shrimp: { id: 'spot_shrimp', name: 'Spot Shrimp', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' },
    spot_bait: { id: 'spot_bait', name: 'Spot Bait', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    spot_fly: { id: 'spot_fly', name: 'Salmon Fly', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', lure: { fish: ['spot_salmon'], breakChance: 10 } },
    spot_shark_lure: { id: 'spot_shark_lure', name: 'Shark Lure', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', lure: { fish: ['spot_shark'] } }
});

registerTokenTypes({
    spot_river: {
        id: 'spot_river', name: 'Spot River', tokenType: 'resource', rarity: 'common', uses: null, sprite: 's_nature',
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        catchPools: [
            { tool: 'fishing_rod', bait: 'spot_bait', catches: [{ itemId: 'spot_trout', weight: 3 }, { itemId: 'spot_salmon', weight: 1 }] },
            { tool: 'harpoon', bait: 'spot_bait', catches: [{ itemId: 'spot_shark', weight: 1 }, { itemId: 'spot_salmon', weight: 1 }] },
            { tool: 'fishing_trap', catches: [{ itemId: 'spot_shrimp', weight: 1 }] },
            // Names no Bait and is no Trap: it never bites, so it gives nothing.
            { tool: 'fishing_net', catches: [{ itemId: 'spot_trout', weight: 1 }] }
        ]
    },
    spot_placed: {
        id: 'spot_placed', name: 'Spot Placed', tokenType: 'resource', rarity: 'common', uses: null, sprite: 's_nature',
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        catchPools: [
            { tool: 'fishing_rod', bait: 'spot_bait', water: ['river'], catches: [{ itemId: 'spot_trout', weight: 1 }] },
            { tool: 'fishing_rod', bait: 'spot_bait', water: ['sea'], catches: [{ itemId: 'spot_shark', weight: 1 }] }
        ]
    }
});

const h = React.createElement;
const mount = (el) => render(h(DndContext, null, el));

function put(typeId, x = 400, y = 300) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, { x, y });
    return instance;
}

const hero = (id, fishing) => ({ id, name: id, status: 'idle', level: 1, skills: { fishing: { level: fishing, xp: 0 } }, hp: { current: 10, max: 10 }, equipment: Array(9).fill(null) });
const fishBlock = (typeId, instanceId) => tokenCardModel(typeId, instanceId).blocks.find(b => b.id === CARD_BLOCK.RECIPE)?.fish;

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => cleanup());
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
});

describe('the fish a spot can give (pure)', () => {
    const pools = () => catchPoolsOf(getTokenType('spot_river'));
    const levels = { spot_trout: 5, spot_salmon: 40, spot_shark: 60, spot_shrimp: 1 };

    it('every fish once, in pool order; a pool that never bites gives none', () => {
        expect(spotFishIds(pools())).toEqual(['spot_trout', 'spot_salmon', 'spot_shark', 'spot_shrimp']);
        expect(spotFishIds([])).toEqual([]);
    });

    it('a row per fish: the tool kinds that catch it, its level, in reach at the best hero level', () => {
        const rows = spotFishRows(pools(), { levelOf: (id) => levels[id], best: 40 });
        expect(rows.map(r => [r.itemId, r.tools, r.level, r.reachable])).toEqual([
            ['spot_trout', ['fishing_rod'], 5, true],
            ['spot_salmon', ['fishing_rod', 'harpoon'], 40, true],
            ['spot_shark', ['harpoon'], 60, false],
            ['spot_shrimp', ['fishing_trap'], 1, true]
        ]);
        expect(spotFishRows(pools(), { levelOf: (id) => levels[id], best: 0 }).every(r => !r.reachable)).toBe(true);
    });

    it('the lure that picks a fish, only where a rod catches it: a harpoon takes no lure', () => {
        const lures = luresIn(getAllItems());
        expect(lures).toEqual(expect.arrayContaining([
            { itemId: 'spot_fly', fish: ['spot_salmon'] },
            { itemId: 'spot_shark_lure', fish: ['spot_shark'] }
        ]));
        const rows = spotFishRows(pools(), { levelOf: (id) => levels[id], best: 99, lures });
        const lureOf = Object.fromEntries(rows.map(r => [r.itemId, r.lures]));
        expect(lureOf.spot_salmon).toEqual(['spot_fly']);
        // The Shark is caught here only by a harpoon, so its lure never picks it here.
        expect(lureOf.spot_shark).toEqual([]);
        expect(lureOf.spot_trout).toEqual([]);
    });

    it('a spot lists only the pools that hold where it stands', () => {
        const def = getTokenType('spot_placed');
        expect(spotFishIds(poolsAt(def, { water: 'river', biomes: [] }))).toEqual(['spot_trout']);
        expect(spotFishIds(poolsAt(def, { water: 'sea', biomes: [] }))).toEqual(['spot_shark']);
    });
});

describe('the spot’s card: Fish here', () => {
    it('one row per fish with its sprite, tool kind and level; the lure that picks it', () => {
        GameState.state.heroes = [hero('ana', 12), hero('bo', 45)];
        const spot = put('spot_river');
        const block = fishBlock('spot_river', spot.id);
        expect(block.best).toBe(45);
        expect(block.rows.map(r => r.itemId)).toEqual(['spot_trout', 'spot_salmon', 'spot_shark', 'spot_shrimp']);

        const { container } = mount(h(TokenCard, { typeId: 'spot_river', instanceId: spot.id }));
        const section = container.querySelector('[data-card-block="fish"]');
        expect(section.textContent).toContain('Fish here');
        const row = (id) => section.querySelector(`[data-card-fish="${id}"]`);
        expect(row('spot_trout').querySelector('img')).not.toBeNull();
        expect(row('spot_trout').textContent).toContain('Spot Trout');
        expect(row('spot_trout').textContent).toContain('Fishing Rod');
        expect(row('spot_trout').textContent).toContain('5');
        expect(row('spot_salmon').textContent).toContain('Fishing Rod or Harpoon');
        expect(row('spot_salmon').textContent).toContain('Lure: Salmon Fly');
        expect(row('spot_salmon').dataset.cardFishLure).toBe('spot_fly');
        expect(row('spot_salmon').querySelector('[data-card-fish-lure-name]').textContent).toBe('Lure: Salmon Fly');
        expect(row('spot_salmon').querySelector('[data-item-bar]').getAttribute('title')).toContain('The Salmon Fly picks it');
        expect(row('spot_shark').textContent).not.toContain('Lure');
        expect(row('spot_shark').dataset.cardFishLure).toBeUndefined();
        expect(row('spot_shrimp').textContent).toContain('Trap');
        // The section sits before the catches by tool.
        const order = [...container.querySelectorAll('[data-card-block]')].map(el => el.dataset.cardBlock);
        expect(order.indexOf('fish')).toBeLessThan(order.indexOf('catch'));
    });

    it('a fish no hero has the level for is greyed, saying the level it asks and the best there is', () => {
        GameState.state.heroes = [hero('ana', 12), hero('bo', 45)];
        const spot = put('spot_river');
        const { container } = mount(h(TokenCard, { typeId: 'spot_river', instanceId: spot.id }));
        const row = (id) => container.querySelector(`[data-card-fish="${id}"]`);
        expect(row('spot_salmon').dataset.cardFishReach).toBe('in');
        expect(row('spot_salmon').className).not.toContain('opacity-50');
        expect(row('spot_shark').dataset.cardFishReach).toBe('out');
        expect(row('spot_shark').className).toContain('opacity-50');
        expect(row('spot_shark').textContent).toContain('60');
        expect(row('spot_shark').querySelector('[data-item-bar]').getAttribute('title')).toContain('No hero has Fishing 60 yet (best 45)');
    });

    it('a hero levelling into reach ungreys it; with no heroes everything above nothing is greyed', () => {
        const spot = put('spot_river');
        expect(fishBlock('spot_river', spot.id).rows.every(r => !r.reachable)).toBe(true);
        GameState.state.heroes = [hero('bo', 60)];
        expect(fishBlock('spot_river', spot.id).rows.every(r => r.reachable)).toBe(true);
    });

    it('a Token with no catch pools has no fish section', () => {
        const tree = put('fixture_producer');
        expect(tokenCardModel('fixture_producer', tree.id).blocks.find(b => b.id === CARD_BLOCK.RECIPE)?.fish ?? null).toBeNull();
    });
});

describe('the hover bubble: the fish it could give', () => {
    const bubbles = (props) => h(TokenBubbles, { boxPx: 128, artPx: 128, artUnit: 2, ...props });

    it('resting on a spot: its fish sprites in the speech bubble; never at rest or on the bare hover', () => {
        const spot = put('spot_river');
        const token = { typeId: 'spot_river', instanceId: spot.id, heroId: null, alert: null };
        const { container, rerender } = mount(bubbles({ instanceId: spot.id, token }));
        expect(container.querySelector('[data-fish-bubble]')).toBeNull();
        rerender(h(DndContext, null, bubbles({ instanceId: spot.id, token, pointerOn: true })));
        expect(container.querySelector('[data-fish-bubble]')).toBeNull();
        rerender(h(DndContext, null, bubbles({ instanceId: spot.id, token, pointerOn: true, isHovered: true })));
        const bubble = container.querySelector('[data-fish-bubble]');
        expect(bubble).not.toBeNull();
        expect([...bubble.querySelectorAll('[data-bubble-sprite]')].map(el => el.dataset.bubbleSprite))
            .toEqual(['spot_trout', 'spot_salmon', 'spot_shark', 'spot_shrimp']);
        // The station's recipe bubble: the hero speech bubble's frame and tail, taking no pointer.
        expect(bubble.querySelector('[data-speech-tone]')).not.toBeNull();
        expect(bubble.querySelector('[data-speech-tail]')).not.toBeNull();
        expect(bubble.className).toContain('pointer-events-none');
        expect(container.querySelector('[data-recipe-bubble]')).toBeNull();
    });

    it('none while marked for demolition, nor on a Token that is not water', () => {
        const spot = put('spot_river');
        const { container } = mount(bubbles({ instanceId: spot.id, token: { typeId: 'spot_river', instanceId: spot.id }, isHovered: true, marked: true }));
        expect(container.querySelector('[data-fish-bubble]')).toBeNull();
        cleanup();
        const other = put('fixture_producer', 600, 300);
        const again = mount(bubbles({ instanceId: other.id, token: { typeId: 'fixture_producer', instanceId: other.id }, isHovered: true }));
        expect(again.container.querySelector('[data-fish-bubble]')).toBeNull();
    });
});
