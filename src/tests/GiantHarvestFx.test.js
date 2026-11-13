// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
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
 * burst and a "Giant!" float, from the mat's effects layer). The Token card shows no chip for it
 * (owner, 2026-11-12): the celebration says it.
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

    it('a hit bursts eight gold stars out from the Token and floats a gold "Giant!" off its top', () => {
        const vein = placeAt('ghfx_vein', 500, 500);
        giantHarvest(vein.id);
        const stars = rec.calls.filter(c => c.el.getAttribute?.('data-fx-burst') === 'giant');
        const float = rec.calls.find(c => c.el.getAttribute?.('data-fx-number'));
        expect(stars).toHaveLength(8);
        expect(float.el.textContent).toBe('Giant!');
        expect(float.el.getAttribute('data-fx-number')).toBe('giant');
        expect(float.el.className).toContain('gi-fx-number-giant');
        // Over the Token's top.
        expect(float.el.style.top).toBe(`${500 - artRadiusOf('ghfx_vein')}px`);
        // Each star: the twinkle's five-pixel plus in gold over a black one a pixel wider, from the
        // Token's middle, out in whole art-pixel steps, a twinkle where it stops, and gone.
        const up = stars[0];
        expect(up.el.style.left).toBe('500px');
        expect(up.el.style.top).toBe('500px');
        expect([...up.el.children].map(b => [b.style.width, b.style.height, b.style.background])).toEqual([
            ['14px', '6px', 'rgb(0, 0, 0)'], ['6px', '14px', 'rgb(0, 0, 0)'],
            ['10px', '2px', 'var(--color-ui-gold)'], ['2px', '10px', 'var(--color-ui-gold)']
        ]);
        const steps = MatFx.burstReach(artRadiusOf('ghfx_vein') / 2);
        expect(up.keyframes.slice(0, MatFx.BURST_STEPS).map(k => k.transform)).toEqual(steps.map(d => `translate(0px, ${-d * 2}px)`));
        expect(up.keyframes.slice(MatFx.BURST_STEPS).map(k => k.visibility)).toEqual(['hidden', 'visible', 'hidden']);
        // A diagonal star stops as far out as a straight one.
        const diagonal = stars[1].keyframes[MatFx.BURST_STEPS - 1].transform.match(/-?\d+/g).map(Number);
        expect(Math.hypot(diagonal[0], diagonal[1]) / 2).toBeCloseTo(steps.at(-1), 0);
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

describe('no chip on the Token card', () => {
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

    it('a guild-wide Giant Harvest shows no chip, beside a Double Loot chip that does show', () => {
        getGlobalAggregator().addModifier({ source: 'guild:ghfx', type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value: 3 });
        getGlobalAggregator().addModifier({ source: 'guild:ghfx_loot', type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 4 });
        const vein = placeAt('ghfx_vein', 800, 500);
        TileModifiers.rebuildAround([vein]);
        const h = React.createElement;
        const { container } = render(h(DndContext, null, h(TokenCard, { typeId: 'ghfx_vein', instanceId: vein.id })));
        expect(container.querySelector('[data-effect-badges] > [data-effect-badge="doubleLoot"]')).not.toBeNull();
        expect(container.querySelector('[data-effect-badge="giantHarvest"]')).toBeNull();
        expect(container.textContent).not.toContain('Giant Harvest');
    });
});
