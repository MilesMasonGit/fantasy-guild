// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { giantHarvest } from '../systems/board/EffectFeedback.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Giant Harvest on screen (brief 620 E1): the small celebration on the mat over the Token (a gold
 * burst and a "Giant!" float, from the mat's effects layer), and its chip in the Token card's badge
 * row like the other effects.
 */

const ORE = 'ghfx_ore';
registerItems({
    [ORE]: { id: ORE, name: 'GHFX Ore', type: 'material', sprite: 'i_wheat', description: '', tags: [], stackable: true, equipSlot: '', value: 1 }
});
registerTokenTypes({
    ghfx_vein: {
        id: 'ghfx_vein', name: 'GHFX Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 10, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

/** Every `animate` call, recorded; each returns a stand-in that can be finished. */
function recordAnimate() {
    const calls = [];
    const proto = window.Element.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
    const original = proto.animate;
    proto.animate = function animate(keyframes, options) {
        const a = { el: this, keyframes, options, onfinish: null, oncancel: null, cancel: vi.fn(), finish() { this.onfinish?.(); } };
        calls.push(a);
        return a;
    };
    return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
}

describe('the celebration on the mat', () => {
    let rec;
    let host;
    let unwatch;
    beforeEach(() => {
        rec = recordAnimate();
        GameState.initNew();
        clearMat();
        host = document.createElement('div');
        document.body.appendChild(host);
        MatFx.attachFxHost(host, 2);
        unwatch = MatFx.watchMatFx();
    });
    afterEach(() => {
        unwatch();
        MatFx.attachFxHost(null);
        rec.restore();
        setDrawingPaused(false);
        document.body.innerHTML = '';
    });

    it('a hit bursts eight gold sparks out from the Token and floats a gold "Giant!" off its top', () => {
        const vein = placeAt('ghfx_vein', 500, 500);
        giantHarvest(vein.id);
        const sparks = rec.calls.filter(c => c.el.tagName === 'SPAN');
        const float = rec.calls.find(c => c.el.getAttribute?.('data-fx-number'));
        expect(sparks).toHaveLength(8);
        expect(float.el.textContent).toBe('Giant!');
        expect(float.el.getAttribute('data-fx-number')).toBe('giant');
        expect(float.el.className).toContain('gi-fx-number-giant');
        // Over the Token's top.
        expect(float.el.style.top).toBe(`${500 - artRadiusOf('ghfx_vein')}px`);
        // Each spark: two art pixels, centred on the Token, out in whole art-pixel steps and gone.
        const up = sparks[0];
        expect(up.el.style.width).toBe('4px');
        expect(up.el.style.left).toBe('498px');
        expect(up.el.style.top).toBe('498px');
        const steps = MatFx.burstReach(artRadiusOf('ghfx_vein') / 2);
        expect(up.keyframes.slice(0, MatFx.BURST_STEPS).map(k => k.transform)).toEqual(steps.map(d => `translate(0px, ${-d * 2}px)`));
        expect(up.keyframes.at(-1).visibility).toBe('hidden');
        // The reach runs from inside the art to past its edge.
        expect(steps[0]).toBeLessThan(artRadiusOf('ghfx_vein') / 2);
        expect(steps.at(-1)).toBeGreaterThan(artRadiusOf('ghfx_vein') / 2);
    });

    it('says no name over the Token and draws no "+N": the drops show what came in', () => {
        const vein = placeAt('ghfx_vein', 500, 500);
        giantHarvest(vein.id);
        expect([...host.querySelectorAll('[data-fx-number]')].map(el => el.textContent)).toEqual(['Giant!']);
    });

    it('draws nothing while drawing is paused (a hidden window)', () => {
        const vein = placeAt('ghfx_vein', 500, 500);
        setDrawingPaused(true);
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: vein.id, giant: true });
        expect(rec.calls).toHaveLength(0);
        expect(host.children).toHaveLength(0);
    });
});

describe('the chip on the Token card', () => {
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
    });

    it('a guild-wide Giant Harvest shows its chip with its chance, and its hover names the source', () => {
        getGlobalAggregator().addModifier({ source: 'guild:ghfx', type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value: 3 });
        const vein = placeAt('ghfx_vein', 800, 500);
        TileModifiers.rebuildAround([vein]);
        const h = React.createElement;
        const { container } = render(h(DndContext, null, h(TokenCard, { typeId: 'ghfx_vein', instanceId: vein.id })));
        const chip = container.querySelector('[data-effect-badges] > [data-effect-badge="giantHarvest"]');
        expect(chip).not.toBeNull();
        expect(chip.textContent).toBe('3%');
        expect(chip.querySelector('svg[data-glyph="ten"]')).not.toBeNull();
        fireEvent.pointerEnter(chip, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 });
        const tip = document.querySelector('[data-badge-tip="giantHarvest"]');
        expect(tip.textContent).toContain('The guild');
        expect(document.querySelector('[data-tooltip]').textContent).toContain('Giant Harvest');
    });
});
