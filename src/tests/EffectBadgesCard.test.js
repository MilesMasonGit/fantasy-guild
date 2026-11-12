// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Orders from '../systems/board/Orders.js';
import * as Flags from '../systems/board/Flags.js';
import { effectBreakdown, EFFECT_KEY, UNIT, LIMIT } from '../systems/board/EffectBreakdown.js';
import { exactInputQuantity } from '../systems/board/InputCost.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { effectAmountText, badgeText, limitNote, badgeTip, EFFECT_GLYPH } from '../ui/components/board/effectBadgeText.js';
import { GLYPHS } from '../ui/components/base/PixelGlyph.jsx';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Brief 600 B3: the Token card's effect badges. A row under the stats line in the Effect names
 * order, each chip the breakdown's number and its hover the breakdown's sources; item chips on
 * their lines; the Rare finds group; "Boosted by" gone; the Needs row at the cost a cycle takes.
 */

const item = (id, name, extra = {}) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1, ...extra
});
const ORE = 'bc_ore';
const COAL = 'bc_coal';
const GEM = 'bc_gem';
const GLOVES = 'bc_gloves';

registerEffects({
    bc_quick_hands: {
        id: 'bc_quick_hands', name: 'Quick Hands',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }]
    }
});
registerItems({
    [ORE]: item(ORE, 'Badge Ore'),
    [COAL]: item(COAL, 'Badge Coal'),
    [GEM]: item(GEM, 'Badge Gem'),
    [GLOVES]: item(GLOVES, 'Gloves', { type: 'tool', effects: [{ effectId: 'bc_quick_hands', scale: 1 }] })
});

const VEIN = 'bc_vein';
const PLAIN = 'bc_plain';
const ALL = { mode: 'all' };
const toId = (value) => ({ mode: 'id', value });
const provides = (id, to, payload) => ({ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to, reach: 'nearby', payload });
const support = (id, name, statements) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_well_wishing', requiresHero: false, statements
});

registerTokenTypes({
    [VEIN]: {
        id: VEIN, name: 'Badge Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 10,
            inputs: [{ itemId: COAL, quantity: 10 }],
            outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }]
        },
        rareTable: { chance: 2, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] }
    },
    [PLAIN]: {
        id: PLAIN, name: 'Badge Plain', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 10, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    bc_cart: support('bc_cart', 'Badge Cart', [
        provides('bc_cart', toId(VEIN), { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.15 }),
        provides('bc_cart_xp', toId(VEIN), { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.1 })
    ]),
    bc_lamp: support('bc_lamp', 'Badge Lamp', [provides('bc_lamp', toId(VEIN), { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 })]),
    bc_rush: support('bc_rush', 'Badge Rush', [provides('bc_rush', toId(VEIN), { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.9 })]),
    bc_mine: support('bc_mine', 'Badge Mine', [
        provides('bc_mine_double', ALL, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 8, category: ORE }),
        provides('bc_mine_lean', toId(VEIN), { type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', value: -0.12 }),
        provides('bc_mine_luck', ALL, { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.25 })
    ])
});

const AT = { x: 800, y: 500 };
const NEAR = { x: 950, y: 500 };
const NEAR2 = { x: 800, y: 650 };
const NEAR3 = { x: 650, y: 500 };

function arrive(typeId, point = AT) {
    const t = placeAt(typeId, point.x, point.y);
    TileModifiers.rebuildAround([point]);
    return t;
}

const HERO = 'hero_bc';
function hire() {
    const slots = [GLOVES];
    while (slots.length < 9) slots.push(null);
    GameState.state.heroes = [{
        id: HERO, name: 'Mira', status: 'idle', equipment: slots, hp: { current: 100, max: 100 },
        skills: { mining: { level: 5, xp: 0 } }
    }];
    InventoryManager.addItem(GLOVES, 1);
    // A hero takes only work its Bank can pay for.
    InventoryManager.addItem(COAL, 50);
}

const h = React.createElement;
const mount = (props) => render(h(DndContext, null, h(TokenCard, props)));
const chips = (root) => [...root.querySelectorAll('[data-effect-badges] > [data-effect-badge]')].map(el => el.getAttribute('data-effect-badge'));
const hover = (el) => fireEvent.pointerEnter(el, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 });
const tipText = () => document.querySelector('[data-tooltip]')?.textContent || '';

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

describe('how a badge writes its number', () => {
    it('a percent is signed, a chance plain, a count signed; one decimal, no -0', () => {
        expect(effectAmountText(UNIT.PERCENT, 23.0000001)).toBe('+23%');
        expect(effectAmountText(UNIT.PERCENT, -10)).toBe('−10%');
        expect(effectAmountText(UNIT.CHANCE, 8)).toBe('8%');
        expect(effectAmountText(UNIT.CHANCE, -5)).toBe('−5%');
        expect(effectAmountText(UNIT.COUNT, 2)).toBe('+2');
        expect(effectAmountText(UNIT.PERCENT, 12.345)).toBe('+12.3%');
        expect(effectAmountText(UNIT.CHANCE, 0.04)).toBe('0.04%');
    });

    it('a held badge shows what counts, and its note says how much of the total that is', () => {
        const held = { key: EFFECT_KEY.SPEED, unit: UNIT.PERCENT, total: 95, counted: 80, held: true, limit: LIMIT.SPEED_FLOOR, sources: [] };
        expect(badgeText(held)).toBe('+80%');
        expect(limitNote(held)).toBe('Held at the limit: +80% of +95% counts');
        expect(limitNote({ ...held, held: false, limit: null })).toBeNull();
        for (const limit of Object.values(LIMIT)) expect(limitNote({ ...held, limit }), limit).not.toMatch(/effectBadges/);
    });

    it('every named effect has a placeholder icon that exists', () => {
        for (const key of Object.values(EFFECT_KEY)) {
            expect(EFFECT_GLYPH[key], key).toBeTruthy();
            expect(GLYPHS[EFFECT_GLYPH[key]], key).toBeDefined();
        }
    });
});

describe('the badge row', () => {
    it('a Token nothing boosts has no row; one boosted by two buildings has their badges in the list\'s order', () => {
        const plain = arrive(PLAIN);
        const a = mount({ typeId: PLAIN, instanceId: plain.id });
        expect(a.container.querySelector('[data-effect-badges]')).toBeNull();
        cleanup();
        clearMat();

        const vein = arrive(VEIN);
        arrive('bc_cart', NEAR);
        arrive('bc_lamp', NEAR2);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        const stats = container.querySelector('[data-card-block="stats"]');
        // Under the stats line, inside the stat block: Speed before XP, as UI_STYLE lists them.
        expect(stats.querySelector('[data-effect-badges]')).not.toBeNull();
        expect(chips(container)).toEqual([EFFECT_KEY.SPEED, EFFECT_KEY.XP]);
        const speed = effectBreakdown(vein.id).effects.find(b => b.key === EFFECT_KEY.SPEED);
        expect(container.querySelector('[data-effect-badge="speed"]').textContent).toBe(badgeText(speed));
        expect(badgeText(speed)).toBe('+20%');
    });

    it('the hover: one line per source with its amount, then the total', () => {
        const vein = arrive(VEIN);
        arrive('bc_cart', NEAR);
        arrive('bc_lamp', NEAR2);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        hover(container.querySelector('[data-effect-badge="speed"]'));
        const tip = document.querySelector('[data-badge-tip="speed"]');
        expect([...tip.querySelectorAll('[data-badge-tip-source]')].map(el => el.textContent)).toEqual([
            'Badge Cart nearby+15%', 'Badge Lamp nearby+5%'
        ]);
        expect(tip.querySelector('[data-badge-tip-total]').textContent).toBe('Total+20%');
        expect(tip.querySelector('[data-badge-tip-limit]')).toBeNull();
        expect(tipText()).toContain('Speed');
    });

    it('held at the limit: the number is gold and the hover says how much counts', () => {
        const vein = arrive(VEIN);
        arrive('bc_rush', NEAR);
        arrive('bc_lamp', NEAR2);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        const chip = container.querySelector('[data-effect-badge="speed"]');
        expect(chip.getAttribute('data-effect-badge-held')).toBe('true');
        expect(chip.querySelector('[data-effect-badge-amount]').style.color).toBe('var(--color-ui-gold)');
        expect(chip.textContent).toBe('+80%');
        hover(chip);
        expect(document.querySelector('[data-badge-tip-total]').textContent).toBe('Total+95%');
        expect(document.querySelector('[data-badge-tip-limit]').textContent).toBe('Held at the limit: +80% of +95% counts');
    });

    it('a hero with Speed gear working it: the total grows, the hover names the gear, the Hero Effects chip comes last', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('bc_cart', NEAR);
        expect(Orders.orderAt(HERO, AT).success).toBe(true);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        expect(chips(container)).toEqual([EFFECT_KEY.SPEED, EFFECT_KEY.XP, 'hero']);
        expect(container.querySelector('[data-effect-badge="speed"]').textContent).toBe('+20%');
        hover(container.querySelector('[data-effect-badge="speed"]'));
        expect(tipText()).toContain('Mira\'s Gloves');
        fireEvent.pointerLeave(container.querySelector('[data-effect-badge="speed"]'));
        hover(container.querySelector('[data-effect-badge="hero"]'));
        const tip = document.querySelector('[data-badge-tip="hero"]');
        expect(tipText()).toContain('Hero Effects');
        expect(tip.textContent).toContain('What Mira has that works here');
        expect([...tip.querySelectorAll('[data-badge-tip-source]')].map(el => el.textContent)).toEqual(['Mira\'s GlovesSpeed +5%']);
    });

    it('the row follows the mat while the card is open: a building placed adds its badge', () => {
        vi.useFakeTimers();
        try {
            const vein = arrive(VEIN);
            const { container } = mount({ typeId: VEIN, instanceId: vein.id });
            expect(container.querySelector('[data-effect-badges]')).toBeNull();
            arrive('bc_lamp', NEAR);
            act(() => { vi.advanceTimersByTime(1100); });
            expect(chips(container)).toEqual([EFFECT_KEY.SPEED]);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('item badges, Rare finds and the Needs cost', () => {
    it('Double Item on the Makes line, Efficiency on the Needs line, the Needs at the cost a cycle can take', () => {
        const vein = arrive(VEIN);
        arrive('bc_mine', NEAR);
        InventoryManager.addItem(COAL, 9);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        const makes = container.querySelector('[data-card-block="makes"]');
        expect(makes.querySelector(`[data-effect-badge="doubleItem"][data-effect-badge-item="${ORE}"]`).textContent).toBe('8%');
        const needs = container.querySelector('[data-card-needs]');
        expect(needs.querySelector(`[data-effect-badge="efficiency"][data-effect-badge-item="${COAL}"]`).textContent).toBe('+12%');
        // 10 Coal at -12 % is 8.8: a cycle can take 9, and the Bank's 9 is enough.
        expect(exactInputQuantity(vein.id, 10, 'mining')).toBeCloseTo(8.8);
        expect(needs.textContent).toContain('9/9');
        expect(needs.querySelector('[data-item-bar]').className).not.toMatch(/danger/);
        expect(tokenCardModel(VEIN, vein.id).blocks.find(b => b.id === CARD_BLOCK.RECIPE).needs).toEqual([{ itemId: COAL, need: 9, have: 9 }]);
        // Off the mat (the Encyclopedia), the recipe's own cost.
        expect(tokenCardModel(VEIN).blocks.find(b => b.id === CARD_BLOCK.RECIPE).needs[0].need).toBe(10);
    });

    it('Rare finds: its chance with Lucky, the Lucky chip on its heading and in the row; a click opens the list, another shuts it', () => {
        const vein = arrive(VEIN);
        arrive('bc_mine', NEAR);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        expect(chips(container)).toContain(EFFECT_KEY.LUCKY);
        const group = container.querySelector('[data-card-rare]');
        expect(group.closest('[data-card-block="drops"]')).not.toBeNull();
        expect(group.getAttribute('data-card-rare')).toBe('shut');
        // 2 % at +25 %.
        expect(group.querySelector('[data-card-rare-chance]').textContent).toBe('2.5%');
        expect(group.querySelector('[data-effect-badge="lucky"]').textContent).toBe('+25%');
        expect(group.querySelector('[data-card-rare-list]')).toBeNull();
        fireEvent.click(group.querySelector('[data-card-rare-toggle]'));
        expect(group.getAttribute('data-card-rare')).toBe('open');
        expect(group.querySelector('[data-card-rare-list]').textContent).toContain('Badge Gem');
        expect(group.querySelector('[data-card-rare-list]').textContent).toContain('2.5%');
        fireEvent.click(group.querySelector('[data-card-rare-toggle]'));
        expect(group.querySelector('[data-card-rare-list]')).toBeNull();
        // The rare finds left Makes for their own group.
        expect(container.querySelector('[data-card-block="makes"]').textContent).not.toContain('Badge Gem');
    });

    it('"Boosted by" has left the card; a building\'s own Boosts list stays', () => {
        const vein = arrive(VEIN);
        const cart = arrive('bc_cart', NEAR);
        const a = mount({ typeId: VEIN, instanceId: vein.id });
        expect(a.container.textContent).not.toContain('Boosted by');
        expect(a.container.querySelector('[data-card-block="support"]')).toBeNull();
        cleanup();
        const b = mount({ typeId: 'bc_cart', instanceId: cart.id });
        expect(b.container.querySelector('[data-card-boosts]').textContent).toContain('Badge Vein');
    });
});

describe('the tip and the chip agree with the breakdown', () => {
    it('each chip\'s number and hover total are the breakdown\'s', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('bc_cart', NEAR);
        arrive('bc_mine', NEAR2);
        arrive('bc_lamp', NEAR3);
        Orders.orderAt(HERO, AT);
        const out = effectBreakdown(vein.id);
        const { container } = mount({ typeId: VEIN, instanceId: vein.id });
        for (const badge of out.effects) {
            const chip = container.querySelector(`[data-effect-badges] > [data-effect-badge="${badge.key}"]`);
            expect(chip.textContent, badge.key).toBe(badgeText(badge));
            expect(badgeTip(badge).total.amount, badge.key).toBe(effectAmountText(badge.unit, badge.total));
        }
    });
});
