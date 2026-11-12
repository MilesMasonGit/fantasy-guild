// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Orders from '../systems/board/Orders.js';
import * as Flags from '../systems/board/Flags.js';
import { carriedPreservation, EFFECT_KEY, UNIT } from '../systems/board/EffectBreakdown.js';
import { chanceOf } from '../systems/board/CycleSavings.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DockEquipmentGrid } from '../ui/components/dock/DockEquipmentGrid.jsx';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Brief 600 B4: a carried item in a hero's slot wears a small Preservation badge, read as
 * `CycleSavings.keepsCarried` asks it, with the card's hover of sources.
 */

const item = (id, name, extra = {}) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1, ...extra
});
const ARROW = 'cp_arrow';
const BREAD = 'cp_bread';
const QUIVER = 'cp_quiver';
const ORE = 'cp_ore';
const VEIN = 'cp_vein';
const HERO = 'hero_cp';

registerEffects({
    cp_care: {
        id: 'cp_care', name: 'Quiver Care',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 15, category: 'ammo' } }]
    }
});
registerItems({
    [ARROW]: item(ARROW, 'Test Arrow', { type: 'consumable', equipSlot: 'consumable', arrow: { damage: 2 } }),
    [BREAD]: item(BREAD, 'Test Bread', { type: 'food', equipSlot: 'food', restoreAmount: 5 }),
    [QUIVER]: item(QUIVER, 'Test Quiver', { type: 'tool', equipSlot: 'trinket', effects: [{ effectId: 'cp_care', scale: 1 }] }),
    [ORE]: item(ORE, 'Test Ore')
});
registerTokenTypes({
    [VEIN]: {
        id: VEIN, name: 'Carry Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

const star = (value, category) => getGlobalAggregator().addModifier({
    source: 'guild:cp_test', type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value, target: { category }
});

function hire(equipment) {
    const slots = [...equipment];
    while (slots.length < 9) slots.push(null);
    GameState.state.heroes = [{
        id: HERO, name: 'Mira', spriteId: 'hn_recruit_por', status: 'idle', equipment: slots,
        hp: { current: 100, max: 100 }, skills: { mining: { level: 5, xp: 0 } }
    }];
    for (const id of equipment) if (id) InventoryManager.addItem(id, 5);
}

const h = React.createElement;
const mount = () => render(h(DeckDndProvider, null, h(DockEquipmentGrid, { heroId: HERO })));
const slotBadges = (root) => [...root.querySelectorAll('[data-slot-badge] [data-effect-badge]')];
const hover = (el) => fireEvent.pointerEnter(el, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 });

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    clearMat();
});

afterEach(() => {
    cleanup();
    getGlobalAggregator().clearAll();
    clearMat();
    vi.restoreAllMocks();
});

describe('a carried item Preservation badge', () => {
    it('reads as the engine asks: the item then its kind, guild stars alone for a hero working nothing', () => {
        hire([ARROW, BREAD]);
        star(10, 'ammo');
        star(4, 'food');
        const arrow = carriedPreservation(HERO, ARROW);
        expect(arrow).toMatchObject({ key: EFFECT_KEY.PRESERVATION, unit: UNIT.CHANCE, total: 10, itemId: ARROW });
        expect(arrow.final).toBe(chanceOf(null, EFFECT_TYPES.PRESERVATION, [ARROW, 'ammo']));
        expect(carriedPreservation(HERO, BREAD).total).toBe(4);
        expect(carriedPreservation(HERO, BREAD).final).toBe(chanceOf(null, EFFECT_TYPES.PRESERVATION, [BREAD, 'food']));
    });

    it('is absent at zero, for gear, and for a hero or item that is not there', () => {
        hire([ARROW, QUIVER]);
        star(10, 'food');
        expect(carriedPreservation(HERO, ARROW)).toBeNull();
        expect(carriedPreservation(HERO, QUIVER)).toBeNull();
        expect(carriedPreservation('nobody', ARROW)).toBeNull();
        expect(carriedPreservation(HERO, 'no_such_item')).toBeNull();
    });

    it('while the hero works a Token, their gear counts too and the total equals the engine chance there', () => {
        hire([ARROW, QUIVER]);
        star(10, 'ammo');
        const vein = placeAt(VEIN, 800, 500);
        TileModifiers.rebuildAround([{ x: 800, y: 500 }]);
        expect(Orders.orderAt(HERO, { x: 800, y: 500 }).success).toBe(true);
        const badge = carriedPreservation(HERO, ARROW);
        expect(badge.total).toBe(25);
        expect(badge.final).toBe(chanceOf(vein.id, EFFECT_TYPES.PRESERVATION, [ARROW, 'ammo']));
        expect(badge.sources.map(s => s.amount).sort((a, b) => a - b)).toEqual([10, 15]);
        expect(badge.sources.some(s => s.name.includes('Test Quiver'))).toBe(true);
    });

    it('reading draws nothing', () => {
        hire([ARROW]);
        star(10, 'ammo');
        const random = vi.spyOn(Math, 'random');
        carriedPreservation(HERO, ARROW);
        expect(random).not.toHaveBeenCalled();
    });
});

describe('the badge in the Hero drawer slots', () => {
    it('a carried item above zero wears a small badge; a slot at zero, and gear, wear none', () => {
        hire([ARROW, BREAD, QUIVER]);
        star(10, 'ammo');
        const { container } = mount();
        const badges = slotBadges(container);
        expect(badges).toHaveLength(1);
        expect(badges[0].getAttribute('data-effect-badge-item')).toBe(ARROW);
        expect(badges[0].textContent).toBe('10%');
        expect(container.querySelector('[data-equip-slot="0"] [data-slot-badge]')).not.toBeNull();
        expect(container.querySelector('[data-equip-slot="1"] [data-slot-badge]')).toBeNull();
    });

    it('the hover gives the sources and the total, as the card chips do', () => {
        hire([ARROW]);
        star(10, 'ammo');
        const { container } = mount();
        hover(slotBadges(container)[0]);
        const tip = document.querySelector('[data-badge-tip="preservation"]');
        expect(tip).not.toBeNull();
        expect([...tip.querySelectorAll('[data-badge-tip-source]')]).toHaveLength(1);
        expect(tip.querySelector('[data-badge-tip-total]').textContent).toBe('Total10%');
    });

    it('follows the board: a rule arriving puts the badge on, within a second', () => {
        vi.useFakeTimers();
        try {
            hire([ARROW]);
            const { container } = mount();
            expect(slotBadges(container)).toHaveLength(0);
            star(20, 'ammo');
            act(() => { vi.advanceTimersByTime(1100); });
            expect(slotBadges(container).map(b => b.textContent)).toEqual(['20%']);
        } finally {
            vi.useRealTimers();
        }
    });
});
